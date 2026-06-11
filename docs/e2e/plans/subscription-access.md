# Subscription access

- **Area:** 7. Plugins (key set)
- **Placement:** ojs
- **Budget:** 6 tests
- **Absorbs:** playwright/tests/subscription-access.spec.js (2 tests)
- **Scenario needs:** journal scenario (`publishingMode`, `users`, `issues` with `accessStatus` passthroughs — all existing); `submission-published` fixture with `journal`/`issue` overrides; PDF galley added via the EditorialWorkflowPage POM (the JATS auto-link bypasses galley_link.tpl, so the `restricted` gate signal needs a real galley). All on scratch journals — publicknowledge stays open access, READ-ONLY. **`subscriptions[]` seeding — adjudicated: APPROVED FOR BUILD** (wave-1 work item, with parity-audit entry): hung off `JournalScenarioController::afterContextCreated` (OJS-only, like IssueProcessor; NOT added to the shared scenario schema). Shape: individual/institutional rows `{user|institution+ipRange, typeId, status, dateStart, dateEnd}`. Needed for expired/institutional *preconditions* (rows 4–5 here, subscriptions-management row 9) — not the behavior under test; the expired-subscription state in particular cannot be reached through the create form without back-dating tricks, and driving the multi-step legacy AjaxModal per test costs ~30s each (already the slowest part of the absorbed subscriber test).
- **Round 2 / out of scope:**
  - Purchase-to-unlock flows (article/issue purchase granting access after payment) — gateway side covered by the payments plan; completed-purchase access is round 2.
  - Membership-based access (`dateEndMembership`) — rare configuration.
  - `restrictOnlyPdf` partial gating variant.
  - Subscription expiry reminder task — round-2 backlog per inventory.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Anonymous reader is blocked; editor bypasses the gate | anonymous, dbarnes | journal scenario (subscription mode, issue accessStatus=2) + submission-published + galley via POM | PDF galley link carries `.restricted` for anonymous; same URL as journal manager renders it unrestricted (canPreview bypass) | implemented (playwright/tests/subscription-access.spec.js) |
| 2 | Subscriber reads the full article | dbarnes (grants), phudson (reads) | same as #1 + reader role + individual subscription via UI | After the manager grants phudson an individual subscription, his article view shows the unrestricted PDF link and the abstract body | implemented (playwright/tests/subscription-access.spec.js) |
| 3 | Logged-in non-subscriber is routed to the subscriptions page | phudson | journal scenario (subscription mode, issue accessStatus=2, `users: [reader]`) + submission-published + galley via POM | With no fees configured, requesting the restricted galley as a logged-in non-subscriber redirects to `/about/subscriptions` (ArticleHandler gate), which explains how to subscribe; the article landing still renders metadata with the `.restricted` link | planned |
| 4 | Expired subscription no longer grants access | phudson | journal scenario + `subscriptions[]` seed (approved for build — individual subscription with `dateEnd` in the past) | The formerly subscribed reader's galley link is `.restricted` again — date-range enforcement, not just status | planned |
| 5 | Institutional subscription grants access by IP | anonymous | journal scenario + `subscriptions[]` seed (approved for build — institutional subscription covering 127.0.0.1) | An anonymous request from the matching IP (`subscribedDomain` check) sees the unrestricted galley link without logging in | planned |
| 6 | Delayed open access opens back content | anonymous | journal scenario (subscription mode) + two published issues + submissions; per-issue open-access date via the issue Access tab UI | The issue whose `openAccessDate` has passed serves unrestricted galleys anonymously; the still-embargoed issue's galleys remain `.restricted` (IssueAccessForm accessStatus/openAccessDate) | planned |
