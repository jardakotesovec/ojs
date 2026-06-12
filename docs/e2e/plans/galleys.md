# Galleys

- **Area:** 3. Publishing & issues
- **Placement:** ojs
- **Budget:** 8 tests
- **Absorbs:** playwright/tests/galleys.spec.js
- **Scenario needs:** submission scenario submission-published fixture (published VoR in Vol 1 No 2 2014, default Article Text file bundled) — exists; `participants` (layout editor) — exists; multi-version seeding via `publications[]` for row 8 — exists. **`publications[].galleys[]` seeding LANDED (wave 1)** in PublicationsProcessor: `galleys: [{label, locale?, file?, urlRemote?}]` per publication (`file` = basename under `lib/pkp/playwright/fixtures/files/`, defaults to the standard PDF; `urlRemote` makes a remote galley; response echoes `galleys: [{id, label, locale, submissionFileId, urlRemote}]`; seeded galleys carry no urlPath and seq=0 — same as UI-created ones). Rows 3, 5, 6 use the seeded galley as setup (wave 6); rows 1, 4, 7 keep the UI creation path as the behavior under test; row 8 seeds `publications: [v1 published, v2 draft]` (v2 via `Repo::publication()->version()`, which clones v1's galleys).
- **Round 2 / out of scope:**
  - Media section (batch upload, web/high-res variants, media files shared across galleys) — owned by `plans/media-files.md` (added 2026-06-11); this plan keeps plain galley-file CRUD only.
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
| 3 | Editor edits a galley's label and urlPath | dbarnes, anonymous | submission scenario: submission-published fixture + seeded galley | Edit form persists a renamed label and new urlPath; manager row and reader link text/href update accordingly (note: the row menu labels the action "View" on a published publication but opens the fully editable form) | implemented (playwright/tests/galleys.spec.js) |
| 4 | Editor creates a remotely hosted galley (no file) | dbarnes, anonymous | submission scenario: submission-published fixture | "Remotely hosted content" checkbox exposes the remote URL field; saving without a file upload creates the galley (the auto-chained upload wizard is dismissed); reader galley link is the local route whose GET answers a redirect at the remote URL (asserted via Location header, never followed off-host) | implemented (playwright/tests/galleys.spec.js) |
| 5 | Editor reorders galleys; reader page follows the order | dbarnes, anonymous | submission scenario: submission-published fixture + two seeded galleys | Order mode + save persists the new sequence in the manager; anonymous article page lists galley links in the new order (baseline order derived dynamically — fresh galleys tie at seq=0) | implemented (playwright/tests/galleys.spec.js) |
| 6 | Editor replaces the file behind an existing galley | dbarnes, anonymous | submission scenario: submission-published fixture + seeded galley | Change-file action runs the upload wizard in revision mode against the existing galley; label and galley submissionFileId unchanged; reader link still resolves and the download's Content-Disposition carries the replacement basename | implemented (playwright/tests/galleys.spec.js) |
| 7 | Layout editor manages galleys as a production participant | gcox | submission scenario: submission-published fixture w/ gcox as layoutEditor participant | gcox's workflow view exposes the Galleys panel with Add galley; adding a galley succeeds and the row appears; reader sees the link (assistant-level galley management works end to end) | implemented (playwright/tests/galleys.spec.js) |
| 8 | Galley added on draft v2 stays off the published v1 article page until v2 is published | dbarnes, anonymous | submission scenario: `publications: [v1 published w/ issue + galley, v2 draft]` | Galley added under v2's Galleys panel does not appear on the public (v1) article page (v1's own galley as positive control); after publishing v2 the galley link is live at its urlPath alongside the galley cloned from v1 | implemented (playwright/tests/galleys.spec.js) |
