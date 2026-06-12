# Website appearance

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp (forms and front-end header/footer are shared; row 4 asserts on OJS issue/article dates — its spec may land in the OJS tree). **Decision (wave 10):** rows 1–3, 5–6 in `lib/pkp/playwright/tests/website-appearance.spec.js`; row 4 in `playwright/tests/website-appearance-dates.spec.js` (OJS tree — it asserts OJS reader surfaces AND imports the OJS-only `submission-published` fixture, which a lib/pkp spec must not reference).
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** journal scenario endpoint (scratch journal, `users: manager`, `issues` array); `submission-published` fixture with `journal` override for the date-format effect (row 4). Appearance values themselves are entered through the UI — the forms are the surface under test. No gaps.
- **Implementation notes (wave 10):**
  - New shared POM `lib/pkp/playwright/pages/WebsiteSettingsPage.js` wraps the two-level tab nav, the Vue-form save dance (Save → contexts API write → `[role="status"] Saved`), and the FieldUploadImage dropzone upload (deterministic hidden-input id `${formId}-${field}-hiddenFileId-${locale}`, assigned in a post-mount setTimeout).
  - Row 4 wording vs reality: the article landing page and issue TOC both render through `$dateFormatShort` — `dateFormatLong` is unused by any OJS frontend template. The test saves custom values for both fields (round-trip asserted on reload) but front-end assertions exercise `dateFormatShort` (`Y~m~d`; the tilde separator appears in no default format).
  - Row 3 front-end check uses computed styles (`.pkp_structure_head` background-color, body font-family) rather than parsing the compiled stylesheet — pipeline-independent; `PKPContextController::editTheme` clears the template+CSS caches so the next anonymous hit recompiles.
- **Round 2 / out of scope:**
  - Custom stylesheet and favicon uploads (Advanced tab) — file-type validation matrix, low weekly-journey value; round 2.
  - Theme variations beyond default-theme options — explicitly round-2 backlog in PRINCIPLES/inventory.
  - Appearance > Editorial Masthead tab (`PKPAppearanceMastheadForm`) — owned by `editorial-masthead`.
  - Highlights, Lists (items per page), Privacy statement tabs — privacy public page owned by `public-pages`; highlights/lists round 2.
  - `journalContentOrganization` / `displayStats` / `useHomepageImageAsHeader` default-theme options — round 2 once the core option round-trip (row 3) holds.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Logo upload renders in the public header | dbarnes, anonymous | journal scenario + UI upload | Appearance > Setup saves `pageHeaderLogoImage`; upload persists on reload; anonymous journal homepage header renders the logo `<img>` (alt text + file URL resolves 200) | implemented (lib/pkp/playwright/tests/website-appearance.spec.js) |
| 2 | Homepage image and additional homepage content render on the journal homepage | dbarnes, anonymous | journal scenario + UI upload | Setup tab saves `homepageImage`; Advanced tab saves `additionalHomeContent`; anonymous homepage renders both the image and the custom HTML content | implemented (lib/pkp/playwright/tests/website-appearance.spec.js) |
| 3 | Default theme options change the front-end presentation | dbarnes, anonymous | journal scenario | Theme tab exposes default-theme options; saving a new `baseColour` and typography choice persists on reload and the anonymous front end reflects them (generated theme stylesheet/inline styles carry the new colour/font stack) | implemented (lib/pkp/playwright/tests/website-appearance.spec.js) |
| 4 | Date format settings reformat published dates | dbarnes, anonymous | journal scenario (issue) + submission-published fixture | Setup > Date & Time saves a custom `dateFormatShort`/`dateFormatLong`; the published article landing page and issue TOC render the publication date in the new format | implemented (playwright/tests/website-appearance-dates.spec.js) |
| 5 | Sidebar block configuration surfaces on the reader sidebar | dbarnes, anonymous | journal scenario | Setup tab's `sidebar` options enable a block (e.g. Information/Language toggle); selection persists; anonymous journal homepage renders the block in the sidebar; disabling removes it | implemented (lib/pkp/playwright/tests/website-appearance.spec.js) |
| 6 | Page footer content renders on front-end pages | dbarnes, anonymous | journal scenario | Setup tab saves a unique `pageFooter`; footer markup renders on the journal homepage and on a secondary page (e.g. /about), proving site-wide injection | implemented (lib/pkp/playwright/tests/website-appearance.spec.js) |
