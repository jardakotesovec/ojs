# Publication publish flow

- **Area:** 3. Publishing & issues
- **Placement:** ojs
- **Budget:** 8 tests
- **Absorbs:** lib/pkp/playwright/tests/publish-unpublish.spec.js (spec moves under playwright/tests/ at implementation to match placement)
- **Scenario needs:** submission scenario `publications[]` (versionStage, metadata incl. copyright/license, `issue` ref, `published` flag) — exists; scheduled state seedable via `issue: <future issue>` + `published: true` (PublicationsProcessor calls `Repo::publication()->publish()`, which yields STATUS_SCHEDULED for an unpublished issue); `decisions` (skipExternalReview, decline) — exists. Row 2 note: missing copyright/license metadata does **not** block publish — OJS `validatePublish()` (classes/publication/Repository.php) only errors on declined status, ORCID problems, an invalid issueId, or an enabled-but-unpaid publication fee; row 2 uses the unpaid-publication-fee precondition, so its seed is a scratch journal with the publication (APC) fee enabled via the Distribution → Payments UI. No gaps.
- **Round 2 / out of scope:**
  - DOI auto-assignment on publish → doi-management plan.
  - Event-log entries for publish/unpublish → activity-log plan.
  - Subscription/delayed-open-access visibility gating → subscription-access plan.
  - Scheduling into a future issue and publish-with-issue journeys → issue-assignment-scheduling plan (this plan only covers the Scheduled state's Preview affordance).
  - Versioned republish (publish v2 etc.) → publication-versioning plan.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Editor publishes a draft VoR, unpublishes, republishes; front-end visibility flips each time | dbarnes, anonymous | submission scenario: draft + skipExternalReview + unpublished VoR w/ license metadata + issue Vol 1 No 2 (2014) | Publish via Title & Abstract panel → status STATUS_PUBLISHED + datePublished set; anonymous article URL 200 with title; unpublish → STATUS_QUEUED, reader 404; republish → live again | implemented (lib/pkp/playwright/tests/publish-unpublish.spec.js) |
| 2 | Publish is blocked by an unpaid publication fee (`validatePublish` precondition) | dbarnes | journal scenario: scratch journal; payments + publication (APC) fee enabled via Distribution → Payments UI; submission scenario (`journal` override): production-stage draft VoR w/ issue, no payment recorded | Review Publishing Details modal lists `editor.article.payment.publicationFeeNotPaid` (the named precondition from OJS `validatePublish()` — the only seedable hard blocker besides declined, which row 8 owns); the confirming Publish step is unavailable; publication stays STATUS_QUEUED | planned |
| 3 | Editor publishes without an issue (continuous publishing) | dbarnes, anonymous | submission scenario: production-stage draft VoR w/ full metadata, no issue | "Don't assign to an issue" option in publish flow → article published immediately (STATUS_PUBLISHED, issueId null); anonymous landing 200; not listed on any issue TOC | planned |
| 4 | Author and assistant see no publish/unpublish controls | atester (submitter), gcox (participant), dbarnes (sanity) | submission scenario: production-stage draft VoR, submitter atester, gcox as layout-editor participant | Author's My Submissions workflow view and assistant's workflow view show the Publication tab without Schedule For Publication/Publish/Unpublish buttons; editor view shows them | planned |
| 5 | Editor previews a scheduled article before it is public | dbarnes, anonymous | submission scenario: VoR w/ metadata, `issue` = future Vol 2 No 1 (2015), `published: true` → STATUS_SCHEDULED | Workflow shows status "Scheduled" with Preview + Unschedule buttons; Preview renders the article content; anonymous article URL still 404 | planned |
| 6 | Cancelling the publish dialog leaves the publication untouched | dbarnes | submission scenario: production-stage draft VoR w/ full metadata + issue | Review Publishing Details shows issue assignment and met requirements; Cancel/close → status remains STATUS_QUEUED, Schedule For Publication button still present | planned |
| 7 | Publishing moves the submission to the published/archived dashboard view | dbarnes | submission scenario: unpublished VoR w/ issue, then publish via UI | After publish, editorial dashboard archived/all view lists the submission with "Published" status badge; it leaves the active production queue | planned |
| 8 | Declined submission exposes no publish action | dbarnes | submission scenario: submitted + decline decision (initialDecline) | Workflow shows Declined status; Publication tab renders without Schedule For Publication; revert-decline (covered elsewhere) is the only path back | planned |
