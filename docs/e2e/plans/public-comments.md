# Public comments

- **Area:** 4. Reader front end
- **Placement:** lib/pkp
- **Budget:** 5 tests
- **Absorbs:** lib/pkp/playwright/tests/public-comments.spec.js, lib/pkp/playwright/tests/user-comments-moderation.spec.js
- **Scenario needs:** journal scenario (`enablePublicComments` passthrough), submission-published fixture. After bootstrap enrichment turns public comments ON in publicknowledge, reader-side rows can run on the shared journal (comments are per-submission state); the absorbed specs' scratch journals remain valid and can be simplified during refit. **Adjudicated verdict:** seeded user comments = **APPROVED FOR BUILD, narrow scope** — approved/unapproved comment rows only, written with the same INSERT as the REST controller; **no report seeding**. Justification: the moderation-table row needs comments to exist before the SPA mounts; user-comments-moderation.spec.js documents a Vue reactivity race where comments posted after journal creation reliably hit the API but intermittently never render in the table, and posting via REST in-test requires a CSRF warm-up dance per commenting user. Multiple moderation behaviors (approve/hide/delete) hang off the same seeded state. Wave-1 work item.
- **Round 2 / out of scope:**
  - Report flows: reader reports a comment, Reports tab, report deletion (abuse-handling surface; 12 Cypress items deliberately dropped in the absorbed spec).
  - Delete-own vs delete-others authorization rules (unit-test territory per absorbed spec's analysis).
  - Versioning closes commenting on superseded publications (publication-versioning feature owns version-state effects).
  - Driving the TinyMCE comment textarea end-to-end (REST POST is the capability; covered).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Reader posts a comment, moderator approves, anonymous reader sees it | phudson (commenter), dbarnes (moderator), anonymous (assert) | journal scenario (`enablePublicComments`) + submission-published | New comment is unapproved by default and hidden from anonymous readers; after `setApproval` the comment renders in `#public-comments` on the article page | implemented (lib/pkp/playwright/tests/public-comments.spec.js) |
| 2 | Anonymous reader cannot post — login gate renders instead of input | anonymous | journal scenario (`enablePublicComments`) + submission-published | Comments section renders for anonymous readers but contains no comment textarea; log-in-to-comment prompt shown | implemented (lib/pkp/playwright/tests/public-comments.spec.js) |
| 3 | Moderation page mounts with Comments heading and four tabs | dbarnes | journal scenario (`enablePublicComments`) | `management/settings/userComments` renders Comments heading; All / Approved / Hidden/Needs Approval / Reported tabs; empty state with no comments | implemented (lib/pkp/playwright/tests/user-comments-moderation.spec.js) |
| 4 | Moderator navigates between the four moderation tabs | dbarnes | journal scenario (`enablePublicComments`) | Clicking each tab flips `aria-selected`; table re-queries per tab | implemented (lib/pkp/playwright/tests/user-comments-moderation.spec.js) |
| 5 | Moderator approves and hides comments from the moderation table | dbarnes (moderator), anonymous (assert) | seeded user comments (one approved + one unapproved) on a submission-published — approved wave-1 build, see Scenario needs | Seeded unapproved comment appears under Hidden/Needs Approval; Approve (detail side modal via More Actions → View Comment — Approve/Hide live only there) makes it visible on the anonymous article page; Hide removes a previously approved comment from the public page and moves it between tabs. Implementation note: the store's `setApproval` PUT is tunneled as POST + `X-Http-Method-Override` (useFetch), so response waits match POST. Seeded comments existed before the SPA mounted, so the wave-1 Vue reactivity race documented in the absorbed spec never armed. | implemented (lib/pkp/playwright/tests/user-comments-moderation.spec.js) |
