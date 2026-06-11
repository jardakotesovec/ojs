# Journal setup

- **Area:** 6. Settings & administration
- **Placement:** ojs (OJS `MastheadForm` adds abbreviation/publisher/ISSN fields; public surfaces are journal pages)
- **Budget:** 4 tests
- **Absorbs:** none
- **Scenario needs:** journal scenario endpoint (scratch journal with `users: [{dbarnes, manager}]`); `contact` and ISSN passthroughs exist but rows 1–3 deliberately enter values through the settings forms — the forms are the surface under test. No gaps.
- **Round 2 / out of scope:**
  - Editorial history / editorial team public display — owned by `editorial-masthead`.
  - Multilingual masthead entry (journal name in a second locale, locale switcher rendering) — owned by `languages-locales` (multilingual form-entry coverage).
  - Sections and Categories tabs of the Journal settings page — own plans (`sections`, `categories`).
  - ISSN public rendering — default front end doesn't print ISSNs (verified: no `onlineIssn` usage in frontend templates/default theme); rows assert ISSN persistence only, not a public effect.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Masthead identity persists and renames the public journal | dbarnes, anonymous | journal scenario | Masthead form saves name, acronym, abbreviation, publisher institution/URL, online + print ISSN; values persist on reload; new journal name renders in the anonymous journal homepage header and on the site index listing | planned |
| 2 | Journal summary and about text surface on reader pages | dbarnes, anonymous | journal scenario | Masthead form saves `description` and `about`; description renders in the homepage "About the Journal" section; about text renders on the public `/about` page | planned |
| 3 | Contact settings persist and render on the public contact page | dbarnes, anonymous | journal scenario | Contact form saves principal contact (name/email/affiliation/phone), mailing address, and support contact; values persist on reload; public `/about/contact` page renders mailing address, principal and support contact | planned |
| 4 | Masthead and contact form validation | dbarnes | journal scenario | Clearing the required journal name/acronym shows inline field errors and blocks save; invalid contact email format is rejected with an inline error; correcting the values allows save | planned |
