# Submission files

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** lib/pkp/playwright/tests/filenames.spec.js (row 1)
- **Scenario needs:** submission scenario — draft fixture with the default seeded Article Text file (every seeded submission gets one; rows 3–7 operate on it), `submitter` override (atester) for the author-permissions row. All met — no GAP. Files at non-submission stages are not needed here (cross-stage Upload/Select is covered in the `copyediting-stage` plan, row 3). New upload fixtures added for row 5: `lib/pkp/playwright/fixtures/files/sample-article.html` (text/html main file — dependent-files support is mimetype-gated) and `dependent-image.png` (1×1 PNG dependent upload).
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
| 2 | Editor uploads and deletes a file at the submission stage | dbarnes | scenario: draft; upload via UI | Upload button opens the file upload wizard (file + genre); new row renders with name, upload date and type; Delete via more-actions + confirm removes the row (seeded Article Text remains) | implemented (lib/pkp/playwright/tests/submission-files.spec.js) |
| 3 | Renaming a file via the edit-metadata modal persists | dbarnes | scenario: draft (seeded Article Text) | More-actions → Edit ("Update File Details") opens the metadata modal; changing the name saves; list shows the new name and the download serves it | implemented (lib/pkp/playwright/tests/submission-files.spec.js) |
| 4 | Uploading a revision replaces the existing file | dbarnes | scenario: draft (seeded Article Text) | Upload wizard's "revision of an existing file" option targets the Article Text; the list still shows a single row for the file (revised in place — same submission-file id, name follows the upload) and the download serves the new bytes | implemented (lib/pkp/playwright/tests/submission-files.spec.js) |
| 5 | Dependent files attach through the edit modal | dbarnes | scenario: draft; HTML upload via UI | Dependent Files grid inside the edit-metadata modal accepts an image upload; it lists in the grid but does not appear as a standalone row in the stage file list. NOTE: dependent files are mimetype-gated (text/html, xml — `Repo::submissionFile()->supportsDependentFiles`), so the test uploads `sample-article.html` first and attaches the image to it, not to the seeded PDF | implemented (lib/pkp/playwright/tests/submission-files.spec.js) |
| 6 | File Information Center shows notes and history | dbarnes | scenario: draft (seeded Article Text) | More-actions → More Information opens the File Information Center; adding a note persists it (survives modal reopen); the History tab renders the seeded upload event-log entry | implemented (lib/pkp/playwright/tests/submission-files.spec.js) |
| 7 | Download All Files returns an archive | dbarnes | scenario: draft (seeded Article Text + one UI upload) | Download All link appears once files exist; the downloadAllFiles response is a zip attachment containing both file names (suggested name is `{id}--submission-files.zip` — double dash is a Str::kebab artifact, asserted tolerantly); single-file download link works | implemented (lib/pkp/playwright/tests/submission-files.spec.js) |
| 8 | Author file permissions at the submission stage | atester | scenario: draft, submitter atester | Author view lists Submission Files with Download All and Edit available (both exercised end-to-end), but no Upload, no Delete and no More Information (SUBMISSION_FILES author permissions: FILE_LIST, FILE_EDIT, FILE_DOWNLOAD_ALL) | implemented (lib/pkp/playwright/tests/submission-files.spec.js) |
