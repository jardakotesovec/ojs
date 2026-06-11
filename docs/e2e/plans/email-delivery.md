# Email delivery

- **Area:** 8. System & communications
- **Placement:** lib/pkp
- **Budget:** 6 tests
- **Absorbs:** none (mailpit.spec.js harness tests are owned by `test-infrastructure`; its password-reset test by `password-flows`)
- **Scenario needs:** `submission-in-review` fixture incl. `journal`/`submitter` overrides and completed reviewers (row 6 uses a unique throwaway submitter as the negative-assertion recipient); submission scenario `decisions[].toAuthor` (email-log parity — decisions seed through `Repo::decision()->add()`, so `NotifyAuthors::logMailable` writes the EDITOR_NOTIFY_AUTHOR log row); `submission-draft`; scratch journal for the Workflow > Emails signature edit (publicknowledge is read-only). Mailpit via `pkpMail` — all assertions scoped by recipient + the test's unique tag, never `clearAll()` (principle 8). All met — no GAP.
- **Round 2 / out of scope:**
  - Edited template text used in sent mail → `email-templates-management` row 5 owns it.
  - Library / submission-file-stage / review-files attachers (`fileAttachers/Library|FileStage|ReviewFiles`) — row 2 covers the Upload attacher only.
  - DISCUSSION_NOTIFY email-log rows: no UI/API surface exists to read them (only `emails/authorEmails` exposes EDITOR_NOTIFY_AUTHOR); deferred until a surface exists.
  - Recipient-locale selection for mailables; per-locale template bodies.
  - Bulk email tool and digest frequency variants (round-2 backlog).
  - Notify-on-assignment email at copyediting → `stage-participants` row 3 owns the send (its former Notify-menu row was dropped in favor of row 4 here); this plan owns rendering/log/attachment concerns.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Decision email renders variables, headers, and the configured signature | dbarnes, atester | scenario: scratch journal + submission-in-review (journal override, submitter atester) | Edit Workflow > Emails signature with a unique marker; record Request Revisions via UI with the stock template → Mailpit message located by recipient (atester) + the tagged submission: subject/body carry real recipient/journal/submission values, no raw `{$...}` placeholders survive, signature marker present, From/Reply-To identify the journal/editor | planned |
| 2 | Composer attachment is delivered with the email | dbarnes, atester | scenario: submission-in-review (submitter atester) | Decision composer → attach file via the Upload attacher (FileAttacherModal); send → `pkpMail.fullMessage` (message located by recipient + tag) shows the attachment with the uploaded filename/MIME alongside the intact body | planned |
| 3 | Author sees logged notify-author emails on their submission | atester | scenario: decisions [sendExternalReview, requestRevisions w/ toAuthor] (submitter atester) | Author's review-stage workflow view lists the email in the Notifications panel (WorkflowListingEmails ← `emails/authorEmails`, EDITOR_NOTIFY_AUTHOR); opening it (readSubmissionEmail) shows full subject/body incl. the seeded toAuthor text | planned |
| 4 | Notify participant prefills from template, delivers, and opens a discussion | dbarnes, atester | scenario: submission-draft (submitter atester) | Participants → Notify: choosing a template prefills subject/body in the form; send → Mailpit delivery to atester (scoped by recipient + tag) matches the message; a discussion containing the message appears at the stage (PKPStageParticipantNotifyForm parity). This plan owns the Participants → Notify delivery surface — `stage-participants` dropped its duplicate row | planned |
| 5 | Decision notify-reviewers email reaches completed reviewers | dbarnes, phudson, jjanssen | scenario: in-review, round 1 with two completed reviewers | Request Revisions wizard exposes the Notify Reviewers step; send → each reviewer's Mailpit copy (scoped per recipient + the tagged submission) carries the entered text and rendered variables | planned |
| 6 | Skipping the decision email sends nothing | dbarnes, throwaway author | scenario: submission-in-review (submitter = unique throwaway user) | Skip the notify-author email step (`canSkip`); decision still records (status + decision history). Negative assertion per principle 8: send a positive-control message (Participants → Notify addressed to dbarnes, carrying the test tag) and wait for the editor copy in Mailpit; once it arrives, assert zero Mailpit messages for the throwaway author scoped by recipient + tag, and the author's Notifications email list stays empty | planned |
