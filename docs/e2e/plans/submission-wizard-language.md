# Submission wizard — language

- **Area:** 1. Submission intake
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** ABSORBED + DELETED (merged into `lib/pkp/playwright/tests/submission-wizard-language.spec.js`): `wizard-language.spec.js` (2 tests → rows 2–3).
- **Scenario needs:** submission scenario `locale` field + `submitted: false` wizard drafts (existing as of the draft-shape fix — see submission-wizard-validation plan's Scenario needs for the canChangeMetadata parity note); journal scenario `supportedLocales`/`primaryLocale` and `sections` passthroughs (existing). publicknowledge ships en + fr_CA submission locales (bootstrap). No gaps.
- **Round 2 / out of scope:**
  - UI-locale vs submission-locale independence (browsing the wizard under `/fr_CA/` URL prefix with an EN submission) — partially exercised by the absorbed copyright-gate FR test in `submission-wizard-validation`.
  - Adding a third submission locale via Languages settings (owned by `languages-locales`).
  - Changing publication language after submission (owned by `publication-versioning` / existing `publication-language-change.spec.js`).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Start form locale picker | atester | UI | Submission-language radio offers en + fr_CA; picking French starts the wizard with fr_CA as the primary metadata locale (Details fields keyed to FR first; the Start form's title lands in the fr_CA publication title, asserted through TinyMCE since the backing textarea only mirrors on editor.save()) | implemented (lib/pkp/playwright/tests/submission-wizard-language.spec.js) |
| 2 | Reconfigure modal changes language and section mid-wizard | dbarnes | UI | Reconfigure modal re-binds the "Submitting to … in …" caption for both the section and locale radios; Details forms re-render against the new locale | implemented (lib/pkp/playwright/tests/submission-wizard-language.spec.js) |
| 3 | Review-step errors render in the new locale | dbarnes | UI | After switching the submission to fr_CA, the Review step's panels and required-field errors render against the FR locale ("Details (French (Canada))") | implemented (lib/pkp/playwright/tests/submission-wizard-language.spec.js) |
| 4 | Multilingual metadata entry | atester | submission scenario (`submitted: false`, `locale: fr_CA`) | Secondary-locale (EN) fields revealed via the form-locale toggle in Details (locale textareas are always attached — visibility of the TinyMCE iframes is what toggles); title/abstract entered in both locales persist (REST-polled before reload) and both values survive save/reload, re-asserted on the per-locale Review panels | implemented (lib/pkp/playwright/tests/submission-wizard-language.spec.js) |
| 5 | French submission end-to-end | atester, dbarnes | UI | A French submission completes the wizard and submits (incl. translating the contributor's migrated affiliation into fr_CA via the contributor edit modal — validateSubmit requires the affiliation name in the submission locale); editor's workflow shows the FR title; submission locale fr_CA is recorded on the submission (REST) | implemented (lib/pkp/playwright/tests/submission-wizard-language.spec.js) |
| 6 | Single-locale journal hides language choices | dbarnes | journal scenario (scratch, en only, 2 sections so the reconfigure entry point renders) | Start form omits the language radio (fewer than 2 submission locales) while the section radio renders; reconfigure modal offers the section radio but no language field | implemented (lib/pkp/playwright/tests/submission-wizard-language.spec.js) |
