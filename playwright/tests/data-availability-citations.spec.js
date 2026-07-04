// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {ArticlePage} = require('../pages/ArticlePage.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Publication — Data availability & citations — the 5 canonical scenarios of
 * docs/product/specs/data-availability-citations.md (status: draft), landed at
 * L·4 by merging the "add a citation" (2) + "edit/reorder/delete" (3) pair into
 * one CRUD test.
 *
 * Scenario → test:
 *   1            → records the Data Availability Statement (live rich-text form),
 *                  it is never required-marked on this tab, it persists, and a
 *                  published article DISPLAYS it. + scenario 5's negative: the
 *                  Data tab is ABSENT on publicknowledge (neither mode on).
 *   2 + 3 MERGED → the Data Citations manager CRUD: add (8-field modal, DOI
 *                  normalised), add a 2nd, reorder (seq rewrite), edit (pre-filled
 *                  modal), delete (confirm), and the invalid-identifier rejection.
 *   4            → published-lock ⚠ (ledger row 97): on a PUBLISHED version the
 *                  author's statement form goes read-only (Save disabled) yet the
 *                  citation-manager Add/Order controls stay ENABLED — and the Add
 *                  POST is refused 401. The manager is warn-not-locked (statement
 *                  editable; a data-citation write succeeds 200).
 *   4-reader / 5 → reader-absence ⚠ (ledger row 98) + permission boundary: a
 *                  published article shows the statement but renders NO data
 *                  citation; an anonymous reader is refused the data-citation API
 *                  (401/403) while the submitting author may read it (200).
 *
 * AS-BUILT setup (spec author, live-verified 2026-07-04): the Publication → Data
 * tab is fully wired but OFF BY DEFAULT — it appears only once the journal turns
 * on the `dataAvailability` and/or `dataCitations` metadata mode (both off on
 * publicknowledge). Every Data-tab test here runs on a SCRATCH journal seeded
 * with both modes ON. `dataAvailability` already passed through the context
 * scenario schema; `dataCitations` is a new, additive passthrough added here
 * (schema/context.json + ContextBuilderProcessor) alongside it. The DB-verified
 * probe (context 40) confirmed both settings persist.
 *
 * Reader render (scenarios 1-display + 4) is asserted on publicknowledge, whose
 * public article page is the well-exercised reader path — article_details.tpl
 * renders `dataAvailability` from the publication value regardless of the journal
 * mode, and the data-citation API scopes on publication write access (not the
 * metadata mode), so a citation can be seeded there to prove the reader-absence.
 *
 * Parallel-safety: hyphenless alphanumeric tags; every mode flip lives on a
 * per-test scratch journal (publicknowledge stays read-only — only fresh
 * submissions added, its published issue scheduled INTO but never mutated);
 * every persistence assertion reads back through the publication / data-citation
 * REST API. No Mailpit use.
 */

// ---- rendered copy (locale/en) --------------------------------------------
const DATA_TAB = 'Data'; // submission.dataAvailabilityAndCitation.data (nav label)
const MANAGER_HEADING = 'Data Citations'; // submission.dataCitations
const EMPTY_CITATIONS = 'No data citations have been added.'; // submission.dataCitations.emptyCitations
const ADD_CITATION = 'Add a new Data Citation'; // grid.action.addDataCitation
const ORDER = 'Order'; // grid.action.order
const SAVE_ORDER = 'Save Order'; // grid.action.saveOrdering
// EDITORIAL published-version banner (warn-not-lock): managers/editors keep
// editing behind the yellow warning.
const EDITOR_EDIT_WARNING =
	'Warning: This version has been published. Editing it may impact the published content.';
// AUTHOR published-version banner (hard lock).
const EDIT_DISABLED_BANNER =
	'This version has been published and can not be edited.';

// ---- publication status constant (verified) -------------------------------
const PUB_STATUS_PUBLISHED = 3; // PKPPublication::STATUS_PUBLISHED

// ---- data-citation form (DataCitationEditForm id) -------------------------
const DC_FORM = 'data_citation';
// The statement form (PKPDataAvailabilityForm id = 'dataAvailability',
// field 'dataAvailability', multilingual rich text).
const STATEMENT_FIELD_PREFIX = 'dataAvailability-dataAvailability-control';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `dac${workerIndex}x${suffix}`;
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/** Deep-link the workflow onto a Publication sub-pane of a specific version. */
function pubLink(journalPath, submissionId, pubId, name, author = false) {
	const dash = author ? 'mySubmissions' : 'editorial';
	return (
		`/index.php/${journalPath}/en/dashboard/${dash}` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_${name}`
	);
}

/**
 * CSRF token from a loaded OJS page. window.pkp boots async under
 * waitUntil:'commit', so wait for the token before reading it.
 */
async function getCsrf(page) {
	await page.waitForFunction(() => !!window.pkp?.currentUser?.csrfToken, null, {
		timeout: 20_000,
	});
	const token = await page.evaluate(() => window.pkp.currentUser.csrfToken);
	expect(token, 'csrf token from page').toBeTruthy();
	return token;
}

/** Resolve the current publication id for a submission (page session). */
async function currentPublicationId(page, submissionId, journalPath) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(res.ok(), `GET submission ${submissionId}: ${res.status()}`).toBeTruthy();
	return (await res.json()).currentPublicationId;
}

/** GET one publication JSON (page session). */
async function fetchPublication(page, submissionId, pubId, journalPath) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(res.ok(), `GET publication ${pubId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/**
 * The data citations on a publication, read through the dedicated
 * (properly-scoped) data-citation list endpoint. `requestCtx` is a Playwright
 * APIRequestContext (page.request or ctx.request) so callers can assert as a
 * specific actor.
 */
async function fetchDataCitations(requestCtx, journalPath, submissionId, pubId) {
	const res = await requestCtx.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}/dataCitations`,
	);
	expect(res.ok(), `GET dataCitations: ${res.status()}`).toBeTruthy();
	return (await res.json()).items ?? [];
}

/** POST a data citation directly (used for warn-not-lock manager writes + seeding). */
async function addDataCitationViaApi(
	requestCtx,
	journalPath,
	submissionId,
	pubId,
	data,
	csrf,
) {
	return requestCtx.post(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}/dataCitations`,
		{
			headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
			data,
		},
	);
}

/**
 * Resolve the id of a mounted+initialised TinyMCE editor whose id contains
 * `includes` (optionally ending in `-{locale}`). Polls until it mounts.
 */
async function resolveEditorId(page, includes, {locale} = {}) {
	const handle = await page.waitForFunction(
		({inc, loc}) => {
			const tiny = window.tinymce;
			const list = (typeof tiny?.get === 'function' ? tiny.get() : null) ?? [];
			const ids = list.filter((e) => e.initialized).map((e) => e.id);
			if (loc) {
				return ids.find((id) => id.includes(inc) && id.endsWith('-' + loc)) || null;
			}
			return ids.find((id) => id.includes(inc)) || null;
		},
		{inc: includes, loc: locale ?? null},
		{timeout: 20_000},
	);
	return /** @type {string} */ (await handle.jsonValue());
}

// ---- Data tab / statement-form locators -----------------------------------

/** The Data Availability Statement PkpForm (holds the multilingual rich-text field). */
function statementForm(page) {
	return page.locator('form.pkpForm', {
		has: page.locator(`[id^="${STATEMENT_FIELD_PREFIX}"]`),
	});
}

/** The statement form's Save button (disabled ⇔ the form is read-only). */
function statementSaveButton(page) {
	return statementForm(page).getByRole('button', {name: 'Save', exact: true});
}

/** Save the statement form and wait for the publication PUT (tunnelled as POST). */
async function saveStatement(page, pubId) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(r) =>
				new RegExp(`/publications/${pubId}(?:\\?|$)`).test(r.url()) &&
				r.request().method() === 'POST',
			{timeout: 20_000},
		),
		statementSaveButton(page).click(),
	]);
	return response;
}

// ---- Data Citations manager locators --------------------------------------

/** The manager's top-controls row (Add + the Order/Save-Order sort button). */
function managerTopControls(page) {
	return page
		.locator('div.flex.gap-x-2', {
			has: page.getByRole('button', {name: ADD_CITATION}),
		})
		.first();
}

function managerAddButton(page) {
	return managerTopControls(page).getByRole('button', {name: ADD_CITATION});
}

function managerSortButton(page, label) {
	return managerTopControls(page).getByRole('button', {name: label, exact: true});
}

/** The manager's PkpTable (aria-label = 'Data Citations'). */
function managerTable(page) {
	return page.getByRole('table', {name: MANAGER_HEADING});
}

/** A manager row scoped by its citation title text. */
function managerRow(page, title) {
	return managerTable(page).locator('tr', {hasText: title});
}

// ---- Add/Edit modal (DataCitationEditForm) locators -----------------------

function dcField(page, name) {
	return page.locator(`#${DC_FORM}-${name}-control`);
}

/** The Add/Edit side-modal's form (unique on the field ids it carries). */
function dataCitationModalForm(page) {
	return page.locator('form', {has: page.locator(`#${DC_FORM}-title-control`)});
}

/** Open the Add modal and wait for its Title field to mount. */
async function openAddModal(page) {
	await managerAddButton(page).click();
	await expect(dcField(page, 'title')).toBeVisible({timeout: 20_000});
}

/** Fill the (open) Add/Edit modal; only `title` + `relationshipType` are required. */
async function fillCitationModal(
	page,
	{title, relationshipType, identifierType, identifier, repository, year, url},
) {
	if (title !== undefined) await dcField(page, 'title').fill(title);
	if (relationshipType) {
		await dcField(page, 'relationshipType').selectOption(relationshipType);
	}
	if (identifierType) {
		await dcField(page, 'identifierType').selectOption(identifierType);
	}
	if (identifier) await dcField(page, 'identifier').fill(identifier);
	if (repository) await dcField(page, 'repository').fill(repository);
	if (year) await dcField(page, 'year').fill(year);
	if (url) await dcField(page, 'url').fill(url);
}

/**
 * Click the modal's Save and wait for the matching data-citation write. All
 * writes tunnel through POST (useFetch's X-Http-Method-Override), so predicates
 * key on the URL path, not the method.
 */
async function saveCitationModal(page, urlPredicate) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(r) => urlPredicate(r.url()) && r.request().method() === 'POST',
			{timeout: 20_000},
		),
		dataCitationModalForm(page)
			.getByRole('button', {name: 'Save', exact: true})
			.click(),
	]);
	return response;
}

/** Open a row's More Actions menu and click a named item (menu portals to root). */
async function clickRowAction(page, title, actionName) {
	await managerRow(page, title)
		.getByRole('button', {name: 'More Actions'})
		.click();
	await page.getByRole('menuitem', {name: actionName, exact: true}).click();
}

/** Open the Data tab and wait for the nav + the pane to mount. */
async function openDataTab(page, journalPath, submissionId, pubId, author = false) {
	await page.goto(
		pubLink(journalPath, submissionId, pubId, 'dataAvailabilityAndCitation', author),
		{waitUntil: 'commit'},
	);
	await expect(
		workflowModal(page).locator('nav').getByText(DATA_TAB, {exact: true}),
	).toBeVisible({timeout: 25_000});
	// The Data Citations manager mounts once both modes are on.
	await expect(
		workflowModal(page).getByRole('heading', {name: MANAGER_HEADING}),
	).toBeVisible({timeout: 25_000});
}

// ---- scenario specs -------------------------------------------------------

/** A submitted, unpublished, stage-1 submission (default: atester author + dbarnes editor). */
function submittedSpec({
	tag,
	title,
	journal,
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** A VoR-published submission assigned to a published issue (atester author). */
function publishedSpec({
	tag,
	title,
	journal,
	issue,
	participants = [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
	metadata = {},
}) {
	return {
		tag,
		journal,
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
				metadata: {title: {en: title}, ...metadata},
				issue,
				published: true,
			},
		],
	};
}

/** Create a scratch journal that collects BOTH the statement and data citations. */
async function createDataJournal(pkpApi, tag, extra = {}) {
	const {context} = await pkpApi.createJournal({
		tag,
		users: [
			{username: 'dbarnes', roles: ['manager']},
			{username: 'atester', roles: ['author']},
		],
		dataAvailability: 'enable',
		dataCitations: 'enable',
		...extra,
	});
	return context;
}

test.use({user: 'dbarnes'}); // manager on the scratch journals + publicknowledge

test.describe('Publication — Data availability & citations', () => {
	// Canonical scenario 1 (+ 5 negative) — the Data Availability Statement.
	// On a scratch journal that collects both, the Data tab shows the rich-text
	// statement field (never required-marked, even though the mode can be
	// "require") and the Data Citations manager. The editor types a statement and
	// saves; it persists on the version. A published article then DISPLAYS the
	// statement. And on publicknowledge (neither mode) the Data tab is ABSENT.
	test(
		'records the statement (unmarked); it persists and the reader displays it; tab follows the mode',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const journal = await createDataJournal(pkpApi, tag);
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Statement ${tag}`, journal: journal.path}),
			);
			const pubId = await currentPublicationId(page, submission.id, journal.path);

			await openDataTab(page, journal.path, submission.id, pubId, false);

			// The multilingual rich-text statement field renders and is NOT
			// required-marked on this tab (Rule 2).
			await expect(
				page.locator(`[id^="${STATEMENT_FIELD_PREFIX}"]`).first(),
			).toBeAttached({timeout: 20_000});
			await expect(
				statementForm(page).locator('.pkpFormFieldLabel__required'),
			).toHaveCount(0);

			// Drive the rich-text field live and save.
			const statementHtml = `<p>Raw data are available at Dryad ${tag}</p>`;
			const editorId = await resolveEditorId(page, 'dataAvailability', {
				locale: 'en',
			});
			await setTinyMceContent(page, editorId, statementHtml);
			const saveRes = await saveStatement(page, pubId);
			expect(saveRes.status()).toBe(200);

			// Server truth: the statement persists on the selected version.
			await expect
				.poll(
					async () =>
						(await fetchPublication(page, submission.id, pubId, journal.path))
							.dataAvailability?.en ?? '',
					{timeout: 20_000},
				)
				.toContain(tag);

			// --- Reader display + scenario 5 negative (publicknowledge) ---
			// A published article carrying a statement DISPLAYS it (mode-independent
			// render). publicknowledge collects neither mode, so its Data tab is
			// absent — the same publication proves both.
			const readerText = `Data are archived at Zenodo ${tag}`;
			const {submission: pubSub, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}r`,
					title: `Reader DA ${tag}`,
					journal: 'publicknowledge',
					issue: {volume: 1, number: 2, year: 2014},
					metadata: {dataAvailability: {en: `<p>${readerText}</p>`}},
				}),
			);
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			// The Data tab is ABSENT on publicknowledge (neither mode) — assert via
			// the Metadata pane's nav (which is present).
			await page.goto(
				pubLink('publicknowledge', pubSub.id, publications[0].id, 'metadata', false),
				{waitUntil: 'commit'},
			);
			await expect(
				workflowModal(page).locator('nav').getByText('Metadata', {exact: true}),
			).toBeVisible({timeout: 25_000});
			await expect(
				workflowModal(page).locator('nav').getByText(DATA_TAB, {exact: true}),
			).toHaveCount(0);

			// The public article page renders the Data Availability Statement.
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				const resp = await article.goto(pubSub.id, {locale: 'en'});
				expect(resp?.status(), 'published article reachable').toBeLessThan(400);
				await expect(article.dataAvailabilitySection).toBeVisible({
					timeout: 20_000,
				});
				await expect(article.dataAvailabilitySection).toContainText(readerText);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenarios 2 + 3 (MERGED) — the Data Citations manager CRUD. Add a
	// citation through the 8-field modal (Title + Relationship required; an
	// Identifier type + Identifier that is prefix-stripped and format-checked);
	// add a second; reorder them (the seq rewrites); edit the first via the
	// pre-filled modal; delete the second via the confirm dialog. Finally, an
	// identifier that doesn't match its type is rejected (HTTP 400).
	test(
		'add (8-field modal, DOI normalised), reorder, edit and delete data citations; invalid identifier rejected',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const journal = await createDataJournal(pkpApi, tag);
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Citations ${tag}`, journal: journal.path}),
			);
			const pubId = await currentPublicationId(page, submission.id, journal.path);

			await openDataTab(page, journal.path, submission.id, pubId, false);
			// Empty state.
			await expect(
				workflowModal(page).getByText(EMPTY_CITATIONS),
			).toBeVisible({timeout: 20_000});

			// --- Add citation 1 (full modal; DOI passed URL-prefixed) ---
			const title1 = `Genome dataset ${tag}`;
			await openAddModal(page);
			await fillCitationModal(page, {
				title: title1,
				relationshipType: 'supporting',
				identifierType: 'DOI',
				identifier: `https://doi.org/10.1234/${tag}a`,
				repository: 'Dryad',
				year: '2021',
			});
			const add1 = await saveCitationModal(page, (u) =>
				/\/dataCitations(?:\?|$)/.test(u),
			);
			expect(add1.status(), await add1.text()).toBe(200);
			await expect(managerTable(page).getByText(title1)).toBeVisible({
				timeout: 20_000,
			});

			// Server truth: one row, DOI normalised (prefix stripped), seq 1.
			await expect
				.poll(
					async () =>
						(await fetchDataCitations(page.request, journal.path, submission.id, pubId))
							.length,
					{timeout: 20_000},
				)
				.toBe(1);
			let citations = await fetchDataCitations(
				page.request,
				journal.path,
				submission.id,
				pubId,
			);
			const c1 = citations.find((c) => c.title === title1);
			expect(c1).toBeTruthy();
			expect(c1.identifier).toBe(`10.1234/${tag}a`); // https://doi.org/ stripped
			expect(c1.identifierType).toBe('DOI');
			expect(c1.relationshipType).toBe('supporting');
			expect(c1.repository).toBe('Dryad');
			expect(String(c1.year)).toBe('2021');
			// (seq is not an apiSummary prop; the list endpoint returns rows already
			// ordered by seq, so order-in-list is the observable ordering — asserted
			// after the reorder below.)

			// --- Add citation 2 (Title + Relationship only) ---
			const title2 = `Survey responses ${tag}`;
			await openAddModal(page);
			await fillCitationModal(page, {
				title: title2,
				relationshipType: 'generated',
			});
			const add2 = await saveCitationModal(page, (u) =>
				/\/dataCitations(?:\?|$)/.test(u),
			);
			expect(add2.status(), await add2.text()).toBe(200);
			await expect
				.poll(
					async () =>
						(await fetchDataCitations(page.request, journal.path, submission.id, pubId))
							.length,
					{timeout: 20_000},
				)
				.toBe(2);
			citations = await fetchDataCitations(
				page.request,
				journal.path,
				submission.id,
				pubId,
			);
			const c2Id = citations.find((c) => c.title === title2).id;
			// Baseline order (rows come back ordered by seq): [c1, c2].
			expect(citations.map((c) => c.title)).toEqual([title1, title2]);

			// --- Reorder: move citation 1 down; save; the seq order swaps ---
			await managerSortButton(page, ORDER).click();
			await expect(managerSortButton(page, SAVE_ORDER)).toBeVisible({
				timeout: 20_000,
			});
			// The row's actions cell is now up/down chevrons (up first, down last).
			await managerRow(page, title1).getByRole('button').last().click();
			const [orderRes] = await Promise.all([
				page.waitForResponse(
					(r) =>
						/\/dataCitations\/order(?:\?|$)/.test(r.url()) &&
						r.request().method() === 'POST',
					{timeout: 20_000},
				),
				managerSortButton(page, SAVE_ORDER).click(),
			]);
			expect(orderRes.status()).toBe(200);
			// The rewrite is observable as the list order flipping to [c2, c1].
			await expect
				.poll(
					async () =>
						(await fetchDataCitations(page.request, journal.path, submission.id, pubId))
							.map((c) => c.title),
					{timeout: 20_000},
				)
				.toEqual([title2, title1]);

			// --- Edit citation 1 via the pre-filled modal ---
			await clickRowAction(page, title1, 'Edit');
			await expect(dcField(page, 'title')).toHaveValue(title1, {timeout: 20_000});
			const title1Edited = `Genome dataset (revised) ${tag}`;
			await dcField(page, 'title').fill(title1Edited);
			const editRes = await saveCitationModal(page, (u) =>
				new RegExp(`/dataCitations/${c1.id}(?:\\?|$)`).test(u),
			);
			expect(editRes.status(), await editRes.text()).toBe(200);
			await expect
				.poll(
					async () =>
						(await fetchDataCitations(page.request, journal.path, submission.id, pubId))
							.find((c) => c.id === c1.id)?.title,
					{timeout: 20_000},
				)
				.toBe(title1Edited);

			// --- Delete citation 2 via the confirm dialog ---
			await clickRowAction(page, title2, 'Delete');
			const dialog = page
				.locator('[role="dialog"]')
				.filter({hasText: 'delete this item'});
			await expect(dialog).toBeVisible({timeout: 15_000});
			const [deleteRes] = await Promise.all([
				page.waitForResponse(
					(r) =>
						new RegExp(`/dataCitations/${c2Id}(?:\\?|$)`).test(r.url()) &&
						r.request().method() === 'POST',
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'OK', exact: true}).click(),
			]);
			expect(deleteRes.status()).toBe(200);
			await expect
				.poll(
					async () =>
						(await fetchDataCitations(page.request, journal.path, submission.id, pubId))
							.length,
					{timeout: 20_000},
				)
				.toBe(1);

			// --- Invalid identifier is rejected (HTTP 400) ---
			await openAddModal(page);
			await fillCitationModal(page, {
				title: `Bad DOI ${tag}`,
				relationshipType: 'analyzed',
				identifierType: 'DOI',
				identifier: `not-a-valid-doi-${tag}`,
			});
			const badRes = await saveCitationModal(page, (u) =>
				/\/dataCitations(?:\?|$)/.test(u),
			);
			expect(badRes.status(), 'invalid DOI rejected').toBe(400);
			// The bad citation did not persist (still one row).
			expect(
				(await fetchDataCitations(page.request, journal.path, submission.id, pubId))
					.length,
			).toBe(1);
		},
	);

	// Canonical scenario 4 — published-lock ⚠ (ledger row 97). On a PUBLISHED
	// version a manager is warn-not-locked: the statement stays editable (Save
	// enabled) and a data-citation write succeeds (200). The AUTHOR is hard-locked
	// — the statement form goes read-only (Save disabled) — YET the Data Citations
	// manager's Add/Order controls stay ENABLED (the divergence), and the Add POST
	// is refused by the server (HTTP 401).
	test(
		'published version: manager warn-not-locked; author statement read-only but citation controls enabled + Add 401',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const journal = await createDataJournal(pkpApi, tag, {
				issues: [{volume: 1, number: 1, year: 2024, published: true}],
			});
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Locked data ${tag}`,
					journal: journal.path,
					issue: {volume: 1, number: 1, year: 2024},
				}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			// --- Manager (dbarnes): warn-not-locked ---
			await openDataTab(page, journal.path, submission.id, pubId, false);
			await expect(
				workflowModal(page).getByText(EDITOR_EDIT_WARNING),
			).toBeVisible({timeout: 20_000});
			// The statement stays editable (Save enabled) …
			await expect(statementSaveButton(page)).toBeEnabled();
			// … the citation-manager controls are enabled …
			await expect(managerAddButton(page)).toBeEnabled();
			await expect(managerSortButton(page, ORDER)).toBeEnabled();
			// … and a data-citation write SUCCEEDS on the published version.
			const mgrCsrf = await getCsrf(page);
			const mgrAdd = await addDataCitationViaApi(
				page.request,
				journal.path,
				submission.id,
				pubId,
				{title: `Manager cite ${tag}`, relationshipType: 'supporting'},
				mgrCsrf,
			);
			expect(mgrAdd.status(), await mgrAdd.text()).toBe(200);

			// --- Author (atester): hard-locked ---
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await openDataTab(authorPage, journal.path, submission.id, pubId, true);
			// The hard-lock banner shows …
			await expect(
				workflowModal(authorPage).getByText(EDIT_DISABLED_BANNER),
			).toBeVisible({timeout: 20_000});
			// … the statement form is read-only (Save disabled) …
			await expect(statementSaveButton(authorPage)).toBeDisabled();
			// … BUT the Data Citations Add/Order controls stay ENABLED (⚠ Rule 8) …
			await expect(managerAddButton(authorPage)).toBeEnabled();
			await expect(managerSortButton(authorPage, ORDER)).toBeEnabled();
			// … and the Add the manager offers is refused by the server (HTTP 401).
			await openAddModal(authorPage);
			await fillCitationModal(authorPage, {
				title: `Author cite ${tag}`,
				relationshipType: 'supporting',
			});
			const [authorAdd] = await Promise.all([
				authorPage.waitForResponse(
					(r) =>
						/\/dataCitations(?:\?|$)/.test(r.url()) &&
						r.request().method() === 'POST',
					{timeout: 20_000},
				),
				dataCitationModalForm(authorPage)
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);
			expect(authorAdd.status(), 'hard-locked author Add refused').toBe(401);

			// The refusal held: only the manager's citation persisted.
			const finalRows = await fetchDataCitations(
				page.request,
				journal.path,
				submission.id,
				pubId,
			);
			expect(finalRows.map((c) => c.title)).toEqual([`Manager cite ${tag}`]);
		},
	);

	// Canonical scenario 4-reader (⚠ ledger row 98) + scenario 5 boundary. A
	// published article DISPLAYS the Data Availability Statement but renders NO
	// data citation, though one is captured on the publication. And the
	// data-citation API is properly scoped (Rule 10): an anonymous reader is
	// refused it (401/403) while the submitting author may read it (200).
	test(
		'reader-absence: published article shows the statement but no data citation; API scoped (anon refused, author reads)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			// publicknowledge: the well-exercised reader path. The statement seeds
			// with the publication; the data-citation API ignores the metadata mode
			// (Rule 11), so a citation can be added there to prove reader-absence.
			const statementText = `Underlying data at OSF ${tag}`;
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Reader gap ${tag}`,
					journal: 'publicknowledge',
					issue: {volume: 1, number: 2, year: 2014},
					metadata: {dataAvailability: {en: `<p>${statementText}</p>`}},
				}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(PUB_STATUS_PUBLISHED);

			// Seed a data citation as the manager (warn-not-lock write on published).
			const citeTitle = `Hidden dataset ${tag}`;
			const citeIdentifier = `10.5061/${tag}`;
			await page.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const csrf = await getCsrf(page);
			const seedRes = await addDataCitationViaApi(
				page.request,
				'publicknowledge',
				submission.id,
				pubId,
				{
					title: citeTitle,
					relationshipType: 'generated',
					identifierType: 'DOI',
					identifier: citeIdentifier,
				},
				csrf,
			);
			expect(seedRes.status(), await seedRes.text()).toBe(200);

			// --- Reader (anonymous): statement shown, citation ABSENT ---
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const reader = await anon.newPage();
				const article = new ArticlePage(reader);
				const resp = await article.goto(submission.id, {locale: 'en'});
				expect(resp?.status(), 'published article reachable').toBeLessThan(400);
				// The statement IS displayed …
				await expect(article.dataAvailabilitySection).toBeVisible({
					timeout: 20_000,
				});
				await expect(article.dataAvailabilitySection).toContainText(statementText);
				// … but the data citation is rendered on NO reader surface (⚠ Rule 9).
				await expect(reader.getByText(citeTitle)).toHaveCount(0);
				await expect(reader.getByText(citeIdentifier)).toHaveCount(0);

				// The data-citation API refuses the anonymous reader (has.user gate).
				const anonGet = await anon.request.get(
					`/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${pubId}/dataCitations`,
				);
				expect([401, 403]).toContain(anonGet.status());
			} finally {
				await anon.close();
			}

			// --- The submitting author MAY read the data citations (200) ---
			const authorCtx = await asUser('atester');
			const authorGet = await authorCtx.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${pubId}/dataCitations`,
			);
			expect(authorGet.status()).toBe(200);
			const items = (await authorGet.json()).items ?? [];
			expect(items.some((c) => c.title === citeTitle)).toBe(true);
		},
	);
});
