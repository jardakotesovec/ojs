# Notifications

- **Area:** 8. System & communications
- **Placement:** lib/pkp
- **Budget:** 4 tests
- **Absorbs:** none
- **Scenario needs:** `submission-draft` with `journal`/`submitter` overrides; throwaway submitter/participant users (journal scenario `users[]` on a scratch journal, or unique per-test seeded users) for every row — shared seeded users accumulate notifications and mail from parallel tests, so no row asserts against them; scratch journal for rows 3–4 — notification subscription settings are stored per (user, context), so toggling them never touches publicknowledge. All met — no GAP.
- **Round 2 / out of scope:**
  - Editing-status stage notice render (WorkflowNotificationDisplay) — owned by `copyediting-stage` row 2, which asserts both states and the flip on copyeditor assignment; the standalone render row was dropped as a duplicate.
  - In-app `blocked_notification` toggle (same profile form, in-app column) — row 3 covers the email column; the in-app variant is deferred.
  - Issue-published reader notification opt-out (deferred here from `issue-management`) — same blocked-email mechanism row 3 asserts; the OJS reader-type variant is round 2.
  - Toast (trivial) notification assertions — `/notification/fetchNotification` drains per-user queues and races under parallel workers (see patterns.md); intentionally not asserted.
  - Editorial-reminder in-app notification — asserted as part of `scheduled-tasks` row 4.
  - Notification digest emails / StatisticsReport notification.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | New discussion lands in the participant's tasks inbox | dbarnes, throwaway submitter | scenario: submission-draft (submitter = throwaway user via journal scenario users[] or unique seeded user) | dbarnes adds a discussion with the throwaway submitter as participant → the submitter opens the tasks grid (taskNotificationsGridHandler modal via the top-nav bell) and the tagged new-discussion notification is listed as unread, linking to the submission. Assert only this notification's presence/read-state — never the bell badge count (shared users accumulate notifications from parallel tests) | implemented (lib/pkp/playwright/tests/notifications.spec.js) |
| 2 | Mark read / mark new / delete in the tasks grid | dbarnes, throwaway submitter | scenario: submission-draft (throwaway submitter); discussion via UI | Selecting the tagged notification row: Mark Read clears its unread state; Mark New restores it; Delete removes the row from the grid — assertions scoped to this row only, no badge-count checks | implemented (lib/pkp/playwright/tests/notifications.spec.js) |
| 3 | Blocking email for a notification type stops mail but keeps in-app | dbarnes, throwaway submitter + control participant | scenario: scratch journal + draft submission (submitter and a second participant seeded as throwaway users via users[]) | Throwaway submitter's profile → Notifications (scratch-journal context): block email for new-discussion notifications; dbarnes starts a discussion with both throwaway users as participants → the control participant's Mailpit copy arrives (positive control bounding the wait, principle 8); then zero Mailpit messages for the blocked recipient scoped by recipient + tag, while the in-app notification still appears in the blocked user's tasks grid | implemented (lib/pkp/playwright/tests/notifications.spec.js) |
| 4 | Unsubscribe link from a notification email blocks future sends | dbarnes, throwaway submitter + control participant | scenario: scratch journal + draft submission (two throwaway participants via users[]) | The discussion notification email footer carries the tokenized unsubscribe link (`notification/unsubscribe`); following it renders the confirm form + result page; a subsequent discussion notifies both participants → the control participant's copy arrives (positive control, principle 8), then zero Mailpit messages for the unsubscribed recipient scoped by recipient + tag (in-app unaffected) | implemented (lib/pkp/playwright/tests/notifications.spec.js) |
