# Site administration

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp (row 1 drives OJS-specific journal creation copy; its spec currently lives in the OJS tree and may stay there)
- **Budget:** 8 tests
- **Absorbs:** playwright/tests/admin-add-journal.spec.js, playwright/tests/multiple-contexts.spec.js. (lib/pkp/playwright/tests/journal-scenario.spec.js — both tests — is owned entirely by `test-infrastructure` row 1; this plan released its claim, and rows 2–3 instead cover journal creation through the admin wizard UI, a genuinely different surface.)
- **Scenario needs:** journal scenario endpoint (`POST /api/v1/_test/scenarios/journal`) with `users` role assignment for rows 4–7; rows 1–3 deliberately create journals through the admin UI — that surface is what they test. No gaps. Rows mutating the hosted-journals list (1–3, 5, 6) operate only on journals they created themselves, so the site singleton stays parallel-safe.
- **Round 2 / out of scope:**
  - Cache-clear ("clear data caches", "clear template cache") and expire-user-sessions maintenance actions — globally-scanning/destructive across all journals and workers (expire-sessions kills every parallel session; cache clears mutate shared caches mid-flight). Per principle 9 they belong to the dedicated serial Playwright project, never this plan's parallel specs; row 8 keeps only the read-only System Information page.
  - Journal enable/disable toggle and disabled-journal visibility — owned by the `site-access-restrictions` plan (legacy Cypress MultipleContexts.cy.js coverage maps there).
  - Hosted-journal reordering on the site index (`saveSequence`) — low-value drag-and-drop; round 2.
  - Site-wide users grid under admin — owned by `user-management`.
  - Jobs / failed-jobs admin pages — owned by `jobs-queue`.
  - Version check ("check for updates") — external network call; excluded.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Site admin creates a journal via /admin/contexts with URL-path validation | admin | UI | Invalid path (spaces) and duplicate path (`publicknowledge`) show inline field errors; valid submit lands on the Settings Wizard; new journal listed via REST; anonymous homepage reachable and shows journal name | implemented (playwright/tests/admin-add-journal.spec.js) |
| 2 | Journal created through the admin wizard UI is publicly reachable at its derived URL path | admin, anonymous | UI (admin creates the journal at /admin/contexts) | Admin-wizard-created journal's homepage resolves (no 404) at `/index.php/{path}/`; journal appears in the contexts grid and the REST contexts list (scenario-endpoint parity for the same state is owned by `test-infrastructure` row 1) | planned |
| 3 | Manager granted through the admin UI can log in and reach the new journal's settings | admin (create); dbarnes | UI (admin wizard creates the journal; dbarnes granted Journal manager via the journal's Users & Roles UI) | dbarnes reaches `/management/settings/context` of the wizard-created journal without a /login redirect — role assignment on a freshly UI-created context works end to end | planned |
| 4 | User with different roles across two journals navigates both dashboards | dbarnes, anonymous | journal scenario (`users: manager`) | Site index lists both journals; dbarnes (editor on publicknowledge, manager on scratch) reaches both editorial dashboards; `.app__contexts` switcher lists the other journal in each; session survives cross-journal hops | implemented (playwright/tests/multiple-contexts.spec.js) |
| 5 | Site admin edits a hosted journal from the admin contexts grid | admin, anonymous | journal scenario | Edit action on the scratch journal's row opens the context form; renamed journal title persists and renders on the anonymous site index listing and journal homepage header | planned |
| 6 | Site admin deletes a hosted journal | admin, anonymous | journal scenario | Delete action with confirmation removes the scratch journal: row gone from contexts grid, gone from anonymous site index, its public URL no longer serves the journal | planned |
| 7 | Settings Wizard configures a fresh journal | admin | UI (journal created via row-1 style flow or journal scenario) | Per-tab assertions, each saved then re-asserted on wizard reload: (1) context form saves name/description/path and shows the saved values; (2) appearance tab persists the theme selection; (3) languages tab lists the installed locales with their toggles; (4) search-indexing form saves and round-trips its metadata | planned |
| 8 | Admin System Information page renders (read-only) | admin | none (read-only) | System Information page renders the application version, server information and configuration sections; no maintenance action is triggered (cache clears / expire sessions live in the serial project — see out-of-scope note, principle 9) | planned |
