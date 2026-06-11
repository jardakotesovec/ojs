# Announcements

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp
- **Budget:** 4 tests (5 rows, within +1 — inventory scope names expiry, which the absorbed spec does not cover)
- **Absorbs:** lib/pkp/playwright/tests/announcements.spec.js (4 tests → rows 1–4)
- **Scenario needs:** scratch journal via `POST /api/v1/_test/scenarios/journal`, with the `enableAnnouncements` passthrough for rows that need the reader route pre-wired (rows 3–5). **Schema caveat (adversarial review):** `enableAnnouncements` is honored by ContextBuilderProcessor's whitelist but is ABSENT from context.json — that schema's `additionalProperties: false` would reject it if validation ran; validation is currently dead code because opis/json-schema is not installed. Wave-1 work item: sync the schema with the whitelist and enable validation. Rows stay as-is. Announcement records themselves are created via UI (one-off state; CRUD is the behavior under test).
- **Round 2 / out of scope:**
  - Homepage announcements block / `numAnnouncementsHomepage` — owned by `journal-homepage` (bootstrap enables announcements on publicknowledge).
  - "Send notification email to users" option on the announcement form (bulk reader mail) — round 2, flagged with bulk-email backlog.
  - Announcement image upload and announcement types — round 2.
  - announcementFeed plugin — round-2 plugin backlog.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Announcement CRUD round-trip | dbarnes | scenario: scratch journal | Settings > Announcements: create with TinyMCE short description → row appears; edit title → updated row; delete with confirm → row gone. | implemented (lib/pkp/playwright/tests/announcements.spec.js) |
| 2 | Enable toggle drives the Announcements nav item | dbarnes | scenario: scratch journal | Website > Setup > Announcements: tick enableAnnouncements + save → nav item appears after reload; untick + save → nav item gone. | implemented (lib/pkp/playwright/tests/announcements.spec.js) |
| 3 | Reader sees a published announcement on /announcement | dbarnes, anonymous | scenario: scratch journal (`enableAnnouncements: true`) | Manager creates an announcement via UI; anonymous reader loads `/{journal}/announcement` → 200 + announcement title rendered. | implemented (lib/pkp/playwright/tests/announcements.spec.js) |
| 4 | Sitemap XML lists announcement URLs when enabled | dbarnes, anonymous | scenario: scratch journal (`enableAnnouncements: true`) | After creating an announcement, `/{journal}/sitemap` returns XML whose `<loc>` entries include an announcement URL. | implemented (lib/pkp/playwright/tests/announcements.spec.js) |
| 5 | Expired announcement hidden from readers, kept in admin | dbarnes, anonymous | scenario: scratch journal (`enableAnnouncements: true`); UI (dateExpire in the past) | Create one current and one expired announcement (dateExpire before today); admin list shows both; public `/announcement` page lists only the current one (`withActiveByDate` filter). | planned |
