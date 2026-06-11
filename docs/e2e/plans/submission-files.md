# Submission files

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** lib/pkp/playwright/tests/filenames.spec.js (row 1)
- **Scenario needs:** submission scenario — draft fixture with the default seeded Article Text file (every seeded submission gets one; rows 3–7 operate on it), `submitter` override (atester) for the author-permissions row. All met — no GAP. Files at non-submission stages are not needed here (cross-stage Upload/Select is covered in the `copyediting-stage` plan, row 3).
- **Round 2 / out of scope:**
  - Author revision uploads during review → `review-rounds-revisions` plan.
  - Reviewer attachments → `reviewer-response` plan; galley files → `galleys` plan.
  - Multilingual file names (per-locale `name` via edit modal) — noted as a separate capability during the filenames port; round 2.
  - Filesystem-illegal characters (`/ \ : * ? " < > |`) — covered by backend unit tests, not stageable on disk for setInputFiles.
  - File upload from the submission wizard (author side) → `submission-wizard-core` plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Non-ASCII + punctuation filename round-trips upload, list and download header | dbarnes | scenario: journal (scratch); wizard upload via UI | Upload of `Édition £ 丹尼爾 & دانيال (tag).pdf` echoes the exact name in the API response and the file list; genre assignment keeps it; download Content-Disposition carries decodable `filename*=UTF-8''…` matching the upload | implemented (lib/pkp/playwright/tests/filenames.spec.js) |
| 2 | Editor uploads and deletes a file at the submission stage | dbarnes | scenario: draft; upload via UI | Upload button opens the file upload wizard (file + genre); new row renders with name, upload date and type; Delete via more-actions + confirm removes the row (seeded Article Text remains) | planned |
| 3 | Renaming a file via the edit-metadata modal persists | dbarnes | scenario: draft (seeded Article Text) | More-actions → Edit opens the metadata modal; changing the name saves; list shows the new name and the download serves it | planned |
| 4 | Uploading a revision replaces the existing file | dbarnes | scenario: draft (seeded Article Text) | Upload wizard's "revision of an existing file" option targets the Article Text; the list still shows a single row for the file (revised, not duplicated) and the download serves the new upload | planned |
| 5 | Dependent files attach through the edit modal | dbarnes | scenario: draft (seeded Article Text) | Dependent Files grid inside the edit-metadata modal accepts an image upload; it lists in the grid but does not appear as a standalone row in the stage file list | planned |
| 6 | File Information Center shows notes and history | dbarnes | scenario: draft (seeded Article Text) | More-actions → More Information opens the File Information Center; adding a note persists it; the history/notes tabs render for the file | planned |
| 7 | Download All Files returns an archive | dbarnes | scenario: draft (seeded Article Text + one UI upload) | Download All link appears once files exist; the downloadAllFiles response is OK with an archive attachment; single-file download link works | planned |
| 8 | Author file permissions at the submission stage | atester | scenario: draft, submitter atester | Author view lists Submission Files with Download All and Edit available, but no Upload and no Delete (SUBMISSION_FILES author permissions: FILE_LIST, FILE_EDIT, FILE_DOWNLOAD_ALL) | planned |
