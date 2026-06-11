# Submission wizard — language

- **Area:** 1. Submission intake
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** `lib/pkp/playwright/tests/wizard-language.spec.js` (2 tests)
- **Scenario needs:** submission scenario `locale` field (existing); journal scenario `supportedLocales`/`primaryLocale` passthroughs (existing); publicknowledge ships en + fr_CA submission locales (bootstrap). No gaps.
- **Round 2 / out of scope:**
  - UI-locale vs submission-locale independence (browsing the wizard under `/fr_CA/` URL prefix with an EN submission) — partially exercised by the absorbed copyright-gate FR test in `submission-wizard-validation`.
  - Adding a third submission locale via Languages settings (owned by `languages-locales`).
  - Changing publication language after submission (owned by `publication-versioning` / existing `publication-language-change.spec.js`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Start form locale picker | atester | UI | Submission-language radio offers en + fr_CA; picking French starts the wizard with fr_CA as the primary metadata locale (Details fields keyed to FR first) | planned |
| 2 | Reconfigure modal changes language and section mid-wizard | dbarnes | UI | Reconfigure modal re-binds the "Submitting to … in …" caption for both the section and locale radios; Details forms re-render against the new locale | implemented (lib/pkp/playwright/tests/wizard-language.spec.js) |
| 3 | Review-step errors render in the new locale | dbarnes | UI | After switching the submission to fr_CA, the Review step's panels and required-field errors render against the FR locale ("Details (French (Canada))") | implemented (lib/pkp/playwright/tests/wizard-language.spec.js) |
| 4 | Multilingual metadata entry | atester | submission scenario (`submitted: false`, `locale: fr_CA`) | Secondary-locale (EN) fields revealed via the form-locale toggle in Details; title/abstract entered in both locales persist and both values survive save/reload | planned |
| 5 | French submission end-to-end | atester, dbarnes | UI | A French submission completes the wizard and submits; editor's workflow shows the FR title; submission locale is recorded on the submission | planned |
| 6 | Single-locale journal hides language choices | dbarnes | journal scenario (scratch, en only) | Start form omits the language radio (fewer than 2 submission locales); reconfigure modal offers no language change | planned |
