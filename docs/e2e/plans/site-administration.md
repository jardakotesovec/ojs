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
| 2 | Journal created through the admin wizard UI is publicly reachable at its derived URL path | admin, anonymous | UI (admin creates the journal at /admin/contexts) | Admin-wizard-created journal's homepage resolves (no 404) at `/index.php/{path}/`; journal appears in the contexts grid and the REST contexts list (scenario-endpoint parity for the same state is owned by `test-infrastructure` row 1) | implemented (playwright/tests/site-administration.spec.js) |
| 3 | Manager granted through the admin UI can log in and reach the new journal's settings | admin (create); dbarnes | UI (admin wizard creates the journal; dbarnes granted Journal manager via the journal's Users & Roles UI) | dbarnes reaches `/management/settings/context` of the wizard-created journal without a /login redirect — role assignment on a freshly UI-created context works end to end | implemented (playwright/tests/site-administration.spec.js) |
| 4 | User with different roles across two journals navigates both dashboards | dbarnes, anonymous | journal scenario (`users: manager`) | Site index lists both journals; dbarnes (editor on publicknowledge, manager on scratch) reaches both editorial dashboards; `.app__contexts` switcher lists the other journal in each; session survives cross-journal hops | implemented (playwright/tests/multiple-contexts.spec.js) |
| 5 | Site admin edits a hosted journal from the admin contexts grid | admin, anonymous | journal scenario | Edit action on the scratch journal's row opens the context form; renamed journal title persists and renders on the anonymous site index listing and journal homepage header | implemented (playwright/tests/site-administration.spec.js) |
| 6 | Site admin deletes a hosted journal | admin, anonymous | journal scenario | Delete action with confirmation removes the scratch journal: row gone from contexts grid, gone from anonymous site index, its public URL no longer serves the journal (404) | implemented (playwright/tests/site-administration.spec.js) |
| 7 | Settings Wizard configures a fresh journal | admin | UI (journal created via row-1 style flow or journal scenario) | Per-tab assertions, each saved then re-asserted on wizard reload: (1) context form saves name/description/path and shows the saved values; (2) appearance tab persists the theme selection; (3) languages tab lists the installed locales with their toggles; (4) search-indexing form saves and round-trips its metadata | implemented (playwright/tests/site-administration.spec.js) |
| 8 | Admin System Information page renders (read-only) | admin | none (read-only) | System Information page renders the application version, server information and configuration sections; no maintenance action is triggered (cache clears / expire sessions live in the serial project — see out-of-scope note, principle 9) | implemented (playwright/tests/site-administration.spec.js) |

## Implementation notes (wave 9)

- Rows 2–3, 5–8 live in the new sibling spec `playwright/tests/site-administration.spec.js`
  (6 tests) next to the absorbed `admin-add-journal.spec.js` (row 1) and
  `multiple-contexts.spec.js` (row 4); a new POM `playwright/pages/AdminContextsPage.js`
  drives the /admin/contexts grid (create / edit / delete / row actions).
- **Enabled-journal trap (rows 1–3):** the OJS ContextForm defaults `enabled` to FALSE
  (`classes/components/forms/context/ContextForm.php:41`), so a journal created through the
  admin UI without ticking "Enable this journal" is created disabled and every anonymous
  front-end URL bounces to the journal login page — which still renders the journal name in
  its banner. Row 1's original public-reachability assertion passed vacuously on that login
  page; `admin-add-journal.spec.js` was extended (tick `enabled`, assert not-/login) and
  rows 2–3 assert the same.
- **Row 3 surface:** OJS exposes no non-invite role-grant UI (see
  `lib/pkp/playwright/tests/user-role-assignment.spec.js` header), so "granted via the
  journal's Users & Roles UI" is the invitation wizard. The journal-scoped user search can't
  see dbarnes (no role there yet → new-email branch); on opening the accept link the
  invitation re-links to his existing account by email match
  (`UserRoleAssignmentInvite::changeInvitationUserIdUsingUserEmail`), the receive controller
  auto-logs him in, and the accept wizard collapses to the single review step. This
  existing-user acceptance branch is covered nowhere else (user-invitation = new-user branch;
  user-role-assignment stops at the pending invitation). Mail assertions are scoped
  `to: dbarnes@mailinator.com` + the journal-name token (no `clearAll()`).
- **Row 7 theme note:** only the `default` theme ships in the test install, so "persists the
  theme selection" is asserted as the theme select showing `default` plus a real theme-form
  round-trip of the default theme's `typography` option (PUT `contexts/{id}/theme`). The
  context-form save changes the urlPath, so the wizard is reloaded before the other tabs
  (their API URLs embed the path at render time).
