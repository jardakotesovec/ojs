# Email templates management

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** lib/pkp/playwright/tests/email-templates.spec.js (now 6 tests → rows 1–6; rows 5–6 added to the same spec in wave 10)
- **Scenario needs:** scratch journal via `POST /api/v1/_test/scenarios/journal` (rows 1–6); `submission-in-review` fixture with `journal` override + Mailpit fixture (row 5 — UI-recorded decision mail reaches Mailpit; scenario-side mail stays `Mail::fake()`d). Template editing itself is always UI — it is the behavior under test.
- **Round 2 / out of scope:**
  - Manage Emails search box and group/sent-from/sent-to filters (list-navigation sugar, low risk).
  - "Reset All" bulk action (row 6 covers the per-template reset path; bulk variant deferred).
  - Per-locale template bodies (multilingual template entry) — compose-side locale handling is exercised in `email-delivery`.
  - Template variable reference popover / insert-variable UX.
  - Site-level vs journal-level template scoping.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Default template flips unrestricted → restricted with user groups | dbarnes | scenario: scratch journal | Manage Emails: open a mailable's default template, set restricted, assign two user groups, save, reload → restriction + group assignments persist. | implemented (lib/pkp/playwright/tests/email-templates.spec.js) |
| 2 | Add restricted custom template with body and two user groups | dbarnes | scenario: scratch journal | Add Template on a mailable: name/subject/TinyMCE body, restricted + two groups, save, reload → custom template listed with body and groups intact. | implemented (lib/pkp/playwright/tests/email-templates.spec.js) |
| 3 | Unrestricted custom template hides user-group options reactively | dbarnes | scenario: scratch journal | With isUnrestricted=true the assignedUserGroupIds checkboxes are absent; flipping the radio re-mounts them (showWhen both directions); saved unrestricted state persists on reload. | implemented (lib/pkp/playwright/tests/email-templates.spec.js) |
| 4 | Restricted custom template with zero user groups is accepted | dbarnes | scenario: scratch journal | Form saves a restricted template with no groups checked; reload confirms restricted + zero-group state round-trips. | implemented (lib/pkp/playwright/tests/email-templates.spec.js) |
| 5 | Edited default template text is used in sent mail | dbarnes | scenario: scratch journal + submission-in-review fixture (journal override); Mailpit | Edit the "Submission Accepted" (DecisionAcceptNotifyAuthor) default template body with a unique marker, save; record an Accept decision via the UI on the seeded submission → Mailpit message to the author contains the marker and rendered template variables (no raw `{$...}` left). | implemented (lib/pkp/playwright/tests/email-templates.spec.js) |
| 6 | Reset restores a default template; Remove deletes a custom one | dbarnes | scenario: scratch journal | Edit a default template's subject/body, save; use the template row's Reset action → stock subject/body restored on reopen. Create a custom template, use Remove → it disappears from the mailable's template list and stays gone after reload. | implemented (lib/pkp/playwright/tests/email-templates.spec.js) |
