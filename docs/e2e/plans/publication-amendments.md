# Publication amendments (Summary of Changes + update type)

- **Area:** 3. Publishing & issues
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** none (feature landed May 2026, commit eb14c0b9d3 — no legacy coverage)
- **Scenario needs:** publication-side `updateType` + `summaryOfChanges` are plain
  publication metadata → seedable TODAY via `publications[].metadata` passthrough
  (schema allows additional props). Revision-file-side `summaryOfChanges` follows the
  review-rounds-revisions verdict: UI fallback (author metadata form / saveMetadata is the
  canonical path and is itself row 1's behavior under test); revisit only if more plans
  need seeded amended revisions.
- **Round 2 / out of scope:**
  - Public display of the amendment notice/update type — NOT yet implemented in the front
    end (verified: article_details.tpl renders neither); add reader rows when it lands.
  - OPS behavior (no review stage → no amendment fields) — different app.
  - Crossref/JATS export of update types (depends on export surfaces; revisit with
    crossref-deposit round 2).

Feature map (verified): submissionFile.json `summaryOfChanges` (single-value, revision
file stages only; form via useFileMetadataForm.js:106), publication.json multilingual
`summaryOfChanges` + `updateType` enum (12 values, default new_version; migration I12584),
InsertSummaryOfChangesModal + useInsertSummaryOfChangesContent (Insert Content button,
submission locale only), useWorkflowVersionForm (Schedule-for-Publication: updateType
required + summary fields), IssueEntryForm GROUP_VERSION_AND_UPDATES, "Amendment Notice"
badge in FileManagerCellType when a revision file carries a summary.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Author submits revision with a Summary of Changes; badge appears | atester, dbarnes | submission scenario: in review, requestRevisions decision; revision upload via UI | The revision upload's metadata form offers the single-value "Summary of Changes (Amendment Notice)" rich-text field; after save the file row shows the Amendment Notice badge; a second revision uploaded without a summary shows no badge | planned |
| 2 | Editor inserts a revision's summary into the publication | dbarnes | row-1 state (revision file carrying a summary, assoc'd to its round) | Publication form's Summary of Changes field shows the Insert Content button (submission locale only); the modal lists the revision file with its round label + date; inserting appends the file's HTML (markup preserved) into the field and it persists | planned |
| 3 | Schedule for Publication carries update type + summary | dbarnes | submission scenario: production-ready, issue-assignable | The version form in the Schedule for Publication flow shows Update Type as a required select (default "New version"; 12 enum options) and the multilingual Summary of Changes; chosen values persist onto the published publication (REST round-trip) | planned |
| 4 | Update type across versions: default then correction | dbarnes | published publication (v1) | v1 publishes with default new_version; Create New Version → schedule with updateType=correction + a summary → republish; v2 carries correction + summary while v1 is untouched (versioning interaction) | planned |
| 5 | Insert modal empty state; manual entry still works | dbarnes | submission scenario: accepted without any review revisions | Insert Content modal shows its empty state when no revision files exist; the editor types a summary manually and it saves | planned |
| 6 | Insert fills only the submission locale | dbarnes | row-1 state on a bilingual journal (en submission) | After insert, summaryOfChanges[en] holds the content while fr_CA remains empty (single-value file summary → per-locale publication field; no cross-locale autofill) | planned |
