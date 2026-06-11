# Native XML import/export

- **Area:** 8. System & communications
- **Placement:** ojs
- **Budget:** 5 tests
- **Absorbs:** playwright/tests/native-xml-submission.spec.js (1 test → row 1); playwright/tests/native-xml-issue.spec.js (2 tests → rows 2–3); playwright/tests/pubmed-metadata.spec.js (2 tests → row 5)
- **Scenario needs:** journal scenario with `issues: [...]` and `users` assignment; `submission-published` fixture with `journal` + `issue` overrides (every seeded submission carries the default Article Text file, so exports have real `<submission_file>` content). All met — no GAP.
- **Round 2 / out of scope:**
  - Users XML import/export plugin.
  - Byte-level fidelity diffing of files/galleys across the round-trip (rows assert metadata + presence, not binary equality).
  - Import error/conflict surfaces (duplicate issue collision, malformed XML messaging).
  - DOAJ/datacite/driver export plugins (round-2 backlog). PubMed is NOT deferred: pubmed-metadata.spec.js was previously orphaned (no plan owned it — an earlier revision here falsely claimed it was "mapped by its own area"); it is now absorbed as row 5.
  - OMP/OPS native-XML siblings — this plan is OJS-only by placement.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Submission export + reimport round-trips metadata | dbarnes | scenario: submission-published (publicknowledge) | Two-step JSON export (`exportSubmissions` → `downloadExportFile`) yields XML carrying the tagged title; reimport (`uploadImportXML` → `import`) creates a new submission with matching metadata, distinct id, original intact | implemented (playwright/tests/native-xml-submission.spec.js) |
| 2 | Issue export round-trips identifiers and the assigned article | dbarnes | scenario: scratch journal + published issue + submission-published (journal/issue override) | Exported issue XML carries volume/number/year and the embedded tagged article title | implemented (playwright/tests/native-xml-issue.spec.js) |
| 3 | Issue reimport into a fresh journal | dbarnes | scenario: two scratch journals (source w/ issue + submission; empty target) | Export from source, import into target → issue surfaces in target's `/api/v1/issues` with matching identifiers and the tagged submission rides along | implemented (playwright/tests/native-xml-issue.spec.js) |
| 4 | Manager drives the Native XML export through the Tools UI | dbarnes | scenario: submission-published (publicknowledge) | Tools → Import/Export → Native XML Plugin: exportable-submissions grid lists the seeded submission (search by tag); select → Export → Download Exported File fires a real browser download whose bytes contain the tagged title (covers the legacy grid/plupload UI path the API-driven rows bypass) | planned |
| 5 | PubMed export delivers MEDLINE XML to managers only | dbarnes, anonymous | scenario: submission-published (publicknowledge) | 2 tests: PubMedExportPlugin `exportSubmissions` returns `<ArticleSet>` XML carrying the journal ISSN (0378-5955) and the tagged `<ArticleTitle>` for the seeded submission; the same endpoint without a session is rejected (non-2xx, no PubMed XML in the body) | implemented (playwright/tests/pubmed-metadata.spec.js) |
