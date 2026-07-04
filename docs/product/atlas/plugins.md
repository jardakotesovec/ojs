# Atlas sweep: plugins
- Scope: plugins/**, lib/pkp/plugins/**
- Method: `find plugins lib/pkp/plugins -maxdepth 2/3` for dirs & version.xml; description from version.xml `<description>` (none present in this OJS version) falling back to the main `*Plugin.php` `@brief`/`@class` docblock; settings-form presence from `*Form*.php` / `settings*.tpl` grep; hint from `ls docs/e2e/plans/`
- Date: 2026-07-02
- Atom count: 51

| ID | Surface | Pointer | What it is | Hint | Claimed by |
|----|---------|---------|------------|------|------------|
| PLUGIN-blocks-browse | plugins/blocks/browse | BrowseBlockPlugin.php | Sidebar block: browse by issue/section/author | website-appearance e2e |  |
| PLUGIN-blocks-developedBy | plugins/blocks/developedBy | DevelopedByBlockPlugin.php | Sidebar block: "developed by PKP" credit | website-appearance e2e |  |
| PLUGIN-blocks-information | plugins/blocks/information | InformationBlockPlugin.php | Sidebar block: for readers/authors/librarians info | website-appearance e2e |  |
| PLUGIN-blocks-languageToggle | plugins/blocks/languageToggle | LanguageToggleBlockPlugin.php | Sidebar block: UI language selector | languages-locales e2e |  |
| PLUGIN-blocks-makeSubmission | plugins/blocks/makeSubmission | MakeSubmissionBlockPlugin.php | Sidebar block: "make a submission" link | website-appearance e2e |  |
| PLUGIN-blocks-subscription | plugins/blocks/subscription | SubscriptionBlockPlugin.php | Sidebar block: subscription status/info | subscription-access e2e |  |
| PLUGIN-generic-announcementFeed | plugins/generic/announcementFeed | AnnouncementFeedPlugin.php | RSS/Atom feed for journal announcements; has settings form (context) | announcements e2e |  |
| PLUGIN-generic-citationStyleLanguage | plugins/generic/citationStyleLanguage | CitationStyleLanguagePlugin.php | Citation Style Language export (APA/MLA/etc.); has settings form (context) | citation-style-language e2e |  |
| PLUGIN-generic-credit | plugins/generic/credit | CreditPlugin.php | NISO CRediT contributor role vocabulary; has settings form (context) | contributors e2e |  |
| PLUGIN-generic-crossref | plugins/generic/crossref | CrossrefPlugin.php | Deposit DOIs/metadata to Crossref registration agency; no dedicated settings form (uses core DOI settings) (context) | crossref-deposit e2e |  |
| PLUGIN-generic-customBlockManager | plugins/generic/customBlockManager | CustomBlockPlugin.php / CustomBlockManagerPlugin.php | Manage custom sidebar text/HTML blocks; has per-block form (context) | website-appearance e2e |  |
| PLUGIN-generic-datacite | plugins/generic/datacite | DatacitePlugin.php | Deposit DOIs/metadata to DataCite registration agency; no dedicated settings form (context) | doi-management e2e |  |
| PLUGIN-generic-doaj | plugins/generic/doaj | DOAJPlugin.php | Register articles/versions with DOAJ; has settings form (context) | doi-management e2e |  |
| PLUGIN-generic-driver | plugins/generic/driver | DRIVERPlugin.php | Inject DRIVER guidelines metadata tags; no settings form (context) | oai-sitemap-feeds e2e |  |
| PLUGIN-generic-dublinCoreMeta | plugins/generic/dublinCoreMeta | DublinCoreMetaPlugin.php | Inject Dublin Core meta tags for indexing; no settings form (context) | ? |  |
| PLUGIN-generic-googleAnalytics | plugins/generic/googleAnalytics | GoogleAnalyticsPlugin.php | Insert Google Analytics tracking code; has settings form (context) | usage-statistics e2e |  |
| PLUGIN-generic-googleScholar | plugins/generic/googleScholar | GoogleScholarPlugin.php | Inject Google Scholar meta tags for indexing; no settings form (context) | site-search e2e |  |
| PLUGIN-generic-htmlArticleGalley | plugins/generic/htmlArticleGalley | HtmlArticleGalleyPlugin.php | Display HTML galley content with image support; no settings form (context) | galleys e2e | galleys |
| PLUGIN-generic-jatsTemplate | plugins/generic/jatsTemplate | JatsTemplatePlugin.php | Generate/attach JATS XML galley template; no settings form (context) | galleys e2e | galleys (render plugin; JATS content-API + oaiJats seam → jats-content-api) |
| PLUGIN-generic-lensGalley | plugins/generic/lensGalley | LensGalleyPlugin.php | Display galleys via eLife Lens reader viewer; no settings form (context) | galleys e2e | galleys |
| PLUGIN-generic-pdfJsViewer | plugins/generic/pdfJsViewer | PdfJsViewerPlugin.php | Embed pdf.js viewer for in-browser PDF display; no settings form (context) | galleys e2e | galleys |
| PLUGIN-generic-pflPlugin | plugins/generic/pflPlugin | PflPlugin.php | Generate Publication Facts Label for articles; has settings form (context) | ? |  |
| PLUGIN-generic-pluginTemplate | plugins/generic/pluginTemplate | PluginTemplatePlugin.php | Starter template/example for new generic plugins; has settings form (context) | ? |  |
| PLUGIN-generic-recommendByAuthor | plugins/generic/recommendByAuthor | RecommendByAuthorPlugin.php | Recommend other articles by same author; no settings form (context) | article-landing e2e |  |
| PLUGIN-generic-recommendBySimilarity | plugins/generic/recommendBySimilarity | RecommendBySimilarityPlugin.php | Recommend similar articles by keyword match; no settings form (context) | article-landing e2e |  |
| PLUGIN-generic-staticPages | plugins/generic/staticPages | StaticPagesPlugin.php | Create/manage custom static content pages; has management form (context) | public-pages e2e |  |
| PLUGIN-generic-tinymce | plugins/generic/tinymce | TinyMCEPlugin.php | WYSIWYG rich-text editor for textareas; no settings form (context) | ? |  |
| PLUGIN-generic-usageEvent | plugins/generic/usageEvent | UsageEventPlugin.php | App-specific usage-event generation for stats; no settings form (context) | usage-statistics e2e |  |
| PLUGIN-generic-webFeed | plugins/generic/webFeed | WebFeedBlockPlugin.php | RSS/Atom feed of recently published content; has settings form (context) | oai-sitemap-feeds e2e |  |
| PLUGIN-importexport-native | plugins/importexport/native | NativeImportExportPlugin.php | Native OJS XML import/export of submissions/issues (context) | native-xml-import-export e2e |  |
| PLUGIN-importexport-pubmed | plugins/importexport/pubmed | PubMedExportPlugin.php | Export article metadata as PubMed/MEDLINE XML; has settings form (context) | native-xml-import-export e2e |  |
| PLUGIN-importexport-users | plugins/importexport/users | UserImportExportPlugin.php | Bulk XML import/export of user accounts (context) | user-management e2e |  |
| PLUGIN-metadata-dc11 | plugins/metadata/dc11 | Dc11Plugin.php | Dublin Core 1.1 metadata field mapping plugin (context) | ? |  |
| PLUGIN-oaiMetadataFormats-dc | plugins/oaiMetadataFormats/dc | OAIMetadataFormatPlugin_DC.php | OAI-PMH Dublin Core metadata format handler (site) | oai-sitemap-feeds e2e |  |
| PLUGIN-oaiMetadataFormats-marc | plugins/oaiMetadataFormats/marc | OAIMetadataFormatPlugin_MARC.php | OAI-PMH MARC metadata format handler (site) | oai-sitemap-feeds e2e |  |
| PLUGIN-oaiMetadataFormats-marcxml | plugins/oaiMetadataFormats/marcxml | OAIMetadataFormatPlugin_MARC21.php | OAI-PMH MARCXML (MARC21) metadata format handler (site) | oai-sitemap-feeds e2e |  |
| PLUGIN-oaiMetadataFormats-oaiJats | plugins/oaiMetadataFormats/oaiJats | OAIMetadataFormatPlugin_JATS.php | OAI-PMH JATS metadata format; has settings form (site) | oai-sitemap-feeds e2e |  |
| PLUGIN-oaiMetadataFormats-rfc1807 | plugins/oaiMetadataFormats/rfc1807 | OAIMetadataFormatPlugin_RFC1807.php | OAI-PMH RFC1807 metadata format handler (site) | oai-sitemap-feeds e2e |  |
| PLUGIN-paymethod-manual | plugins/paymethod/manual | ManualPaymentPlugin.php | Manual/offline payment method for fees (context) | payments e2e |  |
| PLUGIN-paymethod-paypal | plugins/paymethod/paypal | PaypalPaymentPlugin.php | PayPal payment method for fees; has settings form (context) | payments e2e |  |
| PLUGIN-pubIds-urn | plugins/pubIds/urn | URNPubIdPlugin.php | Assign URN public identifiers to objects; has settings form (context) | publication-identifiers e2e | publication-identifiers |
| PLUGIN-reports-articles | plugins/reports/articles | ArticleReportPlugin.php | Generate CSV article metadata report (context) | usage-statistics e2e |  |
| PLUGIN-reports-counter | plugins/reports/counter | CounterReportPlugin.php | Generate COUNTER usage statistics report (context) | usage-statistics e2e |  |
| PLUGIN-reports-reviewReport | plugins/reports/reviewReport | ReviewReportPlugin.php | Generate CSV peer-review activity report (context) | review-decisions e2e |  |
| PLUGIN-reports-subscriptions | plugins/reports/subscriptions | SubscriptionReportPlugin.php | Generate CSV subscriptions report (context) | subscriptions-management e2e |  |
| PLUGIN-themes-default | plugins/themes/default | DefaultThemePlugin.php | Default OJS theme with typography/colour options; has settings/options form (context) | website-appearance e2e |  |
| PLUGIN-libpkp-generic-usageEvent | lib/pkp/plugins/generic/usageEvent | PKPUsageEventPlugin.php | Abstract base class for usage-event plugin (extended by app plugin) | usage-statistics e2e |  |
| PLUGIN-libpkp-importexport-native | lib/pkp/plugins/importexport/native | PKPNativeImportExportPlugin.php | Abstract base native XML import/export plugin (extended by app plugin) | native-xml-import-export e2e |  |
| PLUGIN-libpkp-importexport-users | lib/pkp/plugins/importexport/users | PKPUserImportExportPlugin.php | Abstract base user XML import/export plugin (extended by app plugin) | user-management e2e |  |
| PLUGIN-libpkp-metadata-dc11 | lib/pkp/plugins/metadata/dc11 | PKPDc11MetadataPlugin.php | Abstract base Dublin Core 1.1 metadata plugin (extended by app plugin) | ? |  |
| PLUGIN-libpkp-oaiMetadataFormats-dc | lib/pkp/plugins/oaiMetadataFormats/dc | PKPOAIMetadataFormatPlugin_DC.php | Abstract base OAI-PMH Dublin Core format plugin (extended by app plugin) | oai-sitemap-feeds e2e |  |

## Gaps
- `plugins/gateways/` category is empty in this checkout (only `.gitkeep`) — no gateway plugins bundled; category exists in the plugin-type taxonomy but has zero atoms.
- No `version.xml` in this OJS version carries a `<description>` tag (checked all 46 `plugins/**` version.xml files) — descriptions above are sourced from the `@brief`/`@class` docblock of the main plugin class instead, per the fallback rule.
- `lib/pkp/plugins/{generic/usageEvent,importexport/native,importexport/users,metadata/dc11,oaiMetadataFormats/dc}` are abstract base classes with no own `version.xml`; each is 1:1 extended by an OJS-side plugin already listed above, so treat the pair as one feature when claiming.
- "Site vs context" column folded into the "What it is" cell (site) / (context) tag rather than a separate column, since the atlas table schema is fixed; OAI metadata-format plugins are the only clearly site-wide ones (registered once for the whole OAI repository, not per-journal toggle) — all others are per-context (journal) enable/configure surfaces typical of OJS's Website > Plugins management.
- Settings-form detection is heuristic (`*Form*.php` / `settings*.tpl` grep, filtered for `Format` false-positives) — plugins using newer schema/Vue-driven settings (e.g. crossref/datacite DOI registration agencies, now centralized under core Distribution > DOI settings) show "no dedicated settings form" here even though they are configurable elsewhere; flagged inline rather than omitted.

Oddities (not counted as gaps, reported per prompt instructions):
- `plugins/generic/citationStyleLanguage`, `plugins/generic/crossref`, `plugins/generic/webFeed`, and `lib/pkp` are separate git checkouts (submodules) each showing local commits ahead of the pinned SHA (`git submodule status` prefixes `+`) — read-only sweep, not modified by this pass.
- `plugins/generic/credit` and `plugins/generic/pluginTemplate` are untracked (`??`) local directories, not part of the committed submodule/plugin set.
- `plugins/generic/pflPlugin` ("Publication Facts Label") is a tracked, non-standard third-party plugin bundled in this checkout — not part of the stock PKP plugin roster.
