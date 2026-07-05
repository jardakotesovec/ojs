---
name: oai-pmh
scope: Let harvesters and indexing services machine-read a journal's published article metadata over the OAI-PMH 2.0 protocol
shared: pkp-lib               # the protocol engine (OAI, PKPOAIDAO, resumption tokens, the DC format) lives in lib/pkp and is shared with OMP/OPS; OJS supplies JournalOAI/OAIDAO/OAIHandler and the marc/marcxml/oaiJats/driver plugins. Spec'd from the OJS angle.
status: verified
e2e-plans: [oai-sitemap-feeds]
atlas-claims: [PAGE-oai-index, DB-oai_resumption_tokens, PLUGIN-oaiMetadataFormats-dc, PLUGIN-libpkp-oaiMetadataFormats-dc, PLUGIN-oaiMetadataFormats-marc, PLUGIN-oaiMetadataFormats-marcxml, PLUGIN-oaiMetadataFormats-oaiJats, PLUGIN-generic-driver]
---

# OAI-PMH metadata harvesting endpoint

## Purpose

OAI-PMH is the machine-to-machine door onto a journal's published record. Indexing
services, aggregators, discovery layers and repository networks (DOAJ, BASE, CORE,
OpenAIRE, library discovery systems) periodically *harvest* the endpoint to keep their
own copies of the journal's article metadata current — no login, no HTML scraping, just
structured XML over HTTP. This spec owns the **endpoint**: the `/oai` URL, the six OAI
verbs it answers, the metadata formats it can emit, the way journals and sections appear
as harvestable "sets", how withdrawn articles surface as *deleted-record tombstones*,
and how large result sets are paged with resumption tokens. It does **not** own the
publish/unpublish actions that populate or tombstone a record (that is
publication-publish-flow), nor the tombstone data itself (content-tombstones), nor the
metadata fields' own definitions (submission-wizard-metadata et al.) — only their OAI
rendering.

## Actors & permissions

OAI is **anonymous and public**: every request is an unauthenticated machine call. There
are no roles — the only gates are configuration and publication state. Two config levels
apply to every row below: the site-wide `oai` switch (`config.inc.php [oai] oai = On`)
must be on, and the specific journal must be **enabled** and have its per-journal OAI
setting **on** (`enableOai`). A journal reachable but with OAI off (or disabled) is
simply absent from results; the endpoint itself only 404s when the site switch is off or
the context path is neither a real journal nor the site aggregator.

"Published record" throughout means a submission whose current publication is Published,
in an enabled journal; nothing else is ever emitted as a live record.

| Action | Who may — and when |
|--------|--------------------|
| **Query the repository** (any of the six verbs) | • Anyone (anonymous machine) — when the site `oai` switch is on and the request targets a real journal (`/{journal}/oai`) or the site aggregator (`/index/oai`); otherwise the endpoint is not found <sup>a</sup> |
| **Harvest a published article's metadata** (GetRecord / ListRecords) | • Anyone — but only for **published** submissions in **enabled** journals whose per-journal OAI is on; unpublished/draft submissions are never returned as live records <sup>b</sup> |
| **See a withdrawn/unpublished article** | • Anyone — but only as a **deleted-record tombstone**: a header marked `status="deleted"` with no metadata body; the article's content is never exposed this way <sup>c</sup> |
| **Reach unpublished-content URLs embedded in metadata** | • A caller presenting a valid `Authorization: Bearer <apiKey>` header — ⚠ API-only, no normal harvester path; it does **not** widen which *records* are returned (still published-only), it only lets embedded article/galley preview URLs resolve <sup>d</sup> |
| **Restrict a harvest to one journal or section** | • Anyone — via the `set` argument (`{journalPath}` or `{journalPath}:{sectionAbbrev}`); at journal scope only that journal's sets exist, at site scope all enabled journals' sets do <sup>e</sup> |

<sup>a</sup> `OAIHandler::index()`, `OAIHandler::validate()` (site `oai` off → redirect to index; non-journal, non-`SITE_CONTEXT_PATH` → NotFound); routing `pages/oai/index.php`.
<sup>b</sup> `OAIDAO::_getRecordsRecordSetQuery()` (`where p.status = STATUS_PUBLISHED`, `where j.enabled = 1`, `enableOai` journal-settings exclusion — pkp/pkp-lib#6503).
<sup>c</sup> `PKPOAIDAO::_doCommonOAIFromRowOperations()` (tombstone branch → `OAIRECORD_STATUS_DELETED`); the UNION on `data_object_tombstones` in `OAIDAO::_getRecordsRecordSetQuery()`.
<sup>d</sup> `OAIHandler::validate()` (decodes the Bearer JWT → `setApiToken()`).
<sup>e</sup> `JournalOAI::setSpecToSectionId()`, `OAIDAO::getSetJournalSectionId()`, `OAIDAO::setSpec()`.

## Fields & validation

These are the OAI *request arguments* (URL query parameters), not user-facing form
fields — the "user" is a harvester constructing a URL. Argument legality is enforced
centrally by `OAI::checkParams()`; each verb declares its required and optional set.

| Field (request arg) | Required? | Rules | Anchor |
|---------------------|-----------|-------|--------|
| **verb** | Always | One of `Identify`, `ListMetadataFormats`, `ListSets`, `ListIdentifiers`, `ListRecords`, `GetRecord`; anything else (or missing) → `badVerb` | `OAI::execute()` |
| **metadataPrefix** | GetRecord, ListRecords, ListIdentifiers | Must name an **enabled** format (`oai_dc`, `oai_marc`, `marcxml` by default); unknown → `cannotDisseminateFormat` | `OAI::GetRecord()`/`ListRecords()`/`ListIdentifiers()` against `metadataFormats(true)` |
| **identifier** | GetRecord (required); ListMetadataFormats (optional) | Format `oai:{repositoryId}:article/{submissionId}`; malformed → `badArgument`; well-formed but no matching published record or tombstone → `idDoesNotExist` | `JournalOAI::validIdentifier()`, `identifierToArticleId()`, `record()` |
| **set** | Optional (ListRecords, ListIdentifiers) | `{journalPath}` or `{journalPath}:{sectionAbbrev}`; a set with no matching records yields `noRecordsMatch` | `JournalOAI::setSpecToSectionId()` |
| **from** / **until** | Optional (ListRecords, ListIdentifiers) | UTC `YYYY-MM-DD` or `YYYY-MM-DDThh:mm:ssZ`; both must share granularity; `from` > `until` → `badArgument`; malformed → `badArgument`. ⚠ Effective filtering is **day-level** even for second-granularity input (see rule 12) | `OAI::extractDateParams()`; `OAIDAO::_getRecordsRecordSetQuery()` date clauses |
| **resumptionToken** | Optional (ListRecords, ListIdentifiers, ListSets) | Opaque token from a prior partial response; **exclusive** — when present, only `verb` may accompany it, and all other harvest args are restored *from* the token (passing another arg → `badArgument`); expired/unknown → `badResumptionToken` | `OAI::ListRecords()` (resumption branch), `JournalOAI::resumptionToken()` |

## Rules & state

The endpoint is **read-only**: it never mutates journal content. Its only writes are
resumption-token bookkeeping rows (see Side effects).

**The six verbs**

1. **Identify** returns the repository fingerprint: `repositoryName` (the journal's
   localized name, or the site title at site scope), `baseURL`, `protocolVersion` `2.0`,
   `adminEmail` (the journal's contact email, or the site contact at site scope),
   `earliestDatestamp` (the `last_modified` of the earliest published record),
   `deletedRecord` = **`persistent`** (hardcoded — tombstones are kept indefinitely),
   `granularity` `YYYY-MM-DDThh:mm:ssZ`, `compression` `gzip`/`deflate` (when the server
   has zlib), an `oai-identifier` description block (`scheme` `oai`,
   `repositoryIdentifier` = the configured repository id, `delimiter` `:`,
   `sampleIdentifier` `oai:{repositoryId}:article/1`), and a `toolkit` block naming OJS
   and its version. *(anchor: `OAI::Identify()`, `JournalOAI::repositoryInfo()`)*

2. **ListMetadataFormats** lists the enabled formats — by default `oai_dc`, `oai_marc`,
   `marcxml` (rule 8). With an `identifier` it lists the formats available for that one
   record (same three, since every published article supports all enabled formats); an
   unknown identifier → `idDoesNotExist`. *(anchor: `OAI::ListMetadataFormats()`,
   `OAI::metadataFormats()` via the `OAI::metadataFormats` hook)*

3. **ListSets** returns the harvestable sets (rule 9). *(anchor: `OAI::ListSets()`,
   `OAIDAO::getJournalSets()`)*

4. **ListIdentifiers** returns record **headers** only — `identifier`, `datestamp`,
   `setSpec` per record (plus `status="deleted"` on tombstones). Paged at **500** per
   response (rule 11). *(anchor: `OAI::ListIdentifiers()`, `PKPOAIDAO::getIdentifiers()`)*

5. **ListRecords** returns full records — the same header plus a `<metadata>` body in the
   requested format (omitted on tombstones). Paged at **`oai_max_records`** (default 100)
   per response (rule 11). *(anchor: `OAI::ListRecords()`, `PKPOAIDAO::getRecords()`)*

6. **GetRecord** returns exactly one record by `identifier`, header + metadata (or a
   bare deleted header for a tombstone). Order of checks: invalid identifier format →
   `badArgument`; no such record → `idDoesNotExist`; record exists but the requested
   format is unsupported → `cannotDisseminateFormat`. *(anchor: `OAI::GetRecord()`,
   `JournalOAI::record()`)*

**Identifiers, datestamps, ordering**

7. A record's OAI **identifier** is `oai:{repositoryId}:article/{submissionId}` — the
   submission id, not the publication id, so the identifier is version-stable. Its
   **datestamp** is the UTC `GREATEST` of the article's, its issue's, and its
   publication's `last_modified`. Records are returned ordered by **journal, then
   submission id** (`journal_id, submission_id`) — a stable harvest order, not
   newest-first. *(anchor: `JournalOAI::articleIdToIdentifier()`;
   `OAIDAO::_getRecordsRecordSetQuery()` select `GREATEST(...)` and `orderBy`)*

**Metadata formats**

8. Three formats are **enabled unconditionally** on every install and cannot be turned
   off from the UI: **`oai_dc`** (Dublin Core — the default; core, from lib/pkp),
   **`oai_marc`** (OAI MARC), and **`marcxml`** (MARC21slim). They register on the
   `OAI::metadataFormats` hook whenever the `oaiMetadataFormats` plugin category is loaded
   because their base `getEnabled()` is always true. Two further formats ship but are
   **off by default**: **oaiJats** (JATS XML, prefix **`jats`** — note: not `oai_jats`),
   which reads a per-journal enabled setting and has its own settings form, and — via a
   separate generic plugin — the **DRIVER** set (rule 13). A disabled format's prefix
   yields `cannotDisseminateFormat`. *(anchor: `OAIMetadataFormatPlugin::register()`
   gated on `getEnabled()`; `Plugin::getEnabled()` returns true;
   `OAIMetadataFormatPlugin_JATS::getEnabled()` reads `getSetting(contextId,'enabled')`;
   prefixes in each plugin's `getMetadataPrefix()`)*

   The DC body carries title/creator/subject/description/publisher/date/type/format/
   identifier(URL + DOI)/source(issue + ISSN)/language/relation(galley URL)/rights; the
   embedded article and galley data are assembled in `OAIDAO::setOAIData()`. The metadata
   *fields* are owned by submission-wizard-metadata and siblings; this spec owns only
   that they are exported.

**Sets**

9. A **set** maps to a journal or a journal section. `setSpec` is the journal's URL path
   for the top-level journal set (e.g. `publicknowledge`), or `path:ABBREV` for a section
   (e.g. `publicknowledge:ART`, using the section's localized abbreviation run through
   `toValidSetSpec`); `setName` is the journal or section title. At **journal scope** only
   that journal's sets appear; at **site scope** (`/index/oai`) every enabled journal
   contributes its sets. Sections that survive only as tombstones are merged in so a
   deleted record's set still resolves. ListSets is itself paged at **`oai_max_records`**
   (default 100) — the same page size as ListRecords (rule 11), because `OAI::ListSets()`
   calls `sets($offset, $config->maxRecords, …)`. `OAIConfig::$maxSets` (50) is **dead** for
   paging: it is read only as an `== 0` "sets not supported" gate inside
   ListIdentifiers/ListRecords, never as a page size. *(anchor: `OAIDAO::getJournalSets()`,
   `OAIDAO::setSpec()`, `OAI::ListSets()` — live-confirmed: a site-scope ListSets returns a
   first page of **100** sets with a resumptionToken, not 50)*

**Tombstones / deleted records**

10. When a published article is later **withdrawn or unpublished**, publication-publish-flow
    inserts a row in `data_object_tombstones` (owned by content-tombstones). OAI UNIONs
    those rows into the same result stream and renders each as a **deleted record**: a
    header with `status="deleted"` carrying the tombstone's stored `oai_identifier`,
    `datestamp` (the deletion date), and `set_spec`, and **no** `<metadata>` body. Because
    `deletedRecord` is advertised as `persistent`, these tombstones are permanent and
    appear in ListIdentifiers/ListRecords/GetRecord alike. Re-publishing the article
    deletes its tombstone (publish-flow rule 12), so it reverts to a live record.
    *(anchor: `PKPOAIDAO::_doCommonOAIFromRowOperations()` tombstone branch; the
    `data_object_tombstones`/`data_object_tombstone_oai_set_objects` UNION in
    `OAIDAO::_getRecordsRecordSetQuery()`)*

**Resumption tokens (pagination)**

11. List verbs cap each response and hand back a **resumptionToken** to fetch the next
    slice. The page size differs by verb: **ListRecords** and **ListSets** use
    `oai_max_records` (default 100); **ListIdentifiers** uses a hardcoded **500**
    (`maxIdentifiers`, not configurable) — headers are lighter, so a full harvest of
    identifiers pages less often than one of records. When the emitted count is below the
    total, the response ends with `<resumptionToken>` carrying a fresh token id, plus
    `completeListSize` and `cursor` attributes and an `expirationDate`. Re-requesting with
    `verb` + that token continues from the saved offset; the **final** page carries an
    *empty* `<resumptionToken/>` element (with `completeListSize`/`cursor`, no id) to
    signal completion. Tokens live for **24 h** (`tokenLifetime` 86400 s); an
    expired/unknown token → `badResumptionToken`. *(anchor: `OAI::ListRecords()` /
    `ListIdentifiers()` / `ListSets()` resumption-token blocks; `OAIConfig::$maxIdentifiers`
    = 500, `$maxRecords` from `oai_max_records` (also the ListSets page size), `$maxSets`
    = 50 (dead — an `== 0` sets-supported gate only, never a page size; see rule 9),
    `$tokenLifetime`)*

**Date-range filtering**

12. `from`/`until` narrow a List harvest to records modified in a window; `OAI::extractDateParams()`
    validates them (matching granularity, `from` ≤ `until`, and — for date-only `until` —
    treats the day as inclusive). ⚠ The DAO then compares at **day granularity** for both
    live records (`DATE(GREATEST(...)) >= / <= 'Y-m-d'`) and tombstones
    (`whereDate('date_deleted', ...)`), even though Identify advertises second-level
    granularity — so a second-precision `from`/`until` is truncated to its date. An empty
    window yields `noRecordsMatch`. *(anchor: `OAIDAO::_getRecordsRecordSetQuery()` `from`/`until`
    `whereRaw`/`whereDate` clauses; `OAI::extractDateParams()`; see Known deviations)*

**Optional DRIVER set**

13. The **driver** generic plugin (`plugins/generic/driver`), **off by default**, adds a
    single OAI set `driver` ("Open Access DRIVERset") that exposes only open-access
    articles per DRIVER/OpenAIRE repository guidelines, tags qualifying records with the
    `driver` set, and stamps DRIVER tombstones. It is enabled from the plugin gallery per
    context; on a default install neither the `driver` set nor its records appear. *(anchor:
    `DRIVERPlugin::register()` gated on `getEnabled()`; hooks `OAIDAO::getJournalSets`,
    `JournalOAI::records`/`identifiers`, `OAIDAO::_returnRecordFromRow`/`_returnIdentifierFromRow`)*

**Site vs. journal scope**

14. `/index.php/{journalPath}/oai` scopes every verb to that journal; `/index.php/index/oai`
    is the **site aggregator**, spanning all enabled journals (repository name/contact come
    from the site, ListSets and record sets span journals). Both redirect to a
    locale-prefixed URL (`…/en/oai`) and answer identical XML. *(anchor: `OAIHandler::index()`
    (`Application::SITE_CONTEXT_PATH` check); `JournalOAI::__construct()` (`journalId` null →
    site scope))*

## Side effects

- **Resumption-token rows.** Each partial List response that needs continuation writes one
  row to `oai_resumption_tokens` (`token`, `record_offset`, serialized request `params`,
  `expire`). Every request first **purges expired tokens** (`DELETE … WHERE expire < now`)
  before looking one up. *(anchor: `PKPOAIDAO::insertToken()`, `getToken()`,
  `clearTokens()`; `JournalOAI::saveResumptionToken()`/`resumptionToken()`)*
- **No emails, notifications, event-log entries, or content mutations** — harvesting is
  purely read-only.
- **Session disabled.** The handler runs with no session (`PKPSessionGuard::disableSession()`),
  so requests never create session rows.

## Settings that modify behavior

- **`config.inc.php [oai] oai`** — master on/off for the whole endpoint; off → `/oai`
  redirects to the journal index (no OAI). *(anchor: `OAIHandler::validate()`)*
- **`config.inc.php [oai] oai_max_records`** (default 100) — page size for ListRecords and
  ListSets. *(anchor: `OAIConfig::__construct()`)*
- **`config.inc.php [oai] repository_id`** (test env: `ojs-test`; default `oai`) — forms the
  `oai:{id}:article/{n}` identifier namespace and the Identify `repositoryIdentifier`.
  *(anchor: `OAIHandler::index()` passes it into `OAIConfig`)*
- **Per-journal `enableOai`** — journal-level toggle; a journal without it set is excluded
  from records (pkp/pkp-lib#6503). *(anchor: `OAIDAO::_getRecordsRecordSetQuery()`
  `journal_settings` exclusion)*
- **Journal enabled flag** — a disabled journal contributes no records. *(anchor: `where j.enabled = 1`)*
- **oaiJats plugin enabled setting** — turning on the JATS plugin per journal adds the
  `jats` format to ListMetadataFormats and GetRecord/ListRecords. *(anchor:
  `OAIMetadataFormatPlugin_JATS::getEnabled()`)*
- **driver plugin enabled** — adds the `driver` set (rule 13).
- Hardcoded (not settings, but behavior-shaping): `maxIdentifiers` 500, `maxSets` 50
  (**vestigial** — read only as a `== 0` sets-supported gate; ListSets pages at
  `oai_max_records`, rule 9), `tokenLifetime` 86400 s, `granularity`
  `YYYY-MM-DDThh:mm:ssZ`, `deletedRecord` `persistent`. *(anchor: `OAIConfig`,
  `OAI::Identify()`)*

## Cross-feature interactions

- **publication-publish-flow** — owns the publish/unpublish actions. Publishing makes an
  article appear as a live OAI record and **clears** its tombstone; unpublishing/withdrawing
  **inserts** the tombstone this spec renders as a deleted record (their rule 12). This spec
  owns only the OAI-side rendering.
- **publication-versioning** — notes the same tombstone flip as status crosses the Published
  boundary (their rule 25); the OAI identifier keys on the submission, not the version, so a
  new Version of Record updates the datestamp without changing the identifier.
- **content-tombstones** — the *data* behind deleted records
  (`data_object_tombstones`, `data_object_tombstone_settings`,
  `data_object_tombstone_oai_set_objects`). Background feature; this spec renders it.
- **article-landing** / **issue-archive-toc** — the human reader surfaces for the same
  content; a withdrawn article is a reader not-found page there and a deleted record here.
  issue-archive-toc's row 101 note contrasts the archive's ordering with "the OAI feed";
  the OAI record order is `journal_id, submission_id` (rule 7).
- **submission-wizard-metadata**, **publication-identifiers** (DOI in DC/MARC),
  **data-availability-citations**, **galleys** (galley URL + `dc:format`),
  **contributors** (creators) — own the metadata *fields*; this spec exports them.
- **jats-content-api** — the separate `jatsTemplate` generic plugin supplies the JATS XML
  the oaiJats format serializes; enabling oaiJats is what surfaces it over OAI.

## Canonical scenarios

1. **Identify the repository** — A harvester GETs `?verb=Identify`. It receives the
   repository name, base URL, protocol version 2.0, admin email, earliest datestamp,
   `deletedRecord=persistent`, second-level granularity, gzip/deflate compression, the
   `oai:ojs-test:…` identifier scheme, and the OJS toolkit block — enough to configure
   incremental harvesting.

2. **Discover metadata formats** — A harvester GETs `?verb=ListMetadataFormats` and gets
   exactly `oai_dc`, `oai_marc`, `marcxml` on a default install. Requesting a disabled
   prefix (e.g. `jats`) anywhere returns `cannotDisseminateFormat`.

3. **List the sets** — A harvester GETs `?verb=ListSets` and receives the journal set
   (`publicknowledge`) plus one set per section (`publicknowledge:ART`, `publicknowledge:REV`).
   Against `/index/oai` it receives sets for every enabled journal on the site.

4. **List identifiers, one section** — A harvester GETs
   `?verb=ListIdentifiers&metadataPrefix=oai_dc&set=publicknowledge:ART` and receives the
   headers (identifier + datestamp + setSpec) of every published article in that section,
   up to 500 before a resumption token appears; a section with no published articles
   returns `noRecordsMatch`.

5. **Bulk-harvest records with resumption** — A harvester GETs
   `?verb=ListRecords&metadataPrefix=oai_dc`, receives 100 full DC records plus a
   `<resumptionToken>` with `completeListSize` and `cursor=0`, then re-requests
   `?verb=ListRecords&resumptionToken=<id>` to get the remaining records ending in an empty
   `<resumptionToken/>` — reconstructing the complete list across pages.

6. **Fetch one record** — A harvester GETs
   `?verb=GetRecord&metadataPrefix=oai_dc&identifier=oai:ojs-test:article/29` and receives
   that article's header and Dublin Core body (title, creators, DOI, issue source, galley
   URL, rights). The same call in `marcxml` returns the MARC21slim body.

7. **JATS full-text format (opt-in)** — A manager enables the oaiJats plugin for the
   journal; ListMetadataFormats then also offers `jats`, and
   `?verb=GetRecord&metadataPrefix=jats&identifier=…` returns the article's JATS XML.
   *(Live-verified 2026-07-05 via the retained `oai-pmh.spec.js`: a scratch journal with the
   oaiJats plugin enabled surfaces `jats` in ListMetadataFormats and emits a valid JATS
   `<article>` body from GetRecord — closes OQ1. The plugin is off by default.)*

8. **Withdrawn article as a deleted record** — After an editor unpublishes an article, a
   harvester GETs `?verb=GetRecord&metadataPrefix=oai_dc&identifier=oai:ojs-test:article/204`
   and receives a header with `status="deleted"` and no metadata; the same tombstone appears
   in ListIdentifiers/ListRecords. It persists because `deletedRecord=persistent`.

9. **Malformed requests and incremental windows** — A harvester exercises the error surface:
   `?verb=Frobnicate` → `badVerb`; `?verb=GetRecord` (no identifier) → `badArgument`;
   `…&identifier=oai:ojs-test:article/99999` → `idDoesNotExist`; `…&metadataPrefix=bogus` →
   `cannotDisseminateFormat`; and `?verb=ListRecords&metadataPrefix=oai_dc&from=2099-01-01T00:00:00Z`
   → `noRecordsMatch`. A same-day `from`/`until` window returns records because filtering is
   day-level (rule 12).

## Known deviations (as-built ≠ intent)

- ⚠ **Advertised second-granularity vs. day-level date filtering (rule 12).** Identify
  reports `granularity YYYY-MM-DDThh:mm:ssZ`, telling harvesters they may pass
  second-precision `from`/`until`, but `OAIDAO::_getRecordsRecordSetQuery()` compares only
  the *date* (`DATE(GREATEST(...))` for records, `whereDate('date_deleted', …)` for
  tombstones). A second-precision incremental harvest is therefore truncated to whole days:
  it never *misses* records (the window only widens) but can re-fetch a day's worth it
  already holds, and the advertised precision is misleading. No data loss. The day-cast came
  in with the Postgres crash fix (app-changes.md §1 row 1: `whereDate()` on a raw `GREATEST`
  Expression fataled on PG, replaced by portable `DATE()` casts). **Suspected intent:**
  either honor second-granularity in the query, or advertise `YYYY-MM-DD` granularity to
  match. *Proposed new ledger row — non-blocking; confirm with maintainer whether the
  day-level window is acceptable or the advertised granularity should change.*

## Open questions

1. **oaiJats live render (scenario 7). — RESOLVED (2026-07-05).** The retained
   `oai-pmh.spec.js` seeds a scratch journal with the oaiJats plugin enabled: `jats` then
   appears in ListMetadataFormats and `GetRecord&metadataPrefix=jats` emits a valid JATS
   `<article>` body (namespace `jats.nlm.nih.gov`). Enabling the per-context `enabled`
   setting is exactly what surfaces the format, as the code implied — question closed.
2. **driver set live render (rule 13).** Same read-only limitation: the `driver` set and its
   open-access-only record selection are code-read, not probed. Confirm the enabled plugin
   emits the `driver` set and correctly restricts it to open-access articles.
3. **Is the day-level `from`/`until` window (deviation above) acceptable**, or should the
   query honor second granularity (or Identify advertise day granularity)?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Journal OAI endpoint | `/index.php/{journalPath}/oai` (302 → `…/en/oai`) → `OAIHandler::index()` | PAGE-oai-index |
| Site OAI aggregator | `/index.php/index/oai` | PAGE-oai-index |
| Resumption-token store | `oai_resumption_tokens` table | DB-oai_resumption_tokens |
| Dublin Core format (`oai_dc`) | `plugins/oaiMetadataFormats/dc` + `lib/pkp/plugins/oaiMetadataFormats/dc` base | PLUGIN-oaiMetadataFormats-dc, PLUGIN-libpkp-oaiMetadataFormats-dc |
| OAI MARC format (`oai_marc`) | `plugins/oaiMetadataFormats/marc` | PLUGIN-oaiMetadataFormats-marc |
| MARC21 XML format (`marcxml`) | `plugins/oaiMetadataFormats/marcxml` | PLUGIN-oaiMetadataFormats-marcxml |
| JATS format (`jats`, off by default) | `plugins/oaiMetadataFormats/oaiJats` | PLUGIN-oaiMetadataFormats-oaiJats |
| DRIVER set (off by default) | `plugins/generic/driver` | PLUGIN-generic-driver |

## Reference — code anchors

- **Endpoint handler**: `pages/oai/OAIHandler.php` (`index()`, `validate()`, Bearer-key path); routing `pages/oai/index.php`.
- **Protocol engine (shared)**: `lib/pkp/classes/oai/OAI.php` (the six verbs, `checkParams()`,
  `error()`, `extractDateParams()`, resumption-token emission), `OAIConfig.php`
  (`maxRecords`/`maxIdentifiers`/`maxSets`/`tokenLifetime`/`granularity`), `OAIRecord.php`,
  `OAIIdentifier.php`, `OAISet.php`, `OAIResumptionToken.php`, `OAIUtils.php`.
- **OJS specialization**: `classes/oai/ojs/JournalOAI.php` (`repositoryInfo()`,
  `articleIdToIdentifier()`, `identifierToArticleId()`, `setSpecToSectionId()`, records/identifiers/sets
  delegation with `JournalOAI::records`/`identifiers`/`sets` hooks),
  `classes/oai/ojs/OAIDAO.php` (`_getRecordsRecordSetQuery()` — the published-only + tombstone UNION,
  ordering, date clauses; `getJournalSets()`, `setSpec()`, `setOAIData()`).
- **DAO base (shared)**: `lib/pkp/classes/oai/PKPOAIDAO.php` (`getRecord()`/`getRecords()`/`getIdentifiers()`,
  `getEarliestDatestamp()`, token CRUD, `_doCommonOAIFromRowOperations()` tombstone branch).
- **Format plugins**: `lib/pkp/classes/plugins/OAIMetadataFormatPlugin.php` (base `register()` /
  `callback_formatRequest()` on the `OAI::metadataFormats` hook); each plugin's
  `OAIMetadataFormatPlugin_*` (`getMetadataPrefix()`/`getSchema()`/`getNamespace()`/`getFormatClass()`)
  and its `OAIMetadataFormat_*` serializer.
- **DRIVER**: `plugins/generic/driver/DRIVERPlugin.php`, `DRIVERDAO.php`.
- **Config**: `config.inc.php [oai]` (`oai`, `oai_max_records`, `repository_id`).
- **Dead / removed**: `classes/migration/upgrade/v3_6_0/I12948_RemoveRFC1807Plugin.php` (the rfc1807
  format plugin is removed in 3.6 — see UNASSIGNED.md dead-code).
