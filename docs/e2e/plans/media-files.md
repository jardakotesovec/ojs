# Media files (Media section)

- **Area:** 3. Publishing & issues
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** none (feature landed Feb 2026, commit ec86e2419e — no legacy coverage)
- **Scenario needs:** `publications[].mediaFiles[]` seeding — **APPROVED FOR BUILD** (thin
  PublicationsProcessor extension beside `seedGalleys`, mirroring
  `MediaFilesController` add + `VariantGroup::link()`: SUBMISSION_FILE_MEDIA (23) rows with
  `variant_group_id`/`variant_type`, assocType PUBLICATION). Justification: rows 3–8 all
  need pre-existing media files; only row 1 owns upload as behavior. Wave work item with a
  parity-audit entry. Until built, rows seed via the row-1 upload path (UI).
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
| 1 | Batch upload with genre + variant-type gating | dbarnes | submission scenario: copyedit/production stage | Media tab → Add Media File: dropzone accepts two files; submit stays disabled until every file has a genre and (for IMAGE, supports_file_variants) a variant type; a non-variant genre leaves the variant dropdown disabled; uploaded rows appear with name/type icon/size/date | planned |
| 2 | Batch-link pairs web with high-res and syncs metadata | dbarnes | seeded media files (2 web + 2 high-res, IMAGE) | Link Media Files modal lists only web files on the left, genre-matched high-res options per row (+ "No High-Resolution File"); linking creates the pairs (rows render grouped) and the primary's common metadata is applied to the linked sibling | planned |
| 3 | Manual link + group-capacity guard | dbarnes | seeded media files (1 linked pair + 1 spare high-res) | Action menu → Manually Link Media on a spare file offers only valid counterparts; attempting to link into the already-full pair surfaces the variantGroupAtCapacity error (MAX_GROUP_SIZE=2) | planned |
| 4 | Editing metadata propagates to the linked sibling | dbarnes | seeded linked pair | Edit Metadata on the web file changes name/description; the high-res sibling reflects the synced common fields (VariantGroup::applyMetadataToSiblings) | planned |
| 5 | Deleting one file of a pair ungroups the survivor | dbarnes | seeded linked pair | Delete (confirm dialog names the file) removes the file; the sibling remains, ungrouped (variant_group cleaned up); deleting a solo file just removes its row | planned |
| 6 | One media file serves two galleys | dbarnes, anonymous | seeded media files + published publication with 2 galleys | The same media file is referenced from two galleys; removing it from / deleting one galley leaves the other galley's reference intact. IMPLEMENTATION NOTE: verify the galley↔media linkage surface in code first (galley edit form vs dependent-files grid); if galley sharing is not yet reachable through the UI, mark dropped with that finding | planned |
| 7 | Author sees the Media tab read-only | atester | submission scenario (submitter atester) + seeded media file | Author workflow shows the Media tab listing files but offers no Add/Link/Edit/Delete actions (no canEdit; PublicationWritePolicy gates writes to editor roles) | planned |
| 8 | High-res variant on the reader side | dbarnes, anonymous | published publication + galley + linked media pair | The published article's galley/landing surface serves the web variant with the high-res variant reachable where the theme exposes it. IMPLEMENTATION NOTE: verify the reader-side surface first; if no public rendering exists yet, mark dropped (reader display not implemented) and move to Round 2 | planned |
