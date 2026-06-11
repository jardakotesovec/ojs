# ORCID

- **Area:** 7. Plugins (key set)
- **Placement:** lib/pkp
- **Budget:** 7 tests
- **Absorbs:** lib/pkp/playwright/tests/orcid.spec.js (5 tests)
- **Scenario needs:** ORCID is **core** (lib/pkp/classes/orcid — OrcidManager, SendAuthorOrcidEmail listener, FieldOrcid), not a plugin; settings live on Settings → Access → ORCID (`#orcidSettings` tab). Uses: journal scenario (`users`, `issues`, `contact` passthroughs), `submission-published` fixture, submission scenario `author: {orcid, orcidIsVerified, email}` passthrough (existing — bypasses the REST orcid validator), Mailpit. Settings mutations always on scratch journals (publicknowledge read-only). No new seeds needed.
- **Round 2 / out of scope:**
  - Live ORCID OAuth handshake / sandbox.orcid.org traffic — NO external API calls ever; the registration-prefill test stubs `window.open` (Cypress-parity iframe-srcdoc trick).
  - Server-side OAuth callback (`AuthorizeUserData` token POST + storage) — PHP unit-test territory (recorded in orcid.spec.js).
  - ORCID work deposits to the member API on publication (PKPOrcidWork) — external API.
  - Editor deletes a contributor's ORCID (FieldOrcid `deleteOrcid` confirm dialog) — secondary affordance, deferred to keep budget on the request/verify/display journey.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Manager fills ORCID settings; values persist; disabling clears the form | dbarnes | journal scenario (scratch) | Settings → Access → ORCID tab: enable + API type (memberSandbox) + client id/secret + city + log level survive reload; disable round-trip unchecks | implemented (lib/pkp/playwright/tests/orcid.spec.js) |
| 2 | Connect ORCID iD button renders on the user profile when enabled | dbarnes | journal scenario (scratch) + ORCID enabled via UI | `/user/profile` exposes `#connect-orcid-button` with ORCID label | implemented (lib/pkp/playwright/tests/orcid.spec.js) |
| 3 | Connecting ORCID during registration populates the form fields | anonymous | journal scenario (scratch) + ORCID enabled via UI | Registration page connect button (stubbed `window.open`) fills given/family name, email, country, affiliation, orcid; sandbox routes intercepted | implemented (lib/pkp/playwright/tests/orcid.spec.js) |
| 4 | Verified ORCID iD renders on the article reader page | anonymous | submission-published + `author: {orcid, orcidIsVerified: true}` | Anonymous article page shows the verified-ORCID link (`a[href=<orcid url>]`) without the unauthenticated marker | implemented (lib/pkp/playwright/tests/orcid.spec.js) |
| 5 | Editor requests ORCID verification on a contributor; email dispatched | dbarnes | journal scenario (scratch, contact passthrough) + submission-published + `author: {email}` | Publication → Contributors → Edit → FieldOrcid "Request verification" + confirm dialog; button flips to "requested"; Mailpit receives "Requesting ORCID record access" scoped to the tag-unique author recipient from the `author: {email}` passthrough (principle 8 — never unscoped inbox queries) | implemented (lib/pkp/playwright/tests/orcid.spec.js) |
| 6 | Unverified ORCID renders distinctly from verified on the reader page | anonymous | submission-published + `author: {orcid, orcidIsVerified: false}` | Article page shows the ORCID with the unverified treatment (unauthenticated suffix/icon branch of `hasVerifiedOrcid()` in article_details.tpl) instead of the verified badge | planned |
| 7 | Publish dispatches ORCID request emails to authors when the setting is on | dbarnes (publishes), author inbox | journal scenario (scratch, published issue, contact) + submission ready to publish; `orcidSendMailToAuthorsOnPublication` + ORCID enabled via UI | Editor publishes via the workflow; SendAuthorOrcidEmail listener mails the unverified author the ORCID authorization request (Mailpit, tag-unique address); the verified-iD negative ("no mail") is asserted against a second tag-unique verified-author address with the unverified author's received message as the positive control bounding the wait (principle 8) | planned |
