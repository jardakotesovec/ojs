# Site settings

- **Area:** 6. Settings & administration
- **Placement:** lib/pkp
- **Budget:** 3 tests
- **Absorbs:** none
- **Scenario needs:** none — there is no site-level scenario endpoint and these are one-off states, so all rows drive the UI. The site is a singleton: rows 1 and 3 mutate it and must restore the original value in a `finally` block (read the current value first, write it back at the end); row 2 is strictly read-only. No `GAP:` declared — a site-scenario endpoint would only serve these two mutating tests, below the Processor-extension bar.
- **Round 2 / out of scope:**
  - Installing/uninstalling site locales and changing the site primary locale — site-wide mutation that breaks parallel workers mid-flight (forms re-render, sessions re-localize); cannot be isolated. Round-2 candidate for a serial project.
  - `redirectContextId` (redirect entire site to one journal) — redirects the site index for every concurrent test; cannot be isolated.
  - Site logo upload (`pageHeaderTitleImage`) — restore requires deleting an uploaded public file; low value vs. journal-level logo coverage in `website-appearance`. Round 2.
  - Site security form, bulk-emails enablement, site statistics form — config surfaces with no cheap user-visible effect; bulk emails is explicitly round-2 backlog in the inventory.
  - ORCID site settings tab — owned by the `orcid` plan.
  - Site-level navigation menus tab — journal-level equivalent covered in `navigation-menus`; site-level duplicate is round 2.

> **Site-chrome mutation note (principles 7/9):** rows 1 and 3 mutate visible site chrome (site title, site-level page footer) and restore the original values in a `finally` block. While they run, the chrome briefly carries test values — therefore **no other test in the suite may assert site-chrome text** (site title or site-level footer content); assert journal-level chrome instead. Flagged for a possible move to the dedicated serial project if cross-test interference appears.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Admin edits the site title and it renders site-wide | admin, anonymous | UI (restores original value) | Site Setup > Settings form saves a unique title; anonymous site index renders the new title in the header/page title; original title restored and verified at test end | planned |
| 2 | Site languages tab lists installed locales non-destructively | admin | none (read-only) | Admin Site Settings > Languages grid renders the installed locales (en, fr_CA) with the primary-locale and UI/forms/submissions toggles visible; no mutation performed | planned |
| 3 | Admin sets site-level appearance footer and it renders publicly | admin, anonymous | UI (restores original value) | Appearance > Setup form saves a unique `pageFooter`; anonymous site index renders the footer markup; sidebar block options are present on the form; footer restored at test end | planned |
