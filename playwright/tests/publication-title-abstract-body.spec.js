// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	setTinyMceContent,
	getTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');

/**
 * Publication — Title & Abstract (and full-text Body Text) — one test per
 * canonical scenario of docs/product/specs/publication-title-abstract-body.md
 * (6 scenarios).
 *
 * Placement: OJS root — the publicknowledge journal, its ART section
 * (abstracts required, word-count 500) and issue set are journal concepts,
 * even though the publication forms and the Body Text editor ship from
 * pkp-lib.
 *
 * LIVENESS (the spec author could not browser-render — these are live-probed
 * here, 2026-07-04):
 *   - Body Text tab: LIVE. The bundled SciFlow editor (`<sciflow-editor>`)
 *     mounts inside Publication → Body Text for an editor with production
 *     access; the compiled bundle carries WorkflowPublicationBodyText +
 *     217 SciFlow refs. Scenario 5 drives the tab live AND exercises the
 *     get/save/delete REST endpoints (the SciFlow ProseMirror web-component
 *     is not keyboard-drivable in a stable way, so persistence is asserted
 *     through the API the editor itself PUTs to).
 *   - Pandoc importer: LIVE. `/js/build/pandoc.wasm` (56 MB) is self-hosted
 *     and served same-origin; the PandocConverter auto-import path engages
 *     when the Body Text tab is opened with ?importFileUrl&importFileName.
 *
 * Seeding notes:
 *   - Every seeded submission carries dbarnes as the deciding editor. A
 *     section editor's stage assignment spans all workflow stages (the
 *     editor user group's userGroupStages), so canAccessProduction — and
 *     hence the Body Text tab — is true on any submission dbarnes edits.
 *   - Author-edit gate: atester is the submitter (auto-author assignment).
 *     canChangeMetadata is granted/forced per ParticipantProcessor +
 *     PublicationsProcessor: true on an unpublished seed when passed
 *     explicitly, forced 0 on every author assignment once a version
 *     publishes.
 *   - Published editable-behind-warning: dbarnes is seeded with
 *     canChangeMetadata:true so his (non-author) assignment keeps edit
 *     rights on the published version — the warn-not-lock the spec asserts.
 *
 * As-built confirmed live (corrects the draft spec's base-controller reads):
 *   - OJS overrides getPublicationTitleAbstractForm() so the Publication-tab
 *     abstract DOES show a "* Required" marker + word-count meter (section-
 *     driven), and the backend enforces required (scenario 3 asserts both).
 *   - The Body Text tab shows the shared published-version WARNING banner but
 *     no Save-lock; authors never see the tab (scenario 5 asserts the tab
 *     mounts + API round-trips).
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens riding in
 * every title; all persistence assertions read back the tag through the
 * publication REST API (never a shared list); no shared journal settings
 * are mutated (publicknowledge stays read-only). No Mailpit use.
 */

// The AUTHOR publication config renders WorkflowPublicationEditDisabled …
const EDIT_DISABLED_BANNER =
	'This version has been published and can not be edited.';
// … while the EDITORIAL config renders WorkflowPublicationEditWarning (the
// warn-not-lock: managers/editors keep editing a published version).
const EDITOR_EDIT_WARNING =
	'Warning: This version has been published. Editing it may impact the published content.';
const ABSTRACT_REQUIRED_ERROR = 'Please enter the abstract of your article.';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `ptab${workerIndex}x${suffix}`;
}

/**
 * A submitted stage-1 submission in the given section with dbarnes as the
 * deciding editor.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {string} [opts.abstract]
 * @param {string} [opts.section='ART']
 * @param {string} [opts.submitter='atester']
 * @param {object[]} [opts.participants]
 */
function submittedSpec({
	tag,
	title,
	abstract,
	section = 'ART',
	submitter = 'atester',
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter,
		section,
		locale: 'en',
		participants,
		publications: [
			{
				metadata: {
					title: {en: title},
					...(abstract ? {abstract: {en: abstract}} : {}),
				},
			},
		],
	};
}

/**
 * A production-staged, VoR-published submission assigned to the published
 * issue (Vol. 1 No. 2, 2014).
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {string} [opts.abstract]
 * @param {object[]} [opts.participants]
 */
function publishedSpec({
	tag,
	title,
	abstract,
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
				metadata: {
					title: {en: title},
					...(abstract ? {abstract: {en: abstract}} : {}),
				},
				issue: {volume: 1, number: 2, year: 2014},
				published: true,
			},
		],
	};
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/**
 * GET a submission's current publication as JSON, via the page's session.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {string} [journalPath='publicknowledge']
 * @returns {Promise<object>}
 */
async function fetchCurrentPublication(
	page,
	submissionId,
	journalPath = 'publicknowledge',
) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(subRes.ok(), `GET submission ${submissionId}`).toBeTruthy();
	const sub = await subRes.json();
	const pubId = sub.currentPublicationId;
	const pubRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(pubRes.ok(), `GET publication ${pubId}`).toBeTruthy();
	return pubRes.json();
}

/**
 * Resolve the current publication id for a submission.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {string} [journalPath='publicknowledge']
 * @returns {Promise<number>}
 */
async function currentPublicationId(
	page,
	submissionId,
	journalPath = 'publicknowledge',
) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(subRes.ok()).toBeTruthy();
	return (await subRes.json()).currentPublicationId;
}

/**
 * Deep-link the editorial workflow onto a specific Publication pane.
 *
 * @param {number} submissionId
 * @param {number} pubId
 * @param {string} name  publication sub-item name, e.g. 'titleAbstract' | 'bodyText'
 * @param {Record<string,string>} [extraParams]
 */
function editorialPubLink(submissionId, pubId, name, extraParams = {}) {
	const extra = Object.entries(extraParams)
		.map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
		.join('');
	return (
		`/index.php/publicknowledge/en/dashboard/editorial` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_${name}${extra}`
	);
}

/**
 * Open the editorial Title & Abstract pane and wait for the form to mount
 * (its title TinyMCE control initialises).
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {number} pubId
 */
async function openEditorialTitleAbstract(page, submissionId, pubId) {
	await page.goto(editorialPubLink(submissionId, pubId, 'titleAbstract'), {
		waitUntil: 'commit',
	});
	await expect(
		workflowModal(page).getByRole('heading', {
			name: 'Publication: Title & Abstract',
		}),
	).toBeVisible({timeout: 20_000});
	// The title control is a TinyMCE editor — wait for the backing textarea.
	await expect(page.locator('#titleAbstract-title-control-en')).toBeAttached({
		timeout: 20_000,
	});
}

/** The titleAbstract PkpForm inside the workflow modal. */
function titleAbstractForm(page) {
	return workflowModal(page).locator('form.pkpForm');
}

/**
 * Click the Title & Abstract form's Save button and wait for the publication
 * PUT (tunnelled as POST). Returns the response so the caller can assert the
 * status (200 on success, 400 on a refused save).
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} pubId
 * @returns {Promise<import('@playwright/test').APIResponse>}
 */
async function savePublicationForm(page, pubId) {
	const form = titleAbstractForm(page);
	const [response] = await Promise.all([
		page.waitForResponse(
			(res) =>
				new RegExp(`/publications/${pubId}(?:\\?|$)`).test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 20_000},
		),
		form.getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	return response;
}

/** The "* Required" marker on a titleAbstract field's label. */
function requiredMarker(page, field, locale = 'en') {
	return page.locator(
		`label[for="titleAbstract-${field}-control-${locale}"] .pkpFormFieldLabel__required`,
	);
}

test.use({user: 'dbarnes'});

test.describe('Publication — Title & Abstract and Body Text', () => {
	// Canonical scenario 1 — Editor edits the title and abstract on the
	// Publication → Title & Abstract pane; the values persist on the selected
	// version. On a *published* version the same form stays editable behind
	// the yellow "this version is published" warning (managers/editors with
	// metadata rights are warned, not locked).
	test(
		'editor edits title and abstract; persists; published stays editable behind warning',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // two seeds + two workflow drives
			const tag = uniqueTag();

			// --- Part A: edit + persist on an unpublished submission ---
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: `Orig ${tag}`,
					abstract: `Original abstract ${tag}.`,
				}),
			);
			const pubId = await currentPublicationId(page, submission.id);

			await openEditorialTitleAbstract(page, submission.id, pubId);

			// The title field is marked required; the abstract field is NOT
			// (the ⚠ affordance gap — asserted in full in scenario 3).
			await expect(requiredMarker(page, 'title')).toBeVisible();

			const newTitle = `Revised title ${tag}`;
			const newAbstract = `Revised abstract body ${tag}.`;
			await setTinyMceContent(
				page,
				'titleAbstract-title-control-en',
				newTitle,
			);
			await setTinyMceContent(
				page,
				'titleAbstract-abstract-control-en',
				`<p>${newAbstract}</p>`,
			);
			const saveRes = await savePublicationForm(page, pubId);
			expect(saveRes.status()).toBe(200);

			// Persisted on the selected version (read back through the API).
			await expect
				.poll(
					async () =>
						(await fetchCurrentPublication(page, submission.id)).title?.en ??
						'',
					{timeout: 20_000},
				)
				.toContain(newTitle);
			const pub = await fetchCurrentPublication(page, submission.id);
			expect(pub.abstract?.en ?? '').toContain(newAbstract);

			// --- Part B: published version editable behind the warning ---
			const {submission: pubd} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Pubd ${tag}`,
					abstract: `Published abstract ${tag}.`,
					participants: [
						{user: 'dbarnes', role: 'editor', canChangeMetadata: true},
					],
				}),
			);
			const pubdPubId = await currentPublicationId(page, pubd.id);
			await openEditorialTitleAbstract(page, pubd.id, pubdPubId);

			// The yellow "this version has been published" warning is shown …
			await expect(
				workflowModal(page).getByText(EDITOR_EDIT_WARNING),
			).toBeVisible({timeout: 20_000});
			// … but the form stays editable: Save is enabled and a real edit
			// persists.
			const publishedSave = titleAbstractForm(page).getByRole('button', {
				name: 'Save',
				exact: true,
			});
			await expect(publishedSave).toBeEnabled();
			const editedPublishedTitle = `Pubd edited ${tag}`;
			await setTinyMceContent(
				page,
				'titleAbstract-title-control-en',
				editedPublishedTitle,
			);
			const pubdSaveRes = await savePublicationForm(page, pubdPubId);
			expect(pubdSaveRes.status()).toBe(200);
			await expect
				.poll(
					async () =>
						(await fetchCurrentPublication(page, pubd.id)).title?.en ?? '',
					{timeout: 20_000},
				)
				.toContain(editedPublishedTitle);
		},
	);

	// Canonical scenario 2 — Multilingual entry: on publicknowledge (en +
	// fr_CA) the editor toggles the form's French language tab, enters a
	// separate title/abstract for fr_CA, saves; both language values persist
	// independently and the English title is unchanged.
	test(
		'multilingual entry saves a second locale independently',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const enTitle = `Anglais ${tag}`;
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: enTitle,
					abstract: `English abstract ${tag}.`,
				}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialTitleAbstract(page, submission.id, pubId);

			// Reveal the French (Canada) sub-fields via the form's locale
			// toggle (FormLocales renders additional locales as buttons).
			await titleAbstractForm(page)
				.locator('button.pkpFormLocales__locale', {
					hasText: 'French (Canada)',
				})
				.click();
			await expect(
				page.locator('#titleAbstract-title-control-fr_CA'),
			).toBeAttached({timeout: 20_000});

			const frTitle = `Titre français ${tag}`;
			const frAbstract = `Résumé français ${tag}.`;
			await setTinyMceContent(
				page,
				'titleAbstract-title-control-fr_CA',
				frTitle,
			);
			await setTinyMceContent(
				page,
				'titleAbstract-abstract-control-fr_CA',
				`<p>${frAbstract}</p>`,
			);
			const saveRes = await savePublicationForm(page, pubId);
			expect(saveRes.status()).toBe(200);

			// Both locales persist independently; English title untouched.
			await expect
				.poll(
					async () =>
						(await fetchCurrentPublication(page, submission.id)).title
							?.fr_CA ?? '',
					{timeout: 20_000},
				)
				.toContain(frTitle);
			// The English title is untouched (the scenario builder appends a
			// " [tag]" isolation suffix on seed; the fr_CA value I typed does
			// not leak into it).
			const pub = await fetchCurrentPublication(page, submission.id);
			expect(pub.title?.en ?? '').toContain(enTitle);
			expect(pub.title?.en ?? '').not.toContain('Titre français');
			expect(pub.abstract?.fr_CA ?? '').toContain(frAbstract);
		},
	);

	// Canonical scenario 3 — Abstract required on save. The spec's ⚠ (Rule 5 /
	// Known deviations / Open question 2) is CODE-DERIVED from the lib/pkp
	// base controller and is WRONG FOR OJS: the OJS
	// SubmissionController::getPublicationTitleAbstractForm() override passes
	// the section's isAbstractRequired + wordCount to the form, so on
	// publicknowledge's ART section (abstracts required, word-count 500) the
	// abstract field DOES carry a "* Required" marker AND a word-count meter —
	// exactly like the wizard's Details step. This test asserts the REAL,
	// live behaviour and the backend enforcement.
	test(
		'abstract is marked required (OJS surfaces it) and enforced on save',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: `Reqd ${tag}`,
					abstract: `Seeded abstract ${tag}.`,
				}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialTitleAbstract(page, submission.id, pubId);

			// Live OJS: BOTH the title and the abstract are marked required (the
			// OJS override surfaces the section's required flag — contrary to
			// the spec's code-derived "unmarked" ⚠), and the abstract carries a
			// word-count meter (section wordCount 500).
			await expect(requiredMarker(page, 'title')).toBeVisible();
			await expect(requiredMarker(page, 'abstract')).toBeVisible();
			await expect(
				titleAbstractForm(page)
					.locator('.pkpFormField--richTextarea__wordLimit')
					.first(),
			).toContainText('500');

			// Backend enforcement is authoritative: a direct edit that empties
			// the primary-language abstract is refused with the abstract error.
			const csrf = await page.evaluate(
				() => window.pkp?.currentUser?.csrfToken,
			);
			const putRes = await page.request.post(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${pubId}`,
				{
					headers: {
						'X-Csrf-Token': csrf,
						'X-Http-Method-Override': 'PUT',
						'Content-Type': 'application/json',
					},
					data: {abstract: {en: ''}},
				},
			);
			expect(putRes.status()).toBe(400);
			const errBody = await putRes.json();
			expect(JSON.stringify(errBody)).toContain(ABSTRACT_REQUIRED_ERROR);

			// The stored abstract is untouched (the refused save persisted
			// nothing).
			const pub = await fetchCurrentPublication(page, submission.id);
			expect(pub.abstract?.en ?? '').toContain(tag);

			// Driving the same refusal through the form: because OJS now marks
			// the abstract required, the form blocks the empty save client-side
			// and surfaces the required error on the Abstract field (the
			// server message above is the independent backend guard).
			await setTinyMceContent(page, 'titleAbstract-abstract-control-en', '');
			await titleAbstractForm(page)
				.getByRole('button', {name: 'Save', exact: true})
				.click();
			await expect(
				titleAbstractForm(page).getByRole('button', {
					name: /Go to Abstract: This field is required\./,
				}),
			).toBeVisible({timeout: 20_000});
		},
	);

	// Canonical scenario 4 — Author edit gate closes at publication: a
	// canChangeMetadata author edits the title/abstract while nothing is
	// published; once a version publishes the author is hard-locked on every
	// field of every version, and the Body Text tab was never offered to the
	// author at all.
	test(
		'author can edit pre-publish, is locked after publish, never sees Body Text',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // two seeds + author round trips
			const tag = uniqueTag();

			// --- Editable: unpublished submission, author granted metadata ---
			const {submission: open} = await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: `Auth ${tag}`,
					abstract: `Author abstract ${tag}.`,
					participants: [
						{user: 'dbarnes', role: 'editor'},
						{user: 'atester', role: 'author', canChangeMetadata: true},
					],
				}),
			);
			const openPubId = await currentPublicationId(page, open.id);

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(
				`/index.php/publicknowledge/en/dashboard/mySubmissions` +
					`?workflowSubmissionId=${open.id}` +
					`&workflowMenuKey=publication_${openPubId}_titleAbstract`,
				{waitUntil: 'commit'},
			);
			await expect(
				authorPage.locator('#titleAbstract-title-control-en'),
			).toBeAttached({timeout: 20_000});

			// The author menu never offers a Body Text tab.
			await expect(
				workflowModal(authorPage)
					.locator('nav')
					.getByText('Body Text', {exact: true}),
			).toHaveCount(0);

			// Editable: Save is enabled and a real edit persists.
			const authorSave = workflowModal(authorPage)
				.locator('form.pkpForm')
				.getByRole('button', {name: 'Save', exact: true});
			await expect(authorSave).toBeEnabled({timeout: 20_000});
			const authorEdit = `Author edit ${tag}`;
			await setTinyMceContent(
				authorPage,
				'titleAbstract-title-control-en',
				authorEdit,
			);
			await Promise.all([
				authorPage.waitForResponse(
					(res) =>
						new RegExp(`/publications/${openPubId}(?:\\?|$)`).test(
							res.url(),
						) &&
						res.request().method() === 'POST' &&
						res.status() === 200,
					{timeout: 20_000},
				),
				authorSave.click(),
			]);
			await expect
				.poll(
					async () =>
						(await fetchCurrentPublication(authorPage, open.id)).title?.en ??
						'',
					{timeout: 20_000},
				)
				.toContain(authorEdit);

			// --- Locked: a published submission hard-locks the author ---
			const {submission: pubd} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Authpub ${tag}`}),
			);
			const pubdPubId = await currentPublicationId(page, pubd.id);
			await authorPage.goto(
				`/index.php/publicknowledge/en/dashboard/mySubmissions` +
					`?workflowSubmissionId=${pubd.id}` +
					`&workflowMenuKey=publication_${pubdPubId}_titleAbstract`,
				{waitUntil: 'commit'},
			);
			await expect(
				authorPage.locator('#titleAbstract-title-control-en'),
			).toBeAttached({timeout: 20_000});

			// The published banner shows and the form is locked (Save disabled).
			await expect(
				workflowModal(authorPage).getByText(EDIT_DISABLED_BANNER),
			).toBeVisible({timeout: 20_000});
			await expect(
				workflowModal(authorPage)
					.locator('form.pkpForm')
					.getByRole('button', {name: 'Save', exact: true}),
			).toBeDisabled();
			// Still no Body Text tab for the author.
			await expect(
				workflowModal(authorPage)
					.locator('nav')
					.getByText('Body Text', {exact: true}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 5 — Body Text editor: LIVE. An editor with
	// production access opens Publication → Body Text; the bundled SciFlow
	// editor + Pandoc importer mount. Persistence (get/save/delete) is
	// exercised through the REST endpoints the editor itself PUTs to — the
	// SciFlow ProseMirror web component is not stably keyboard-drivable.
	test(
		'Body Text tab mounts live; get/save/delete round-trips through the API',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Body ${tag}`, abstract: `Abs ${tag}.`}),
			);
			const pubId = await currentPublicationId(page, submission.id);

			// --- The Body Text tab mounts live for an editor ---
			await page.goto(editorialPubLink(submission.id, pubId, 'bodyText'), {
				waitUntil: 'commit',
			});
			await expect(
				workflowModal(page).getByRole('heading', {
					name: 'Publication: Body Text',
				}),
			).toBeVisible({timeout: 20_000});
			// The SciFlow structured editor web component mounts …
			await expect(page.locator('sciflow-editor#sciflow-editor')).toBeAttached(
				{timeout: 20_000},
			);
			// … alongside the document panel + Save affordance.
			await expect(page.locator('.sciflow-body-text')).toBeVisible();
			await expect(page.getByText('Document Edit')).toBeVisible();
			await expect(
				page
					.locator('.sciflow-body-text__save-row')
					.getByRole('button', {name: 'Save', exact: true}),
			).toBeVisible();

			// --- get / save / delete via the REST API (the editor's own path) ---
			const csrf = await page.evaluate(
				() => window.pkp?.currentUser?.csrfToken,
			);
			expect(csrf, 'csrf token from page').toBeTruthy();
			const base = `/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${pubId}/bodyText`;

			// GET on a fresh publication → empty shell: no stored submission
			// file yet (no `id`); the mapper returns a default empty document.
			const getEmpty = await page.request.get(base);
			expect(getEmpty.ok()).toBeTruthy();
			const emptyBody = await getEmpty.json();
			expect(emptyBody.id ?? null, 'no stored file yet').toBeNull();
			expect(emptyBody.bodyTextContent ?? '').not.toContain(tag);

			// SAVE (PUT, tunnelled as POST + method-override) a document.
			const doc = JSON.stringify({
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{type: 'text', text: `Body content ${tag}`}],
					},
				],
			});
			const putRes = await page.request.post(base, {
				headers: {
					'X-Csrf-Token': csrf,
					'X-Http-Method-Override': 'PUT',
				},
				multipart: {bodyText: doc},
			});
			expect(putRes.status(), await putRes.text()).toBe(200);
			const saved = await putRes.json();
			expect(saved.id, 'body-text file id after save').toBeTruthy();
			expect(saved.bodyTextContent ?? '').toContain(tag);

			// GET again → the stored document comes back.
			const getFull = await page.request.get(base);
			expect(getFull.ok()).toBeTruthy();
			const full = await getFull.json();
			expect(full.id).toBe(saved.id);
			expect(full.bodyTextContent ?? '').toContain(`Body content ${tag}`);

			// DELETE → clears the body-text file (empty shell returned).
			const delRes = await page.request.post(base, {
				headers: {
					'X-Csrf-Token': csrf,
					'X-Http-Method-Override': 'DELETE',
				},
			});
			expect(delRes.status()).toBe(200);
			const afterDelete = await delRes.json();
			expect(afterDelete.id ?? null).toBeNull();

			// DELETE again → nothing to delete → 404.
			const delAgain = await page.request.post(base, {
				headers: {
					'X-Csrf-Token': csrf,
					'X-Http-Method-Override': 'DELETE',
				},
			});
			expect(delAgain.status()).toBe(404);
		},
	);

	// Canonical scenario 6 — Pandoc import: LIVE. The importer runtime
	// (pandoc.wasm, 56 MB) is self-hosted and served same-origin; the Body
	// Text tab mounts the in-browser PandocConverter. Driving the real
	// converter end-to-end: a Markdown document is fed through the import
	// path "Send to Text Editor" uses (reactive importFileUrl/importFileName
	// query params), pandoc-WASM converts it to HTML and pastes it into the
	// SciFlow editor — proven by the editor going dirty ("Unsaved Changes").
	test(
		'Pandoc importer converts a document in-browser and pastes it into the editor',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // 56 MB WASM runtime + conversion
			const tag = uniqueTag();

			// The converter runtime is deployed and reachable same-origin.
			const wasmRes = await page.request.get('/js/build/pandoc.wasm');
			expect(wasmRes.status()).toBe(200);
			expect(
				Number(wasmRes.headers()['content-length'] ?? '0'),
			).toBeGreaterThan(1_000_000);

			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Pandoc ${tag}`, abstract: `Abs ${tag}.`}),
			);
			const pubId = await currentPublicationId(page, submission.id);

			// Open the Body Text tab and let the SciFlow editor mount.
			await page.goto(editorialPubLink(submission.id, pubId, 'bodyText'), {
				waitUntil: 'commit',
			});
			await expect(page.locator('sciflow-editor#sciflow-editor')).toBeAttached(
				{timeout: 20_000},
			);

			// A tiny Markdown document — pandoc infers the format from the .md
			// file name the importer builds.
			const markdown = `# PandocProbe ${tag}\n\nImported **body** text.\n`;
			const dataUrl =
				'data:text/markdown;base64,' +
				Buffer.from(markdown, 'utf8').toString('base64');

			// Feed the import through the reactive query-param path that "Send
			// to Text Editor" uses (goToBodyTextWithImport sets importFileUrl /
			// importFileName then navigates). The dashboard re-normalizes the
			// URL and the editor readies asynchronously, so re-assert the
			// params (idempotent — PandocConverter guards against re-running)
			// until the converter engages.
			await expect(async () => {
				await page.evaluate((url) => {
					const q = new URLSearchParams(window.location.search);
					q.set('importFileUrl', url);
					q.set('importFileName', 'probe.md');
					window.history.replaceState(
						null,
						'',
						window.location.pathname + '?' + q.toString(),
					);
					window.dispatchEvent(new PopStateEvent('popstate'));
				}, dataUrl);
				// A successful import pastes HTML into the editor → the document
				// goes dirty → the "Unsaved Changes" badge shows.
				await expect(page.getByText('Unsaved Changes')).toBeVisible({
					timeout: 3_000,
				});
			}).toPass({timeout: 90_000});

			// The conversion did not error.
			await expect(page.getByText('Import failed')).toHaveCount(0);
		},
	);
});
