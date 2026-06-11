# Activity log

- **Area:** 2. Editorial workflow
- **Placement:** lib/pkp
- **Budget:** 4 tests
- **Absorbs:** none
- **Scenario needs:** submission-in-review fixture (decisions + reviewer statuses — existing); submission-in-round-2 fixture (existing). Parity caution, not a gap: rows 1 and 4 assert on event-log/round-history state produced by seeding; Processors go through the real Repos, which write `event_log` rows. If an entry is missing at implementation time that is a Processor parity defect (PRINCIPLES §2 → `docs/scenario-processor-audit.md`), not a reason to drive the whole history through the UI.
- **Implementation notes (wave 5):** all seeded entries row 1 depends on were present (submit, participant-added, decision, reviewer-assigned) — no missing-entry parity defect. Two display defects surfaced in the History grid and are reported in the wave-5 ledger notes, neither blocking coverage: (a) participant-added rows render a raw `{$userGroupName}` placeholder — production writes the same wrong param key (`userGroupName`, a locale array off the Eloquent model) as the Processor, vs. schema key `userGroupNames` (`StageParticipantGridHandler.php:397`), so this is an app bug shared by seeded and live rows; (b) scenario-seeded `email_log` rows carry uncompiled subjects (`…{$contextName}`) where production logs compiled ones — seeding-side parity wrinkle only. OJS overrides `submission.event.submissionSubmitted` to "Article submitted"; the spec asserts the OJS string.
- **Round 2 / out of scope:**
  - Per-submission email log (covered by the email-delivery plan).
  - File-level information center (`FileInformationCenterHandler`) — rarely used legacy surface.
  - Event-log API pagination/filtering — no dedicated UI; api-smoke territory if ever needed.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Activity Log history lists seeded and live workflow events | dbarnes | submission-in-review fixture (decision `sendExternalReview`, one accepted reviewer) | Editor opens Activity Log from the workflow page (`editor.activityLog` action → legacy info-center modal); History tab lists submission-submitted, reviewer-assigned and decision entries with actor + date; editor then records a live decision via UI and the new entry appears after reopening the log | implemented (lib/pkp/playwright/tests/activity-log.spec.js) |
| 2 | Notes tab: add a note, persists across editors | dbarnes, dbuskins | submission-draft fixture (dbarnes editor + dbuskins section editor participants) | Editor adds a note in the Notes tab (`saveNote`); note renders with author + date; reopening the modal as the other assigned editor shows the same note | implemented (lib/pkp/playwright/tests/activity-log.spec.js) |
| 3 | Activity Log access is gated by role | mfritz, dbuskins, atester | submission-draft fixture (submitter atester; participants: dbuskins sectionEditor, mfritz copyeditor) | Assigned section editor sees the Activity Log button (`canAccessEditorialHistory`); assistant participant and the author do not get the button on their workflow/mySubmissions view | implemented (lib/pkp/playwright/tests/activity-log.spec.js) |
| 4 | Reviewer round-history modal shows past-round outcome | phudson | submission-in-round-2 fixture (round 1 completed by phudson with `pendingRevisions`, round 2 invited jjanssen) | phudson opens their reviewer submission page, past round 1 is listed; Round History modal opens with round number + publication title and shows the completed review's details (dates, recommendation/comments surface per `RoundHistoryModal.vue`) | implemented (lib/pkp/playwright/tests/activity-log.spec.js) |
