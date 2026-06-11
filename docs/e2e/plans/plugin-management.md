# Plugin management

- **Area:** 7. Plugins (key set)
- **Placement:** lib/pkp
- **Budget:** 5 tests
- **Absorbs:** none
- **Scenario needs:** journal scenario (`users`, `issues`, `plugins: {name: {enabled, settings}}` passthroughs — all existing). One-off plugin states are flipped through the grid UI, which is itself the surface under test.
- **Round 2 / out of scope:**
  - Plugin Gallery tab (PluginGalleryGridHandler) — fetches the live PKP plugin-gallery feed; no external calls.
  - Plugin upload / install / upgrade / delete — mutates the shared installation filesystem; not parallel-safe.
  - Functional coverage of long-tail generic plugins (htmlArticleGalley, lensGalley, staticPages, customBlockManager, …) — round-2 backlog per inventory.
  - Role gating (403 for non-managers on the grid) — covered generically by roles-permissions.

## Tests

| # | Title | Actors | Seed | Verifies | Status |
|---|-------|--------|------|----------|--------|
| 1 | Manager enables a plugin and the toggle gates its front-end surface | dbarnes, anonymous | journal scenario (scratch, published issue via `issues`) | Settings → Website → Plugins → Installed Plugins grid renders (SettingsPluginGridHandler); checking the webFeed row's enable checkbox shows the success notification and persists on reload; journal homepage `<head>` gains the Atom/RSS `link[rel=alternate]` feed tags; unchecking removes them | planned |
| 2 | Manager edits a plugin's settings through the grid's Settings modal | dbarnes | journal scenario (scratch, `plugins: {citationstylelanguageplugin: enabled}`) | Per-row Settings link action opens the AjaxModal with the plugin's settings form (CSL settings.tpl); changing the primary citation style and saving closes the modal with a notification; reopening the modal shows the saved value | planned |
| 3 | Site admin manages plugins at site level — SERIAL project | admin | UI | /admin/settings → Plugins tab renders the AdminPluginGridHandler grid grouped by category; toggling the **googleScholar** plugin's site-level enable checkbox persists across reload, with the original state restored in a `finally` block. **Serial-project note (principle 9):** a site-level plugin toggle affects all journals and parallel workers, so this test lives in the dedicated serial Playwright project, never in a parallel spec. googleScholar was verified as the safe candidate: display-only (`<head>` citation meta tags on article pages), enabled-by-default, and referenced by no other plan (citationStyleLanguage and webFeed are NOT safe — other rows/plans depend on them). | planned |
| 4 | Plugin enablement is journal-scoped | dbarnes | 2× journal scenario (scratch A with `plugins: {webfeedplugin: enabled}`, scratch B without) | Journal A's plugins grid shows webFeed checked and its homepage carries feed link tags; journal B's grid shows it unchecked and its homepage has none — enabling in one context does not leak into another | planned |
| 5 | Manager filters the installed-plugins grid | dbarnes | journal scenario (scratch) | The grid filter (pluginGridFilter.tpl: name search + category select) narrows the listed rows to matching plugins and restores the full category listing when cleared | planned |
