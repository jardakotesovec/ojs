// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {
	LibraryFilesGrid,
} = require('../../lib/pkp/playwright/pages/LibraryFilesGrid.js');
const {
	fixtureFilePath,
} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');
const {
	waitForJQueryIdle,
} = require('../../lib/pkp/playwright/support/jquery.js');

/**
 * Document Library — the reusable-document store at its two levels: the
 * journal-wide CONTEXT library (Settings → Workflow → Library) and the
 * per-SUBMISSION library (workflow header → "Submission Library"). One
 * test per canonical scenario of docs/product/specs/document-library.md
 * (5 scenarios → 4 tests):
 *
 *   Test 1 = scenario 1 (manager curates the journal library) MERGED with
 *            scenario 4 (a public journal document / public download URL).
 *            The merge: scenario 1 already uploads context documents, so
 *            the public-access document + its `libraryFiles/downloadPublic`
 *            URL are exercised on the same curated library rather than in a
 *            standalone test. This test ALSO carries the OQ1 security probe
 *            (below).
 *   Test 2 = scenario 2 (Submission Library from the workflow — editor).
 *   Test 3 = scenario 3 (author attaches a permissions form to their own
 *            submission).
 *   Test 4 = scenario 5 (permission boundaries — the `_library` REST API is
 *            manager/sub-editor-only; a reviewer is refused the Library
 *            modal op).
 *
 * THE distinctive coverage (the spec author could not round-trip the
 * upload): every context/submission document here is uploaded through the
 * REAL legacy plupload "Add a file" modal in a live browser and asserted on
 * BOTH the rendered grid AND the library API / download responses — via the
 * shared LibraryFilesGrid POM (lib/pkp), which drives the plupload widget
 * like the sibling upload flows.
 *
 * ⚠ OQ1 SECURITY PROBE (spec Open question 1): the bare page op
 * `…/libraryFiles/downloadLibraryFile?libraryFileId={id}` carries no
 * authorization policy and, for a CONTEXT document (no submissionId),
 * default-allows — so it appears to serve a NON-PUBLIC journal library file
 * with no login. Test 1 probes this live (logged out AND as a
 * non-privileged author) and asserts the app's REAL, as-built behaviour. It
 * is reported to the verifier, NOT fixed here.
 *
 * As-built respected (spec Known deviations / task notes):
 *   - Description is asterisked but NOT enforced — test 1 uploads a document
 *     with an EMPTY description and asserts it still saves (not blocked).
 *   - The four offered types are Marketing / Permissions / Reports / Other
 *     (CONTRACT is defined but never mapped, so never offered).
 *   - The submission-library form has no Public-Access checkbox (only the
 *     context form does) — public access is asserted only on context docs.
 *
 * Parallel-safety: test 1 mutates a per-run SCRATCH journal (context-library
 * uploads pollute the shared journal, so they are isolated off
 * publicknowledge entirely); tests 2–4 use per-test submissions (submission
 * library rows cascade-delete with the submission). Tags are single
 * hyphenless alphanumeric tokens. No Mailpit / clearAll.
 */

const ROLE_DENIED =
	'The current role does not have access to this operation.';

/** A unique, hyphenless, alphanumeric tag (parallel isolation; urlPath ≤ 32). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `dl${workerLetter}${suffix.slice(0, 6)}`;
}

/** Localize a schema `name` (string or locale map) to a plain string. */
function nameOf(item) {
	const n = item.name;
	if (typeof n === 'string') return n;
	return n?.en ?? Object.values(n || {})[0] ?? '';
}

/**
 * GET the `_library` REST list through a request context (throws on
 * non-2xx). Optionally include a submission's documents.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} journalPath
 * @param {{submissionId?: number}} [opts]
 * @returns {Promise<any[]>} the `items` array
 */
async function getLibrary(request, journalPath, {submissionId} = {}) {
	const qs = submissionId ? `?includeSubmissionId=${submissionId}` : '';
	const res = await request.get(
		`/index.php/${journalPath}/api/v1/_library${qs}`,
	);
	if (!res.ok()) {
		throw new Error(`GET _library failed: ${res.status()} ${await res.text()}`);
	}
	return (await res.json()).items || [];
}

/** The role-gated component download route (the LIVE, UI-referenced path). */
function componentDownloadUrl(journalPath, fileId, submissionId) {
	const sub = submissionId ? `&submissionId=${submissionId}` : '';
	return `/index.php/${journalPath}/$$$call$$$/api/file/file-api/download-library-file?libraryFileId=${fileId}${sub}`;
}

/** The bare, legacy PAGE download op (OQ1 — no auth policy). */
function barePageDownloadUrl(journalPath, fileId) {
	return `/index.php/${journalPath}/libraryFiles/downloadLibraryFile?libraryFileId=${fileId}`;
}

/** The public download page op (serves only when Public Access is set). */
function publicDownloadUrl(journalPath, fileId) {
	return `/index.php/${journalPath}/libraryFiles/downloadPublic/${fileId}`;
}

/**
 * Open a submission's "Submission Library" side modal from the workflow
 * header Library button and return the dialog.
 *
 * @param {import('@playwright/test').Page} page
 */
async function openSubmissionLibrary(page) {
	await page
		.locator('[data-cy="active-modal"]')
		.first()
		.getByRole('button', {name: 'Library', exact: true})
		.click();
	const dialog = page.getByRole('dialog', {name: 'Submission Library'});
	await expect(dialog).toBeVisible({timeout: 20_000});
	await waitForJQueryIdle(page);
	return dialog;
}

const FILE = fixtureFilePath(); // default-article.pdf (application/pdf)

test.use({user: 'dbarnes'}); // default actor: a Journal manager of publicknowledge

test.describe('Document Library', () => {
	// ── Canonical scenario 1 (curate the journal library) MERGED with
	// scenario 4 (a public journal document) + the OQ1 security probe.
	//
	// A manager opens Settings → Workflow → Library, uploads a non-public
	// "Other" document (with NO description — the unenforced-asterisk
	// deviation), sees it list, downloads it via the referenced component
	// route, PROBES the bare unauthenticated page op, uploads a SECOND,
	// PUBLIC "Marketing" document and confirms its public URL serves to an
	// anonymous client while the non-public doc 403s on that public URL,
	// then EDITS (renames) and DELETES the documents. Runs on a per-run
	// scratch journal so the context-library mutations never leak into the
	// shared publicknowledge library.
	test(
		'manager curates the journal library incl. a public document (scenarios 1 + 4) and the OQ1 bare-op probe',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL, asUser}) => {
			test.slow(); // scratch journal + two full plupload uploads + edit/delete
			const tag = uniqueTag();
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
			});
			const journalPath = context.path;

			const privateName = `Reviewer Guidelines ${tag}`;
			const publicName = `Marketing Flyer ${tag}`;

			// Settings → Workflow → Library (the "Publisher Library" grid).
			await page.goto(
				`/index.php/${journalPath}/management/settings/workflow`,
			);
			await expect(page.locator('#library-button')).toBeVisible({
				timeout: 20_000,
			});
			await page.locator('#library-button').click();
			const contextGrid = new LibraryFilesGrid(page, {
				containerSelector: '#libraryGridDiv',
				gridId: LibraryFilesGrid.CONTEXT_GRID_ID,
			});
			await contextGrid.expectReady();

			// The four type categories render (each shown even when empty).
			for (const cat of ['Marketing', 'Permissions', 'Reports', 'Other']) {
				await expect(
					contextGrid.container().getByText(cat, {exact: true}).first(),
				).toBeVisible({timeout: 15_000});
			}

			// Upload a NON-PUBLIC "Other" document with NO description — the
			// asterisked-but-unenforced Description deviation: it still saves.
			await contextGrid.addFile({
				name: privateName,
				type: 'Other',
				filePath: FILE,
				// description intentionally omitted (deviation).
			});

			// It is in the library API (proof it persisted despite the empty
			// description) with an id + a download url.
			let items = await getLibrary(page.request, journalPath);
			const priv = items.find((i) => nameOf(i) === privateName);
			expect(priv, 'the non-public doc should be in _library').toBeTruthy();
			expect(priv.submissionId).toBe(0); // a CONTEXT (journal-wide) row.

			// Download it via the referenced, role-gated component route (the
			// name link's live target). 200 + a PDF body.
			const dl = await page.request.get(
				componentDownloadUrl(journalPath, priv.id),
				{maxRedirects: 0},
			);
			expect(dl.status()).toBe(200);
			expect((await dl.body()).byteLength).toBeGreaterThan(0);

			// ── OQ1 SECURITY PROBE ─────────────────────────────────────────
			// The bare legacy PAGE op has no auth policy; for a CONTEXT file it
			// default-allows. Probe it (a) logged out and (b) as a
			// non-privileged author. maxRedirects:0 so a login redirect can't
			// masquerade as a served file. Asserts the app's REAL behaviour.
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const anonProbe = await anon.request.get(
					barePageDownloadUrl(journalPath, priv.id),
					{maxRedirects: 0},
				);
				const anonType = anonProbe.headers()['content-type'] || '';
				// AS-BUILT: the bare op serves the non-public context file to an
				// anonymous client — 200 with the file's own MIME (application/
				// pdf), NOT an HTML login page. This is the latent hole OQ1
				// flags; asserted as reality, not endorsed.
				expect(
					anonProbe.status(),
					'OQ1: bare downloadLibraryFile status (logged out)',
				).toBe(200);
				expect(
					anonType,
					'OQ1: bare op served the file body, not an HTML login page',
				).toContain('pdf');
				expect((await anonProbe.body()).byteLength).toBeGreaterThan(0);
			} finally {
				await anon.close();
			}

			// (b) as a non-privileged author (atester, enrolled author-only on
			// this scratch journal) — same bare op.
			const authorCtx = await asUser('atester');
			const authorProbe = await authorCtx.request.get(
				barePageDownloadUrl(journalPath, priv.id),
				{maxRedirects: 0},
			);
			expect(
				authorProbe.status(),
				'OQ1: bare downloadLibraryFile status (non-privileged author)',
			).toBe(200);
			expect(
				authorProbe.headers()['content-type'] || '',
				'OQ1: author gets the file body from the bare op',
			).toContain('pdf');
			// ───────────────────────────────────────────────────────────────

			// Upload a PUBLIC "Marketing" document (Public Access ticked).
			await contextGrid.addFile({
				name: publicName,
				type: 'Marketing',
				filePath: FILE,
				description: `Flyer for ${tag}`,
				publicAccess: true,
			});
			items = await getLibrary(page.request, journalPath);
			const pub = items.find((i) => nameOf(i) === publicName);
			expect(pub).toBeTruthy();

			// Scenario 4: the PUBLIC document downloads with NO login via the
			// public URL; the NON-PUBLIC document 403s on that same route.
			const anon2 = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const pubDl = await anon2.request.get(
					publicDownloadUrl(journalPath, pub.id),
					{maxRedirects: 0},
				);
				expect(pubDl.status(), 'public doc: anonymous download OK').toBe(200);
				expect((await pubDl.body()).byteLength).toBeGreaterThan(0);

				// The non-public document is REFUSED on the public URL. As-built
				// quirk (verified live): LibraryFileHandler's refusal uses the
				// legacy `header('HTTP/1.0 403 Forbidden')`, which the PHP dev
				// server does NOT translate into a 403 status — the response is
				// an HTTP 200 whose text/html body is literally "403 Forbidden".
				// So the refusal is asserted at the body level, not the status.
				const privPub = await anon2.request.get(
					publicDownloadUrl(journalPath, priv.id),
					{maxRedirects: 0},
				);
				const privPubBody = await privPub.body();
				expect(
					privPub.headers()['content-type'] || '',
					'non-public doc: NOT served (no PDF body) on the public URL',
				).not.toContain('pdf');
				expect(
					privPubBody.subarray(0, 4).toString('latin1'),
					'non-public doc: body is not a PDF',
				).not.toBe('%PDF');
				expect(
					privPubBody.toString('latin1'),
					'non-public doc: refused with a body-level 403',
				).toContain('403 Forbidden');
			} finally {
				await anon2.close();
			}

			// Scenario 1 EDIT: rename the private document (metadata-only).
			const renamed = `${privateName} (rev)`;
			await contextGrid.renameFile(privateName, renamed);

			// Scenario 1 DELETE: remove both documents; the library empties.
			await contextGrid.deleteFile(renamed);
			await contextGrid.deleteFile(publicName);
			items = await getLibrary(page.request, journalPath);
			const remaining = items.map(nameOf);
			expect(remaining).not.toContain(renamed);
			expect(remaining).not.toContain(publicName);
		},
	);

	// ── Canonical scenario 2 — Submission Library from the workflow.
	// An editor opens a submission and clicks the header Library button; the
	// "Submission Library" modal shows the four type categories with "Add a
	// file" and "View Document Library" actions. Add-a-file stashes a
	// document on this submission; View Document Library opens the journal
	// library read-only. The submission document downloads back.
	test(
		'submission library from the workflow — categories, Add-a-file, View Document Library (scenario 2)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // seed + workflow modal + legacy library modal + upload
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor'}],
				publications: [{metadata: {title: {en: `Sub library ${tag}`}}}],
			});

			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await expect(
				workflow.workflowModal().getByRole('heading', {
					name: 'Workflow: Submission',
				}),
			).toBeVisible({timeout: 20_000});

			const dialog = await openSubmissionLibrary(page);
			const subGrid = new LibraryFilesGrid(page, {
				containerSelector: '#submissionLibraryGridContainer',
				gridId: LibraryFilesGrid.SUBMISSION_GRID_ID,
			});
			await subGrid.expectReady();

			// The two grid-level actions specific to the submission library.
			await expect(subGrid.addFileButton().first()).toBeVisible();
			await expect(subGrid.viewLibraryButton().first()).toBeVisible();
			await expect(
				dialog.getByRole('link', {name: 'View Document Library', exact: true}),
			).toBeVisible();

			// The four type categories render inside the modal.
			for (const cat of ['Marketing', 'Permissions', 'Reports', 'Other']) {
				await expect(
					subGrid.container().getByText(cat, {exact: true}).first(),
				).toBeVisible({timeout: 15_000});
			}

			// Add a document scoped to THIS submission (Type = Other).
			const docName = `Editor note ${tag}`;
			await subGrid.addFile({name: docName, type: 'Other', filePath: FILE});

			// It is a SUBMISSION row (carries this submissionId; absent from the
			// context-only library).
			const withSub = await getLibrary(page.request, 'publicknowledge', {
				submissionId: submission.id,
			});
			const seeded = withSub.find((i) => nameOf(i) === docName);
			expect(seeded).toBeTruthy();
			expect(seeded.submissionId).toBe(submission.id);
			const contextOnly = await getLibrary(page.request, 'publicknowledge');
			expect(contextOnly.map(nameOf)).not.toContain(docName);

			// It downloads back (component route, editor scope).
			const dl = await page.request.get(
				componentDownloadUrl('publicknowledge', seeded.id, submission.id),
				{maxRedirects: 0},
			);
			expect(dl.status()).toBe(200);
			expect((await dl.body()).byteLength).toBeGreaterThan(0);

			// View Document Library → the context library, read-only, stacked
			// on top. It shows the four categories (empty on a fresh journal).
			await subGrid.viewLibraryButton().first().click();
			const viewDialog = page.getByRole('dialog', {
				name: 'View Document Library',
			});
			await expect(viewDialog).toBeVisible({timeout: 20_000});
			await waitForJQueryIdle(page);
			for (const cat of ['Marketing', 'Permissions', 'Reports', 'Other']) {
				await expect(
					viewDialog.getByText(cat, {exact: true}).first(),
				).toBeVisible({timeout: 15_000});
			}
		},
	);

	// ── Canonical scenario 3 — the AUTHOR attaches a permissions form to
	// their own submission. atester opens their submission's Library, adds a
	// Type = Permissions document; it lists on that submission's library and
	// downloads back; the editor assigned to the submission can also download
	// it; and it is scoped to the submission (not the journal-wide library).
	test(
		'author attaches a permissions form to their own submission (scenario 3)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // seed + author workflow modal + legacy upload
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants: [{user: 'dbarnes', role: 'editor'}],
				publications: [{metadata: {title: {en: `Author library ${tag}`}}}],
			});

			// The author drives the whole add flow in their own context.
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(
				`/index.php/publicknowledge/en/dashboard/mySubmissions?workflowSubmissionId=${submission.id}`,
			);
			// The side-modal wrapper reports visibility:hidden during open
			// (patterns.md pitfall 5) — anchor arrival on the header Library
			// button (inner content) instead of the wrapper.
			await expect(
				authorPage
					.locator('[data-cy="active-modal"]')
					.first()
					.getByRole('button', {name: 'Library', exact: true}),
			).toBeVisible({timeout: 20_000});

			const dialog = await openSubmissionLibrary(authorPage);
			const authorGrid = new LibraryFilesGrid(authorPage, {
				containerSelector: '#submissionLibraryGridContainer',
				gridId: LibraryFilesGrid.SUBMISSION_GRID_ID,
			});
			await authorGrid.expectReady();

			// The submission-library form has NO Public-Access checkbox
			// (context-only field) — assert it is absent for the author.
			const addForm = await authorGrid.openAddFileForm();
			await expect(addForm.locator('input[name="publicAccess"]')).toHaveCount(0);
			const permName = `Signed permissions ${tag}`;
			await authorGrid.fillAndSubmit(addForm, {
				name: permName,
				type: 'Permissions',
				filePath: FILE,
			});
			await expect(authorGrid.fileLink(permName)).toBeVisible({
				timeout: 20_000,
			});

			// The document downloads back for the author, straight off its
			// grid name link (the real UI download path — PostAndRedirect).
			const [authorDownload] = await Promise.all([
				authorPage.waitForEvent('download', {timeout: 20_000}),
				authorGrid.fileLink(permName).click(),
			]);
			expect(await authorDownload.path()).toBeTruthy();

			// The assigned EDITOR can see + download it; and it is a submission
			// row, not a context row (scoping proof — authors are refused the
			// _library API per scenario 5, so the scoping truth is read through
			// the editor). This also demonstrates the document is confined to
			// this submission, not visible journal-wide or on any other.
			const editorSub = await getLibrary(page.request, 'publicknowledge', {
				submissionId: submission.id,
			});
			const editorSeen = editorSub.find((i) => nameOf(i) === permName);
			expect(editorSeen, 'editor sees the submission document').toBeTruthy();
			expect(editorSeen.submissionId).toBe(submission.id);
			const editorContext = await getLibrary(page.request, 'publicknowledge');
			expect(editorContext.map(nameOf)).not.toContain(permName);

			const editorDl = await page.request.get(
				componentDownloadUrl('publicknowledge', editorSeen.id, submission.id),
				{maxRedirects: 0},
			);
			expect(editorDl.status()).toBe(200);
			expect((await editorDl.body()).byteLength).toBeGreaterThan(0);
		},
	);

	// ── Canonical scenario 5 — permission boundaries. The `_library` REST
	// API (the editorial email-attach source) is manager/site-admin/
	// sub-editor only: an author and a reviewer are both refused (401), even
	// though the author may manage the submission library grid. And a
	// reviewer opening the submission Library op gets the role-denied body
	// ("The current role does not have access to this operation.").
	test(
		'permission boundaries — _library refuses author + reviewer; reviewer refused the Library op (scenario 5)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			// A submission in review so the reviewer holds a submission tie
			// (passes SubmissionAccessPolicy) yet still lacks a library role.
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: 'publicknowledge',
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor'}],
				decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
				reviewRounds: [
					{reviewers: [{user: 'jjanssen', method: 'anonymous', status: 'accepted'}]},
				],
				publications: [{metadata: {title: {en: `Boundary ${tag}`}}}],
			});

			// Manager (default actor) — _library is allowed (200).
			const mgr = await page.request.get(
				`/index.php/publicknowledge/api/v1/_library`,
			);
			expect(mgr.status()).toBe(200);

			// Author (atester) — refused 401 (even with includeSubmissionId,
			// on their OWN submission).
			const authorCtx = await asUser('atester');
			const authorRes = await authorCtx.request.get(
				`/index.php/publicknowledge/api/v1/_library?includeSubmissionId=${submission.id}`,
			);
			expect(authorRes.status()).toBe(401);

			// Reviewer (jjanssen) — refused 401.
			const reviewerCtx = await asUser('jjanssen');
			const reviewerRes = await reviewerCtx.request.get(
				`/index.php/publicknowledge/api/v1/_library`,
			);
			expect(reviewerRes.status()).toBe(401);

			// Reviewer opening the submission Library modal op — the handler
			// admits no reviewer role, so the body is the role-denied message.
			const reviewerLib = await reviewerCtx.request.get(
				`/index.php/publicknowledge/$$$call$$$/modals/document-library/document-library/document-library?submissionId=${submission.id}`,
			);
			const reviewerBody = await reviewerLib.text();
			expect(reviewerBody).toContain(ROLE_DENIED);
		},
	);
});
