# Stage participants

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 7 tests
- **Absorbs:** lib/pkp/playwright/tests/stage-participants.spec.js (rows 1–2)
- **Scenario needs:** submission scenario — `participants` (roles editor/sectionEditor/copyeditor/layoutEditor/proofreader, plus `recommendOnly`/`canChangeMetadata` flags), `decisions: [skipExternalReview]` for copyediting-stage seeds, `submitter` override (atester). All met — no GAP. Notification emails are triggered by UI actions so they reach Mailpit (scenario-side mail stays faked).
- **Round 2 / out of scope:**
  - `recommendOnly` decision-flow consequences → `recommend-only-editors` plan (only flag persistence + list indicator covered here).
  - `canChangeMetadata` permission effects → `editor-metadata-editing` plan (absorbs author-edit-published.spec.js).
  - Admin impersonation via user management grid → `login-as` plan (row 6 covers only the participant-panel entry point).
  - Stage-specific panel composition per assistant role → `copyediting-stage` / `production-stage` plans.
  - Participants → Notify delivery (template prefill, Mailpit receipt, resulting discussion, email log) → `email-delivery` plan row 4 owns it.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor adds a copyeditor via the Assign Participant modal | dbarnes | scenario: draft + dbarnes editor + decisions [skipExternalReview] | Assign button opens the legacy add-participant form; filter by Copyeditor group + name search; mfritz appears in the Participants panel with the Copyeditor role | implemented (lib/pkp/playwright/tests/stage-participants.spec.js) |
| 2 | Editor removes a stage participant via the more-actions menu | dbarnes | scenario: copyedit-stage + mfritz copyeditor seeded | Remove menu item + confirm dialog; list re-renders without mfritz; remaining participant intact | implemented (lib/pkp/playwright/tests/stage-participants.spec.js) |
| 3 | Assigning with a notification message emails the participant | dbarnes, svogt | scenario: copyedit-stage; assignment via UI | Add-participant form's notify section (template select + message carrying a unique marker) sends the stage mailable on save; Mailpit assertion scoped to recipient (svogt) + marker confirms receipt and message body — no clearAll (Principles §8) | planned |
| 4 | Editing assignment flags persists recommend-only | dbarnes | scenario: draft (default cast incl. dbuskins sectionEditor) | More-actions → Edit re-opens the assignment form; checking `recommendOnly` saves; participant list shows the recommend-only indicator; reopening Edit shows the checkbox persisted (`canChangeMetadata` checkbox present on the same form) | planned |
| 5 | Unassigned user cannot access the submission workflow | svogt, dbarnes | scenario: copyedit-stage with editor only | svogt (copyeditor role in journal, not a participant) opening the workflow URL is denied (403/redirect, no workflow panels); after dbarnes assigns svogt at the stage, the same URL renders the workflow | planned |
| 6 | Log In As from the Participants panel | admin, mfritz | scenario: copyedit-stage + mfritz copyeditor | Participant more-actions shows Log In As (canLoginAs); confirm dialog → session becomes mfritz on their dashboard; logout-as returns to the admin session | planned |
| 7 | Author auto-assignment and author-side absence of the panel | dbarnes, atester | scenario: draft, submitter atester | Editor's Participants panel lists atester under the Author group automatically (seed parity with wizard submit); atester's own author view of the stage renders no Participants panel | planned |
