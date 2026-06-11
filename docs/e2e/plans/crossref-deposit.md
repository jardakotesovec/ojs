# Crossref deposit

- **Area:** 7. Plugins (key set)
- **Placement:** ojs
- **Budget:** 4 tests
- **Absorbs:** playwright/tests/doi-crossref.spec.js (2 tests)
- **Scenario needs:** journal scenario passthroughs `enableDois`, `doiPrefix`, `registrationAgency`, `plugins: {crossrefplugin: {enabled, settings}}`, `issues` — all existing; `submission-published` fixture. **Crossref-valid publication (adjudicated: NOT an endpoint gap)** — the XML export row needs a publication complete enough to pass the Crossref XSD; this resolves as a richer submission-spec fixture preset: METADATA_FIELDS already passes licenseUrl/abstract, the galley dependency is the approved publications[].galleys[] build, and the XSD-validation timeout (doi-crossref.spec.js footer) is harness config (test-mode `max_execution_time`), not a Processor capability. The export row here and any future DataCite/round-2 agency rows reuse the same "registration-ready publication" preset.
- **Round 2 / out of scope:**
  - Live or mocked Crossref HTTP deposits (`depositSubmissions`), deposit-status polling, and Error-status surfaces produced by failed deposits — NO live external API calls ever; error states are unreachable without a mock agency server.
  - Deposit job queue processing (DepositSubmission jobs) — metrics on the jobs page belong to jobs-queue.
  - Crossref citation DOI check scheduled task (CrossrefCitationDoiCheckTask) — external API.
  - `addAllowedObjectTypes` hook filtering of enabledDoiTypes — unit-level (recorded when doi-crossref.spec.js was written).

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Crossref configured as agency; manager marks a DOI registered | dbarnes | journal scenario (DOI + `registrationAgency` + `plugins` passthroughs) + submission-published | Context resolves `registrationAgency=crossrefplugin`; markRegistered transitions `doiObject.status` to Registered (3); DOI keeps the seeded prefix end-to-end | implemented (playwright/tests/doi-crossref.spec.js) |
| 2 | Manager configures Crossref via the settings UI and it persists | dbarnes | journal scenario (scratch, DOIs on) | Website → Plugins grid enables the Crossref plugin; Distribution → DOIs → Registration selects the agency + fills depositor name/email; values survive reload; context REST payload confirms the agency. Extra assertions on the same settings surface (merged former rows 5–6): the `automaticDoiDeposit` checkbox appears once an agency is selected and its enabled state persists across reload + in the context REST payload; saving the Registration form with empty depositor name/email surfaces required-field validation errors (CrossrefSettings schema requires both) and does not persist | implemented (playwright/tests/doi-crossref.spec.js) |
| 3 | Manager exports Crossref XML for a published submission | dbarnes | journal scenario (Crossref configured) + submission-published with the Crossref-valid fixture preset (licenseUrl/abstract via METADATA_FIELDS, galley via publications[].galleys[]) | Bulk Export on the DOI management page downloads the Crossref deposit XML; file contains the DOI, the depositor block from settings, and the article title — generated locally, never deposited | planned |
| 4 | Deposit affordances appear only when an agency is configured | dbarnes | 2× journal scenario (scratch with Crossref agency seeded; scratch with DOIs on but no agency) | With Crossref configured, the DOI list panel's bulk-actions menu offers Deposit and "Deposit all" (and Export); without an agency those registration actions are absent — no deposit is actually triggered | planned |
