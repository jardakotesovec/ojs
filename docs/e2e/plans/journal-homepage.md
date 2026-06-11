# Journal homepage

- **Area:** 4. Reader front end
- **Placement:** ojs
- **Budget:** 5 tests
- **Absorbs:** playwright/tests/journal-homepage.spec.js (index test only; its archive test is absorbed by issue-archive-toc)
- **Scenario needs:** submission-published fixture; journal scenario (`users`, `issues`, `enableAnnouncements` passthrough). Announcement content and sidebar/theme configuration are journal-level mutations → scratch journal, seeded via UI (one-off states). `GAP: publications[].metadata.datePublished` passthrough (one-line PublicationsProcessor METADATA_FIELDS addition) — row 4 needs two distinct datePublished values for deterministic newest-first ordering; `Repo::publication()->publish()` only stamps today's date, so two same-day seeded publications sort nondeterministically.
- **Round 2 / out of scope:**
  - Homepage image upload + additional homepage content (website-appearance feature owns appearance forms).
  - Highlights carousel (separate management UI, low usage).
  - Category listing content organization on homepage (`JournalContentOption::CATEGORY_LISTING`) — see browse-category-section round 2.
  - Pagination of the recent-publications listing.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Journal index renders current-issue section with a published article | anonymous | submission-published (publicknowledge) | 200; journal name in `<title>`/h1; "Current Issue" h2; bootstrap issue identification (Vol. 1 No. 2 (2014)) visible | implemented (playwright/tests/journal-homepage.spec.js) |
| 2 | Announcements block on homepage lists a recent announcement | dbarnes (setup), anonymous (assert) | journal scenario (`enableAnnouncements: true`) + UI: create announcement, set `numAnnouncementsHomepage` on the announcements settings form | Homepage `announcements_list` shows announcement title + summary; title links to the announcement detail page | planned |
| 3 | Configured sidebar blocks render on the homepage | dbarnes (setup), anonymous (assert) | journal scenario + UI: Website → Appearance → Setup, enable Information + Make a Submission sidebar blocks | Sidebar (`has_sidebar`) renders both blocks; "Make a Submission" links to about/submissions; Information block links (e.g. For Readers) resolve | planned |
| 4 | Recent-publications homepage organization lists latest articles | dbarnes (setup), anonymous (assert) | journal scenario + 2× submission published **issueless** (`published: true`, no `issue` — `filterByLatestPublished` only includes issueless/unpublished-issue publications) with **distinct `datePublished` values** (same-day dates make the order nondeterministic) + UI: theme option `journalContentOrganization` → Recent Published only (Issue TOC unchecked) | Homepage renders the `.latest_articles` block (`latest_article.tpl`): `ul.cmp_article_list` contains both seeded titles as article summaries, the newer `datePublished` listed first; the `section.current_issue` block is absent (Issue TOC option deselected) | planned |
| 5 | Default homepage navigation links resolve | anonymous | none (bootstrap publicknowledge, read-only) | Primary nav renders Current, Archives, About, Search; each link navigates to the matching page (issue/current, issue/archive, about, search) with 200 | planned |
