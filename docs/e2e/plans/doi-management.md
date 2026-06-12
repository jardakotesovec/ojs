# DOI management

- **Area:** 7. Plugins (key set)
- **Placement:** ojs
- **Budget:** 9 tests
- **Absorbs:** playwright/tests/doi-assignment.spec.js (3 tests)
- **Scenario needs:** journal scenario DOI passthroughs (`enableDois`, `doiPrefix`, `doiVersioning`, `enabledDoiTypes`) + `issues` — all existing; `submission-published` fixture (publicknowledge and scratch via `journal` override). Bootstrap enrichment keeps DOIs ON with auto-assign in publicknowledge, so display/management rows ride the shared journal with per-test submissions. One-off settings states (doiCreationTime=never, suffix pattern) are set through the Distribution → DOIs settings UI on scratch journals — no new passthrough needed.
- **Round 2 / out of scope:**
  - Registration-agency deposit flows and agency-specific statuses — owned by the crossref-deposit plan.
  - DataCite / URN plugins — round-2 backlog per inventory.
  - Marked-status error-toast wording for invalid state transitions — unit-test territory (recorded when doi-assignment.spec.js was written).
  - Galley (representation) and peer-review DOI types — rarely enabled; publication + issue types cover the management surface.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Auto-assigned DOI on publish renders on the article landing page | dbarnes, anonymous | journal scenario (DOI passthroughs) + submission-published | Published publication carries `doiObject.doi` under the configured prefix; anonymous article page renders the DOI in `section.item.doi` | implemented (playwright/tests/doi-assignment.spec.js) |
| 2 | New major version receives its own DOI when versioning is enabled | dbarnes | journal scenario (`doiVersioning`) + submission-published with v2 publication | v1 and v2 publications carry distinct DOIs under the prefix | implemented (playwright/tests/doi-assignment.spec.js) |
| 3 | Manager configures DOI settings via the UI and they persist | dbarnes | journal scenario (scratch, DOIs off) | Distribution → DOIs: enable + per-type toggles + prefix + creation time survive reload | implemented (playwright/tests/doi-assignment.spec.js) |
| 4 | DOI management page lists submission DOIs with status badges and filters | dbarnes | submission-published on publicknowledge (bootstrap auto-assign mints DOI) | /dois renders the submission DoiListPanel; per-test submission found via search; item shows its DOI + Unregistered badge. Filter assertions are tag-scoped: the tagged item appears under its expected status filter (Unregistered / "DOI assigned") and is absent under one other filter (e.g. Registered). NEVER assert whole-list composition — parallel tests mint DOIs into the same shared /dois list. | implemented (playwright/tests/doi-management.spec.js) |
| 5 | Manager transitions DOI status via bulk actions | dbarnes | submission-published on publicknowledge | Select the per-test item; bulk Mark Registered flips the badge to Registered; Mark Stale shows the "Needs Sync" badge (stale is only reachable from Submitted/Registered — `markSubmissionsStale` filterByDoiStatuses); Mark Unregistered reverts to Unregistered — each transition reflected without reload in the list item | implemented (playwright/tests/doi-management.spec.js) |
| 6 | Manager assigns DOIs manually from the management page | dbarnes | journal scenario (scratch, DOI passthroughs) + submission-published; doiCreationTime=never via UI | With automatic assignment off, the published item appears under the "Needs DOI" filter; bulk "Assign DOIs" mints a DOI under the configured prefix and the item shows it | implemented (playwright/tests/doi-management.spec.js) |
| 7 | Editor edits a DOI to a custom suffix and it propagates to the reader page | dbarnes, anonymous | submission-published on publicknowledge | Expanding the list item exposes the editable DOI field; saving a tag-unique custom suffix persists, and the article landing page DOI section shows the edited DOI | implemented (playwright/tests/doi-management.spec.js) |
| 8 | Issue DOIs: assign and display | dbarnes, anonymous | journal scenario (scratch, `enabledDoiTypes: [publication, issue]`, published issue) | /dois shows the Issues tab (issueDoiListPanel); bulk-assigning the issue's DOI mints it; the anonymous issue TOC page renders the DOI link (issue_toc.tpl `.pub_id.doi`) | implemented (playwright/tests/doi-management.spec.js) |
| 9 | Custom suffix pattern drives newly minted DOIs | dbarnes | journal scenario (scratch, DOI passthroughs); suffix pattern via UI | Distribution → DOIs: choosing `doiSuffixType` = custom pattern reveals the pattern fields; after saving a pattern, a newly seeded published submission's DOI matches the pattern shape (e.g. contains the journal initials/volume tokens) | implemented (playwright/tests/doi-management.spec.js) |
