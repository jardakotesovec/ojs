// @ts-check
const {test, expect} = require('../support/fixtures.js');

/**
 * OAI-PMH 2.0 metadata-harvesting endpoint (`/oai`) — the machine-to-machine
 * door onto a journal's published record. One test per canonical scenario of
 * docs/product/specs/oai-pmh.md (9 scenarios), landed at 9.
 *
 * OAI is ANONYMOUS: every request is an unauthenticated machine call, so these
 * tests drive the endpoint with `request.get` + XML string assertions rather
 * than a browser DOM. No file-level `test.use({user})` — the `request` fixture
 * stays anonymous; the one authenticated actor (the tombstone unpublish) is
 * opened per-test via `asUser('dbarnes')`.
 *
 * As-built, live-verified via curl during authoring (see the spec's Reference):
 *   - Journal endpoint `/index.php/publicknowledge/oai` 302s to `…/en/oai`
 *     (request.get follows it); site aggregator is `/index.php/index/oai`.
 *   - Default-enabled formats are EXACTLY oai_dc, oai_marc, marcxml. oaiJats
 *     (prefix `jats`) is OFF by default (per-context setting); rfc1807 was
 *     removed in 3.6. A disabled/unknown prefix → cannotDisseminateFormat.
 *   - setSpec = `{journalPath}` (journal) or `{journalPath}:{sectionAbbrev}`
 *     (section); the site aggregator spans every enabled journal's sets.
 *   - Identify: deletedRecord=persistent, granularity YYYY-MM-DDThh:mm:ssZ,
 *     oai-identifier repositoryIdentifier=ojs-test, sample oai:ojs-test:article/1.
 *   - ListRecords pages at oai_max_records=100; a corpus >100 (publicknowledge
 *     baseline is ~174) hands back a resumptionToken (cursor 0 → next → a
 *     terminal empty <resumptionToken/>). Tests assert the MECHANISM, never the
 *     exact count — parallel specs shift the corpus.
 *   - A withdrawn/unpublished article surfaces as a deleted-record tombstone
 *     (header status="deleted", no <metadata>) because deletedRecord=persistent.
 *   - ⚠ Row 106 deviation: Identify advertises second-level granularity, but the
 *     DAO filters from/until at DAY granularity — a second-precision window is
 *     truncated to its date (it only ever WIDENS the window). Asserted here.
 *
 * SEEDING: the corpus is the shared publicknowledge journal (~174 published
 * records) for the read-only verbs; every test that needs a KNOWN record (GetRecord,
 * ListIdentifiers, the tombstone, the day-window, JATS) seeds its own published
 * article via the scenario API and asserts against its own OAI identifier. Sites
 * are never mutated except the tombstone test (unpublishing its own seeded
 * article) and the ListSets/JATS tests (their own scratch journals).
 */

// The OAI repository id from config.test.inc.php ([oai] repository_id = ojs-test).
// Article OAI identifiers are `oai:{repository_id}:article/{submissionId}`.
const OAI_REPOSITORY_ID = 'ojs-test';

// The advertised granularity (Identify) — used to validate datestamps.
const DATESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `oai${workerIndex}x${suffix}`;
}

/** The OAI identifier for a submission id. */
function identifierFor(submissionId) {
	return `oai:${OAI_REPOSITORY_ID}:article/${submissionId}`;
}

/**
 * GET an OAI response as an anonymous machine call. `request.get` follows the
 * `/oai` → `/en/oai` 302 (publicknowledge) by default. Returns {status, body}.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {{journal?: string, query: string}} opts
 */
async function oai(request, {journal = 'publicknowledge', query}) {
	const res = await request.get(`/index.php/${journal}/oai?${query}`);
	return {status: res.status(), body: await res.text()};
}

/** The `code` of the first <error> in an OAI response, or null. */
function errorCode(body) {
	const m = body.match(/<error code="([^"]+)"/);
	return m ? m[1] : null;
}

/** The continuation resumptionToken id ('' when the token is empty/terminal or absent). */
function tokenId(body) {
	const m = body.match(/<resumptionToken[^>]*>([^<]*)<\/resumptionToken>/);
	return m ? m[1].trim() : '';
}

/** Whether the body carries any <resumptionToken> element (incl. the empty terminal one). */
function hasTokenElement(body) {
	return /<resumptionToken[\s/>]/.test(body);
}

/** The completeListSize attribute (a number), or null. */
function completeListSize(body) {
	const m = body.match(/completeListSize="(\d+)"/);
	return m ? Number(m[1]) : null;
}

/** Count of <record> elements in a list/GetRecord response. */
function countRecords(body) {
	return (body.match(/<record>/g) || []).length;
}

/** All <setSpec> values in a response. */
function setSpecs(body) {
	return [...body.matchAll(/<setSpec>([^<]+)<\/setSpec>/g)].map((m) => m[1]);
}

/**
 * A VoR-published article on `journal` (defaults to publicknowledge's published
 * Vol 1 No 2 2014) — appears as a live OAI record immediately (OAI reads
 * publications directly; no async index). Section ART, one PDF galley.
 */
function publishedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	section = 'ART',
	issue = {volume: 1, number: 2, year: 2014},
	metadata = {},
	galleys = [{label: 'PDF', file: 'default-article.pdf'}],
}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section,
		locale: 'en',
		participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{versionStage: 'VoR', metadata: {title: {en: title}, ...metadata}, issue, published: true, galleys},
		],
	};
}

/** Read window.pkp's CSRF token from a booted backend page. */
async function getCsrf(page) {
	await page.waitForFunction(
		// eslint-disable-next-line no-undef
		() => !!window.pkp?.currentUser?.csrfToken,
		null,
		{timeout: 20_000},
	);
	// eslint-disable-next-line no-undef
	return page.evaluate(() => window.pkp.currentUser.csrfToken);
}

test.describe('OAI-PMH harvesting endpoint (anonymous)', () => {
	// Canonical scenario 1 — Identify the repository. A harvester GETs
	// ?verb=Identify and receives the repository fingerprint needed to configure
	// incremental harvesting: name, protocol 2.0, deletedRecord=persistent,
	// second-level granularity, the oai:ojs-test:… identifier scheme, the OJS
	// toolkit block. The followed request URL is the locale-prefixed /en/oai.
	test(
		'Identify returns the repository fingerprint',
		{tag: ['@smoke', '@regression']},
		async ({request}) => {
			const {status, body} = await oai(request, {query: 'verb=Identify'});
			expect(status).toBe(200);

			expect(body).toContain('<repositoryName>Journal of Public Knowledge</repositoryName>');
			expect(body).toContain('<protocolVersion>2.0</protocolVersion>');
			expect(body).toContain('<deletedRecord>persistent</deletedRecord>');
			expect(body).toContain('<granularity>YYYY-MM-DDThh:mm:ssZ</granularity>');

			// The oai-identifier description block.
			expect(body).toContain('<scheme>oai</scheme>');
			expect(body).toContain(`<repositoryIdentifier>${OAI_REPOSITORY_ID}</repositoryIdentifier>`);
			expect(body).toContain(`<sampleIdentifier>${identifierFor(1)}</sampleIdentifier>`);

			// The toolkit block names OJS; the followed request is /en/oai.
			expect(body).toContain('<title>Open Journal Systems</title>');
			expect(body).toMatch(/<request verb="Identify">[^<]*\/publicknowledge\/en\/oai<\/request>/);

			// earliestDatestamp is present and matches the advertised granularity.
			const earliest = body.match(/<earliestDatestamp>([^<]+)<\/earliestDatestamp>/);
			expect(earliest && DATESTAMP_RE.test(earliest[1])).toBeTruthy();
		},
	);

	// Canonical scenario 2 — Discover metadata formats. A default install offers
	// EXACTLY oai_dc, oai_marc, marcxml; oaiJats (`jats`) is off by default.
	test(
		'ListMetadataFormats advertises exactly oai_dc, oai_marc, marcxml',
		{tag: ['@smoke', '@regression']},
		async ({request}) => {
			const {status, body} = await oai(request, {query: 'verb=ListMetadataFormats'});
			expect(status).toBe(200);

			const prefixes = [...body.matchAll(/<metadataPrefix>([^<]+)<\/metadataPrefix>/g)]
				.map((m) => m[1])
				.sort();
			expect(prefixes).toEqual(['marcxml', 'oai_dc', 'oai_marc']);

			// The off-by-default JATS format is absent.
			expect(body).not.toContain('<metadataPrefix>jats</metadataPrefix>');
			// Schemas are advertised alongside each prefix.
			expect(body).toContain('oai_dc.xsd');
		},
	);

	// Canonical scenario 3 — List the sets. At journal scope only publicknowledge's
	// sets exist (the journal set + one per section); the site aggregator spans
	// every enabled journal. A scratch journal is seeded so the "spans journals"
	// claim holds on any DB state and journal-scope isolation is checkable against
	// a known foreign path.
	test(
		'ListSets: journal scope lists journal + section sets; site scope spans journals',
		{tag: ['@smoke', '@regression']},
		async ({request, pkpApi}) => {
			const tag = uniqueTag();
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
			});
			const scratchPath = context.path;

			// Journal scope (publicknowledge): the journal set + its section sets.
			const j = await oai(request, {journal: 'publicknowledge', query: 'verb=ListSets'});
			expect(j.status).toBe(200);
			const jSpecs = setSpecs(j.body);
			expect(jSpecs).toContain('publicknowledge');
			expect(jSpecs).toContain('publicknowledge:ART');
			expect(jSpecs).toContain('publicknowledge:REV');
			// Isolation: no foreign journal's sets appear at journal scope.
			expect(jSpecs).not.toContain(scratchPath);
			for (const s of jSpecs) {
				expect(s === 'publicknowledge' || s.startsWith('publicknowledge:')).toBeTruthy();
			}

			// The scratch journal's own scope lists its own journal set.
			const s = await oai(request, {journal: scratchPath, query: 'verb=ListSets'});
			expect(s.status).toBe(200);
			expect(setSpecs(s.body)).toContain(scratchPath);

			// Site aggregator: publicknowledge present + more than one distinct
			// top-level journal set (spans journals).
			const site = await oai(request, {journal: 'index', query: 'verb=ListSets'});
			expect(site.status).toBe(200);
			const siteSpecs = setSpecs(site.body);
			expect(siteSpecs).toContain('publicknowledge');
			const topLevelJournals = new Set(siteSpecs.filter((x) => !x.includes(':')));
			expect(topLevelJournals.size, 'site aggregator spans >1 journal').toBeGreaterThan(1);
		},
	);

	// Canonical scenario 4 — List identifiers, one section. ListIdentifiers returns
	// record HEADERS only (identifier + datestamp + setSpec). A seeded article
	// appears in the publicknowledge:ART set; the set filter holds (every returned
	// header is tagged with the ART set); a section with no published records →
	// noRecordsMatch.
	test(
		'ListIdentifiers returns headers filtered by set',
		{tag: ['@smoke', '@regression']},
		async ({request, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `ListId ${tag}`}),
			);
			const id = identifierFor(submission.id);

			const {status, body} = await oai(request, {
				query: 'verb=ListIdentifiers&metadataPrefix=oai_dc&set=publicknowledge:ART',
			});
			expect(status).toBe(200);

			// My freshly-published article's header is in the ART set.
			expect(body).toContain(id);
			const headers = [...body.matchAll(/<header[^>]*>([\s\S]*?)<\/header>/g)].map((m) => m[1]);
			expect(headers.length).toBeGreaterThan(0);

			// The set filter holds: every returned header carries the ART setSpec.
			expect(setSpecs(body).every((x) => x === 'publicknowledge:ART')).toBeTruthy();

			// My header carries a second-granularity datestamp + the ART setSpec.
			const mine = headers.find((h) => h.includes(id));
			expect(mine, 'my header present').toBeTruthy();
			const ds = /** @type {string} */ (mine).match(/<datestamp>([^<]+)<\/datestamp>/);
			expect(ds && DATESTAMP_RE.test(ds[1])).toBeTruthy();
			expect(/** @type {string} */ (mine)).toContain('<setSpec>publicknowledge:ART</setSpec>');

			// A section with no published records → noRecordsMatch (REV is empty;
			// every seeded article goes to ART).
			const empty = await oai(request, {
				query: 'verb=ListIdentifiers&metadataPrefix=oai_dc&set=publicknowledge:REV',
			});
			expect(errorCode(empty.body)).toBe('noRecordsMatch');
		},
	);

	// Canonical scenario 5 — Bulk-harvest with resumption. ListRecords caps a
	// response at oai_max_records (100) and hands back a resumptionToken with
	// completeListSize + cursor=0; following it continues from the saved offset
	// and the FINAL page carries an empty <resumptionToken/> signalling
	// completion. Asserts the MECHANISM (a token appears, following it yields more
	// records and eventually a terminal empty token), not the exact corpus count.
	test(
		'ListRecords pages the corpus with a resumption token',
		{tag: ['@smoke', '@regression']},
		async ({request}) => {
			const p1 = await oai(request, {query: 'verb=ListRecords&metadataPrefix=oai_dc'});
			expect(p1.status).toBe(200);

			const first = countRecords(p1.body);
			expect(first, 'page 1 has records').toBeGreaterThan(0);
			const size = completeListSize(p1.body);
			expect(size, 'completeListSize present').not.toBeNull();
			// A token only appears when the corpus exceeds one page — the
			// publicknowledge baseline (~174) is comfortably over 100.
			expect(size, 'corpus exceeds one page').toBeGreaterThan(100);
			expect(p1.body).toMatch(/cursor="0"/);

			let token = tokenId(p1.body);
			expect(token, 'page 1 carries a continuation token id').not.toBe('');

			// Follow the token across pages until the terminal empty token.
			let total = first;
			let pages = 1;
			let lastBody = p1.body;
			let terminalReached = false;
			for (let i = 0; i < 20 && token; i++) {
				const next = await oai(request, {query: `verb=ListRecords&resumptionToken=${token}`});
				expect(next.status, `page ${pages + 1} status`).toBe(200);
				expect(errorCode(next.body), `page ${pages + 1} carries no error`).toBeNull();
				total += countRecords(next.body);
				pages += 1;
				lastBody = next.body;
				const nextToken = tokenId(next.body);
				if (!nextToken) {
					terminalReached = true;
					break;
				}
				token = nextToken;
			}

			expect(pages, 'harvest spanned more than one page').toBeGreaterThan(1);
			expect(total, 'harvested more than a single page of records').toBeGreaterThan(100);
			// The final page carries an empty terminal <resumptionToken/> (element
			// present, no id) per the protocol's completion signal.
			expect(terminalReached, 'reached a terminal empty token').toBeTruthy();
			expect(hasTokenElement(lastBody), 'terminal page still carries a <resumptionToken/>').toBeTruthy();
			expect(tokenId(lastBody), 'terminal token has no id').toBe('');
		},
	);

	// Canonical scenario 6 — Fetch one record. GetRecord returns exactly one
	// record by identifier: its header + a <metadata> body in the requested
	// format. A seeded article is fetched as Dublin Core (title, DC identifier
	// URL, type) and again as MARC21slim.
	test(
		'GetRecord returns one article as Dublin Core and MARCXML',
		{tag: ['@smoke', '@regression']},
		async ({request, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `GetRecord ${tag}`,
					metadata: {abstract: {en: `<p>Abstract ${tag}</p>`}},
				}),
			);
			const id = identifierFor(submission.id);

			// Dublin Core.
			const dc = await oai(request, {
				query: `verb=GetRecord&metadataPrefix=oai_dc&identifier=${id}`,
			});
			expect(dc.status).toBe(200);
			expect(dc.body).toContain(`<identifier>${id}</identifier>`);
			expect(dc.body).toContain('<setSpec>publicknowledge:ART</setSpec>');
			expect(dc.body).toContain('<metadata>');
			expect(dc.body).toContain('oai_dc:dc'); // the DC container element
			expect(dc.body).toMatch(new RegExp(`<dc:title[^>]*>[^<]*${tag}`)); // title carries my tag
			expect(dc.body).toContain(`article/view/${submission.id}`); // dc:identifier URL
			expect(dc.body).toContain('info:eu-repo/semantics/article'); // dc:type

			// MARC21slim body for the same record.
			const marc = await oai(request, {
				query: `verb=GetRecord&metadataPrefix=marcxml&identifier=${id}`,
			});
			expect(marc.status).toBe(200);
			expect(marc.body).toContain(`<identifier>${id}</identifier>`);
			expect(marc.body).toContain('<metadata>');
			expect(marc.body).toContain('MARC21slim');
		},
	);

	// Canonical scenario 8 — Withdrawn article as a deleted record. A published
	// article's OAI record is alive (header + metadata); after an editor
	// unpublishes it, GetRecord returns a header with status="deleted" and NO
	// metadata body — the tombstone persists because deletedRecord=persistent.
	// Reuses the publish-flow tombstone pattern; unpublish is a real editor action
	// via the authenticated publication API (which fires the tombstone insert).
	test(
		'unpublishing an article turns its OAI record into a deleted tombstone',
		{tag: ['@smoke', '@regression']},
		async ({request, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Tombstone ${tag}`}),
			);
			const pubId = publications[0].id;
			const id = identifierFor(submission.id);

			// Precondition: the OAI record is ALIVE (metadata present, not deleted).
			const alive = await oai(request, {
				query: `verb=GetRecord&metadataPrefix=oai_dc&identifier=${id}`,
			});
			expect(alive.status).toBe(200);
			expect(alive.body).toContain(id);
			expect(alive.body).toContain('<metadata>');
			expect(alive.body).not.toContain('status="deleted"');

			// Unpublish as the assigned editor (dbarnes, manager) via the
			// publication API — the same status flip the UI drives, which inserts
			// the tombstone synchronously in-request.
			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			await page.goto('/index.php/publicknowledge/en/dashboard', {waitUntil: 'commit'});
			const csrf = await getCsrf(page);
			const un = await ctx.request.post(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${pubId}/unpublish`,
				{
					headers: {
						'X-Csrf-Token': csrf,
						'X-Http-Method-Override': 'PUT',
						'Content-Type': 'application/json',
					},
					data: {},
				},
			);
			const unBody = await un.text();
			expect(un.ok(), `unpublish ${un.status()} ${unBody}`).toBeTruthy();

			// GetRecord now returns a deleted-record tombstone for the same
			// identifier: header status="deleted", no <metadata>.
			await expect
				.poll(
					async () =>
						(await oai(request, {query: `verb=GetRecord&metadataPrefix=oai_dc&identifier=${id}`}))
							.body,
					{timeout: 15_000},
				)
				.toContain('status="deleted"');
			const deleted = await oai(request, {
				query: `verb=GetRecord&metadataPrefix=oai_dc&identifier=${id}`,
			});
			expect(deleted.body).toContain(id);
			expect(deleted.body).not.toContain('<metadata>');
		},
	);

	// Canonical scenario 9 — Malformed requests and incremental windows. Exercises
	// the OAI error surface (badVerb, badArgument, idDoesNotExist,
	// cannotDisseminateFormat, noRecordsMatch) AND the ⚠ row-106 day-granularity
	// deviation: Identify advertises second-level granularity, but from/until
	// filter at DAY level, so a 1-second window at the very START of a record's
	// day still returns that record (the window widens to the whole day).
	test(
		'malformed requests return the right OAI error codes; date windows filter at day granularity',
		{tag: ['@smoke', '@regression']},
		async ({request, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Errors ${tag}`}),
			);
			const id = identifierFor(submission.id);

			/** @type {Array<[string, string]>} */
			const cases = [
				['verb=Frobnicate', 'badVerb'], // illegal verb
				['', 'badVerb'], // missing verb
				['verb=GetRecord&metadataPrefix=oai_dc', 'badArgument'], // GetRecord w/o identifier
				['verb=GetRecord&metadataPrefix=oai_dc&identifier=garbage', 'badArgument'], // malformed id
				[`verb=GetRecord&metadataPrefix=oai_dc&identifier=${identifierFor(99999999)}`, 'idDoesNotExist'],
				[`verb=GetRecord&metadataPrefix=bogus&identifier=${id}`, 'cannotDisseminateFormat'], // unknown format, valid record
				['verb=ListRecords&metadataPrefix=jats', 'cannotDisseminateFormat'], // off-by-default format
				['verb=ListRecords&metadataPrefix=rfc1807', 'cannotDisseminateFormat'], // removed in 3.6
			];
			for (const [query, code] of cases) {
				const {body} = await oai(request, {query});
				expect(errorCode(body), `${query || '(no args)'} → ${code}`).toBe(code);
			}

			// noRecordsMatch: a window entirely before any record existed.
			const past = await oai(request, {
				query: 'verb=ListRecords&metadataPrefix=oai_dc&from=2000-01-01&until=2000-01-02',
			});
			expect(errorCode(past.body)).toBe('noRecordsMatch');

			// Row 106: take my record's datestamp DAY, then a 1-second window at the
			// very start of that day. Second-precision filtering would match nothing
			// (my record was created hours later); day-level filtering widens the
			// window to the whole day, so my record IS returned.
			const rec = await oai(request, {
				query: `verb=GetRecord&metadataPrefix=oai_dc&identifier=${id}`,
			});
			const dayMatch = rec.body.match(/<datestamp>(\d{4}-\d{2}-\d{2})/);
			expect(dayMatch, 'record datestamp present').toBeTruthy();
			const day = /** @type {RegExpMatchArray} */ (dayMatch)[1];
			const win = await oai(request, {
				query: `verb=ListIdentifiers&metadataPrefix=oai_dc&from=${day}T00:00:01Z&until=${day}T00:00:02Z`,
			});
			expect(errorCode(win.body), 'day-level window is not empty').toBeNull();
			expect(
				win.body,
				'a record created hours later still falls in a 1-second start-of-day window (day granularity)',
			).toContain(id);
		},
	);

	// Canonical scenario 7 — JATS full-text format (opt-in). oaiJats is off by
	// default; enabling it per journal (seeded here on a scratch journal) surfaces
	// the `jats` prefix in ListMetadataFormats and makes GetRecord&metadataPrefix=jats
	// emit the article's JATS XML. Closes the spec's Open Question 1.
	test(
		'enabling oaiJats surfaces the jats format and emits JATS XML',
		{tag: '@regression'},
		async ({request, pkpApi}) => {
			const tag = uniqueTag();
			// Scratch journal with the oaiJats plugin enabled + a published issue.
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				plugins: {OAIMetadataFormatPlugin_JATS: {enabled: true}},
				issues: [{volume: 1, number: 1, year: 2024, published: true}],
			});
			const journalPath = context.path;

			const {submission} = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}j`,
					title: `JATS ${tag}`,
					journal: journalPath,
					issue: {volume: 1, number: 1, year: 2024},
				}),
			);
			const id = identifierFor(submission.id);

			// ListMetadataFormats on this journal now also offers `jats`.
			const formats = await oai(request, {journal: journalPath, query: 'verb=ListMetadataFormats'});
			expect(formats.status).toBe(200);
			expect(formats.body).toContain('<metadataPrefix>jats</metadataPrefix>');

			// GetRecord in the jats format emits a JATS <article> body.
			const jats = await oai(request, {
				journal: journalPath,
				query: `verb=GetRecord&metadataPrefix=jats&identifier=${id}`,
			});
			expect(jats.status).toBe(200);
			expect(jats.body).toContain(`<identifier>${id}</identifier>`);
			expect(jats.body).toContain('<metadata>');
			expect(jats.body).toContain('jats.nlm.nih.gov'); // the JATS namespace
			expect(jats.body).toMatch(/<article[\s>]/);
			expect(jats.body).toMatch(new RegExp(`<article-title[^>]*>[^<]*${tag}`));
		},
	);
});
