# Subscriptions management

- **Area:** 7. Plugins (key set)
- **Placement:** ojs
- **Budget:** 9 tests
- **Absorbs:** playwright/tests/subscription-config.spec.js (4 of its 5 tests — types create/delete, policies, publishingMode; the Payments-settings test is absorbed by the payments plan)
- **Scenario needs:** journal scenario (`users` incl. `reader` role, `publishingMode`, `issues` passthroughs — all existing). Every test runs on a scratch journal: publicknowledge stays open access and READ-ONLY. Subscription types/subscriptions in rows 1–8 are created through the legacy grids — the grids ARE the behavior under test. **`subscriptions[]` seeding — adjudicated: APPROVED FOR BUILD** (wave-1 work item with parity-audit entry; spec'd in `subscription-access`): hung off `JournalScenarioController::afterContextCreated` (OJS-only, like IssueProcessor; NOT in the shared scenario schema). Used here only by row 9, where the granted subscription is a precondition, not the grid behavior under test.
- **Round 2 / out of scope:**
  - Subscription expiry reminder scheduled task — round-2 backlog per inventory.
  - Online self-serve subscription purchase with payment gateway — payment gateway live flows are round 2; the request-side surface is covered by the payments plan.
  - Subscription notify-email checkbox on the subscription form (SubscriptionNotify mailable) — depends on policy contact fields; low traffic.
  - Bulk subscriber import / renewals at scale.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Manager creates a subscription type | dbarnes | journal scenario (scratch) | /payments → Subscription Types: create form (name, currency, cost, format, duration, individual); row appears with cost string | implemented (playwright/tests/subscription-config.spec.js) |
| 2 | Manager edits subscription policies and they persist | dbarnes | journal scenario (scratch) | Subscription Policies tab: contact name/email + mailing address survive reload | implemented (playwright/tests/subscription-config.spec.js) |
| 3 | Manager deletes a subscription type | dbarnes | journal scenario (scratch) | Row controls → Delete → confirm dialog; row removed from grid | implemented (playwright/tests/subscription-config.spec.js) |
| 4 | Manager flips publishing mode to Subscription and it persists | dbarnes | journal scenario (scratch) | Distribution → Access: subscription radio persists on reload + in context REST payload | implemented (playwright/tests/subscription-config.spec.js) |
| 5 | Manager edits a subscription type | dbarnes | journal scenario (scratch); type via UI | Row controls → Edit reopens the form with stored values; changing name and cost saves and the grid row reflects both | planned |
| 6 | Individual subscription lifecycle in the grid | dbarnes | journal scenario (scratch, `users: [reader]`); type via UI | Individual Subscriptions tab → Create New Subscription modal: pick the reader from the SubscriberSelect grid, set type/status/date range, save; row appears; Edit extends the end date; Delete removes the row | planned |
| 7 | Institutional subscription with institution and IP range | dbarnes | journal scenario (scratch, `users: [reader]` as contact); type with institutional flag via UI | Institutional Subscriptions tab → create: institution name, mailing address, IP range, contact user, type, dates; row appears showing the institution name; edit round-trips the IP range | planned |
| 8 | Reader-facing subscriptions page lists types and contact | anonymous | journal scenario (scratch, `publishingMode: 1`); type + policies via UI | `/about/subscriptions` (subscriptions.tpl) renders the subscription contact from policies and the active type with its cost/duration | planned |
| 9 | Subscriber sees their subscription in their profile | phudson (views) | journal scenario (scratch, `publishingMode: 1`, `users: [reader]`) + `subscriptions[]` seed (approved for build — individual subscription for the reader) | User profile → Subscriptions tab (userSubscriptions.tpl) lists the granted individual subscription with type name and expiry | planned |
