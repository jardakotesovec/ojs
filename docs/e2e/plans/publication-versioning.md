# Publication versioning

- **Area:** 3. Publishing & issues
- **Placement:** lib/pkp (row 8's urlPath form lives on the OJS Issue panel; its assertion seeds urlPath via scenario metadata, so the spec can stay shared)
- **Budget:** 8 tests
- **Absorbs:** lib/pkp/playwright/tests/versioning.spec.js; playwright/tests/publication-language-change.spec.js (moves/refits per placement at implementation)
- **Scenario needs:** submission scenario `publications[]` supports multi-entry version seeding (entry i>0 calls `Repo::publication()->version()` with `versionStage` + `versionIsMinor`) and per-version `published` — exists; `metadata.urlPath` passthrough — exists. No gaps.
- **Round 2 / out of scope:**
  - Update Type + Summary of Changes on the version/publish forms — owned by `plans/publication-amendments.md` (added 2026-06-11).
  - JATS file management per version; Body Text per version.
  - "Send to Text Editor" / version-source selection flows in the version dialog.
  - Deleting a version (no UI exists; intentionally untested).
  - Version-scoped galley isolation → galleys plan row 8 (OJS).
  - Versioned DOI re-assignment → doi-management plan.
  - v2 Issue-panel edits (stacked-form save) — deferred by the absorbed spec; revisit if the Issue panel binding regresses.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor creates v2, edits and publishes it; reader defaults to v2 and can reach v1; unpublishing v2 restores v1 | dbarnes, anonymous | submission scenario: submission-published fixture (VoR 1.0 published in Vol 1 No 2 2014) | Create New Version → VoR 1.1 draft; title edit saves; publish v2; reader page shows v2 title, `.versions` picker links v1 with outdated-version notice; unpublish v2 → reader sees v1 only. **This row owns the outdated-version reader notice**; article-landing's versions row asserts versions-list/link presence only | implemented (lib/pkp/playwright/tests/versioning.spec.js) |
| 2 | Contributor added on v2 lands in v2's authors only; v1 unchanged | dbarnes | submission scenario: submission-published fixture; v2 created via UI | Contributors panel under v2 nav writes to v2's contributors endpoint; v2 authors include the new row, v1 authors do not | implemented (lib/pkp/playwright/tests/versioning.spec.js) |
| 3 | Language change is blocked while published; after unpublish the editor switches primary locale and republishes | dbarnes, anonymous | submission scenario: VoR published w/ en metadata + issue | "Change" button absent while published; after unpublish, change-language modal switches to fr_CA with new title/abstract (PUT changeLocale); republish persists locale; fr_CA reader URL renders French title | implemented (playwright/tests/publication-language-change.spec.js) |
| 4 | Language change is unavailable once multiple versions exist | dbarnes | submission scenario: `publications: [v1 published, v2 draft]` (two entries) | Even with the latest version unpublished, the change-language widget is hidden when publications.length ≥ 2 (workflow controls-left shows no "Change" button on either version) | planned |
| 5 | Published version is locked for editing; draft version is editable | dbarnes | submission scenario: `publications: [v1 published, v2 draft]` | v1 panels show the create-new-version edit warning and disabled fields; v2 panels accept and save edits (Title & Abstract round-trip) | planned |
| 6 | Create-version dialog offers version stage and significance; labels reflect the choice | dbarnes | submission scenario: submission-published fixture | Dialog exposes version stage (AO/PMUR/VoR) + major/minor radio; choosing VoR+minor yields "Version of Record 1.1", a second major bump yields 2.0; version strings appear in the Publication nav | planned |
| 7 | Publication menu lists all versions with per-version status | dbarnes | submission scenario: `publications: [v1 published, v2 draft]` | Side menu "Publication" lists both version entries; status indicator shows Published for v1 and Unscheduled/Unpublished for v2; selecting v1 shows its (locked) content | planned |
| 8 | Custom urlPath resolves on the reader side alongside version URLs | dbarnes, anonymous | submission scenario: VoR published w/ `metadata.urlPath` + issue | `/article/view/{urlPath}` renders the article (200); numeric URL still resolves; `/article/view/{urlPath}/version/{v1Id}` reaches the version after a v2 publish | planned |
