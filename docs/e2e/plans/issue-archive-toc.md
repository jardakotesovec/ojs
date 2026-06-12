# Issue archive & TOC

- **Area:** 4. Reader front end
- **Placement:** ojs
- **Budget:** 4 tests
- **Absorbs:** playwright/tests/journal-homepage.spec.js (archive test only). The earlier claim on playwright/tests/issues.spec.js was removed — all 4 of that spec's tests back issue-management rows 1-4 only (this plan's claim was double-counting; row 2 reverted to `planned` and re-scoped).
- **Scenario needs:** submission-published fixture with `section` override (ART vs REV — both seeded in bootstrap); journal scenario (`users`, `issues`). No gaps. Determinism notes from implementation: (a) scenario-seeded sections all land `seq=0` (SectionProcessor never sequences; sections.seq column default), while the UI create path resequences (SectionForm::execute, REALLY_BIG_NUMBER + resequence) — row 2 creates its second section via the Sections grid UI so the journal section sequence is deterministic; possible SectionProcessor parity candidate for a future wave. (b) Nothing in the publish flow assigns `publications.seq` (schema default 0, even via the real UI), so within-section TOC order is a DB tie — strict title-order assertions inside a section are impossible without custom TOC ordering (round 2).
- **Round 2 / out of scope:**
  - Issue galleys displayed on the TOC (needs issue-galley seeding; issue-management owns the upload UI).
  - Issue/article cover images on archive cards and TOC.
  - Archive pagination beyond one page of issues.
  - Reader-visible effects of custom TOC ordering (issue-management owns the ordering UI).
  - Subscription-gated issue access (subscription-access feature).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Issue archive lists the bootstrapped published issue | anonymous | none (bootstrap publicknowledge) | `/issue/archive` 200; `.page_issue_archive` with "Archives" h1; `ul.issues_archive` contains Vol. 1 No. 2 (2014) | implemented (playwright/tests/journal-homepage.spec.js) |
| 2 | Issue TOC groups articles by section and orders them within sections | dbarnes (setup), anonymous (assert) | journal scenario: scratch journal w/ default ART section + published issue; second section (REV) created via the Sections grid UI for a deterministic section sequence (see Scenario needs note a); 2×2 submissions seeded published into the issue across both sections | Reader issue page renders `.sections` grouped by section in the journal's section sequence (Articles before Reviews, asserted positionally), each seeded article under its own section heading and only there, each section listing exactly its 2 articles. Within-section title ORDER is not asserted — untestable without custom TOC ordering (Scenario needs note b; round 2) | implemented (playwright/tests/issue-archive-toc.spec.js) |
| 3 | Issue TOC groups published articles by section | anonymous | 2× submission-published into bootstrap's published issue: one `section: 'ART'`, one `section: 'REV'` | Issue view renders `.sections` with "Articles" and "Reviews" headings; each seeded title (tag-scoped) listed under its own section | implemented (playwright/tests/issue-archive-toc.spec.js) |
| 4 | /issue/current resolves to the current issue TOC | anonymous | submission-published (publicknowledge) | `/issue/current` 200 showing the current issue identification and TOC; "Current" nav item points there | implemented (playwright/tests/issue-archive-toc.spec.js) |
