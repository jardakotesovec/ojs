// @ts-check
const fs = require('fs');
const {test, expect} = require('../support/fixtures.js');
const {MediaFileManagerPage} = require('../../lib/pkp/playwright/pages/MediaFileManagerPage.js');
const {fixtureFilePath} = require('../../lib/pkp/playwright/pages/FileStagePanel.js');

/**
 * Media files — the publication's supplementary / dependent media on the
 * workflow Publication → Media tab (the Vue MediaFileManager +
 * MediaFilesController REST API + variant_groups). One test per canonical
 * scenario of docs/product/specs/media-files.md (7 scenarios; the two variant-
 * linking scenarios — manual single-link + batch-link — merged into one → 6
 * tests).
 *
 * The spec author verified the media permissions/API by hand but never rendered
 * the Vue manager live; THESE tests drive the manager in a browser and assert
 * on BOTH the rendered manager and the media-files API state.
 *
 * Surfaces driven live (POM: lib/pkp/playwright/pages/MediaFileManagerPage.js):
 *   - Add Media File → the Upload Media File modal / FileMediaUploader batch
 *     upload (per-file genre + resolution) → POST …/mediaFiles (scenario 1).
 *   - Manually Link Media (per-row) + Batch Link Media (top button) → the
 *     PUT …/{id}/link and POST …/mediaFiles/link that build a variant group
 *     (scenarios 2+3).
 *   - The reader galley-download media allow-list — a publication-scoped media
 *     file served through ANY of the publication's galleys (scenario 4). No
 *     OJS theme surfaces a media file to a reader, so this is driven at the
 *     download route (the spec's own note); the "shared across galleys" claim
 *     is proven by reaching the SAME media file through two different galleys.
 *   - The author list-only boundary (scenario 5) and the published-lock ⚠
 *     (media stays fully editable for editorial roles on a published article,
 *     rule 9 — scenario 6).
 *   - Delete File + variant-group cleanup (scenario 7).
 *
 * Known ⚠ respected (docs/e2e/app-changes.md):
 *   - Media CRUD works on a published article for editorial users (the Vue
 *     ignores canEdit; the API's PublicationWritePolicy exempts managers/
 *     sub-editors) — scenario 6 asserts that reality, incl. a persisting delete.
 *   - A refused media write returns HTTP 401 (not 403) with key
 *     api.submissions.403.userCantEdit — scenario 5's author DELETE.
 *   - Grouped-media seeding was blocked by a dangling
 *     VariantGroup::MAX_GROUP_SIZE (ledger row 93); the seed path is fixed in
 *     this branch (PublicationsProcessor), letting scenario 7 seed a linked
 *     pair directly.
 *
 * Placement: OJS root — the reader ArticleHandler download and the OJS workflow
 * wiring are OJS-only (the manager + controller ship from pkp-lib, but the
 * surfaces exercised here are the OJS-hosted screens + the OJS reader route).
 *
 * Parallel-safety: single hyphenless alphanumeric tags; every submission is
 * per-test and opened by the id the scenario API returns; the reader context
 * passes an explicit empty storageState (the file's dbarnes session would
 * otherwise preview unpublished content).
 */

const STATUS_PUBLISHED = 3; // PKPSubmission::STATUS_PUBLISHED

// The shared "published version" warning banner (publication.editorEditWarning)
// prepended to every publication panel — including Media — on a published
// version.
const PUBLISHED_BANNER =
	'Warning: This version has been published. Editing it may impact the published content.';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `med${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * A production-stage submission on publicknowledge (skipExternalReview →
 * sendToProduction). dbarnes is the assigned editor (production access → full
 * media manager); atester is the submitting author. Optional `mediaFiles` are
 * seeded on the (unpublished) current publication.
 *
 * @param {{tag: string, title: string, submitter?: string, mediaFiles?: object[]}} opts
 */
function productionSpec({tag, title, submitter = 'atester', mediaFiles}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter,
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants: [{user: 'dbarnes', role: 'editor'}],
		decisions: [
			{type: 'skipExternalReview', by: 'dbarnes'},
			{type: 'sendToProduction', by: 'dbarnes'},
		],
		publications: [
			{
				metadata: {title: {en: title}},
				...(mediaFiles ? {mediaFiles} : {}),
			},
		],
	};
}

/**
 * A VoR-published submission assigned to the open-access published issue
 * (Vol 1, No 2, 2014), optionally carrying seeded galleys + media files on the
 * published publication.
 *
 * @param {{tag: string, title: string, submitter?: string, galleys?: object[], mediaFiles?: object[]}} opts
 */
function publishedSpec({tag, title, submitter = 'atester', galleys, mediaFiles}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter,
		section: 'ART',
		locale: 'en',
		submitted: true,
		participants: [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
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
				...(galleys ? {galleys} : {}),
				...(mediaFiles ? {mediaFiles} : {}),
			},
		],
	};
}

/** Deep-link the editorial workflow straight onto Publication → Media. */
function mediaEditorLink(submissionId, pubId, journalPath = 'publicknowledge') {
	return (
		`/index.php/${journalPath}/en/dashboard/editorial` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_media`
	);
}

/** The author's My-Submissions deep link onto Publication → Media. */
function mediaAuthorLink(submissionId, pubId, journalPath = 'publicknowledge') {
	return (
		`/index.php/${journalPath}/en/dashboard/mySubmissions` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_media`
	);
}

/** Open the editorial Media panel and wait for the Vue manager to mount. */
async function openEditorMedia(page, submissionId, pubId) {
	const pom = new MediaFileManagerPage(page);
	await page.goto(mediaEditorLink(submissionId, pubId), {waitUntil: 'commit'});
	await pom.expectVisible();
	return pom;
}

/** The localized (or plain) display name of an API media-file item. */
function nameOf(item) {
	if (typeof item.name === 'string') {
		return item.name;
	}
	return Object.values(item.name || {})[0];
}

/** Find an API media-file item by its (unique-tagged) display name. */
function byName(items, name) {
	return items.find((i) => nameOf(i) === name);
}

/** An in-memory upload payload feeding the shared PNG fixture under `name`. */
function pngUpload(name) {
	return {
		name,
		mimeType: 'image/png',
		buffer: fs.readFileSync(fixtureFilePath('dependent-image.png')),
	};
}

test.use({user: 'dbarnes'}); // the assigned editor (production-stage access)

test.describe('Media files — publication media manager + reader', () => {
	// Canonical scenario 1 — Batch-upload media files. dbarnes opens Media,
	// Add Media File → drops two images, sets each genre to Image, one Web /
	// one High resolution, and Upload Files. Both land as Media-stage rows on
	// the publication (rendered + API), one web + one high-res.
	test(
		'editor batch-uploads two media files (web + high-res)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // live drag-drop batch upload
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({tag, title: `Upload media ${tag}`}),
			);
			const pubId = publications[0].id;

			const pom = await openEditorMedia(page, submission.id, pubId);

			// Empty to start.
			const before = await pom.fetchMediaFiles(submission.id, pubId);
			expect(before.length).toBe(0);

			const webName = `web-${tag}.png`;
			const hiName = `hires-${tag}.png`;

			const modal = await pom.openAddModal();
			await pom.addFileToUploader(modal, pngUpload(webName), 1);
			await pom.addFileToUploader(modal, pngUpload(hiName), 2);

			// Each dropped file needs a genre (Image supports variants → the
			// resolution select then enables); leave file 1 at Web, set file 2
			// to High resolution.
			const genres = pom.uploaderGenreSelects(modal);
			await genres.nth(0).selectOption({label: 'Image'});
			await genres.nth(1).selectOption({label: 'Image'});
			const variants = pom.uploaderVariantSelects(modal);
			await expect(variants.nth(1)).toBeEnabled();
			await variants.nth(1).selectOption({label: 'High resolution'});

			// Upload Files posts the batch to POST …/mediaFiles.
			const uploadBtn = pom.uploadFilesButton(modal);
			await expect(uploadBtn).toBeEnabled();
			await Promise.all([
				page.waitForResponse(
					(r) =>
						/\/publications\/\d+\/mediaFiles(\?|$)/.test(r.url()) &&
						r.request().method() === 'POST' &&
						r.status() === 200,
					{timeout: 30_000},
				),
				uploadBtn.click(),
			]);

			// Both rows render in the manager…
			await expect(pom.row(webName)).toBeVisible({timeout: 20_000});
			await expect(pom.row(hiName)).toBeVisible();

			// …and server truth: two Media rows on the publication, one web +
			// one high-resolution, named as uploaded.
			await expect(async () => {
				const items = await pom.fetchMediaFiles(submission.id, pubId);
				expect(items.length).toBe(2);
				const web = byName(items, webName);
				const hi = byName(items, hiName);
				expect(web, 'web file present via API').toBeTruthy();
				expect(hi, 'high-res file present via API').toBeTruthy();
				expect(web.variantType).toBe('web');
				expect(hi.variantType).toBe('high_resolution');
			}).toPass({timeout: 15_000});
		},
	);

	// Canonical scenarios 2 + 3 (merged) — Variant linking, single + batch. Four
	// ungrouped web/high-res images are seeded. The editor uses a web image's
	// per-row Manually Link Media to pair it with a high-res original (they
	// render as one grouped pair sharing a variant-group id), then Batch Link
	// Media to pair the second web/high-res set at once. Each pairing is proven
	// on the rendered grouped <tbody> AND the shared variantGroupId in the API.
	test(
		'editor links a web variant to its high-res original — manually and via batch',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow(); // two link modals + refetches
			const tag = uniqueTag();
			const webA = `webA-${tag}.png`;
			const hiA = `hiA-${tag}.png`;
			const webB = `webB-${tag}.png`;
			const hiB = `hiB-${tag}.png`;
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Link media ${tag}`,
					mediaFiles: [
						{variantType: 'web', name: webA},
						{variantType: 'high_resolution', name: hiA},
						{variantType: 'web', name: webB},
						{variantType: 'high_resolution', name: hiB},
					],
				}),
			);
			const pubId = publications[0].id;

			const pom = await openEditorMedia(page, submission.id, pubId);

			// All four start ungrouped (no variant_group_id).
			const seeded = await pom.fetchMediaFiles(submission.id, pubId);
			expect(seeded.length).toBe(4);
			for (const item of seeded) {
				expect(item.variantGroupId).toBeFalsy();
			}

			// --- Manual link: webA → hiA (per-row action). ---
			await pom.clickRowAction(webA, 'Manually Link Media');
			const manualModal = page
				.locator('[data-cy="active-modal"]')
				.filter({hasText: 'Select the media file to link'})
				.first();
			await expect(
				manualModal.getByRole('combobox', {name: /Select the media file to link/}),
			).toBeVisible({timeout: 15_000});
			await manualModal
				.getByRole('combobox', {name: /Select the media file to link/})
				.selectOption({label: hiA});
			await Promise.all([
				page.waitForResponse(
					(r) =>
						/\/mediaFiles\/\d+\/link(\?|$)/.test(r.url()) && r.status() === 200,
					{timeout: 20_000},
				),
				manualModal.getByRole('button', {name: 'Link Media', exact: true}).click(),
			]);

			// Rendered as one grouped pair (both names in one <tbody>).
			await expect(pom.groupBody(webA, hiA)).toBeVisible({timeout: 20_000});

			// Server truth: webA & hiA now share a (non-null) variant group.
			await expect(async () => {
				const items = await pom.fetchMediaFiles(submission.id, pubId);
				const a = byName(items, webA);
				const b = byName(items, hiA);
				expect(a.variantGroupId).toBeTruthy();
				expect(a.variantGroupId).toBe(b.variantGroupId);
			}).toPass({timeout: 15_000});

			// --- Batch link: webB → hiB (top Batch Link Media button). ---
			const batchModal = await pom.openBatchLinkModal();
			await pom.batchLinkSelectFor(batchModal, webB).selectOption({label: hiB});
			await Promise.all([
				page.waitForResponse(
					(r) => /\/mediaFiles\/link(\?|$)/.test(r.url()) && r.status() === 200,
					{timeout: 20_000},
				),
				batchModal.getByRole('button', {name: 'Link Media', exact: true}).click(),
			]);

			await expect(pom.groupBody(webB, hiB)).toBeVisible({timeout: 20_000});

			// Server truth: webB & hiB grouped into their OWN group; webA/hiA
			// still grouped and distinct from webB/hiB.
			await expect(async () => {
				const items = await pom.fetchMediaFiles(submission.id, pubId);
				const a = byName(items, webA);
				const b = byName(items, hiB);
				const c = byName(items, webB);
				expect(c.variantGroupId).toBeTruthy();
				expect(c.variantGroupId).toBe(b.variantGroupId);
				expect(c.variantGroupId).not.toBe(a.variantGroupId);
			}).toPass({timeout: 15_000});
		},
	);

	// Canonical scenario 4 — Share a media file across galleys (reader). A
	// published article has TWO galleys and one publication-scoped media file;
	// an anonymous reader reaches the SAME media file through EITHER galley's
	// download route (ArticleHandler::download media allow-list), proving the
	// "shared across galleys" model. (No OJS theme surfaces media to a reader —
	// spec rule 10 — so this is driven at the download route, per the spec.)
	test(
		'a publication media file is served through any of its galleys to a reader',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const mediaName = `shared-${tag}.png`;
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Shared media ${tag}`,
					galleys: [
						{label: 'HTML A', file: 'sample-article.html'},
						{label: 'HTML B', file: 'sample-article.html'},
					],
					mediaFiles: [{variantType: 'web', name: mediaName}],
				}),
			);
			expect(publications[0].status).toBe(STATUS_PUBLISHED);
			const galleyA = publications[0].galleys[0].id;
			const galleyB = publications[0].galleys[1].id;
			const mediaFileId = publications[0].mediaFiles[0].id;
			expect(mediaFileId, 'media file seeded on the published pub').toBeTruthy();

			const imageBytes = fs.readFileSync(fixtureFilePath('dependent-image.png'));

			// Anonymous reader — explicit empty storage state.
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const req = anon.request;

				// The media file downloads through galley A…
				const viaA = await req.get(
					`/index.php/publicknowledge/en/article/download/${submission.id}/${galleyA}/${mediaFileId}`,
				);
				expect(viaA.ok(), `media via galley A ${viaA.status()}`).toBeTruthy();
				const bodyA = await viaA.body();
				expect(bodyA.subarray(0, 8)).toEqual(imageBytes.subarray(0, 8)); // PNG sig
				expect(bodyA.length).toBe(imageBytes.length);

				// …and identically through galley B (same file, one copy on the
				// publication — the sharing model).
				const viaB = await req.get(
					`/index.php/publicknowledge/en/article/download/${submission.id}/${galleyB}/${mediaFileId}`,
				);
				expect(viaB.ok(), `media via galley B ${viaB.status()}`).toBeTruthy();
				const bodyB = await viaB.body();
				expect(Buffer.compare(bodyA, bodyB)).toBe(0);

				// A file id that is neither the galley's own file nor a media
				// file of its publication is refused (404 allow-list).
				const bogus = await req.get(
					`/index.php/publicknowledge/en/article/download/${submission.id}/${galleyA}/99999999`,
				);
				expect(bogus.status(), 'non-allow-listed file 404').toBe(404);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 5 — Author read-only boundary. The submitting author
	// opens their own Media tab and sees the list read-only: no Add Media File,
	// no Batch Link Media, no per-row More Actions. The API admits their LIST
	// (200) but refuses every write (DELETE → 401 userCantEdit).
	test(
		'author sees the media list read-only; the API refuses their writes',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const mediaName = `authormed-${tag}.png`;
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Author media ${tag}`,
					mediaFiles: [{variantType: 'web', name: mediaName}],
				}),
			);
			const pubId = publications[0].id;
			const mediaFileId = publications[0].mediaFiles[0].id;

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(mediaAuthorLink(submission.id, pubId), {
				waitUntil: 'commit',
			});

			const pom = new MediaFileManagerPage(authorPage);
			await pom.expectVisible();
			await expect(pom.row(mediaName)).toBeVisible();

			// No management affordances for the author.
			await expect(pom.addButton()).toHaveCount(0);
			await expect(pom.batchLinkButton()).toHaveCount(0);
			await expect(
				pom.row(mediaName).getByRole('button', {name: /More Actions/i}),
			).toHaveCount(0);

			// API: the author's LIST is admitted…
			const apiBase =
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}` +
				`/publications/${pubId}/mediaFiles`;
			const list = await authorCtx.request.get(apiBase);
			expect(list.status(), 'author LIST 200').toBe(200);

			// …but a write is refused. Refusals return HTTP 401 with the key
			// api.submissions.403.userCantEdit ("not allowed to edit this
			// publication") — the documented status/body-key mismatch.
			const csrfToken = await authorPage.evaluate(
				() => window.pkp?.currentUser?.csrfToken,
			);
			const del = await authorCtx.request.delete(`${apiBase}/${mediaFileId}`, {
				headers: {'X-Csrf-Token': csrfToken || ''},
			});
			expect(del.status(), 'author DELETE refused 401').toBe(401);
			expect(await del.text()).toContain('not allowed to edit this publication');
		},
	);

	// Canonical scenario 6 — Media stays editable on a published article (the ⚠,
	// rule 9). MediaFileManager.vue ignores canEditPublication and the API's
	// PublicationWritePolicy exempts editorial roles, so on a PUBLISHED
	// publication the manager still offers Add / Batch-Link / per-row actions
	// (beside the "this version has been published" banner) and a delete
	// PERSISTS without a new version.
	test(
		'published article: media stays fully editable for the editor (⚠ rule 9)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const mediaName = `pubmed-${tag}.png`;
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Published media ${tag}`,
					mediaFiles: [{variantType: 'web', name: mediaName}],
				}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			const pom = await openEditorMedia(page, submission.id, pubId);

			// The published-version banner and the write affordances render
			// together (the Vue ignores the published-lock).
			await expect(page.getByText(PUBLISHED_BANNER)).toBeVisible({
				timeout: 20_000,
			});
			await expect(pom.addButton()).toBeVisible();
			await expect(pom.batchLinkButton()).toBeVisible();
			await expect(pom.row(mediaName)).toBeVisible();

			// A delete on the published version succeeds and persists.
			await pom.deleteFile(mediaName);
			await expect(async () => {
				const items = await pom.fetchMediaFiles(submission.id, pubId);
				expect(items.length).toBe(0);
			}).toPass({timeout: 15_000});
		},
	);

	// Canonical scenario 7 — Delete a media file + variant-group cleanup. A
	// linked web/high-res pair is seeded (the fixed grouped-media seed path).
	// The editor deletes the high-resolution half from the row menu; the file
	// is removed and its former web partner is left standalone (ungrouped) — the
	// now-single-member group is cleaned up, not stranded empty.
	test(
		'editor deletes the high-res half of a pair; the web partner is left ungrouped',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const webName = `gweb-${tag}.png`;
			const hiName = `ghires-${tag}.png`;
			const {submission, publications} = await pkpApi.createSubmission(
				productionSpec({
					tag,
					title: `Delete media ${tag}`,
					mediaFiles: [
						{variantType: 'web', name: webName, group: 'pair'},
						{variantType: 'high_resolution', name: hiName, group: 'pair'},
					],
				}),
			);
			const pubId = publications[0].id;

			// The seed linked them into one variant group.
			const seeded = await new MediaFileManagerPage(page).fetchMediaFiles(
				submission.id,
				pubId,
			);
			expect(seeded.length).toBe(2);
			expect(seeded[0].variantGroupId).toBeTruthy();
			expect(seeded[0].variantGroupId).toBe(seeded[1].variantGroupId);

			const pom = await openEditorMedia(page, submission.id, pubId);

			// Rendered as one grouped pair.
			await expect(pom.groupBody(webName, hiName)).toBeVisible({timeout: 20_000});

			// Delete the high-resolution half.
			await pom.deleteFile(hiName);

			// The web partner remains — now standalone (variantGroupId cleared,
			// the emptied group removed).
			await expect(pom.row(webName)).toBeVisible();
			await expect(async () => {
				const items = await pom.fetchMediaFiles(submission.id, pubId);
				expect(items.length).toBe(1);
				expect(nameOf(items[0])).toBe(webName);
				expect(items[0].variantGroupId).toBeFalsy();
			}).toPass({timeout: 15_000});
		},
	);
});
