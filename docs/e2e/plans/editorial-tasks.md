# Editorial tasks

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 6 tests (7 rows, within ±1)
- **Absorbs:** lib/pkp/playwright/tests/task-templates.spec.js (rows 3–6). Absorbs (rework): playwright/tests/discussions/discussion-manager.spec.js (task half of test 1 → row 1; test 2 → row 2; the discussion half of test 1 is claimed by the `discussions` plan — split the spec on absorption).
- **Scenario needs:** journal scenario for scratch journals (templates are journal-level config — never on publicknowledge); submission scenario inside the scratch journal (draft + participants) and on publicknowledge (draft fixture). Auto-add row relies on `Repo::editorialTask()->autoCreateFromTemplates()` firing from a UI-recorded decision (DecisionType.php:228) — templates created via UI first, so no GAP.
- **Round 2 / out of scope:**
  - Per-user-group template visibility restriction (author sees only unrestricted, copyeditor sees both) — deliberately dropped during the task-templates port (three cross-actor contexts for a visibility check); round 2.
  - Task overdue indicators / due-date reminder emails — round 2.
  - Discussion-shaped items without task info → `discussions` plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Task lifecycle: create, start, complete | dbarnes | scenario: draft (default cast) | Create task with participants, responsible assignee, future due date and Do-Not-Start → listed "Yet to begin"; unsaved-changes guard on cancel; start task → started state; complete → "Closed"; Edit disabled after completion. Absorbs (rework): playwright/tests/discussions/discussion-manager.spec.js (task arc of test 1) | planned |
| 2 | Task edit/delete access is restricted by role | dbarnes, dbuskins, minoue | scenario: draft (default cast) | Responsible participant (dbuskins) gets actions menu + edit; non-responsible participant (minoue) sees read-only row (no actions menu, disabled checkbox, Edit hidden); responsible can delete | implemented (playwright/tests/discussions/discussion-manager.spec.js) |
| 3 | Manager adds a task template and it persists | dbarnes | scenario: journal (scratch) | Workflow settings → Task Templates tab; add template (title, description, stage, auto-add flag); row appears under the stage group and survives reload | implemented (lib/pkp/playwright/tests/task-templates.spec.js) |
| 4 | Applying a template pre-fills the task form in the workflow | dbarnes | scenario: journal (scratch) + submission in scratch journal | Template created in settings is offered in the discussion/task add form; picking it pre-fills title, flips to task shape, computes due date from dueInterval, and pre-fills the description editor | implemented (lib/pkp/playwright/tests/task-templates.spec.js) |
| 5 | Template form validation rejects an empty submission | dbarnes | scenario: journal (scratch) | Saving the empty add-template form surfaces "This field is required." on title and description; modal stays open | implemented (lib/pkp/playwright/tests/task-templates.spec.js) |
| 6 | Manager edits a template, toggles auto-add, deletes it | dbarnes | scenario: journal (scratch) | Edit via More Actions renames the row; auto-add row checkbox toggles with confirm dialog; delete removes the row | implemented (lib/pkp/playwright/tests/task-templates.spec.js) |
| 7 | Auto-add template instantiates a task on stage entry | dbarnes | scenario: journal (scratch) + stage-1 submission; template + decision via UI | With a copyediting-stage template saved with auto-add ON, recording Accept and Skip Review moves the submission to copyediting and the panel lists a system-created task from the template in "Yet to begin" (autoCreateFromTemplates) | planned |
