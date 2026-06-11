# Website appearance

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp (forms and front-end header/footer are shared; row 4 asserts on OJS issue/article dates — its spec may land in the OJS tree)
- **Budget:** 6 tests
- **Absorbs:** none
- **Scenario needs:** journal scenario endpoint (scratch journal, `users: manager`, `issues` array); `submission-published` fixture with `journal` override for the date-format effect (row 4). Appearance values themselves are entered through the UI — the forms are the surface under test. No gaps.
- **Round 2 / out of scope:**
  - Custom stylesheet and favicon uploads (Advanced tab) — file-type validation matrix, low weekly-journey value; round 2.
  - Theme variations beyond default-theme options — explicitly round-2 backlog in PRINCIPLES/inventory.
  - Appearance > Editorial Masthead tab (`PKPAppearanceMastheadForm`) — owned by `editorial-masthead`.
  - Highlights, Lists (items per page), Privacy statement tabs — privacy public page owned by `public-pages`; highlights/lists round 2.
  - `journalContentOrganization` / `displayStats` / `useHomepageImageAsHeader` default-theme options — round 2 once the core option round-trip (row 3) holds.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Logo upload renders in the public header | dbarnes, anonymous | journal scenario + UI upload | Appearance > Setup saves `pageHeaderLogoImage`; upload persists on reload; anonymous journal homepage header renders the logo `<img>` (alt text + file URL resolves 200) | planned |
| 2 | Homepage image and additional homepage content render on the journal homepage | dbarnes, anonymous | journal scenario + UI upload | Setup tab saves `homepageImage`; Advanced tab saves `additionalHomeContent`; anonymous homepage renders both the image and the custom HTML content | planned |
| 3 | Default theme options change the front-end presentation | dbarnes, anonymous | journal scenario | Theme tab exposes default-theme options; saving a new `baseColour` and typography choice persists on reload and the anonymous front end reflects them (generated theme stylesheet/inline styles carry the new colour/font stack) | planned |
| 4 | Date format settings reformat published dates | dbarnes, anonymous | journal scenario (issue) + submission-published fixture | Setup > Date & Time saves a custom `dateFormatShort`/`dateFormatLong`; the published article landing page and issue TOC render the publication date in the new format | planned |
| 5 | Sidebar block configuration surfaces on the reader sidebar | dbarnes, anonymous | journal scenario | Setup tab's `sidebar` options enable a block (e.g. Information/Language toggle); selection persists; anonymous journal homepage renders the block in the sidebar; disabling removes it | planned |
| 6 | Page footer content renders on front-end pages | dbarnes, anonymous | journal scenario | Setup tab saves a unique `pageFooter`; footer markup renders on the journal homepage and on a secondary page (e.g. /about), proving site-wide injection | planned |
