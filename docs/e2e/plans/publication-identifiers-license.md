# Publication identifiers & license

- **Area:** 3. Publishing & issues
- **Placement:** lib/pkp
- **Budget:** 8 tests
- **Absorbs:** none
- **Scenario needs:** submission scenario `publications[].metadata` (copyrightHolder/copyrightYear/licenseUrl, title/abstract per locale) — exists; journal scenario `plugins: {urn: {enabled: true, settings}}` passthrough for the pub-id-gated Identifiers tab — exists. `enablePublisherId` is not a context-scenario field: one-off, toggled via the Workflow > Metadata settings UI on a scratch journal (row 5), so no GAP. Ownership note: this plan owns references/citations end-to-end (editing, persistence, and published reader rendering — rows 2 and 8); article-landing dropped its references row in its favor. Reader-side fr_CA rendering is owned by article-landing's multilingual row; row 3 here stops at panel persistence + publish.
- **Round 2 / out of scope:**
  - DOI assignment/display rows → doi-management plan (per charter, DOI rows stay in plugin plans).
  - URN plugin depth (check digit, auto-assign patterns) — round-2 backlog; row 6 only uses URN as the gate that surfaces the core Identifiers tab.
  - Structured citation editing / citations metadata lookup pipeline.
  - copyrightYearBasis (issue vs publication) variants → distribution-settings plan covers the setting form.
  - Data Availability statement → submission-wizard-metadata plan (existing data-availability.spec.js).
  - How-to-cite rendering of license/contributors → citation-style-language plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor overrides copyright & license on a publication; reader sees the override | dbarnes, anonymous | submission scenario: production-stage draft VoR w/ issue | License panel (Permissions & Disclosure) override fields accept copyrightHolder/copyrightYear/licenseUrl; values persist; after publish, article landing shows the copyright statement and the overridden license link | planned |
| 2 | Editor adds raw references; reader sees the References section | dbarnes, anonymous | submission scenario: draft VoR w/ issue (citations enabled in bootstrap) | Citations panel saves pasted raw references; persists on reload; after publish, article landing renders the references section with the entries | planned |
| 3 | Per-locale title and abstract round-trip on the Title & Abstract panel | dbarnes | submission scenario: draft VoR w/ en metadata + issue | fr_CA title + abstract entered on the multilingual Title & Abstract fields persist independently of en (reload + publications API); publish succeeds with both locales intact (reader-side fr_CA rendering is owned by article-landing's multilingual row) | planned |
| 4 | Publishing without overrides applies journal default copyright and license | dbarnes, anonymous | submission scenario: draft VoR w/ issue, no license metadata override beyond requirements | Publish fills copyrightHolder per the journal's copyrightHolderType and copyrightYear; article landing shows the journal-default license terms/link | planned |
| 5 | Publisher ID field appears after enabling it in metadata settings | dbarnes | journal scenario: scratch journal (dbarnes manager) + draft submission; enablePublisherId toggled via Workflow settings UI | Workflow > Metadata settings "publisher identifier" option for publications enables the pub-id::publisher-id field on the publication Metadata panel; value saves and persists | planned |
| 6 | Identifiers tab is gated by a pub-id plugin | dbarnes | journal scenario: scratch journal w/ `plugins: {urn: enabled}` + draft submission; plain publicknowledge submission for the negative arm | publicknowledge workflow shows no Identifiers nav item (no pub-id plugin); scratch journal with URN enabled shows the Identifiers panel and a URN value round-trips | planned |
| 7 | Clearing a license override restores journal defaults | dbarnes, anonymous | submission scenario: draft VoR w/ overridden licenseUrl/copyrightHolder + issue | Removing the override values on the License panel reverts the publication to context defaults; after publish, landing shows the default license again | planned |
| 8 | Editor edits and deletes references; reader updates | dbarnes, anonymous | submission scenario: draft VoR w/ issue and citations saved in row-2 style | Editing a citation entry persists the new text; deleting removes it; published article references section reflects both changes | planned |
