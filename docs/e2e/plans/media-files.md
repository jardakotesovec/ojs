# Media files (Media section)

- **Area:** 3. Publishing & issues
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** none (feature landed Feb 2026, commit ec86e2419e — no legacy coverage)
- **Scenario needs:** `publications[].mediaFiles[]` seeding — **BUILT (wave 7)**: the
  submission scenario accepts per-publication
  `mediaFiles: [{variantType ('web'|'high_resolution', required), file?, name?, genre?
  (IMAGE default | ARTICLE), group?}]`; entries sharing a `group` label are linked pairwise
  via `VariantGroup::link()` (first entry = primary, max 2). Response echoes
  `mediaFiles: [{id, name, variantType, group, variantGroupId}]`. Parity entry at the end
  of `docs/scenario-processor-audit.md`. Rows 2–8 seed through it; row 1 owns upload as
  behavior.
- **Round 2 / out of scope:**
  - Reader-side variant serving beyond row 8's smoke (responsive/srcset behaviors, if any).
  - View Info legacy modal (FileInformationCenterHandler) — legacy surface, low value.
  - Genre management UI for `supports_file_variants` (settings surface; IMAGE auto-enabled
    by migration is asserted in row 1).
  - Unlink-without-delete (no UI surface exists today — only delete-cleanup ungroups).

Feature map (verified): `lib/ui-library/src/managers/MediaFileManager/`,
`lib/pkp/api/v1/submissions/MediaFilesController.php`, `VariantGroup.php`
(MAX_GROUP_SIZE=2, metadata sync), `MediaVariantType` enum (web | high_resolution),
migration I12251 (`variant_groups`, `submission_files.variant_group_id/variant_type`,
`genres.supports_file_variants`). UI: Production stage → Media tab; editors+assistants
write, authors read-only.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Batch upload with genre + variant-type gating | dbarnes | submission scenario: copyedit/production stage | Media tab → Add Media File: dropzone accepts two files; submit stays disabled until every file has a genre and (for IMAGE, supports_file_variants) a variant type; a non-variant genre leaves the variant dropdown disabled; uploaded rows appear with name/type icon/size/date | implemented (lib/pkp/playwright/tests/media-files.spec.js) |
| 2 | Batch-link pairs web with high-res and syncs metadata | dbarnes | seeded media files (2 web + 2 high-res IMAGE + 1 ARTICLE high-res decoy) | "Batch Link Media" modal lists only web files on the left, genre-matched high-res options per row (+ "No high-resolution file"; ARTICLE decoy excluded; picks consumed by one row leave the other rows' lists); linking creates the pairs (rows render grouped) and the primary's common metadata (caption + description, set via REST pre-link) is applied to the linked sibling — `name` is NOT | implemented (lib/pkp/playwright/tests/media-files.spec.js) |
| 3 | Manual link + group-capacity guard | dbarnes | seeded media files (1 linked pair + spare web + 2 spare high-res) | Manually Link Media on a spare high-res offers only the free web counterpart (the paired web file is filtered out by useMediaFileImageLinking); UI link succeeds. NOTE: that filter makes a full pair unreachable through the modal, so the variantGroupAtCapacity (MAX_GROUP_SIZE=2) guard is asserted via direct REST PUT …/link → 400 + message | implemented (lib/pkp/playwright/tests/media-files.spec.js) |
| 4 | Editing metadata propagates to the linked sibling | dbarnes | seeded linked pair | Edit Metadata on the web file changes name + caption; the high-res sibling reflects the synced common field (VariantGroup::applyMetadataToSiblings) while keeping its own name. NOTE: IMAGE is an ARTWORK-category genre — its form has caption/credit/copyrightOwner/terms, not description (SUPPLEMENTARY-only field); caption is the common field asserted via the UI | implemented (lib/pkp/playwright/tests/media-files.spec.js) |
| 5 | Deleting one file of a pair ungroups the survivor | dbarnes | seeded linked pair + 1 solo file | Delete (confirm dialog names the file) removes the file; the sibling remains, ungrouped (variantGroupId null via REST); deleting the solo file just removes its row | implemented (lib/pkp/playwright/tests/media-files.spec.js) |
| 6 | One media file serves two galleys | dbarnes, anonymous | seeded web media file + published publication with 2 HTML galleys | FINDING (code-verified): no per-galley media linkage exists — media files attach to the PUBLICATION and ArticleHandler::download (pages/article/ArticleHandler.php:538-550) serves any publication media file under any of its galleys' URLs; HtmlGalleyHelper embeds it from every HTML galley by name. Implemented as: both galleys' rewritten HTML reference the SAME file id, both URLs serve the PNG anonymously; deleting galley A 404s its URL while galley B's reference and the publication's media file survive | implemented (lib/pkp/playwright/tests/media-files.spec.js) |
| 7 | Author sees the Media tab read-only | atester | submission scenario (submitter atester) + seeded media file | Author workflow shows the Media tab listing files but no Add/Batch-Link buttons and no per-row More Actions menu (author role = MEDIA_FILE_LIST only); a direct DELETE as atester is rejected by PublicationWritePolicy (HTTP 401 — PKP API maps authorization failures to 401) | implemented (lib/pkp/playwright/tests/media-files.spec.js) |
| 8 | High-res variant on the reader side | anonymous | published publication + HTML galley + linked media pair (both named dependent-image.png) | SURFACE (code-verified): HtmlGalleyHelper.php:55-66 filters HIGH_RESOLUTION out of embeddable files ("reserved for download/export use cases, e.g. PubMed Central"); no template/theme references variantType, so there is NO theme link to the high-res file. Implemented as the smoke of what exists: the galley embed rewrites to the WEB variant's id (even with the high-res sharing the referenced name), the web URL serves anonymously, and the high-res file serves on a directly-constructed download URL. Theme/srcset exposure → Round 2 | implemented (lib/pkp/playwright/tests/media-files.spec.js) |
