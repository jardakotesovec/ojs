---
name: article-landing
scope: The reader-facing ARTICLE abstract page (`/article/view/{id}`) — the published metadata display (title, authors + ORCID, abstract, keywords, section, published date, DOI, references), the galley view/download links + the pdf.js viewer, the license/copyright display, the how-to-cite / Crossmark / recommend-by reader blocks, the version view + outdated-version notice, and the DC/Google-Scholar indexer meta tags injected into its head
shared: no          # the reader ArticleHandler + article.tpl/article_details.tpl/galley_link.tpl are OJS-specific (OMP=CatalogBookHandler, OPS=PreprintHandler); it *reuses* shared lib/pkp frontend Vue islands (PkpCrossmarkButton, PkpComments) and the OpenReview/Comment components, but the page/handler/templates are OJS's own
status: verified
e2e-plans: [article-landing]
atlas-claims:
  - PAGE-article-view
  - PAGE-article-viewfile
  - VUE-pkp-crossmark-button
  - PLUGIN-generic-recommendByAuthor
  - PLUGIN-generic-recommendBySimilarity
---

# Article landing page (the reader's article abstract page)

## Purpose

When a reader clicks an article from the journal home page, an issue table of contents, a search
result, or a DOI/DC-indexed link, they land on the **article abstract page** — `ArticleHandler::view`
at `/index.php/{journal}/{lang}/article/view/{id}`. This is the public, anonymous-by-default reader
face of a published article: the **title, authors (with ORCID and affiliation/ROR), abstract,
keywords, section, published date, DOI and references**, the **download/view links for each galley**
(the PDF opens in an embedded pdf.js viewer; HTML/XML/remote render inline or link out), the
**license and copyright** notice, the **how-to-cite** block with citation-format links and
BibTeX/RIS downloads, and — when their plugins are enabled — a **Crossmark** button, **recommend-by**
related-article blocks, and machine-readable **Dublin Core / Google Scholar meta tags** in the page
head for indexers. The same handler serves **older versions** (`/version/{publicationId}`, with an
"outdated version" notice and a `noindex` robots header) and lets editorial staff **preview** an
unpublished/scheduled version. This spec owns the **page and its reader render**; the data it shows
is authored on the Publication-record tabs and the rules that populate it live in those features
(pointers below).

## Actors & permissions

The page is **public**. Two baselines apply to every row: **Anonymous reader** — the default actor,
no login; **canPreview user** — an editorial user (manager/site-admin, or an assigned editor/
assistant/author) who may see an *unpublished/scheduled* version (`Repo::submission()->canPreview`).
"Published" here means the *publication version* has status **Published** *and* the journal itself is
in a published state (`OjsJournalMustPublishPolicy`); a disabled/unpublished journal makes the whole
page unreachable. Galley **download** streaming and its subscription/payment gate are owned by
`galleys` / `subscriptions` / `payments`; this spec owns the page, the reader galley **links**, and
the abstract-level access flags. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **View the article abstract page** | • Anonymous reader — any **published** article's current version (200); an unpublished/unscheduled article is **not-found** to the public (404), never a login wall<br>• canPreview user — additionally the **unpublished/scheduled** version, shown with a "you are viewing a preview" notice <sup>b</sup> |
| **View an older (published) version** | • Anyone — `…/version/{publicationId}` of any **published** past version; the page shows an "outdated version" notice linking to the current one and sends a `noindex` robots header + a canonical link to the latest<br>• An *unpublished* draft version is preview-only (canPreview), else 404 <sup>c</sup> |
| **View / download a galley** (the reader links) | • Anyone — for a published article, each galley renders as a **view link** (PDF → pdf.js viewer, HTML/XML → inline, remote → redirect out) and a raw **download**; subject to the journal's subscription/payment gate (open access, subscribed user/domain, purchased article/issue, membership, or a PDF-only restriction that frees non-PDF galleys)<br>• A gated galley link is drawn with a **restricted** marker and (if purchasable) a fee; clicking it triggers the login/subscribe/purchase flow instead of the file<br>• canPreview user — may open galleys on an unpublished article; the public is **not-found** on an unpublished article's galley <sup>d</sup> |
| **Use the how-to-cite / Crossmark / recommend-by blocks** | • Anyone — but each block **only appears when its plugin is enabled** for the journal: how-to-cite (citationStyleLanguage), Crossmark button (crossref + its Crossmark option), recommend-by-author / -by-similarity blocks (their generic plugins, off by default) <sup>e</sup> |
| **Post / read public comments** | • Reader — only when the journal has **public comments enabled**; the comments surface is owned by `public-comments` (rendered here as a Vue island) <sup>f</sup> |

<sup>a</sup> `ArticleHandler::authorize()` (`ContextRequiredPolicy` + `OjsJournalMustPublishPolicy`; optional `Authorization: Bearer <apiToken>` header path for API-key preview of unpublished/subscription content); `ArticleHandler::view()` ·
<sup>b</sup> `ArticleHandler::initialize()` (`status !== STATUS_PUBLISHED && (!$user || !canPreview)` → `NotFoundHttpException`); `article_details.tpl` `submission.viewingPreview` notice; live 2026-07-04 (ojs_main): published sub → 200 `obj_article_details`; unpublished subs 2 & 3 → **404** anonymous ·
<sup>c</sup> `ArticleHandler::view()` (`publication->getId() != currentPublicationId` → `addHeader('noindex'…)` + canonical link); `article_details.tpl` `submission.outdatedVersion`; live 2026-07-04: `…/16/version/17` (older published) → 200 with `<meta name="robots" content="noindex">`, `<link rel="canonical" …/article/view/16>` and the "This is an outdated version published on …" notice ·
<sup>d</sup> `ArticleHandler::userCanViewGalley()`; `galley_link.tpl` (`restricted` class, `reader.subscriptionAccess`/`reader.subscriptionOrFeeAccess`, purchase cost); download streaming in `galleys` (`PAGE-article-download`) ·
<sup>e</sup> `CitationStyleLanguagePlugin::addCitationMarkup()` / `CrossrefPlugin::displayCrossmarkButton()` (both on `Templates::Article::Details`); `RecommendByAuthorPlugin`/`RecommendBySimilarityPlugin` (`Templates::Article::Footer::PageFooter`); each guarded by `$this->getEnabled()` ·
<sup>f</sup> `ArticleHandler::view()` (`enablePublicComments` → `UserCommentComponent`); `article_details.tpl` `<pkp-comments>`; owned by `public-comments`

## Fields & validation

**N/A as an input surface** — the article page is a **read-only reader render**; it has no form and
validates nothing. Every value shown is display-only, sourced from the article's **current (or
requested) publication** and the journal context, and *authored* on the Publication-record tabs
(each field's create/validate rules live in the owning feature). What the reader sees, and who owns
the source field:

| Shown on the page | Rendered from | Field/rules owned by |
|-------------------|---------------|----------------------|
| Title, subtitle, abstract, plain-language summary | `publication` localized data | `publication-title-abstract-body` |
| Authors: name, affiliation (+ ROR icon/link), contributor roles, **ORCID icon + link**, CRediT roles | `publication->authors`, `creditRoleTerms`, `orcidIcon`/`orcidUnauthenticatedIcon` | `contributors` (author record); ORCID badge logic → `orcid` |
| Keywords / subjects | `publication->keywords` | `publication-metadata-references` / `submission-wizard-metadata` |
| DOI (resolving URL) | `doiObject` (with versioning fallback, rule 8) | `publication-identifiers` / `doi-management` |
| References list | `parsedCitations` / `citationsRaw` | `publication-metadata-references` |
| License badge + copyright statement + license terms | `ccLicenseBadge`, `licenseUrl`, `copyrightHolder/Year`, context `licenseTerms` | `publication-license` (snapshot) / `distribution-settings` (defaults) |
| Data-availability statement | `publication` `dataAvailability` | `data-availability-citations` |
| Funding statement | `publication` `fundingStatement` | `publication-metadata-references` |
| Issue / section / categories / article number / cover image | `issue`, `section`, `categories`, `publication` | `publication-issue-assignment`, `sections`, `categories`, `issue-management` |
| Published date + version list | `firstPublication`, `getPublishedPublications()` | `publication-versioning` / `publication-publish-flow` |
| Galley view/download links, JATS download | `primaryGalleys`/`supplementaryGalleys`, `jatsDownloadUrl` | `galleys` (entity + download) |

## Rules & state

The handler resolves the target publication in `initialize()`, gates public visibility, then `view()`
assembles the template variables and displays `frontend/pages/article.tpl` → `article_details.tpl`.

1. **URL resolution and canonicalisation.** The path segment is a submission **id or urlPath**;
   an unknown one is **404**. If the reader used an id but the submission has a urlPath (or vice
   versa), the handler **redirects to the canonical URL**. A galley segment that uses the numeric id
   when a urlPath exists likewise redirects; a galley id that only matches an *outdated* version's
   galley redirects to the current article page; an unmatched galley id is 404. <sup>a</sup>
2. **Published-only public visibility (the core gate).** A publication version that is **not
   Published** is served **only** to a `canPreview` user (editorial staff / the author) — everyone
   else gets a **404, not a login prompt**. The surrounding `OjsJournalMustPublishPolicy` additionally
   makes the whole handler unreachable on a journal that is not in a published state. This is the
   reader-visibility "flip" that `publication-publish-flow` triggers on publish/unpublish; the page it
   flips *on* is owned here. **Live-verified 2026-07-04**: a published submission → 200 rendering
   `obj_article_details`; unpublished submissions → 404 anonymous. <sup>b</sup>
3. **Version view + the "outdated version" notice.** `/article/view/{id}/version/{publicationId}`
   renders that specific version (404 if the id isn't one of the submission's publications). When the
   requested version is **not the current** one, the page (a) prepends an **"outdated version"** notice
   linking to the latest, (b) emits `<meta name="robots" content="noindex">`, and (c) adds a
   `<link rel="canonical">` to the current article URL — so indexers keep only the latest. An
   **unpublished** version shows a **"viewing a preview"** notice instead (canPreview only).
   **Live-verified 2026-07-04** on an older published version. The version lifecycle is owned by
   `publication-versioning`; this spec owns the reader render of the version + its notices. <sup>c</sup>
4. **Metadata block (main column).** In order: preview/outdated notice, title, subtitle, then the
   **authors** list — each author's full name, affiliation names with a **ROR** link icon, textual
   contributor roles, an **ORCID** row (the *verified* icon vs the *unauthenticated* icon by
   `hasVerifiedOrcid()`, plus the ORCID URL as a link), and CRediT roles — then **DOI**, **keywords**,
   **abstract**, **plain-language summary**, the `Templates::Article::Main` hook, an optional
   **usage-statistics download chart** (theme `displayStats` option), **author biographies**, and the
   **references** list. Note the ORCID here is **raw template markup**, *not* the `PkpOrcidDisplay` Vue
   component (seam, rule 12). <sup>d</sup>
5. **References display.** Renders the publication's **parsed citations** (`getRawCitationWithLinks()`,
   each passed through the `Templates::Article::Details::Reference` hook for plugin enrichment) or, if
   none are parsed, the **raw citation text**. The citation *data/edit* is owned by
   `publication-metadata-references`; this spec owns the reader list. <sup>e</sup>
6. **Galley links: primary/supplementary split + reader link.** `view()` splits the publication's
   galleys into **primary** (a remote-URL galley, or a file whose genre is a *primary* component) and
   **supplementary** (a *supplementary*-genre file) in `seq` order, dropping any galley with neither a
   file nor a URL. Each renders via `galley_link.tpl` as a link to the **view** op
   (`/article/view/{id}/{galleyId}`, or a `/version/…` link on an older version). A PDF galley gets a
   `pdf` type class; others get `file`. A galley the reader may **not** access is drawn with a
   `restricted` class + screen-reader "subscription/fee access" text + (if purchasable) a fee. **A
   remote-URL galley's view link redirects the reader straight out to that URL.** **Live-verified**:
   the reader page lists a PDF galley link. <sup>f</sup>
7. **Galley view → render plugin → pdf.js smoke.** Opening a **file** galley's view URL fires the
   `ArticleHandler::view::galley` hook, which the format plugins claim by file type (owned by
   `galleys`): a **PDF** renders in the embedded **pdf.js** viewer, HTML/XML render inline (Lens for
   XML), and an unclaimed type **redirects to the raw download**. **Live-verified 2026-07-04**: the PDF
   galley view returns the pdf.js viewer (`pdfJsViewer/pdf.js/web/viewer.html?file=…` + a
   `#pdfCanvasContainer`). The **download** op that streams the file — and its access gate — is owned
   by `galleys` (`PAGE-article-download`). This spec also owns the two **deprecated OJS-2 redirects**
   on this handler: `viewFile` (`PAGE-article-viewfile`) 301-redirects to `download` (companion to
   galleys' `downloadSuppFile`). <sup>g</sup>
8. **DOI display with a versioning fallback.** The page shows the **current version's DOI** as its
   resolving URL. If the requested publication has no own DOI, the handler falls back: with DOI
   *versioning* on, to a **sibling minor version's** DOI; otherwise to the **current** publication's
   DOI. DOI minting/format is owned by `publication-identifiers`; this spec owns the reader display. <sup>h</sup>
9. **License / copyright display.** When the publication has a **license URL** or the journal has
   **license terms**, the entry-details column shows a **copyright statement** (`copyrightHolder` +
   `copyrightYear`), the **CC license badge** (image) when the license URL is a recognised Creative
   Commons one, else a plain license link, and the journal's free-text **license terms**. The license
   *snapshot* onto the publication is owned by `publication-license`; this spec owns its reader render. <sup>i</sup>
10. **Data-availability statement — shown; data citations — not.** The publication's
    **data-availability statement** renders as its own section (`#data-availability-statement`). The
    structured **data citations** managed alongside it have **no reader-facing display** in 3.6 (a
    `data-availability-citations` ⚠, ledger row 98) — this page renders only the statement. The
    **funding statement** and **plain-language summary** render similarly when set. <sup>j</sup>
11. **How-to-cite block (plugin, server-rendered).** The **citationStyleLanguage** plugin hooks
    `Templates::Article::Details` and injects a server-rendered **"How to Cite"** block: the article
    formatted in the journal's **primary style** (default APA), a **citation-formats** dropdown of the
    enabled styles (each an AJAX link swapping the shown citation), and **download** links for the
    enabled export formats (BibTeX/RIS/…). The block appears **only when the plugin is enabled**; the
    styles offered, the primary style, and the downloads are owned by `citation-style-language`
    (feature 82) — including the `VUE-pkp-cite` island, which is **not** what the OJS default theme
    mounts (the default render is the Blade `citation-block`, not the Vue component). ⚠ On the probed
    dev DB the plugin was **not enabled**, so the block did not render (Open question 1). <sup>k</sup>
12. **Crossmark button (plugin + setting-gated Vue island).** The **crossref** plugin hooks
    `Templates::Article::Details` and, **only when its "Crossmark" option is enabled**, injects
    `crossmarkButton.tpl` — a `data-vue-root` section mounting the **`<pkp-crossmark-button>`** Vue
    component plus the Crossmark widget script — and adds a `DC.Identifier.DOI` meta tag the widget
    reads. This spec claims the reader **button** (`VUE-pkp-crossmark-button`); the Crossmark **deposit**
    and the enable setting are owned by `doi-deposit`. Off by default; not present on the probed DB. <sup>l</sup>
13. **Recommend-by related-article blocks (plugins, footer).** **recommendByAuthor** and
    **recommendBySimilarity** each hook `Templates::Article::Footer::PageFooter` (the hook `article.tpl`
    calls after the details) to append a "readers also read / similar articles" block — by same author,
    or by keyword/full-text similarity. Both are **generic plugins that are disabled by default** (no
    `enabled` default in their settings), so neither block appears until a manager enables it. <sup>m</sup>
14. **Open-review reader block follows review-anonymity.** `view()` prepares an **OpenReviewComponent**
    config (locale keys, SVG icons, constants) on **every** article page, but the **OJS default theme
    has no inline `<pkp-open-review>` mount** — the public open-review *reader surface* is owned by
    `open-peer-review-display`, and *what* it may reveal (a reviewer's identity only under the **open**
    method, and only for a review marked publicly-visible + accepted + editor-confirmed) is the single
    rule owned by `review-anonymity` (which claims `VUE-pkp-open-review`). This spec neither owns nor
    re-states that rule; it hosts the config. <sup>n</sup>
15. **Indexer meta tags in the head (plugins).** **dublinCoreMeta** and **googleScholar** are generic
    plugins **enabled by default** (`settings.xml` `enabled=true`) that inject machine-readable
    `<meta name="DC.*">` (Dublin Core) and `<meta name="citation_*">` (Google Scholar, incl.
    `citation_pdf_url`) tags into this page's head for indexers. **Live-verified 2026-07-04**: both
    families render on the article page. The **`<meta>` tags themselves** are owned by
    `indexing-meta-tags` (feature 74); this spec owns the visible page they ride on (seam, rule 12 of
    the atom notes). <sup>o</sup>
16. **Usage stats fire on this page.** Displaying the abstract emits a **UsageEvent** for the
    submission (`ASSOC_TYPE_SUBMISSION`); a galley **file download** emits one for the file (owned by
    `galleys`). These feed `usage-statistics`. The optional per-article **downloads chart** is a theme
    option (`displayStats`). <sup>p</sup>

<sup>a</sup> `ArticleHandler::initialize()` (`getByUrlPath`/`get`; `getBestId()` canonical redirect; galley id/urlPath redirects; unmatched → `NotFoundHttpException`) ·
<sup>b</sup> `ArticleHandler::initialize()` (`status !== STATUS_PUBLISHED && (!$user || !canPreview)`); `ArticleHandler::authorize()` `OjsJournalMustPublishPolicy`; live ojs_main 2026-07-04 ·
<sup>c</sup> `ArticleHandler::initialize()` (`version` subPath → matching publication or 404) + `ArticleHandler::view()` (`noindex`/canonical headers); `article_details.tpl` (`submission.viewingPreview` / `submission.outdatedVersion`); live `…/16/version/17` ·
<sup>d</sup> `article_details.tpl` (`main_entry`: authors/DOI/keywords/abstract/plainLanguageSummary/`Templates::Article::Main`/usage-chart/author_bios/references); `hasVerifiedOrcid()`, `OrcidManager::getIcon()` ·
<sup>e</sup> `article_details.tpl` references section (`parsedCitations` `getRawCitationWithLinks()` / `citationsRaw`; `Templates::Article::Details::Reference` hook) ·
<sup>f</sup> `ArticleHandler::view()` (primary/supplementary genre split via `GenreDAO::getPrimaryByContextId`/`getBySupplementaryAndContextId`); `galley_link.tpl` (`isPdfGalley`, `restricted`, purchase cost); live PDF galley link ·
<sup>g</sup> `ArticleHandler::view()` (`ArticleHandler::view::galley` hook else redirect `download`); `ArticleHandler::viewFile()` (301 → `download`); render plugins + `download` owned by `galleys`; live pdf.js viewer on the galley view ·
<sup>h</sup> `ArticleHandler::view()` (`doiObject` fallback: `Context::SETTING_DOI_VERSIONING` → `getMinorVersionsDoi`, else current publication's `doiObject`) ·
<sup>i</sup> `article_details.tpl` copyright section (`ccLicenseBadge`, `submission.copyrightStatement`, context `licenseTerms`); `Application::getCCLicenseBadge()`; `publication-license` ·
<sup>j</sup> `article_details.tpl` `dataAvailability` (`#data-availability-statement`), `fundingStatement`, `plainLanguageSummary`; `data-availability-citations` rule 9 / ledger row 98 ·
<sup>k</sup> `CitationStyleLanguagePlugin::register()` (`Templates::Article::Details` → `addCitationMarkup()`; `ArticleHandler::view` → `getTemplateData()`), `templates/citation-block.blade`, `getPrimaryStyleName()` (default `apa`); ojs_main: no `enabled` row → block absent ·
<sup>l</sup> `CrossrefPlugin::register()` (`Templates::Article::Details` → `displayCrossmarkButton()`, gated `getSetting(...,'crossmark')`; `ArticleHandler::view` → `addCrossmarkDoiMeta()`), `templates/crossmarkButton.tpl` (`<pkp-crossmark-button>`); `doi-deposit` ·
<sup>m</sup> `RecommendByAuthorPlugin::register()` / `RecommendBySimilarityPlugin::register()` (`Templates::Article::Footer::PageFooter`, guarded by `getEnabled()`); `article.tpl` `{call_hook name="Templates::Article::Footer::PageFooter"}` ·
<sup>n</sup> `ArticleHandler::view()` (`OpenReviewComponent` config assigned unconditionally); no `<pkp-open-review>` in OJS `templates/frontend/` or `lib/pkp/templates/frontend/`; `review-anonymity` rule 10 / `open-peer-review-display` ·
<sup>o</sup> `DublinCoreMetaPlugin`/`GoogleScholarPlugin` `settings.xml` `enabled=true`; live DC.* + citation_* meta tags on the article page; `indexing-meta-tags` ·
<sup>p</sup> `ArticleHandler::view()` (`event(new UsageEvent(ASSOC_TYPE_SUBMISSION, …))`), `ArticleHandler::download()` (file `UsageEvent`, owned by galleys); `article_details.tpl` `displayStats` chart

## Side effects

- **Usage events (stats):** a landing-page view emits a submission `UsageEvent`; a galley file
  download emits a file `UsageEvent` (in `galleys`). Both feed `usage-statistics` (double-click
  filtering etc. are the ETL's job). No event fires for a remote-URL galley redirect or for merely
  listing galleys.
- **Response headers:** an **outdated/old version** view adds `robots: noindex` + a canonical
  `<link>` to the latest; a galley view of an old version adds `noindex`. The current published
  version is indexable.
- **No emails, notifications, or data mutations** — the page is read-only. Enabling the
  citationStyleLanguage plugin adds a stylesheet + `articleCitation.js`; enabling crossref's Crossmark
  adds the external Crossmark widget script.
- **Plugin content injection:** enabled plugins append markup at `Templates::Article::Main`,
  `Templates::Article::Details`, `Templates::Article::Details::Reference`, and
  `Templates::Article::Footer::PageFooter`, and inject `<meta>`/`<link>` into the head.

## Settings that modify behavior

- **Reader-block plugins** (Settings → Website → Plugins): **citationStyleLanguage** (how-to-cite +
  its styles/primary-style/downloads), **crossref → Crossmark** (the Crossmark button),
  **recommendByAuthor** / **recommendBySimilarity** (related-article blocks, **off by default**),
  **dublinCoreMeta** / **googleScholar** (indexer meta tags, **on by default**), **pdfJsViewer** /
  **htmlArticleGalley** / **lensGalley** (how a galley renders, owned by `galleys`, on by default).
- **Public comments** (`enablePublicComments`, journal setting): shows the reader comments island
  (`public-comments`).
- **Subscription / payment settings** (`subscriptions`, `payments`): `restrictArticleAccess`,
  subscription requirement, article/issue purchase, membership and the **PDF-only** restriction gate
  the galley view/download links (rule 6) and drive the abstract-page `hasAccess` flag; the abstract
  itself is always readable for a published article.
- **Theme options** (`website-appearance-settings`): the active theme's `displayStats` option toggles
  the per-article downloads chart; the theme also decides the overall page chrome (this spec assumes
  the default theme).
- **DOI versioning** (`Context::SETTING_DOI_VERSIONING`, `doi-management`): changes the DOI
  fallback shown to readers (rule 8).
- **Genres** (`workflow-settings`): which submission-component genres are *primary* vs *supplementary*
  decides the galley grouping (rule 6).

## Cross-feature interactions

- **galleys** (feature 26) — owns the galley **entity**, the four render plugins, and the **download**
  page (`PAGE-article-download`) + `downloadSuppFile`; this spec owns the reader **view links** on the
  article page, the primary/supplementary grouping display, and the deprecated `viewFile` redirect.
  The pdf.js smoke lives at the boundary (view route here → render plugin there).
- **publication-publish-flow** (feature 33) — owns the publish/unpublish transition; this spec owns the
  reader page whose **200-vs-404 visibility flips** as its side effect (rule 2).
- **publication-versioning** (feature 32) — owns versions + `canPreview`; this spec owns the reader
  **version view**, the **preview** and **outdated-version** notices, and the version dropdown (rule 3).
- **publication-license** (feature 30) — owns the license/copyright **snapshot**; this spec owns its
  **reader display** (rule 9). Journal defaults come from `distribution-settings`.
- **data-availability-citations** (feature 34) — owns the statement/citation authoring; this spec owns
  the reader render of the **statement** (data citations have no reader display — their ⚠, rule 10).
- **publication-metadata-references** (feature 25) — owns keywords/funding/citation authoring; this
  spec owns their reader render (rules 4–5).
- **review-anonymity** (feature 20) / **open-peer-review-display** (feature 71) — own the open-review
  visibility **rule** and the public reader **surface/component** respectively; this page only hosts the
  `OpenReviewComponent` config (rule 14).
- **citation-style-language** (feature 82) — owns the citationStyleLanguage plugin, its styles/
  downloads and the `VUE-pkp-cite` island; this spec owns the page the how-to-cite block renders on
  (rule 11, seam).
- **indexing-meta-tags** (feature 74) — owns the DC/Scholar/DRIVER `<meta>` tags and Google Analytics;
  this spec owns the visible page they inject into (rule 15, seam).
- **doi-management** / **doi-deposit** (features 76/77) — own the DOI value/format and the Crossmark
  deposit; this spec owns the reader DOI display and the Crossmark **button** (rules 8, 12).
- **orcid** (feature 79) — owns ORCID settings + the verified/unverified badge logic and the
  `VUE-pkp-orcid-display` component; this spec renders author ORCID here via **raw template markup**
  (rule 4, seam).
- **article-recommendations** (feature 39) — the reader recommend-by blocks; ⚠ its entire atom set is
  the two recommend-by plugins this spec claims (rule 13) — see Open question 3.
- **public-comments** (feature 43) — owns the comments surface rendered here when enabled.
- **journal-homepage** / **issue-archive-toc** / **site-search** — link *into* this page.

## Canonical scenarios

1. **Reader opens a published article** — Anonymous reader clicks an article from an issue TOC and
   lands on `/article/view/{id}`: the page renders title, authors (name/affiliation/ORCID/roles),
   abstract, keywords, section, published date and the version list, and lists the article's galleys
   in the sidebar. (Live-verified: 200 + `obj_article_details`, authors/keywords/abstract/galleys/
   published/versions all present.)
2. **Reader downloads the PDF galley via pdf.js** — The reader clicks the **PDF** link; the galley
   view route hands off to the pdfJsViewer plugin, which renders the file in the embedded pdf.js
   viewer with a raw-download link one click away, and the download is metered as a usage event.
   (Live-verified: the galley view returns `pdf.js/web/viewer.html` + `#pdfCanvasContainer`.)
3. **Reader hits a subscription/purchase gate on a galley** — On a subscription article the galley
   link is drawn **restricted** (with a fee when purchasable); clicking it routes to login/subscribe/
   purchase instead of the file, while an open-access or subscribed reader gets the file (gate owned by
   `subscriptions`/`payments`).
4. **Reader views an older version and sees the "outdated" notice** — Opening `/version/{oldPubId}`
   of a multi-version article shows the "this is an outdated version, read the current one" notice,
   sends `noindex` + a canonical link to the latest, and still renders that version's content.
   (Live-verified on submission 16 / version 17.)
5. **Editorial user previews an unpublished version** — A manager/editor (canPreview) opens an
   unpublished or scheduled version and sees it rendered with a "you are viewing a preview" notice,
   whereas an anonymous reader gets a 404 for the same URL. (Live-verified: unpublished subs → 404
   anonymous.)
6. **Reader reads the how-to-cite block and grabs a BibTeX file** — With citationStyleLanguage
   enabled, the reader sees the article formatted in the primary style, switches format via the
   dropdown (AJAX-swapped), and downloads a BibTeX/RIS citation. (Block is plugin-gated; not enabled on
   the probed dev DB.)
7. **Reader sees the license, copyright and DOI** — On a published article with a CC license and a
   DOI, the sidebar shows the CC badge + copyright statement + license terms and the DOI as a
   resolving link (with the versioning fallback when the version has no own DOI).
8. **Reader reads the data-availability statement** — An article whose author set a data-availability
   statement shows it in its own section; the structured data citations are *not* shown (a known 3.6
   gap owned by `data-availability-citations`).
9. **Indexer crawls the DC / Google-Scholar meta tags** — A crawler requesting the page finds the
   default-on Dublin Core (`DC.*`) and Google Scholar (`citation_*`, incl. `citation_pdf_url`) meta
   tags in the head. (Live-verified both families render.)
10. **Reader sees recommend-by related articles** — With recommendByAuthor / recommendBySimilarity
    enabled, the page footer shows "other articles by this author" / "similar articles" blocks; with
    the plugins off (the default) neither appears.
11. **Crossmark button on a Crossmark-enabled journal** — With crossref's Crossmark option on, a
    Crossmark status button (a Vue island) appears in the article details and opens the Crossref
    Crossmark record; off by default it is absent.

## Known deviations (as-built ≠ intent)

- ⚠ **Data-availability *statement* is shown, but data *citations* are not** — the reader page renders
  only the statement; the structured data citations managed beside it have no reader display in 3.6
  despite the manager copy implying one. Canonical home + ledger **row 98** are owned by
  `data-availability-citations` (rule 10 here is a pointer, not a re-narration).
- ⚠ **Version amendment notice / update-type not shown to readers** — a published article's
  "Summary of Changes" and update type are captured editor-side but rendered on **no** reader page
  (this one included); ledger **row 96**, owned by `publication-amendments`. Pointer only.
- **ORCID on the article page is raw template markup, not the `PkpOrcidDisplay` Vue component**
  (`article_details.tpl` uses `$orcidIcon` + `$author->getData('orcid')`; `PkpOrcidDisplay` is not
  even registered in the frontend runtime). Not a bug — an as-built note explaining why this spec does
  **not** claim `VUE-pkp-orcid-display` (it is not live here). The component's home is `orcid`.
- **The how-to-cite on the OJS default theme is the server-rendered Blade `citation-block`, not the
  `PkpCiteBody` Vue island** — `VUE-pkp-cite` is registered in the frontend runtime but the default
  theme mounts no `<pkp-cite>` tag; the live how-to-cite is the citationStyleLanguage plugin's Blade
  output. As-built note explaining why `VUE-pkp-cite` is left to `citation-style-language`.

## Open questions

1. **Is citationStyleLanguage enabled by default in a stock OJS journal?** On the probed **dev DB
   (ojs_main)** it had **no `enabled` row** and the how-to-cite block did **not** render, yet CSL is
   conventionally on in production installs. The block's *mechanics* are confirmed from code; a
   maintainer should confirm the intended default so the spec can state "how-to-cite shows by default"
   vs "opt-in." **Verifier (2026-07-04):** confirmed there is **no stock/bare-install default** — the
   plugin ships **no `settings.xml` `enabled` value** and no install-data/registry row turns it on
   (`register()` gates purely on `getEnabled($mainContextId)`). The retained test env renders the block
   only because the **publicknowledge bootstrap explicitly enables it**
   (`playwright/fixtures/bootstrap.js` → `citationstylelanguageplugin: {enabled: true}`). So today the
   how-to-cite is **opt-in**; whether a fresh production install should default it on remains the
   maintainer's call. (Does not gate verification of the page itself.)
2. **Should `PAGE-article-viewfile` sit with `article-landing` or `galleys`?** It is a deprecated
   OJS-2 301-redirect to `download` (a galley-file concern) living on `ArticleHandler`; `galleys`
   already owns the parallel `downloadSuppFile`. Claimed here as part of the ArticleHandler page per
   the feature map; flag if the maintainer prefers it grouped with the two download redirects.
3. **`article-recommendations` (feature 39) is now atom-less — RESOLVED: merged into `article-landing`.**
   Its entire atom set — `PLUGIN-generic-recommendByAuthor` + `PLUGIN-generic-recommendBySimilarity` —
   is claimed here as the reader footer blocks (rule 13); feature 39 had **no other atoms and no screen
   of its own** beyond those two reader blocks, which live on **this** page. **Verifier decision
   (2026-07-04): fold feature 39 into `article-landing`** — the two atoms stay single-owned here, and
   feature 39 is dropped as a standalone feature (its FEATURE-MAP stanza is annotated RESOLVED; no
   INVENTORY row was ever created for it, so there is no phantom row to retire). The *enabled* reader
   render (a manager turning the plugins on) is covered by canonical scenario 10 + the retained test's
   default-absent assertion; the two plugins' own *settings/mechanics* remain plugin-owned. The
   maintainer may still re-split later if article-recommendations grows a dedicated config surface.
4. **`VUE-pkp-crossmark-button` — `article-landing` or `doi-deposit`?** Claimed here as the reader
   button (it renders on this page); `doi-deposit` owns the crossref Crossmark deposit + the enable
   setting. Confirm the split when `doi-deposit` is written.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Article abstract page | `article/view/{submissionId|urlPath}` → `ArticleHandler::view` → `frontend/pages/article.tpl` → `article_details.tpl` | PAGE-article-view |
| Versioned view | `article/view/{id}/version/{publicationId}` (outdated notice + `noindex`) | PAGE-article-view |
| Galley view link (→ render plugin / remote redirect) | `article/view/{id}[/version/{pubId}]/{galleyId}` → `ArticleHandler::view` (`ArticleHandler::view::galley` hook) | *(view route here; render plugins + `PAGE-article-download` owned by galleys)* |
| Deprecated file view redirect | `article/viewFile/{id}/{galleyId}/{fileId}` → `ArticleHandler::viewFile` (301 → download) | PAGE-article-viewfile |
| How-to-cite block | citationStyleLanguage `Templates::Article::Details` → `citation-block.blade`; format links → `citationstylelanguage/get/{style}`, downloads → `citationstylelanguage/download/{format}` | *(owned by citation-style-language; VUE-pkp-cite there)* |
| Crossmark button | crossref `Templates::Article::Details` → `crossmarkButton.tpl` (`<pkp-crossmark-button>`), gated on the `crossmark` setting | VUE-pkp-crossmark-button |
| Recommend-by blocks | recommendByAuthor / recommendBySimilarity `Templates::Article::Footer::PageFooter` | PLUGIN-generic-recommendByAuthor, PLUGIN-generic-recommendBySimilarity |
| DC / Scholar meta tags | dublinCoreMeta / googleScholar (head `<meta>`), on by default | *(owned by indexing-meta-tags)* |
| Open-review config | `ArticleHandler::view` assigns `OpenReviewComponent` config (no default-theme mount) | *(VUE-pkp-open-review owned by review-anonymity)* |

## Reference — code anchors

- **Handler**: `pages/article/ArticleHandler.php` — `authorize()` (`ContextRequiredPolicy`,
  `OjsJournalMustPublishPolicy`, Bearer-token preview path), `initialize()` (url/version/galley
  resolution + published-only 404 gate), `view()` (template-variable assembly, DOI fallback,
  galley grouping, access flags, `noindex`/canonical headers, `UsageEvent`), `viewFile()`
  (301 → download), `userCanViewGalley()` / `download()` / `downloadSuppFile()` (owned by `galleys`).
- **Templates**: `templates/frontend/pages/article.tpl` (`Templates::Article::Footer::PageFooter`
  call), `templates/frontend/objects/article_details.tpl` (the full reader render; hooks
  `Templates::Article::Main` / `::Details` / `::Details::Reference`),
  `templates/frontend/objects/galley_link.tpl` (reader galley link + restricted/purchase markup).
- **How-to-cite**: `plugins/generic/citationStyleLanguage/CitationStyleLanguagePlugin.php`
  (`addCitationMarkup()`, `getTemplateData()`, `getCitationStyles()`/`getCitationDownloads()`,
  `getPrimaryStyleName()`), `templates/citation-block.blade`, `js/articleCitation.js`.
- **Crossmark**: `plugins/generic/crossref/CrossrefPlugin.php` (`displayCrossmarkButton()`,
  `addCrossmarkDoiMeta()`), `templates/crossmarkButton.tpl`;
  `lib/ui-library/src/frontend/components/PkpCrossmarkButton/PkpCrossmarkButton.vue`.
- **Recommend-by**: `plugins/generic/recommendByAuthor/RecommendByAuthorPlugin.php`,
  `plugins/generic/recommendBySimilarity/RecommendBySimilarityPlugin.php`
  (`Templates::Article::Footer::PageFooter`, `getEnabled()` gate).
- **Meta tags**: `plugins/generic/dublinCoreMeta/DublinCoreMetaPlugin.php`,
  `plugins/generic/googleScholar/GoogleScholarPlugin.php` (each `settings.xml` `enabled=true`).
- **Open-review config**: `lib/pkp/classes/components/OpenReviewComponent.php`;
  frontend runtime `lib/pkp/js/load_frontend.js` (registers `PkpOpenReview`, `PkpCiteBody`,
  `PkpCrossmarkButton`).
- **Frontmatter/liveness note**: probed live 2026-07-04 against a throwaway server on `ojs_main`
  (published articles; the `:8000` test DB had none): confirmed the core render, the pdf.js galley
  view, the DC/Scholar meta tags, the published-only 404, and the outdated-version notice + `noindex`.
- **Verifier (2026-07-04)**: re-confirmed every rule against as-built — `ArticleHandler`
  (`initialize()` url/version/galley resolution + the `status !== STATUS_PUBLISHED && !canPreview` 404
  gate; `view()` DOI fallback, primary/supplementary split, `noindex`/canonical headers, `UsageEvent`;
  `viewFile()` 301), `article_details.tpl` (raw-ORCID markup `{$orcidIcon}`/`getData('orcid')` — **no**
  `<pkp-orcid-display>`; `#data-availability-statement`; license/copyright block; the
  `Templates::Article::{Main,Details,Details::Reference}` hooks), `article.tpl`
  (`Templates::Article::Footer::PageFooter`), the plugins (crossref `displayCrossmarkButton` gated on
  the `crossmark` setting; recommendBy{Author,Similarity} gated on `getEnabled()`, no `settings.xml`;
  dublinCoreMeta/googleScholar `settings.xml enabled=true`), `load_frontend.js` (registers
  `PkpOpenReview`/`PkpCiteBody`/`PkpCrossmarkButton` — **not** `PkpOrcidDisplay`, confirming the ORCID
  seam), `OjsJournalMustPublishPolicy` (DENY on `publishingMode == PUBLISHING_MODE_NONE` for
  non-privileged), and `Repo::submission()->canPreview()`. The retained
  `playwright/tests/article-landing.spec.js` (10 tests) drives **all 10 canonical scenarios GREEN** on
  the `:8000` test DB — each seeding its own rich published article — covering metadata+ORCID, the
  pdf.js galley view + PDF byte-stream download, license/copyright/DOI, how-to-cite + BibTeX, the
  version view + outdated notice + `noindex`/canonical, the data-availability statement (row 98), the
  DC/Scholar meta tags, published-only 404 + editor-preview 200, the subscription gate (galley link
  `restricted` → view 302→login), and recommend-by/Crossmark absent-by-default. **No spec-vs-code
  contradiction found**; the 5 claimed atoms are single-owner and every left atom is correctly
  attributed to its owner (galleys / indexing-meta-tags / citation-style-language / orcid /
  review-anonymity).
