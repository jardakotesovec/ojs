# OAI, sitemap & web feeds

- **Area:** 4. Reader front end
- **Placement:** ojs
- **Budget:** 5 tests
- **Absorbs:** lib/pkp/playwright/tests/oai-dc.spec.js (spec currently lives in lib/pkp because the OAI endpoint is shared; OJS-specific sitemap/feed rows land in playwright/tests — keep or split at implementation time)
- **Scenario needs:** submission-published fixture only. Sitemap and OAI read the DB directly (no search-index dependency); webFeed plugin is enabled by default (`plugins/generic/webFeed/settings.xml`: enabled, displayPage=homepage). No gaps.
- **Round 2 / out of scope:**
  - OAI resumption tokens / paging; marc, marcxml, rfc1807 metadata formats; deleted-record behavior after unpublish.
  - webFeed plugin settings variants (displayPage, recentItems, includeIdentifiers) — round-2 plugin depth; round 1 is presence only per inventory.
  - announcementFeed plugin; sitemap inclusion of announcements (covered by announcements feature, area 6).
  - Site-level sitemap aggregation across journals.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | OAI ListRecords returns DC records for published items | anonymous (API) | submission-published | 200 text/xml; `<ListRecords>` with records; oai_dc block with dc:title/creator/source/language/identifier; seeded title present (tag-scoped) | implemented (lib/pkp/playwright/tests/oai-dc.spec.js) |
| 2 | OAI GetRecord returns the specific record by identifier | anonymous (API) | submission-published | Identifier extracted from ListRecords (`oai:{repo}:article/{id}`); GetRecord echoes identifier + seeded dc:title; no `<error>` | implemented (lib/pkp/playwright/tests/oai-dc.spec.js) |
| 3 | OAI Identify, ListMetadataFormats and ListSets describe the repository | anonymous (API) | none (bootstrap publicknowledge) | Identify returns repository name + admin email; ListMetadataFormats includes oai_dc; ListSets lists the journal set and its section sets (Articles/Reviews) | planned |
| 4 | Journal sitemap XML lists issue and article URLs | anonymous (API) | submission-published | `/{path}/sitemap` returns 200 XML containing issue/current, issue/archive, the seeded issue view URL and the seeded `article/view/{id}` URL | planned |
| 5 | Web feeds are advertised and the atom feed serves the journal content | anonymous (API) | submission-published | Homepage `<head>` carries `<link rel="alternate">` entries for atom/rss; the atom gateway URL returns feed XML with the journal title and current-issue article entries | planned |
