// @ts-check
const {test, expect} = require('../support/fixtures.js');

/**
 * Publication — Metadata & References — one test per canonical scenario of
 * docs/product/specs/publication-metadata-references.md (7 scenarios).
 *
 * This spec owns two Publication-tab surfaces:
 *   - Metadata tab: the base PKPMetadataForm (id `metadata`, no OJS
 *     override) — keywords/subjects/… chips + coverage/rights/source/type
 *     text + funding rich-text, each per submission language. A field shows
 *     only under a collecting mode; no field carries a required marker; the
 *     empty form renders "No metadata fields are currently enabled."
 *   - References tab (the CitationManager Vue): present only when the
 *     journal collects references (`supportsCitations = !!context.citations`;
 *     publicknowledge ships References at *request* so the tab is live). Add
 *     references as raw text → tokenised citation rows; edit a row raw (lookup
 *     off, the default) or structured (lookup on); reprocess.
 *
 * Placement: OJS root — the publicknowledge journal, its ART section and the
 * scratch-journal setting flips are journal concepts, even though the forms
 * and the CitationManager ship from pkp-lib.
 *
 * As-built facts verified here (from the spec author's live probes 2026-07-04,
 * re-confirmed against source):
 *   - The References tab renders because publicknowledge's References mode is
 *     *request* (`citations = request`). `citationsMetadataLookup` is OFF by
 *     default → the raw citation edit form, no Reprocess actions.
 *   - The structured (~19-field) citation edit form and the Reprocess actions
 *     appear only when `citationsMetadataLookup` is ON. Scenarios 4 (structured)
 *     and 5 (reprocess) drive them live on a SCRATCH journal seeded with
 *     `citationsMetadataLookup: true` (a new, additive context-scenario
 *     passthrough — schema/context.json + ContextBuilderProcessor).
 *   - ⚠ SECURITY (spec Known deviations #1 / ledger row 91): the single-citation
 *     API (`PKPCitationController` get/edit/delete/reprocess) authorises with
 *     ONLY the journal role list + a context check — NO SubmissionAccessPolicy
 *     and NO PublicationWritePolicy. Scenario 7 asserts this REAL as-built hole:
 *     a plain author (atester) with no role on the target submission GETs + PUTs
 *     another submission's citation → 200, persisted. This documents the gap in
 *     a retained test; it does NOT assert a fix (a throwaway seeded submission
 *     is tampered, so no cleanup is needed).
 *
 * Structured-edit + reprocess handling: driven live in the UI on a lookup-on
 * scratch journal (structured modal fields + Reprocess row/all actions render
 * there). The reprocess pipeline is Background infra (owned by
 * citation-enrichment-pipeline) and outbound HTTP is firewalled in test runs —
 * so scenario 5 asserts the reprocess endpoint 200 + the reset-to-Not-processed
 * dispatch, NOT async enrichment completion.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every
 * setting flip lives on a per-test scratch journal (publicknowledge stays
 * read-only); every persistence assertion reads the tag back through the
 * publication/citation REST API. No Mailpit use.
 */

const NO_FIELDS_MESSAGE = 'No metadata fields are currently enabled.';
// EDITORIAL published-version banner (WorkflowPublicationEditWarning) — the
// warn-not-lock: managers/editors keep editing behind the yellow warning.
const EDITOR_EDIT_WARNING =
	'Warning: This version has been published. Editing it may impact the published content.';
// AUTHOR published-version banner (WorkflowPublicationEditDisabled) — hard lock.
const EDIT_DISABLED_BANNER =
	'This version has been published and can not be edited.';
// Citation processing status NOT_PROCESSED (CitationProcessingStatus::NOT_PROCESSED).
const NOT_PROCESSED = 0;

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `pmr${workerIndex}x${suffix}`;
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/**
 * A submitted stage-1 submission with dbarnes as the deciding editor.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {string} [opts.journal='publicknowledge']
 * @param {string} [opts.submitter='atester']
 * @param {object[]} [opts.participants]
 */
function submittedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	submitter = 'atester',
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		tag,
		journal,
		submitter,
		section: 'ART',
		locale: 'en',
		participants,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * A production-staged, VoR-published submission on publicknowledge assigned to
 * the published issue (Vol. 1 No. 2, 2014). atester is the author (hard-locked
 * once published); the editor keeps edit rights only if passed
 * canChangeMetadata.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {object[]} [opts.participants]
 */
function publishedSpec({
	tag,
	title,
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants,
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}},
				issue: {volume: 1, number: 2, year: 2014},
				published: true,
			},
		],
	};
}

/** Resolve the current publication id for a submission (page session). */
async function currentPublicationId(page, submissionId, journalPath) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(subRes.ok(), `GET submission ${submissionId}`).toBeTruthy();
	return (await subRes.json()).currentPublicationId;
}

/** GET a submission's current publication as JSON (page session). */
async function fetchCurrentPublication(page, submissionId, journalPath) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(subRes.ok()).toBeTruthy();
	const pubId = (await subRes.json()).currentPublicationId;
	const pubRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(pubRes.ok()).toBeTruthy();
	return pubRes.json();
}

/** The parsed citation rows on a submission's current publication. */
async function fetchCitations(page, submissionId, journalPath) {
	const pub = await fetchCurrentPublication(page, submissionId, journalPath);
	return pub?.citations ?? [];
}

/**
 * CSRF token from a loaded OJS page. The Vue app boots `window.pkp`
 * asynchronously; under `waitUntil:'commit'` navigations it may not be ready
 * yet, so wait for the token before reading it.
 */
async function getCsrf(page) {
	await page.waitForFunction(() => !!window.pkp?.currentUser?.csrfToken, null, {
		timeout: 20_000,
	});
	const token = await page.evaluate(() => window.pkp?.currentUser?.csrfToken);
	expect(token, 'csrf token from page').toBeTruthy();
	return token;
}

/**
 * Deep-link the workflow onto a specific Publication pane.
 *
 * @param {string} journalPath
 * @param {number} submissionId
 * @param {number} pubId
 * @param {string} name  pane name, e.g. 'metadata' | 'citations'
 * @param {boolean} [author=false]  author (mySubmissions) vs editorial dashboard
 */
function pubLink(journalPath, submissionId, pubId, name, author = false) {
	const dash = author ? 'mySubmissions' : 'editorial';
	return (
		`/index.php/${journalPath}/en/dashboard/${dash}` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_${name}`
	);
}

/** The Metadata-tab PkpForm (the form that holds the `metadata-*` fields). */
function metadataForm(page) {
	return page.locator('form.pkpForm', {
		has: page.locator('[id^="metadata-"]'),
	});
}

/** A metadata/citation form field control by its deterministic FieldBase id. */
function fieldControl(page, formId, field, locale = 'en') {
	const suffix = locale ? `-${locale}` : '';
	return page.locator(`#${formId}-${field}-control${suffix}`);
}

/** The "* Required" marker attached to a field's label (absent when unmarked). */
function fieldRequiredMarker(page, formId, field, locale = 'en') {
	const suffix = locale ? `-${locale}` : '';
	return page.locator(
		`label[for="${formId}-${field}-control${suffix}"] .pkpFormFieldLabel__required`,
	);
}

/** A selected controlled-vocabulary chip, scoped by its visible label. */
function vocabChip(page, formId, field, label, locale = 'en') {
	const control = fieldControl(page, formId, field, locale);
	return page
		.locator('.pkpAutosuggest', {has: control})
		.locator('.pkpAutosuggest__selection', {hasText: label})
		.first();
}

/** Add a free-text chip to a controlled-vocabulary field (type + Enter). */
async function addVocabChip(page, formId, field, term, locale = 'en') {
	const input = fieldControl(page, formId, field, locale);
	await input.click();
	await input.pressSequentially(term, {delay: 20});
	// FieldControlledVocab always offers the raw typed text (allowCustom) —
	// never depend on which STORED suggestions appear (journal-scope bug).
	await expect(
		page.locator('.autosuggest__results-item', {hasText: term}).first(),
	).toBeVisible({timeout: 10_000});
	await input.press('Enter');
	await expect(vocabChip(page, formId, field, term, locale)).toBeVisible({
		timeout: 10_000,
	});
}

/** Reveal a secondary locale's sub-fields via the metadata form's locale toggle. */
async function toggleMetadataLocale(page, localeLabel) {
	await metadataForm(page)
		.locator('button.pkpFormLocales__locale', {hasText: localeLabel})
		.click();
}

/**
 * Click the Metadata form's Save and wait for the publication PUT (tunnelled
 * as POST). Returns the response so the caller can assert the status.
 */
async function saveMetadataForm(page, journalPath, pubId) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(res) =>
				new RegExp(`/publications/${pubId}(?:\\?|$)`).test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 20_000},
		),
		metadataForm(page)
			.getByRole('button', {name: 'Save', exact: true})
			.click(),
	]);
	return response;
}

/** Open a Publication pane and wait for it to mount (anchor by the pane's form). */
async function openMetadataTab(page, journalPath, submissionId, pubId, author) {
	await page.goto(pubLink(journalPath, submissionId, pubId, 'metadata', author), {
		waitUntil: 'commit',
	});
	await expect(
		workflowModal(page).locator('nav').getByText('Metadata', {exact: true}),
	).toBeVisible({timeout: 20_000});
}

/** Open the References pane and wait for the Add box to mount (both roles). */
async function openReferencesTab(
	page,
	journalPath,
	submissionId,
	pubId,
	author = false,
) {
	await page.goto(
		pubLink(journalPath, submissionId, pubId, 'citations', author),
		{waitUntil: 'commit'},
	);
	await expect(page.locator('#addCitations-rawCitations-control')).toBeAttached({
		timeout: 20_000,
	});
}

/** POST importAdditionalCitations (append + tokenise + dedup) as the page user. */
async function addReferencesViaApi(
	page,
	journalPath,
	submissionId,
	pubId,
	rawText,
	csrf,
) {
	const res = await page.request.post(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}/citations/importAdditionalCitations`,
		{
			headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
			data: {rawCitations: rawText},
		},
	);
	expect(res.status(), await res.text()).toBe(200);
	return res.json();
}

/** Open the (single) citation row's More Actions menu and click a named item. */
async function clickRowAction(page, actionName) {
	await workflowModal(page)
		.getByRole('button', {name: 'More Actions'})
		.first()
		.click();
	await page.getByRole('menuitem', {name: actionName, exact: true}).click();
}

/**
 * Click Save inside the open citation edit side-modal and wait for the
 * single-citation PUT (tunnelled as POST). `controlId` disambiguates the raw
 * vs structured form.
 */
async function saveCitationEditModal(page, citationId, controlId) {
	const form = page.locator('form', {has: page.locator(`#${controlId}`)});
	const [res] = await Promise.all([
		page.waitForResponse(
			(r) =>
				new RegExp(`/api/v1/citations/${citationId}(?:\\?|$)`).test(r.url()) &&
				r.request().method() === 'POST',
			{timeout: 20_000},
		),
		form.getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	return res;
}

test.use({user: 'dbarnes'});

test.describe('Publication — Metadata & References', () => {
	// Canonical scenario 1 — Editor edits the descriptive metadata. On
	// publicknowledge only Keywords is enabled (keywords = request; every other
	// metadata field disabled), unmarked. The editor adds an English keyword
	// chip, toggles the form's French tab, adds a French keyword, and saves;
	// both language values persist on the selected version.
	test(
		'editor edits keywords (multilingual chips) and they persist',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const enKeyword = `metadata keyword ${tag}`;
			const frKeyword = `mot cle ${tag}`;

			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Meta ${tag}`}),
			);
			const pubId = await currentPublicationId(
				page,
				submission.id,
				'publicknowledge',
			);

			await openMetadataTab(page, 'publicknowledge', submission.id, pubId, false);

			// Only Keywords renders (the sole enabled field), and it is NOT
			// required-marked — no field on this tab carries a required marker.
			await expect(
				fieldControl(page, 'metadata', 'keywords'),
			).toBeVisible({timeout: 20_000});
			await expect(
				fieldRequiredMarker(page, 'metadata', 'keywords'),
			).toHaveCount(0);
			// Disabled fields are absent from the form.
			await expect(fieldControl(page, 'metadata', 'coverage')).toHaveCount(0);
			await expect(fieldControl(page, 'metadata', 'subjects')).toHaveCount(0);

			// Add an English keyword chip.
			await addVocabChip(page, 'metadata', 'keywords', enKeyword);

			// Toggle the French (Canada) sub-field and add a separate chip.
			await toggleMetadataLocale(page, 'French (Canada)');
			await expect(
				fieldControl(page, 'metadata', 'keywords', 'fr_CA'),
			).toBeAttached({timeout: 20_000});
			await addVocabChip(page, 'metadata', 'keywords', frKeyword, 'fr_CA');

			const saveRes = await saveMetadataForm(page, 'publicknowledge', pubId);
			expect(saveRes.status()).toBe(200);

			// Both locales persist independently on the selected version.
			await expect
				.poll(
					async () =>
						JSON.stringify(
							(
								await fetchCurrentPublication(
									page,
									submission.id,
									'publicknowledge',
								)
							).keywords ?? {},
						),
					{timeout: 20_000},
				)
				.toContain(enKeyword);
			const pub = await fetchCurrentPublication(
				page,
				submission.id,
				'publicknowledge',
			);
			expect(JSON.stringify(pub.keywords?.en ?? [])).toContain(enKeyword);
			expect(JSON.stringify(pub.keywords?.fr_CA ?? [])).toContain(frKeyword);
		},
	);

	// Canonical scenario 2 — The tab reflects the journal's metadata modes.
	// A scratch journal with Subjects on *collect-but-don't-ask* and Coverage
	// on *require* shows BOTH on the Metadata tab (any collecting mode surfaces
	// here, unlike the wizard), neither required-marked (require adds no marker
	// on this tab). A second journal with every metadata field disabled shows
	// "No metadata fields are currently enabled." — and, with References mode
	// off, the References tab is absent entirely (Rule 5).
	test(
		'the tab surfaces every collecting mode, unmarked; empty shows the no-fields message',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();

			// --- Journal A: subjects collect-only + coverage require ---
			const {context: jA} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
				subjects: 'enable',
				coverage: 'require',
			});
			const {submission: subA} = await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: `Modes ${tag}`,
					journal: jA.path,
					participants: [],
				}),
			);
			const pubA = await currentPublicationId(page, subA.id, jA.path);
			await openMetadataTab(page, jA.path, subA.id, pubA, false);

			// Both fields render (collect-only Subjects + require Coverage), plus
			// the default-enabled Keywords — none required-marked.
			await expect(fieldControl(page, 'metadata', 'subjects')).toBeVisible({
				timeout: 20_000,
			});
			await expect(fieldControl(page, 'metadata', 'coverage')).toBeVisible();
			await expect(
				fieldRequiredMarker(page, 'metadata', 'subjects'),
			).toHaveCount(0);
			await expect(
				fieldRequiredMarker(page, 'metadata', 'coverage'),
			).toHaveCount(0);
			// References mode defaults to *request* on a scratch journal → the
			// References tab is present.
			await expect(
				workflowModal(page)
					.locator('nav')
					.getByText('References', {exact: true}),
			).toBeVisible();

			// --- Journal B: every metadata field disabled + references off ---
			const tagB = uniqueTag();
			const {context: jB} = await pkpApi.createJournal({
				tag: tagB,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
				keywords: 0,
				citations: 0,
			});
			const {submission: subB} = await pkpApi.createSubmission(
				submittedSpec({
					tag: tagB,
					title: `Nomodes ${tagB}`,
					journal: jB.path,
					participants: [],
				}),
			);
			const pubB = await currentPublicationId(page, subB.id, jB.path);
			await openMetadataTab(page, jB.path, subB.id, pubB, false);

			// Empty form → the no-fields message; no metadata control renders.
			await expect(
				workflowModal(page).getByText(NO_FIELDS_MESSAGE),
			).toBeVisible({timeout: 20_000});
			await expect(page.locator('[id^="metadata-"]')).toHaveCount(0);
			// References mode off → the References tab is absent for everyone.
			await expect(
				workflowModal(page)
					.locator('nav')
					.getByText('References', {exact: true}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 3 — Add references as raw text. Three references (one
	// per line) pasted into the Add box and submitted are tokenised into three
	// citation rows (sequence 1–3, status Not processed, unstructured); re-adding
	// an existing line is skipped as a duplicate.
	test(
		'add references as raw text; rows parsed, sequenced, deduplicated',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Refs ${tag}`}),
			);
			const pubId = await currentPublicationId(
				page,
				submission.id,
				'publicknowledge',
			);

			const ref1 = `Alpha A. First reference ${tag}. Journal One. 2020.`;
			const ref2 = `Beta B. Second reference ${tag}. Journal Two. 2021.`;
			const ref3 = `Gamma C. Third reference ${tag}. Journal Three. 2022.`;

			await openReferencesTab(page, 'publicknowledge', submission.id, pubId);

			// Paste three lines and submit via the Add box (the UI Add path).
			await page
				.locator('#addCitations-rawCitations-control')
				.fill(`${ref1}\n${ref2}\n${ref3}`);
			const addForm = page.locator('form', {
				has: page.locator('#addCitations-rawCitations-control'),
			});
			await Promise.all([
				page.waitForResponse(
					(r) =>
						r.url().includes('/citations/importAdditionalCitations') &&
						r.request().method() === 'POST' &&
						r.status() === 200,
					{timeout: 20_000},
				),
				addForm.getByRole('button', {name: 'Add', exact: true}).click(),
			]);

			// Three rows land as parsed, unstructured, Not-processed citations,
			// sequenced 1–3 (assert on the authoritative publication state).
			await expect
				.poll(
					async () =>
						(await fetchCitations(page, submission.id, 'publicknowledge'))
							.length,
					{timeout: 20_000},
				)
				.toBe(3);
			const citations = await fetchCitations(
				page,
				submission.id,
				'publicknowledge',
			);
			const raws = citations.map((c) => c.rawCitation);
			expect(raws).toEqual(expect.arrayContaining([ref1, ref2, ref3]));
			for (const c of citations) {
				expect(c.isStructured).toBe(false);
				expect(c.processingStatus).toBe(NOT_PROCESSED);
			}
			expect([...citations].map((c) => c.seq).sort((a, b) => a - b)).toEqual([
				1, 2, 3,
			]);

			// The parsed rows render in the Structured References table.
			await expect(workflowModal(page).getByText(ref1)).toBeVisible();
			await expect(workflowModal(page).getByText(ref3)).toBeVisible();

			// Re-adding an existing line is skipped — the row count stays 3.
			const csrf = await getCsrf(page);
			await addReferencesViaApi(
				page,
				'publicknowledge',
				submission.id,
				pubId,
				ref1,
				csrf,
			);
			const afterDup = await fetchCitations(
				page,
				submission.id,
				'publicknowledge',
			);
			expect(afterDup.length).toBe(3);
		},
	);

	// Canonical scenario 4 — Edit a citation, raw vs structured. With
	// *References Metadata Lookup* OFF (publicknowledge default), the per-row
	// Edit opens a single Raw Citation textarea; the editor corrects the text
	// and saves. With it ON (a scratch journal), the same Edit opens the
	// ~19-field structured form (DOI, title, …) with Raw Citation required; the
	// editor fills DOI + title and saves. Both persist via the citation PUT.
	test(
		'edit a citation — raw form (lookup off) and structured form (lookup on)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();

			// --- Part A: RAW edit on publicknowledge (lookup off) ---
			const {submission: rawSub} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Rawedit ${tag}`}),
			);
			const rawPub = await currentPublicationId(
				page,
				rawSub.id,
				'publicknowledge',
			);
			await openReferencesTab(page, 'publicknowledge', rawSub.id, rawPub);
			const rawSeed = `Original raw reference ${tag}. Journal. 2019.`;
			const rawCsrf = await getCsrf(page);
			await addReferencesViaApi(
				page,
				'publicknowledge',
				rawSub.id,
				rawPub,
				rawSeed,
				rawCsrf,
			);
			await page.reload({waitUntil: 'commit'});
			await expect(workflowModal(page).getByText(rawSeed)).toBeVisible({
				timeout: 20_000,
			});
			const rawCitationId = (
				await fetchCitations(page, rawSub.id, 'publicknowledge')
			)[0].id;

			// Edit → the RAW form: a single "Edit Raw Citation" textarea, and NO
			// structured DOI field (lookup off).
			await clickRowAction(page, 'Edit');
			await expect(page.locator('#citation_raw-rawCitation-control')).toBeVisible(
				{timeout: 20_000},
			);
			await expect(
				page.locator('#citation_structured-doi-control'),
			).toHaveCount(0);
			const rawEdited = `Corrected raw reference ${tag}. Journal. 2019.`;
			await page.locator('#citation_raw-rawCitation-control').fill(rawEdited);
			const rawSaveRes = await saveCitationEditModal(
				page,
				rawCitationId,
				'citation_raw-rawCitation-control',
			);
			expect(rawSaveRes.status()).toBe(200);
			await expect
				.poll(
					async () =>
						(await fetchCitations(page, rawSub.id, 'publicknowledge')).find(
							(c) => c.id === rawCitationId,
						)?.rawCitation ?? '',
					{timeout: 20_000},
				)
				.toBe(rawEdited);

			// --- Part B: STRUCTURED edit on a lookup-on scratch journal ---
			const sTag = uniqueTag();
			const {context: sJournal} = await pkpApi.createJournal({
				tag: sTag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
				citations: 'request',
				citationsMetadataLookup: true,
			});
			const {submission: sSub} = await pkpApi.createSubmission(
				submittedSpec({
					tag: sTag,
					title: `Structedit ${sTag}`,
					journal: sJournal.path,
					participants: [],
				}),
			);
			const sPub = await currentPublicationId(page, sSub.id, sJournal.path);
			await openReferencesTab(page, sJournal.path, sSub.id, sPub);
			const structSeed = `Unstructured reference ${sTag}. Journal. 2018.`;
			const sCsrf = await getCsrf(page);
			await addReferencesViaApi(
				page,
				sJournal.path,
				sSub.id,
				sPub,
				structSeed,
				sCsrf,
			);
			await page.reload({waitUntil: 'commit'});
			await expect(workflowModal(page).getByText(structSeed)).toBeVisible({
				timeout: 20_000,
			});
			const structCitationId = (
				await fetchCitations(page, sSub.id, sJournal.path)
			)[0].id;

			// Edit → the STRUCTURED form: Raw Citation (required) + DOI + Title +
			// the rest of the ~19 fields.
			await clickRowAction(page, 'Edit');
			await expect(
				page.locator('#citation_structured-rawCitation-control'),
			).toBeVisible({timeout: 20_000});
			await expect(
				page.locator('#citation_structured-doi-control'),
			).toBeVisible();
			await expect(
				page.locator('#citation_structured-title-control'),
			).toBeVisible();

			const structDoi = `10.1234/${sTag}`;
			const structTitle = `Structured title ${sTag}`;
			await page.locator('#citation_structured-doi-control').fill(structDoi);
			await page.locator('#citation_structured-title-control').fill(structTitle);
			const structSaveRes = await saveCitationEditModal(
				page,
				structCitationId,
				'citation_structured-rawCitation-control',
			);
			expect(structSaveRes.status()).toBe(200);
			await expect
				.poll(
					async () => {
						const c = (
							await fetchCitations(page, sSub.id, sJournal.path)
						).find((x) => x.id === structCitationId);
						return `${c?.doi ?? ''}|${c?.title ?? ''}`;
					},
					{timeout: 20_000},
				)
				.toBe(`${structDoi}|${structTitle}`);
		},
	);

	// Canonical scenario 5 — Reprocess a citation (lookup on). On a lookup-on
	// scratch journal the References tab exposes the structured header, the
	// processed/total status line and a "Reprocess all references" control; each
	// unstructured row offers a Reprocess action. Clicking it dispatches the
	// background enrichment chain and resets the row to Not-processed. The
	// pipeline is Background infra + outbound HTTP is firewalled in tests, so we
	// assert the endpoint 200 + the reset, NOT async completion.
	test(
		'reprocess a citation dispatches the pipeline and resets it to Not-processed',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {context: journal} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
				citations: 'request',
				citationsMetadataLookup: true,
			});
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: `Reprocess ${tag}`,
					journal: journal.path,
					participants: [],
				}),
			);
			const pubId = await currentPublicationId(page, submission.id, journal.path);

			await openReferencesTab(page, journal.path, submission.id, pubId);
			const seed = `Reprocess me ${tag}. Journal. 2017.`;
			const csrf = await getCsrf(page);
			await addReferencesViaApi(
				page,
				journal.path,
				submission.id,
				pubId,
				seed,
				csrf,
			);
			await page.reload({waitUntil: 'commit'});
			await expect(workflowModal(page).getByText(seed)).toBeVisible({
				timeout: 20_000,
			});
			const citationId = (
				await fetchCitations(page, submission.id, journal.path)
			)[0].id;

			// Lookup-on affordances render: the structured header, the
			// Reprocess-all control (v-show on lookup), and the status line.
			await expect(
				workflowModal(page)
					.getByRole('heading', {name: 'Structured References'})
					.first(),
			).toBeVisible();
			await expect(
				workflowModal(page).getByRole('button', {
					name: 'Reprocess all references',
				}),
			).toBeEnabled();

			// The unstructured row offers a Reprocess action; confirming it POSTs
			// the reprocess endpoint (200) and dispatches the enrichment chain.
			await clickRowAction(page, 'Reprocess');
			const [reprocessRes] = await Promise.all([
				page.waitForResponse(
					(r) =>
						new RegExp(
							`/api/v1/citations/${citationId}/reprocessCitation`,
						).test(r.url()) && r.request().method() === 'POST',
					{timeout: 20_000},
				),
				page
					.locator('[role="dialog"]')
					.getByRole('button', {name: 'OK', exact: true})
					.click(),
			]);
			expect(reprocessRes.status()).toBe(200);

			// The endpoint resets the citation to Not-processed and then
			// dispatches the enrichment chain — its OWN response reflects the
			// reset. (In test mode the queued chain then runs to completion at
			// end-of-request, flipping the row to PROCESSED even though the
			// external lookups are firewalled — the terminal job marks it
			// processed regardless. So we assert the endpoint's response, not a
			// later re-fetch, which would already read PROCESSED.)
			const reprocessBody = await reprocessRes.json();
			expect(reprocessBody.id).toBe(citationId);
			expect(reprocessBody.processingStatus).toBe(NOT_PROCESSED);
		},
	);

	// Canonical scenario 6 — Published version: warn (editor) vs hard-lock
	// (author) on the References tab. On a published version a manager/editor
	// with metadata rights still sees the Add box, per-row actions and Delete-all
	// behind the yellow published-version warning (warn-not-lock); an author,
	// hard-locked the moment a version publishes, sees a read-only list — the
	// per-row menu gone, Add + Delete-all disabled.
	test(
		'published version — editor warned-not-locked, author read-only',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Pubrefs ${tag}`,
					participants: [
						{user: 'dbarnes', role: 'editor', canChangeMetadata: true},
					],
				}),
			);
			const pubId = await currentPublicationId(
				page,
				submission.id,
				'publicknowledge',
			);

			// Seed one reference onto the published publication AS the editor —
			// managers/editors are warn-not-locked, so importAdditionalCitations
			// (which gates on canEditPublication) still succeeds.
			await page.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const seed = `Published reference ${tag}. Journal. 2016.`;
			const csrf = await getCsrf(page);
			await addReferencesViaApi(
				page,
				'publicknowledge',
				submission.id,
				pubId,
				seed,
				csrf,
			);

			// --- Editor: warned, not locked ---
			await openReferencesTab(page, 'publicknowledge', submission.id, pubId);
			await expect(workflowModal(page).getByText(seed)).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				workflowModal(page).getByText(EDITOR_EDIT_WARNING),
			).toBeVisible();
			// Delete-all is enabled and the per-row More Actions menu shows.
			await expect(
				workflowModal(page).getByRole('button', {
					name: 'Delete all references',
				}),
			).toBeEnabled();
			await expect(
				workflowModal(page).getByRole('button', {name: 'More Actions'}).first(),
			).toBeVisible();

			// --- Author: hard-locked, read-only ---
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await openReferencesTab(
				authorPage,
				'publicknowledge',
				submission.id,
				pubId,
				true,
			);
			await expect(workflowModal(authorPage).getByText(seed)).toBeVisible({
				timeout: 20_000,
			});
			// The author sees the hard-lock banner …
			await expect(
				workflowModal(authorPage).getByText(EDIT_DISABLED_BANNER),
			).toBeVisible();
			// … the per-row menu is gone (v-show canEditPublication) …
			await expect(
				workflowModal(authorPage).getByRole('button', {name: 'More Actions'}),
			).toHaveCount(0);
			// … and Add + Delete-all are disabled.
			await expect(
				workflowModal(authorPage).getByRole('button', {
					name: 'Delete all references',
				}),
			).toBeDisabled();
			await expect(
				authorPage
					.locator('form', {
						has: authorPage.locator('#addCitations-rawCitations-control'),
					})
					.getByRole('button', {name: 'Add', exact: true}),
			).toBeDisabled();
		},
	);

	// Canonical scenario 7 — ⚠ Permission boundary: the single-citation API gap
	// (spec Known deviations #1 / ledger row 91). PKPCitationController authorises
	// with ONLY the journal role list + a context check — no SubmissionAccessPolicy,
	// no PublicationWritePolicy. This test asserts the REAL as-built hole: atester,
	// a journal author with NO role on the target submission, can GET and PUT
	// another submission's citation by id → 200, persisted. Documents the gap; it
	// does NOT assert a fix. The tampered submission is a disposable seed.
	test(
		'a non-assigned author can GET and edit another submission’s citation via the API',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			// dbarnes submits + edits; atester has NO role on this submission.
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: `Apigap ${tag}`,
					submitter: 'dbarnes',
					participants: [{user: 'dbarnes', role: 'editor'}],
				}),
			);
			const pubId = await currentPublicationId(
				page,
				submission.id,
				'publicknowledge',
			);

			// Seed a citation as the assigned editor.
			await page.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const original = `Victim citation ${tag}. Journal. 2015.`;
			const editorCsrf = await getCsrf(page);
			await addReferencesViaApi(
				page,
				'publicknowledge',
				submission.id,
				pubId,
				original,
				editorCsrf,
			);
			const citationId = (
				await fetchCitations(page, submission.id, 'publicknowledge')
			)[0].id;

			// atester — a plain author with no assignment on this submission.
			const attackerCtx = await asUser('atester');
			const attackerPage = await attackerCtx.newPage();
			await attackerPage.goto('/index.php/publicknowledge/en/dashboard', {
				waitUntil: 'commit',
			});
			const attackerCsrf = await getCsrf(attackerPage);

			// GET the citation by id → 200 (no SubmissionAccessPolicy blocks it).
			const getRes = await attackerCtx.request.get(
				`/index.php/publicknowledge/api/v1/citations/${citationId}`,
			);
			expect(getRes.status()).toBe(200);
			expect((await getRes.json()).id).toBe(citationId);

			// PUT (tunnelled via POST) an overwrite → 200, and it persists.
			const tampered = `TAMPERED by unassigned author ${tag}.`;
			const putRes = await attackerCtx.request.post(
				`/index.php/publicknowledge/api/v1/citations/${citationId}`,
				{
					headers: {
						'X-Csrf-Token': attackerCsrf,
						'X-Http-Method-Override': 'PUT',
						'Content-Type': 'application/json',
					},
					data: {rawCitation: tampered, doi: null, arxiv: null, handle: null},
				},
			);
			expect(putRes.status(), await putRes.text()).toBe(200);
			expect((await putRes.json()).rawCitation).toBe(tampered);

			// The editor's own read now returns the attacker's text — the write
			// crossed the submission boundary with no assignment.
			const persisted = (
				await fetchCitations(page, submission.id, 'publicknowledge')
			).find((c) => c.id === citationId);
			expect(persisted.rawCitation).toBe(tampered);
		},
	);
});
