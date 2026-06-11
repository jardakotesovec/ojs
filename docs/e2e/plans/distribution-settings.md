# Distribution settings

- **Area:** 6. Settings & administration
- **Placement:** ojs
- **Budget:** 5 tests
- **Absorbs:** none (subscription-config.spec.js touches the Access publishingMode and Payments tabs but is absorbed by `subscriptions-management`; coordinate so its access/payments assertions are not double-counted)
- **Scenario needs:** scratch journal via `POST /api/v1/_test/scenarios/journal` (`publishingMode` passthrough available where a pre-set mode is needed); `submission-published` fixture with `journal` override (row 1). Settings values are driven through the UI — the mutation is the behavior under test.
- **Round 2 / out of scope:**
  - Subscription/paywall enforcement of publishingMode — owned by `subscription-access`.
  - Payments grid, manual payment recording, PayPal config — owned by `payments`.
  - Reader-side license block on the article landing page — owned by `article-landing`; per-publication license overrides by `publication-identifiers-license`.
  - DOIs tabs (setup/registration) — owned by `doi-management`.
  - Statistics tab (geo/institution/SUSHI toggles) — round 2 with the usage-stats pipeline.
  - PKP PN archiving form (plugin-dependent `archivePn` component) — round 2; row 5 covers the always-present LOCKSS/CLOCKSS surface.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | License defaults persist and apply to new publications | dbarnes | scenario: scratch journal + submission-published fixture (journal override, published after settings save) | Distribution > License: set copyright holder (custom "Other" name), license URL (CC BY) and copyrightYearBasis, save, reload → values persist; a submission published afterwards carries the defaults (Permissions & Disclosure panel / publication API copyrightHolder + licenseUrl). | planned |
| 2 | Subscription mode reveals the delayed-open-access duration field | dbarnes | scenario: scratch journal | Distribution > Access: selecting subscription mode reveals the delayedOpenAccessDuration select (showWhen) and a duration can be chosen; switching back to open access hides it. Narrowed in adversarial review to the showWhen reveal only — publishingMode flip persistence is owned by `subscriptions-management` row 4 (implemented); enforcement (reader paywall) by `subscription-access`. | planned |
| 3 | Search-indexing metadata lands in front-end HTML | dbarnes, anonymous | scenario: scratch journal | Distribution > Indexing: set searchDescription and a customHeaders tag, save → persists; anonymous journal homepage HTML contains `<meta name="description">` with the text and the custom header markup in `<head>`. | planned |
| 4 | Enabling payments gates the Payments/Institutions nav entries | dbarnes | scenario: scratch journal | Distribution > Payments: after enabling paymentsEnabled (+ currency) and saving, the manager sidebar gains the Payments and Institutions nav entries; disabling removes them. Nav-entry gating only — the enable-payments settings persistence is owned by `payments` row 1 (implemented), payment flows by `payments`. | planned |
| 5 | LOCKSS/CLOCKSS enablement gates the gateway manifests | dbarnes, anonymous | scenario: scratch journal | Distribution > Archive > LOCKSS: enable LOCKSS + CLOCKSS, save → persists; anonymous `gateway/lockss` and `gateway/clockss` manifest pages render for the journal; with the flags off the manifests are refused. | planned |
