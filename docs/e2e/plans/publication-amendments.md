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
| 1 | Author submits revision with a Summary of Changes; badge appears | atester, dbarnes | submission scenario: in review, requestRevisions decision; revision upload via UI | The revision upload's metadata form offers the single-value "Summary of Changes (Amendment Notice)" rich-text field; after save the file row shows the Amendment Notice badge; a second revision uploaded without a summary shows no badge | implemented (lib/pkp/playwright/tests/publication-amendments.spec.js) |
| 2 | Editor inserts a revision's summary into the publication | dbarnes | row-1 state (revision file carrying a summary, assoc'd to its round) | Publication form's Summary of Changes field shows the Insert Content button (submission locale only); the modal lists the revision file with its round label + date; inserting appends the file's HTML (markup preserved) into the field and it persists | implemented (lib/pkp/playwright/tests/publication-amendments.spec.js) |
| 3 | Schedule for Publication carries update type + summary | dbarnes | submission scenario: production-ready, issue-assignable | The version form in the Schedule for Publication flow shows Update Type as a select defaulting to "New Version" with the 12 enum options (NOT flagged required — see note 2) and the multilingual Summary of Changes; chosen values persist onto the publication (REST round-trip) | implemented (lib/pkp/playwright/tests/publication-amendments.spec.js) |
| 4 | Update type across versions: default then correction | dbarnes | published publication (v1) | v1 publishes with default new_version; Create New Version → schedule with updateType=correction + a summary → republish; v2 carries correction + summary while v1 is untouched (versioning interaction) | implemented (lib/pkp/playwright/tests/publication-amendments.spec.js) |
| 5 | Insert modal empty state; manual entry still works | dbarnes | submission scenario: accepted without any review revisions | Insert Content modal shows its empty state when no revision files exist; the editor types a summary manually and it saves | implemented (lib/pkp/playwright/tests/publication-amendments.spec.js) |
| 6 | Insert fills only the submission locale | dbarnes | row-1 state on a bilingual journal (en submission) | After insert, summaryOfChanges[en] holds the content while fr_CA remains empty (single-value file summary → per-locale publication field; no cross-locale autofill) | implemented (lib/pkp/playwright/tests/publication-amendments.spec.js) |

## IMPLEMENTATION NOTES (wave 7)

1. **The "Scenario needs" claim about metadata passthrough is wrong.** The submission
   scenario schema does allow extra keys under `publications[].metadata`
   (`additionalProperties: true`), but `PublicationsProcessor::applyMetadataAndAttributes`
   filters them through the `METADATA_FIELDS` allowlist
   (lib/pkp/classes/testing/scenario/Processor/PublicationsProcessor.php:47-53), which
   includes neither `updateType` nor `summaryOfChanges` — unknown metadata is silently
   dropped. No row needed it (the DB column default `new_version` —
   classes/migration/install/OJSMigration.php:249 — covers "v1 defaults", everything else
   is UI-driven), so no Processor change was made. If a future plan needs seeded
   amendment metadata, extend the allowlist + add a parity-audit entry.
2. **Update Type is not actually a *required* select.** `useWorkflowVersionForm.js:333-339`
   adds the field without `isRequired` (unlike its `versionStage`/`versionIsMinor`
   siblings). It cannot be empty in practice — no blank option and the value defaults to
   `new_version` — so row 3 asserts the default + the 12 enum options instead of a
   required marker.
3. **Publication-side editing surfaces are two**: the Schedule-for-Publication version
   form (formId `version`, rows 3–4) and the Issue-entry / "Publication Settings" panel
   (formId `issueEntry`, rows 2/5/6, IssueEntryForm GROUP_VERSION_AND_UPDATES). On the
   Issue-entry form the embedded issue-assignment fields
   (useWorkflowPublicationFormIssue.js) preload the assignment radio to "current/back
   issue" with the required Issue select empty, so client-side validation blocks ANY save
   of the form — including a summary-only edit — until an issue is picked ("Issue: This
   field is required.", Save disabled). The tests satisfy it by selecting the seeded back
   issue. Note for the app-changes ledger: an editor cannot record an amendment notice
   from Publication Settings without simultaneously making an issue-assignment decision,
   and the save also PUTs the assignment-derived hidden `status`
   (useWorkflowPublicationFormIssue.js:126/154) onto the publication.
4. Insert-modal row label realities baked into row 2's assertions: items render
   "plain-text summary preview" + description "Review (Round 1) • {short date} • {file
   name}"; files without a summary are filtered out of the list entirely (so a
   no-summary revision also produces the row-5 empty state).
