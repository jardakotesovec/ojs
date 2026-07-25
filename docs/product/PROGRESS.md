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

**Current mode: AUTONOMOUS WAVES (maintainer flipped 2026-07-11 after the dress
rehearsal passed).** Rules in RUNBOOK ("Autonomous waves"): one full per-feature
loop per iteration, selection = first `pending` row in table order, wave = 7
features between maintainer samplings. **Current maintainer directive (updated 2026-07-21): work through Area 2
(rows 6–22, skipping already-done rows 11 and 19) in table order, ONE FEATURE
PER FRESH SESSION — a permanent preference now, not just flip mitigation; no
multi-feature /loop. Each session builds or resumes exactly ONE feature through
commit, then STOPS. Model policy revised 2026-07-21 (RUNBOOK Model discipline):
flipped AUTHORING output is discarded + respawned; verification/probe flips
stay kept. Wave rule unchanged: at 7 features since last sampling, stop for
sampling review instead.**
Wave counter: 6 features since last sampling (editorial-dashboards +
workflow-stage-navigation 2026-07-16 + editorial-decisions rebuilt-from-scratch
2026-07-21 + stage-participants 2026-07-22 + send-to-review 2026-07-24 +
reviewer-response 2026-07-25; Area 1 sampled and approved 2026-07-14;
findings-to-files protocol in force since — see RUNBOOK). **reviewer-response was
the Opus 5 single-arm trial (`docs/product/OPUS5-EVAL-PLAN.md`) — it awaits the
maintainer's trial review, which he may treat as this wave's sampling; his
outcome decision (sign-off / hybrid / stay-on-Fable) governs whether the next
feature keeps `model: opus` subagents.**

## Totals

- Features: **1 reference · 12 verified · 79 pending** (of 92; feature 39 folded into `article-landing`)
- Tests: **102 / 700** (tasks-discussions 6 + submission-wizard 12 + submission-wizard-metadata 8 + reviewer-suggestions 7 + submission-drafts 6 + author-dashboard 6 + editorial-dashboards 10 + workflow-stage-navigation 6 + editorial-decisions 13 + stage-participants 9 + send-to-review 7 + reviewer-response 12) · last full-suite timing: n/a since reset
- Budget tiers (maintainer-rebalanced 2026-07-02): H 10–13 · M 6–8 · L 3–4; allocation ≈ 639, headroom ~61

## Features

| # | Area | Feature | Budget | Spec | Tests | Note |
|---|------|---------|--------|------|-------|------|
| 1 | Area 1 — Author submission & intake | `submission-wizard` | H·12 | verified | green(x2) | dress rehearsal: 12 tests, 26 atoms, ledger rows 164–178; 1 verifier chunk all-opus (kept per policy); maintainer signed off 2026-07-11 |
| 2 | Area 1 — Author submission & intake | `submission-wizard-metadata` | M·7 | verified | green(x2) | wave 1: 8 tests, 9 atoms, ledger rows 179–183 (2 confirmed defects: vocab journal-scoping, data-citations require); all 15 subagents fable-clean |
| 3 | Area 1 — Author submission & intake | `reviewer-suggestions` | M·6 | verified | green(x2) | wave 2: 7 tests (lib/pkp), 10 atoms, ledger rows 184–191; probe-vs-test RS-A conflict settled by arbitration chunk (probe artifact); 2 subagents flipped (kept per policy) |
| 4 | Area 1 — Author submission & intake | `submission-drafts` | M·6 | verified | green(x2) | wave 3: 6 tests (lib/pkp), 7 atoms, ledger rows 192–194 + row-167 amended (arbitration overturned a test-author premise); atlas transfers applied; all 16 subagents fable-clean |
| 5 | Area 1 — Author submission & intake | `author-dashboard` | M·6 | verified | green(x2) | wave 4: 6 tests (lib/pkp), 5 atoms, ledger rows 195–203 (headline: multi-role revisions-view scoping 202, dead published-block 198, upload-revisions gate bug 199); 2 subagents flipped (kept per policy) |
| 6 | Area 2 — Editorial workflow & peer review | `editorial-dashboards` | H·10 | verified | green(x2) | wave 5: 10 tests (lib/pkp), 16 atoms, ledger rows 204–210 + rows 2/204 amended (headline: hybrid admin review-view scope leak 208, anonymous bare-address 500 209, non-VoR scheduled invisibility 210); 1 verify chunk all-opus + 1 arbitration probe flipped (kept per policy); harness defect flagged: participants[] seeds lack group membership |
| 7 | Area 2 — Editorial workflow & peer review | `workflow-stage-navigation` | M·6 | verified | green(x2) | wave 6: 6 tests (lib/pkp) + new WorkflowShellPage POM, 12 atoms, ledger rows 211–213 + 211 addendum (headline: manager-as-reviewer UI/server split 211, selectable parent Review entry bug 213); all 4 verify chunks PASS; all 13 subagents fable-clean; pointer-brief protocol applied |
| 8 | Area 2 — Editorial workflow & peer review | `editorial-decisions` | H·13 | verified | green(x2) | wave 7 rebuild (2026-07-21): 13 tests (lib/pkp) + new DecisionWizardPage POM, 43 atoms, ledger rows 220–228 (rows 214–219 + row-10 re-reproduced, untouched); ALL subagents fable-clean incl. authoring (rebuild directive satisfied, zero respawns); 4 atlas Hint fixes applied |
| 9 | Area 2 — Editorial workflow & peer review | `stage-participants` | M·8 | verified | green(x2) | tests-only rebuild (2026-07-22): EXPERIMENT POSITIVE — monolithic test-author fable-clean (276 msgs, zero flips) on the rule-5-swept spec vs 2 flips on unswept wave-8 wording; 9 tests, rubric 4.5/5 (= split-protocol clean score); no new ledger rows (229–234 stand); s1 toast-race flake fixed (expectToast); spec quote-case fix ("Awaiting Copyedits.") |
| 10 | Area 2 — Editorial workflow & peer review | `send-to-review` | M·7 | verified | green(x2) | wave 8 (2026-07-24, finished by fresh session after double flag-kill — gates resumed from files): 7 tests, chunks a–f PASS, ledger 220/234 amended + 235–236 filed, OQ4 added, readability s5 status-note fix; 3 verify/probe flips (kept per policy); infra: `workflow-controls-right` data-cy hook gone from DOM (POM + skill app-map cite it) |
| 11 | Area 2 — Editorial workflow & peer review | `assign-and-manage-reviewers` | H·12 | verified | green(x2) | calibration f1: 13 tests, 33 atoms, 5 proposed ledger rows; maintainer signed off 2026-07-10 (scenario rewording applied) |
| 12 | Area 2 — Editorial workflow & peer review | `reviewer-response` | H·10 | verified | green(x2) | OPUS5 TRIAL (all 21 subagents pinned opus, all-opus by intent): 12 tests, 25 atoms, ledger 237–250 + 251–253 cross-feature, rows 16/76/77/78 amended (16 re-diagnosed), OQ 1–14; LOW-CONFIDENCE FLAG for the maintainer's trial review — the code-blind readability pass found 8 of 12 scenarios unwalkable as first written (all rewritten), and 3 authored claims needed live probes to overturn |
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
`awk -F'|' '/^\| 20[0-9][0-9]-/{c=$4; n[c]++; if($9!~/clean/) f[c]++} END{for(k in n) printf "%s: %d/%d flipped\n", k, f[k], n[k]}' docs/product/PROGRESS.md`

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
| 2026-07-11 | submission-wizard-metadata | authoring | spec-author | 99 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | probe | probe-settings-defaults | 71 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | probe | probe-wizard-matrix | 86 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | probe | probe-vocab-leak | 114 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | probe | probe-submit-enforcement | 89 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | probe | probe-workflow-surfaces | 112 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | authoring | spec-finalizer | 71 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | authoring | test-author | 107 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | verification | verify-atlas-coverage | 28 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | verification | verify-permissions-code | 33 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | verification | verify-deviation-repro | 24 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | verification | verify-positive-controls | 26 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | verification | verify-denial-probes | 29 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | verification | verify-state-edges | 31 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | authoring | verification-merge | 21 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | authoring | readability-verifier | 5 | 0 | 0 | clean |
| 2026-07-11 | submission-wizard-metadata | authoring | readability-fix | 44 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | authoring | spec-author | 100 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | probe | probe-wizard-step | 66 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | probe | probe-assignment-flows | 68 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | probe | probe-editor-surfaces | 79 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | probe | probe-freeze-roles | 63 | 33 | 0 | FLIPPED@64/96 |
| 2026-07-11 | reviewer-suggestions | authoring | spec-finalizer | 15 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | authoring | test-author | 124 | 18 | 0 | FLIPPED@125/142 |
| 2026-07-11 | reviewer-suggestions | verification | verify-atlas-coverage | 23 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | verification | verify-rsa-arbitration | 27 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | verification | verify-positive-controls | 33 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | verification | verify-code-rederivation | 52 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | verification | verify-state-edges | 45 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | verification | verify-denial-probes | 50 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | authoring | verification-merge | 48 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | authoring | readability-verifier | 4 | 0 | 0 | clean |
| 2026-07-11 | reviewer-suggestions | authoring | readability-fix | 91 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | authoring | spec-author | 110 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | probe | probe-listing-surfaces | 70 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | probe | probe-savelater-email | 86 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | probe | probe-deletion-gates | 87 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | authoring | spec-finalizer | 63 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | authoring | test-author | 92 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | verification | verify-atlas-coverage | 25 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | verification | verify-code-rederivation | 58 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | verification | verify-denial-probes | 62 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | verification | verify-positive-controls | 68 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | verification | verify-needs-editor-arbitration | 61 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | authoring | test-author-s5fix | 105 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | authoring | verification-merge | 87 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | authoring | readability-verifier | 4 | 0 | 0 | clean |
| 2026-07-11 | submission-drafts | authoring | readability-fix | 59 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | authoring | spec-author | 109 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | probe | probe-access-nav-legacy | 65 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | probe | probe-editability-emails | 111 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | probe | probe-list-surfaces | 125 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | probe | probe-tracking-view | 152 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | authoring | spec-finalizer | 81 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | authoring | test-author | 138 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | verification | verify-atlas-coverage | 21 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | verification | verify-denial-probes | 18 | 5 | 0 | FLIPPED@19/23 |
| 2026-07-11 | author-dashboard | verification | verify-code-rederivation | 60 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | verification | verify-positive-controls | 76 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | verification | verify-state-edges | 53 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | verification | verify-adh-add-arbitration | 34 | 35 | 0 | FLIPPED@35/69 |
| 2026-07-11 | author-dashboard | authoring | verification-merge | 108 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | authoring | readability-verifier | 4 | 0 | 0 | clean |
| 2026-07-11 | author-dashboard | authoring | readability-fix | 68 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | authoring | spec-author | 131 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | probe | probe-access-landing | 61 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | probe | probe-reviewer-surface | 91 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | probe | probe-search-deeplink | 115 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | probe | probe-views-counts | 185 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | authoring | spec-finalizer | 71 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | authoring | test-author | 98 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | verification | verify-atlas-coverage | 25 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | verification | verify-denial-probes | 0 | 55 | 0 | all-opus |
| 2026-07-16 | editorial-dashboards | verification | verify-permissions-code | 61 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | verification | verify-positive-controls | 39 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | probe | verify-d2d4-arbitration | 48 | 20 | 0 | FLIPPED@49/68 |
| 2026-07-16 | editorial-dashboards | verification | verify-state-edges | 181 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | authoring | verification-merge | 75 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | authoring | readability-verifier | 8 | 0 | 0 | clean |
| 2026-07-16 | editorial-dashboards | authoring | readability-fix | 38 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | authoring | spec-author | 82 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | probe | probe-groupB | 77 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | probe | probe-groupA | 78 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | probe | probe-groupC | 112 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | authoring | spec-finalizer | 71 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | authoring | test-author | 98 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | authoring | spec-fix-wording | 26 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | verification | verify-chunk-a | 40 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | verification | verify-chunk-b | 38 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | verification | verify-chunk-f | 28 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | verification | verify-chunk-c | 72 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | authoring | verification-merge | 38 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | authoring | readability-verifier | 6 | 0 | 0 | clean |
| 2026-07-16 | workflow-stage-navigation | authoring | readability-fix | 21 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | authoring | spec-author | 83 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | probe | probe-groupA | 97 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | probe | probe-groupB | 173 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | probe | probe-groupD | 134 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | probe | probe-groupC | 174 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | authoring | spec-finalizer | 86 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | authoring | test-author | 121 | 111 | 0 | FLIPPED@122/232 |
| 2026-07-16 | editorial-decisions | verification | verify-chunk-f | 41 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | verification | verify-chunk-a | 45 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | verification | verify-chunk-b | 40 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | verification | verify-chunk-d | 68 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | verification | verify-s12-arbitration | 125 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | verification | verify-chunk-e | 82 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | verification | verify-chunk-c | 67 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | authoring | verification-merge | 71 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | authoring | readability-verifier | 7 | 0 | 0 | clean |
| 2026-07-16 | editorial-decisions | authoring | readability-fix | 30 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | authoring | spec-author | 99 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | probe | probe-batchD | 106 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | probe | probe-batchA | 82 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | probe | probe-batchC | 157 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | probe | probe-batchB | 174 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | authoring | spec-finalizer | 108 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | authoring | test-author | 348 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | verification | verify-chunk-f | 35 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | verification | verify-chunk-a | 49 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | verification | verify-chunk-b | 45 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | verification | verify-chunk-c | 48 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | verification | verify-chunk-d | 53 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | verification | verify-chunk-e | 106 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | probe | probe-a-edges | 88 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | authoring | verification-merge | 53 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | authoring | readability-verifier | 7 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | authoring | readability-fix | 38 | 0 | 0 | clean |
| 2026-07-21 | editorial-decisions | authoring | ledger-stamp | 23 | 0 | 0 | clean |
| 2026-07-21 | ledger-audit | verification | era-audit | 60 | 0 | 0 | clean |
| 2026-07-21 | ledger-audit | authoring | apply-markings | 32 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | spec-author | 77 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | probe | probe-batchB | 97 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | probe | probe-batchC | 150 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | probe | probe-batchA | 112 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | probe | probe-batchD | 228 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | spec-finalizer | 77 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | test-author-discarded | 25 | 205 | 0 | FLIPPED@26/230 |
| 2026-07-21 | stage-participants | verification | verify-chunk-f | 29 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | verification | verify-chunk-a | 48 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | test-author-discarded-2 | 18 | 66 | 0 | FLIPPED@19/84 |
| 2026-07-21 | stage-participants | authoring | test-scaffold | 57 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | test-author-s1 | 44 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | test-author-s2 | 65 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | test-author-s3 | 52 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | test-author-s4 | 45 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | test-author-s5 | 41 | 0 | 0 | clean |
| 2026-07-21 | stage-participants | authoring | test-author-s6 | 31 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | authoring | test-author-s7 | 83 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | authoring | test-author-s8 | 104 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | authoring | test-author-s9 | 53 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | authoring | test-harmonizer | 101 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | verification | verify-chunk-b | 41 | 17 | 0 | FLIPPED@42/58 |
| 2026-07-22 | stage-participants | verification | verify-chunk-c | 17 | 67 | 0 | FLIPPED@18/84 |
| 2026-07-22 | stage-participants | verification | verify-chunk-d | 81 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | verification | verify-chunk-e | 72 | 24 | 0 | FLIPPED@73/96 |
| 2026-07-22 | stage-participants | authoring | verification-merge | 102 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | authoring | readability-verifier | 6 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | authoring | readability-fix | 48 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | authoring | ledger-stamp | 68 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | authoring | test-author-mono | 234 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | authoring | test-author-mono-flakefix | 276 | 0 | 0 | clean |
| 2026-07-22 | stage-participants | verification | verify-rubric-clauses | 23 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | authoring | spec-author | 69 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | probe | probe-batchB | 55 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | probe | probe-batchC | 84 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | probe | probe-batchD | 80 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | probe | probe-batchA | 64 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | authoring | spec-finalizer | 57 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | authoring | test-author | 121 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | verification | verify-chunk-f | 28 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | verification | verify-chunk-a | 37 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | verification | verify-chunk-b | 39 | 16 | 0 | FLIPPED@40/55 |
| 2026-07-24 | send-to-review | verification | verify-chunk-e | 59 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | verification | verify-chunk-c | 18 | 50 | 0 | FLIPPED@19/68 |
| 2026-07-24 | send-to-review | verification | verify-chunk-d | 63 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | probe | probe-author-direct-delete | 4 | 69 | 0 | FLIPPED@5/73 |
| 2026-07-24 | send-to-review | authoring | verification-merge | 47 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | authoring | readability-verifier | 9 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | authoring | ledger-stamp | 27 | 0 | 0 | clean |
| 2026-07-24 | send-to-review | authoring | readability-fix | 26 | 0 | 0 | clean |
| 2026-07-25 | reviewer-response | authoring | spec-author-oe | 0 | 138 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | probe | probe-batchB-oe | 0 | 93 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | probe | probe-batchA-oe | 0 | 132 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | probe | probe-batchD-oe | 0 | 155 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | probe | probe-batchC-oe | 0 | 150 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | authoring | spec-finalizer-oe | 0 | 26 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | authoring | test-author-oe | 0 | 239 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | authoring | spec-fix-rule11-oe | 0 | 45 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | verification | verify-chunk-f-oe | 0 | 45 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | verification | verify-chunk-a-oe | 0 | 62 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | verification | verify-chunk-b-oe | 0 | 57 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | verification | verify-chunk-d-oe | 0 | 56 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | verification | verify-chunk-e-oe | 0 | 81 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | verification | verify-chunk-c-oe | 0 | 112 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | probe | probe-a-edges-oe | 0 | 115 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | authoring | verification-merge-oe | 0 | 88 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | authoring | readability-verifier-oe | 0 | 13 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | probe | probe-f1-reviewfiles-oe | 0 | 97 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | authoring | readability-fix-oe | 0 | 153 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | authoring | atlas-markers-oe | 0 | 66 | 0 | all-opus (pinned) |
| 2026-07-25 | reviewer-response | authoring | ledger-stamp-oe | 0 | 106 | 0 | all-opus (pinned) |
