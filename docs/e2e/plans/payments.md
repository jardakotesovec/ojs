# Payments

- **Area:** 7. Plugins (key set)
- **Placement:** ojs
- **Budget:** 5 tests
- **Absorbs:** playwright/tests/subscription-config.spec.js (1 of its 5 tests — the Distribution → Payments settings test; the other four are absorbed by subscriptions-management)
- **Scenario needs:** journal scenario (`publishingMode`, `users`, `issues`, `contact` passthroughs — all existing; `contact` gives row 3 a tag-unique notify-mail recipient); `submission-published` fixture; Mailpit for the manual-payment notify email. Fees and payment settings are set through the UI (the forms are the surface under test). The completed-payment row records the fee through the product's own `PUT /api/v1/_submissions/{id}/payment` endpoint (the editor-side record-payment API) — product API, not a test seed. All on scratch journals; publicknowledge stays open access. NO live gateway calls ever — PayPal coverage is config-surface only.
- **Round 2 / out of scope:**
  - Live PayPal checkout / IPN fulfillment — external gateway, round 2 (if ever; likely mock-server territory).
  - Self-serve subscription purchase checkout (purchaseIndividualSubscription.tpl flow through a gateway).
  - Editor-side APC waive/record UI: the REST endpoint exists (`_submissions/{id}/payment`) but no Vue dashboard surface currently consumes it — do not invent UI; revisit when the dashboard regains the payment column.
  - `restrictOnlyPdf` fee variant; issue-purchase fee flow (mirrors article purchase).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Manager enables payments with the Manual plugin and settings persist | dbarnes | journal scenario (scratch) | Distribution → Payments: enable + plugin "Manual Fee Payment" + currency + manual instructions survive reload | implemented (playwright/tests/subscription-config.spec.js) |
| 2 | Manager configures reader and author fees | dbarnes | journal scenario (scratch); payments enabled via UI | /payments → Payment Types form: publication, purchase-article, purchase-issue and membership fees save and re-populate on reload (PaymentTypesForm) | planned |
| 3 | Reader hits a fee wall and notifies payment via the Manual plugin | dbarnes (setup), phudson (pays) | journal scenario (subscription mode, issue accessStatus=2, `users: [reader]`) + submission-published + galley via POM; payments + purchaseArticleFee via UI | Logged-in non-subscriber requesting the restricted galley gets the manual-payment page showing the fee amount and instructions; clicking the notify action sends the ManualPaymentNotify email to the journal contact (Mailpit, scoped to the scratch journal's tag-unique contact address set via the `contact` passthrough — principle 8) and shows the "notification sent" confirmation | planned |
| 4 | Recorded payment appears in the payments grid | dbarnes | journal scenario (scratch) + submission-published; payments + publicationFee via UI; payment recorded via product REST | /payments → Payments tab grid (PaymentsGridHandler) lists the completed publication-fee payment with payer, type and amount; the row's details action shows the payment record | planned |
| 5 | PayPal configuration surface renders and persists — no external calls | dbarnes | journal scenario (scratch) | Distribution → Payments: selecting "PayPal Fee Payment" reveals the plugin's fields (account name, client id, secret, test mode); values persist on reload; no request leaves for paypal.com (asserted via routing guard) | planned |
