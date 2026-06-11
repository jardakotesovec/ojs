# Citation Style Language

- **Area:** 7. Plugins (key set)
- **Placement:** ojs
- **Budget:** 6 tests
- **Absorbs:** none. **Ownership note:** this plan owns coverage of the how-to-cite block on the article landing page — `article-landing` dropped its duplicate render-only row in adversarial review.
- **Scenario needs:** Bootstrap enrichment turns the CSL plugin ON in publicknowledge, so reader-display rows use the shared journal with per-test `submission-published` seeds. Settings/enable-state mutations use scratch journals via the journal scenario `plugins: {citationstylelanguageplugin: {enabled, settings}}` passthrough (existing). DOI-in-citation row relies on bootstrap auto-assign DOIs. No new seeds needed.
- **Round 2 / out of scope:**
  - Per-style citation correctness across the full style catalogue (Vancouver, Turabian, …) — one primary + one alternate style proves the pipeline; style fidelity is the CSL library's concern.
  - `publisherLocation` setting's effect on citation output — cosmetic field, low traffic.
  - Book/chapter/OMP citation paths (getChapter/setBookAuthors) — not OJS surface.
  - Citation block on issue galleys / unpublished-preview gating — edge cases.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | How-to-cite block renders the primary citation on the article page | anonymous | submission-published on publicknowledge | Article landing shows the "How to Cite" block (citation-block template) with the default primary style (APA) citation containing author family name, title, and journal name; "More Citation Formats" list is present | planned |
| 2 | Reader switches citation format and the citation re-renders | anonymous | submission-published on publicknowledge | Choosing another offered style from the citation-formats dropdown fetches via the CSL handler `get` op and replaces the rendered citation text with the selected style's shape | planned |
| 3 | Reader downloads BibTeX and RIS citations | anonymous | submission-published on publicknowledge | The download links (handler `download` op) deliver a BibTeX file containing the title (`title = {`) and an RIS file with `TY  -`/`TI` records for the same article | planned |
| 4 | Citation includes the DOI for a DOI-assigned article | anonymous | submission-published on publicknowledge (bootstrap auto-assign DOI) | The rendered how-to-cite citation includes the publication's `https://doi.org/...` URL, matching the auto-assigned DOI | planned |
| 5 | Manager configures primary style and offered styles/downloads; front end reflects it | dbarnes, anonymous | journal scenario (scratch, CSL enabled via `plugins`) + submission-published | CSL settings form (plugins grid Settings modal): set a non-default primary style, restrict enabled styles and downloads to a subset; values persist on reopen; the article page renders the new primary citation and lists only the enabled styles/downloads | planned |
| 6 | Disabling the CSL plugin removes the how-to-cite block | dbarnes, anonymous | journal scenario (scratch, CSL enabled via `plugins`) + submission-published | Article page shows the block while enabled; after the manager unchecks the plugin in the Website → Plugins grid, the block (and citation downloads) disappear from the article page | planned |
