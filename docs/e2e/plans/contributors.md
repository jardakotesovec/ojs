# Contributors

- **Area:** 3. Publishing & issues
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** lib/pkp/playwright/tests/publication-metadata-editing.spec.js — split per the N-test absorption rule (the spec has 2 tests): **this plan owns the add-contributor test** ("editor adds a new contributor via the Contributors panel"), which backs row 1's `implemented` status; **editor-metadata-editing owns the title/abstract/keywords test** (backs its row 1). Both plans record this split.
- **Scenario needs:** submission scenario draft submissions (submission-in-review / submission-draft fixtures) — exists. Contributor states themselves are created via UI (the CRUD is the behavior under test). No gaps.
- **Round 2 / out of scope:**
  - Contributor entry inside the submission wizard → submission-wizard-core plan.
  - ORCID request/verified badge on contributors → orcid plan.
  - Author editing own published contributors (canChangeMetadata gate) → editor-metadata-editing plan (absorbs author-edit-published.spec.js).
  - Reader-side byline/affiliation display on the article landing page → article-landing plan.
  - Version-scoped contributor isolation (v2 add) → publication-versioning plan row 2.
  - ROR API-backed affiliation autocomplete (external service; row 6 uses the manual-entry path only).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor adds a contributor with role and multilingual name | dbarnes | submission scenario: submission-in-review fixture | Add Contributor modal: givenName/familyName (en), email, country, Author role checkbox; new row appears in the list; publication authors API includes it | implemented (lib/pkp/playwright/tests/publication-metadata-editing.spec.js) |
| 2 | Editor edits an existing contributor | dbarnes | submission scenario: draft submission (submitter's seeded author row) | Edit opens prefilled form; changed family name + email persist in the list and in the publication authors after reload | planned |
| 3 | Editor deletes a contributor | dbarnes | submission scenario: draft submission + one extra contributor added via UI | Delete action confirms and removes the row; publication authors no longer include the deleted email; remaining contributor untouched | planned |
| 4 | Editor reorders contributors and previews the byline | dbarnes | submission scenario: draft submission + second contributor via UI | Order mode moves a contributor up/down and Save Order persists; Preview modal shows contributor display lists in the new order; order survives reload | planned |
| 5 | Editor reassigns the primary contact | dbarnes | submission scenario: draft submission + second contributor via UI | Primary-contact indicator sits on the submitter by default; "Set primary contact" moves the badge; persists (publication primaryContactId updated) | planned |
| 6 | Contributor affiliations round-trip (manual entry) | dbarnes | submission scenario: draft submission | Affiliations field on the contributor form accepts a manually entered institution; affiliation shows on the contributor row/preview and persists on the publication author | planned |
