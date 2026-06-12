# Languages & locales

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** lib/pkp/playwright/tests/multilingual.spec.js (3 tests → rows 1–3)
- **Scenario needs:** scratch journal via `POST /api/v1/_test/scenarios/journal` with `supportedLocales: ['en','fr_CA']` (all rows); `primaryLocale` passthrough exists but row 6 flips primary via the grid radio because the action is the behavior under test; `submission-in-review` fixture with `journal` override (row 3). fr_CA must be installed at site level (true in the test image).
- **Round 2 / out of scope:**
  - Installing a brand-new site locale from the admin Languages page — owned by `site-settings`.
  - Wizard locale-picker mechanics and mid-wizard reconfigure — owned by `submission-wizard-language`; row 4 covers only the settings-grid gate.
  - `submissionMetadataLocale` column (metadata-only locales) — round 2.
  - Locale file customization / translation overrides — round 2.
  - RTL locale rendering — round 2.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | UI-locale toggle round-trips in the Languages grid | dbarnes | scenario: scratch journal (`supportedLocales: en, fr_CA`) | Website > Setup > Languages: uncheck fr_CA's UI checkbox → AJAX save → still unchecked after reload; re-check → persists. | implemented (lib/pkp/playwright/tests/multilingual.spec.js) |
| 2 | Form locale stays editable when UI locale is off | dbarnes | scenario: scratch journal (`supportedLocales: en, fr_CA`) | With fr_CA UI-disabled but forms-enabled, the masthead form's French tab accepts an acronym; save → FR value persists across reload. | implemented (lib/pkp/playwright/tests/multilingual.spec.js) |
| 3 | French publication title round-trips on a submission | dbarnes | scenario: scratch journal (`supportedLocales: en, fr_CA`) + submission-in-review fixture (journal override) | Workflow Title & Abstract: switch form to French, set FR title via TinyMCE, save → publication API returns title.fr_CA. | implemented (lib/pkp/playwright/tests/multilingual.spec.js) |
| 4 | Submission-locale toggle gates the wizard language choice | dbarnes | scenario: scratch journal (`supportedLocales: en, fr_CA`) | Submission Languages grid (Website > Setup > Languages, second grid): enable fr_CA for submissions → wizard start step offers French in the submission-language picker; disable → picker no longer offers French. (Picker behavior beyond the gate is `submission-wizard-language`.) | implemented (lib/pkp/playwright/tests/multilingual.spec.js) |
| 5 | UI locale exposes the front-end language switcher | dbarnes, anonymous | scenario: scratch journal (`supportedLocales: en, fr_CA`) | With fr_CA UI-enabled, the reader front end offers Français and `/{journal}/fr_CA/` renders French chrome; after disabling the UI flag the switcher option disappears for readers. (Scratch journals ship an empty `sidebar`, so the test first places the languageToggle block via Website > Appearance > Setup — the block is the front-end switcher; its labels render own-language lowercase: "français".) | implemented (lib/pkp/playwright/tests/multilingual.spec.js) |
| 6 | Changing primary locale flips the front-end default | dbarnes, anonymous | scenario: scratch journal (`supportedLocales: en, fr_CA`) | Languages grid primary radio → fr_CA (`setContextPrimaryLocale`, kebab-cased to `set-context-primary-locale`): grid re-renders with FR as primary after reload; a fresh anonymous visitor with an unmatched Accept-Language (de-DE) now gets the fr_CA-prefixed home by default (Accept-Language matching `en` would override the journal default — Locale::getPreferredLocale honours the visitor first). | implemented (lib/pkp/playwright/tests/multilingual.spec.js) |
