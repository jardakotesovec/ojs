# Galleys

- **Area:** 3. Publishing & issues
- **Placement:** ojs
- **Budget:** 8 tests
- **Absorbs:** playwright/tests/galleys.spec.js
- **Scenario needs:** submission scenario submission-published fixture (published VoR in Vol 1 No 2 2014, default Article Text file bundled) — exists; `participants` (layout editor) — exists; multi-version seeding via `publications[]` for row 8 — exists. Galley states in this plan's CRUD rows are created via UI (the grid is the behavior under test). **Adjudicated verdict:** `publications[].galleys[]` seeding **APPROVED FOR BUILD** in PublicationsProcessor (`Repo::galley()->add()` + a PROOF-stage file at galley-grid parity) — the strongest cross-plan demand (article-landing, subscription-access, payments, and this plan); wave-1 work item. Rows here that need a pre-existing galley as setup (2, 3, 5, 6) can switch to the seeded galley once built; rows 1, 4, 7 keep the UI path as the behavior under test.
- **Round 2 / out of scope:**
  - Galley file download content/headers and inline viewing → article-landing plan.
  - HTML galley inline rendering / pdfJsViewer / lensGalley — round-2 plugin backlog.
  - Dependent files on galleys (e.g. HTML images) → submission-files plan.
  - Issue galleys → issue-management plan row 7.
  - Genre variations in the galley upload wizard (genre-agnostic; single PDF run is sufficient evidence per absorbed spec).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor adds a PDF galley; reader sees the download link | dbarnes, anonymous | submission scenario: submission-published fixture | Add galley form (label, locale, urlPath) + file upload wizard; galley row appears; anonymous article page renders `obj_galley_link` "PDF" pointing at the urlPath route | implemented (playwright/tests/galleys.spec.js) |
| 2 | Editor deletes a galley; reader link disappears | dbarnes, anonymous | submission scenario: submission-published fixture + galley added via UI | Delete from the galley row's actions menu; row gone; anonymous article page no longer lists the PDF galley link | implemented (playwright/tests/galleys.spec.js) |
| 3 | Editor edits a galley's label and urlPath | dbarnes, anonymous | submission scenario: submission-published fixture + galley via UI | Edit form persists a renamed label and new urlPath; manager row and reader link text/href update accordingly | planned |
| 4 | Editor creates a remotely hosted galley (no file) | dbarnes, anonymous | submission scenario: submission-published fixture | "Remotely hosted content" checkbox exposes the remote URL field; saving without a file upload creates the galley; reader galley link resolves to/redirects at the remote URL | planned |
| 5 | Editor reorders galleys; reader page follows the order | dbarnes, anonymous | submission scenario: submission-published fixture + two galleys via UI | Order mode + save persists the new sequence in the manager; anonymous article page lists galley links in the new order | planned |
| 6 | Editor replaces the file behind an existing galley | dbarnes, anonymous | submission scenario: submission-published fixture + galley via UI | Change-file action runs the upload wizard against the existing galley; label/urlPath unchanged; reader link still resolves (new file served) | planned |
| 7 | Layout editor manages galleys as a production participant | gcox | submission scenario: submission-published fixture w/ gcox as layoutEditor participant | gcox's workflow view exposes the Galleys panel with Add galley; adding a galley succeeds and the row appears (assistant-level galley management works end to end) | planned |
| 8 | Galley added on draft v2 stays off the published v1 article page until v2 is published | dbarnes, anonymous | submission scenario: `publications: [v1 published, v2 draft]` w/ issue | Galley added under v2's Galleys panel does not appear on the public (v1) article page; after publishing v2 the galley link is live | planned |
