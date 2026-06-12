# Article landing

- **Area:** 4. Reader front end
- **Placement:** ojs
- **Budget:** 10 tests (8 planned/implemented + 2 dropped to owning plans)
- **Absorbs:** playwright/tests/article-dc-metadata.spec.js
- **Scenario needs:** submission-published fixture (metadata passthrough covers keywords, pages, plainLanguageSummary, subtitle, license fields, multilingual locales; `publications[]` array supports multi-version seeding). Relies on bootstrap enrichment defaults: CSL plugin ON, DOIs ON with auto-assign on publish. Galley seeding **BUILT in wave 1** — `publications[].galleys[]` in PublicationsProcessor (`Repo::galley()->add()` + a PROOF-stage file at galley-grid parity); response echoes `publications[i].galleys[]` with ids. Rows 4 and 10 use the seeded galley directly (no UI galley creation).
- **Round 2 / out of scope:**
  - JATS download link (depends on jatsTemplate plugin — round-2 plugin).
  - Supplementary galleys section (uses the same `publications[].galleys[]` seeding; add alongside row 4 in round 2).
  - pdfJsViewer depth beyond the row-10 smoke (issue-galley viewing, outdated-version banner inside the viewer, fullscreen/download controls).
  - Article/issue cover image on landing; usage-stats downloads chart.
  - Public comments section (own feature: public-comments); subscription gating (subscription-access); DOI assignment mechanics (doi-management); how-to-cite styles/downloads (citation-style-language).
  - Unpublished article → 404 (covered by publication-publish-flow via publish-unpublish.spec.js).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Core metadata renders on the article landing page | anonymous | submission-published (keywords, pages, plainLanguageSummary, subtitle) | Title+subtitle heading; author list; abstract + plain-language summary sections; keywords; section name; issue identification linking to the issue TOC; pages; DOI block with resolving URL (enriched default: auto-assigned on publish) | implemented (playwright/tests/article-landing.spec.js) |
| 2 | License and copyright block displays | anonymous | submission-published (licenseUrl CC-BY 4.0, copyrightHolder, copyrightYear) | CC license link/badge rendered; copyright statement with holder + year visible to anonymous readers | implemented (playwright/tests/article-landing.spec.js) |
| 3 | How-to-cite block renders a formatted citation | — | — | — | dropped (owned by citation-style-language rows — how-to-cite render, styles and downloads live there) |
| 4 | Galley is listed, viewable and downloadable by anonymous readers | anonymous | submission-published + seeded PDF galley (`publications[].galleys[]`, approved wave-1 build — see Scenario needs) | PDF galley link in `galleys_links`; galley view URL loads; download URL responds 200 with PDF content type | implemented (playwright/tests/article-landing.spec.js) |
| 5 | Versions list is present and links each published version | anonymous | submission-published with 2 published publications (VoR + new version) | Landing shows the `.versions` list with an entry per published version; each entry links to that version's URL (outdated-version notice on superseded versions is owned by publication-versioning row 1) | implemented (playwright/tests/article-landing.spec.js) |
| 6 | Multilingual metadata renders on the secondary-locale article page | anonymous | submission-published with en + fr_CA title/abstract | `/{path}/fr_CA/article/view/{id}` renders the French title and abstract; en URL keeps English (this plan owns reader-side fr_CA rendering; publication-identifiers-license row 3 stops at panel persistence + publish) | implemented (playwright/tests/article-landing.spec.js) |
| 7 | References section lists publication citations | — | — | — | dropped (owned by publication-identifiers-license — it owns references/citations end-to-end, editing through published rendering) |
| 8 | Article page emits core DC meta tags | anonymous | submission-published | DC.Title, DC.Creator.PersonalName, DC.Identifier(.URI), DC.Type(.articleType), DC.Language, DC.Date.issued, DC.Source(.ISSN) | implemented (playwright/tests/article-dc-metadata.spec.js) |
| 9 | Article page emits DC.Subject per keyword and DC.Rights | anonymous | submission-published (keywords, copyright, licenseUrl) | One DC.Subject per keyword; DC.Rights carries copyright statement + license URL | implemented (playwright/tests/article-dc-metadata.spec.js) |
| 10 | pdfJsViewer smoke: galley link opens the inline PDF viewer | anonymous | submission-published + seeded PDF galley (`publications[].galleys[]`, approved wave-1 build) | Plugin ships enabled by default (plugins/generic/pdfJsViewer/settings.xml) and hooks `ArticleHandler::view::galley`; following the galley link to `article/view/{id}/{galleyId}` renders the plugin's display template with `#pdfCanvasContainer > iframe` whose src is set to `pdf.js/web/viewer.html?file={encoded article/download URL}`; the embedded download URL responds 200 application/pdf | implemented (playwright/tests/article-landing.spec.js) |
