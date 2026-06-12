# Public pages

- **Area:** 4. Reader front end
- **Placement:** lib/pkp
- **Budget:** 4 tests
- **Absorbs:** none — the earlier claim on lib/pkp/playwright/tests/editorial-masthead.spec.js was removed: that 1-test spec backs editorial-masthead's row 1 (double-counting); row 1 here was repointed to a different public-pages behavior.
- **Scenario needs:** journal scenario (`users`, `contact` passthrough — ContextBuilderProcessor accepts `contact: {name, email}` and mirrors it into supportName/supportEmail; row 1 exercises it end-to-end against `AboutContextHandler::contact`, handler verified in lib/pkp/pages/about/AboutContextHandler.php). `about` and `privacyStatement` are context settings with no scenario passthrough — seeded via their settings forms in the UI (one-off states; the forms themselves are journal-setup/website-appearance territory). Bootstrap publicknowledge already seeds contact name/email, so row 3 reads the shared journal without mutation. No gaps.
- **Round 2 / out of scope:**
  - Editorial history page (`/about/editorialHistory`).
  - "About this publishing system" page.
  - Information pages (For Readers / For Authors / For Librarians) — content empty by default; pair with the Information sidebar block in round 2.
  - Editorial masthead page entirely — anonymous render and config → display mapping both live in the editorial-masthead feature (area 5), which keeps editorial-masthead.spec.js.
  - staticPages custom pages plugin (round-2 plugin).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Contact page renders scenario-seeded contact details on a scratch journal | anonymous | journal scenario: scratch journal w/ `contact: {name, email}` passthrough | `/about/contact` 200; the seeded principal contact name + email render; support contact block shows the same seeded values (ContextBuilderProcessor mirrors `contact` into supportName/supportEmail) — complements row 3, which reads bootstrap publicknowledge without mutation | implemented (lib/pkp/playwright/tests/public-pages.spec.js) |
| 2 | About-the-journal page displays the configured About text | dbarnes (setup), anonymous (assert) | journal scenario + UI: set "About the Journal" rich text on Settings → Journal → Masthead | `/about` 200; "About the Journal" heading; the saved about text renders for anonymous readers. Note: the masthead form requires `acronym`, which the scenario doesn't seed by default — the spec passes `acronym` in the journal spec so the form's PUT validates | implemented (lib/pkp/playwright/tests/public-pages.spec.js) |
| 3 | Contact page shows the journal contact details | anonymous | none (bootstrap publicknowledge seeds contact name + email) | `/about/contact` 200; contact name (Ramiro Vaca) and email rendered | implemented (lib/pkp/playwright/tests/public-pages.spec.js) |
| 4 | Privacy statement page renders the configured statement | dbarnes (setup), anonymous (assert) | journal scenario + UI: set privacy statement on Website → Setup → Privacy | `/about/privacy` 200 with the saved statement text; with NO statement the page is not served (404). PREMISE CORRECTION (wave 8): new contexts are born with a default statement (`lib/pkp/schemas/context.json` privacyStatement `defaultLocaleKey`), so a virgin journal serves 200 — the 404 branch is exercised by clearing the field via the same Privacy form and re-probing anonymously | implemented (lib/pkp/playwright/tests/public-pages.spec.js) |
