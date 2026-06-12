// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {IssuePage} = require('../pages/IssuePage.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {
	setTinyMceContent,
	getTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Issue management rows 5–11 — docs/e2e/plans/issue-management.md.
 * (Rows 1–4 live in playwright/tests/issues.spec.js.)
 *
 * Every test runs on its own E0 scratch journal: issue create / publish /
 * edit / delete are journal-level mutations and publicknowledge's issues
 * are read-only shared state (charter principle 1).
 *
 *   Row 5  — TOC reorder (OrderCategoryGridItemsFeature → saveSequence)
 *            persists; the anonymous issue page follows the new order.
 *   Row 6  — cover image upload + alt text; reader issue page and the
 *            archive listing render the cover.
 *   Row 7  — issue galley upload; reader issue page lists the galley link.
 *   Row 8  — deleting a future and a published back issue removes the
 *            grid rows; the archive no longer lists the back issue.
 *   Row 9  — title/showTitle/description/urlPath save on Issue Data;
 *            /issue/view/{urlPath} renders title + description after
 *            publish.
 *   Row 10 — unpublishing an issue flips its article back to Scheduled
 *            (IssueGridHandler::unpublishIssue re-publishes each attached
 *            publication against the now-unpublished issue →
 *            STATUS_SCHEDULED); the article URL 404s anonymously and the
 *            archive no longer lists the issue.
 *   Row 11 — TOC removeArticle unpublishes the publication
 *            (TocGridHandler::removeArticle → Repo::publication()->
 *            unpublish → STATUS_QUEUED) and drops the grid row; the
 *            reader TOC keeps the sibling article.
 *
 * Server-side surfaces exercised (grep-verified):
 *   - controllers/grid/toc/TocGridHandler.php — saveSequence (category
 *     feature), removeArticle (RemoteActionConfirmationModal row action).
 *   - classes/controllers/grid/issues/IssueGridHandler.php — deleteIssue,
 *     unpublishIssue, updateIssue, uploadFile (cover images).
 *   - controllers/grid/issueGalleys/IssueGalleyGridHandler.php +
 *     controllers/grid/issues/form/IssueGalleyForm.php — add/upload/update.
 *   - controllers/grid/issues/form/IssueForm.php — title/showTitle/
 *     description/urlPath/coverImageAltText persistence; the hidden
 *     datePublished altField posts Y-m-d for published issues, so saving
 *     a published issue's Issue Data revalidates cleanly.
 *
 * Reader-side markup (templates/frontend/...):
 *   - pages/issue.tpl — h1 = $issueIdentification (includes the title
 *     when showTitle is on).
 *   - objects/issue_toc.tpl — .cover img[alt], .description,
 *     .galleys .galleys_links, .cmp_article_list .obj_article_summary
 *     .title (in publication-seq order via Repo::submission()->
 *     getInSections, ORDERBY_SEQUENCE).
 *   - objects/issue_summary.tpl (archive) — a.cover img[alt], .title.
 */

test.use({user: 'dbarnes'});

const IMAGE_FIXTURE = path.resolve(
	__dirname,
	'../../lib/pkp/playwright/fixtures/files/dependent-image.png',
);
const PDF_FIXTURE = path.resolve(
	__dirname,
	'../../lib/pkp/playwright/fixtures/files/dummy.pdf',
);

// Publication status ints — lib/pkp/classes/publication/PKPPublication.php.
const STATUS_QUEUED = 1;
const STATUS_SCHEDULED = 5;

/**
 * Explicit empty storage state for genuinely-anonymous reader contexts.
 * With `test.use({user: 'dbarnes'})` active, `browser.newContext()`
 * inherits the worker's configured storageState — without this override
 * the "anonymous" context is silently logged in and editors can preview
 * unpublished content (patterns.md rule 8).
 */
const ANON_STORAGE_STATE = {cookies: [], origins: []};

test.describe('Issue management', () => {
	// Row 5 — TOC reorder persists and the reader TOC follows.
	test(
		'manager reorders the issue TOC; reader TOC follows',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag('toc');
			const issue = {volume: 1, number: '1', year: 2026};
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...issue, published: true}],
			});
			const titleA = await seedPublishedArticle(pkpApi, {
				tag,
				journalPath: context.path,
				issue,
				title: 'Alpha order article',
			});
			const titleB = await seedPublishedArticle(pkpApi, {
				tag,
				journalPath: context.path,
				issue,
				title: 'Beta order article',
			});

			const issuePage = new IssuePage(page);
			await issuePage.goto(context.path);
			await issuePage.openBackTab();
			await issuePage.openIssueToc(issuePage.backRow(issue));

			const rows = issuePage.tocArticleRows();
			await expect(rows).toHaveCount(2);
			// Freshly-seeded publications share seq=0, so read the grid's
			// actual order instead of assuming one; the reorder target is
			// "whatever is last goes first".
			const firstRowText = await rows.first().innerText();
			const newOrder = firstRowText.includes(titleA)
				? [titleB, titleA]
				: [titleA, titleB];

			await issuePage.startTocOrdering();
			await issuePage.dragRowAbove(rows.nth(1), rows.nth(0));
			// The sortable rearranges the live DOM on drop — confirm the
			// swap took before committing, so a missed drag fails here and
			// not as a confusing persistence mismatch later.
			await expect(rows.first()).toContainText(newOrder[0]);
			await issuePage.finishTocOrdering();

			// Persistence: reload the page, reopen the TOC, same order.
			await issuePage.goto(context.path);
			await issuePage.openBackTab();
			await issuePage.openIssueToc(issuePage.backRow(issue));
			await expect(issuePage.tocArticleRows().first()).toContainText(
				newOrder[0],
			);
			await expect(issuePage.tocArticleRows().nth(1)).toContainText(
				newOrder[1],
			);

			// Reader: the anonymous issue page lists the articles in the
			// new order (saveSequence wrote distinct publication seqs;
			// getInSections orders by sequence).
			const issueId = await resolveIssueId(page, context.path, issue);
			const anon = await browser.newContext({
				baseURL,
				storageState: ANON_STORAGE_STATE,
			});
			try {
				const anonPage = await anon.newPage();
				const resp = await anonPage.goto(
					`/index.php/${context.path}/issue/view/${issueId}`,
				);
				expect(resp?.status()).toBe(200);
				const titles = anonPage.locator(
					'.obj_issue_toc .cmp_article_list .obj_article_summary .title',
				);
				await expect(titles).toHaveCount(2);
				await expect(titles.first()).toContainText(newOrder[0]);
				await expect(titles.nth(1)).toContainText(newOrder[1]);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 6 — cover image + alt text surface to readers.
	test(
		'issue cover image uploads and shows to readers with its alt text',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag('cover');
			const issue = {volume: 2, number: '1', year: 2026};
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...issue, published: true}],
			});
			const altText = `Issue cover alt ${tag}`;

			const issuePage = new IssuePage(page);
			await issuePage.goto(context.path);
			await issuePage.openBackTab();

			// Save 1: upload the image. The alt-text field only renders
			// once a cover exists (issueForm.tpl's preview section), so
			// the alt text is a second save.
			await issuePage.openIssueDataTab(issuePage.backRow(issue));
			await issuePage.uploadCoverImage(IMAGE_FIXTURE);
			await issuePage.saveIssueForm();

			// Save 2: the reopened form previews the stored cover and
			// exposes coverImageAltText.
			const form = await issuePage.openIssueDataTab(
				issuePage.backRow(issue),
			);
			await expect(form.locator('#coverImagePreview img')).toBeVisible({
				timeout: 15_000,
			});
			await form.locator('input[name="coverImageAltText"]').fill(altText);
			await issuePage.saveIssueForm();

			const issueId = await resolveIssueId(page, context.path, issue);
			const anon = await browser.newContext({
				baseURL,
				storageState: ANON_STORAGE_STATE,
			});
			try {
				const anonPage = await anon.newPage();

				// Issue view page renders the cover with the alt text.
				const viewResp = await anonPage.goto(
					`/index.php/${context.path}/issue/view/${issueId}`,
				);
				expect(viewResp?.status()).toBe(200);
				const cover = anonPage.locator('.obj_issue_toc .cover img');
				await expect(cover).toBeVisible({timeout: 10_000});
				await expect(cover).toHaveAttribute('alt', altText);
				const src = await cover.getAttribute('src');
				expect(src).toContain(`cover_issue_${issueId}`);
				// The file must actually be served, not just referenced.
				const imgResp = await anonPage.request.get(String(src));
				expect(imgResp.status()).toBe(200);

				// Archive listing renders the same cover.
				const archiveResp = await anonPage.goto(
					`/index.php/${context.path}/issue/archive`,
				);
				expect(archiveResp?.status()).toBe(200);
				const archiveCover = anonPage.locator(
					'.obj_issue_summary a.cover img',
				);
				await expect(archiveCover).toBeVisible({timeout: 10_000});
				await expect(archiveCover).toHaveAttribute('alt', altText);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 7 — full-issue galley listed on the reader issue page.
	test(
		'issue galley upload is listed on the anonymous issue page',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag('galley');
			const issue = {volume: 3, number: '1', year: 2026};
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...issue, published: true}],
			});
			const galleyLabel = `PDF-${tag}`;

			const issuePage = new IssuePage(page);
			await issuePage.goto(context.path);
			await issuePage.openBackTab();
			await issuePage.openIssueGalleysTab(issuePage.backRow(issue));
			await issuePage.addIssueGalley({
				label: galleyLabel,
				filePath: PDF_FIXTURE,
			});

			// The galley grid refreshed with the new row.
			await expect(
				page.locator('#issueGalleysGridContainer tr.gridRow', {
					hasText: galleyLabel,
				}),
			).toBeVisible({timeout: 15_000});

			// Reader: the issue page's "Full Issue" block links the galley.
			const issueId = await resolveIssueId(page, context.path, issue);
			const anon = await browser.newContext({
				baseURL,
				storageState: ANON_STORAGE_STATE,
			});
			try {
				const anonPage = await anon.newPage();
				const resp = await anonPage.goto(
					`/index.php/${context.path}/issue/view/${issueId}`,
				);
				expect(resp?.status()).toBe(200);
				// Don't use getByRole({name: label}) here: issue_toc.tpl
				// passes labelledBy="issueTocGalleyLabel" into
				// galley_link.tpl, so aria-labelledby overrides the link's
				// accessible name with the "Full Issue" heading text.
				// Match the rendered label text instead.
				await expect(
					anonPage.locator(
						'.obj_issue_toc .galleys .galleys_links a.obj_galley_link',
						{hasText: galleyLabel},
					),
				).toBeVisible({timeout: 10_000});
			} finally {
				await anon.close();
			}
		},
	);

	// Row 8 — delete a future issue and a published back issue.
	test(
		'manager deletes issues from both tabs; archive drops the back issue',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag('del');
			const futureIssue = {volume: 9, number: '1', year: 2031};
			const backIssue = {volume: 4, number: '1', year: 2026};
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [
					{...backIssue, published: true},
					{...futureIssue, published: false},
				],
			});
			const issuePage = new IssuePage(page);
			const backIdentification = issuePage.identification(backIssue);

			// Positive control before deleting: the published issue is on
			// the public archive (bounds the absence assertion below).
			const anon = await browser.newContext({
				baseURL,
				storageState: ANON_STORAGE_STATE,
			});
			try {
				const anonPage = await anon.newPage();
				const before = await anonPage.goto(
					`/index.php/${context.path}/issue/archive`,
				);
				expect(before?.status()).toBe(200);
				await expect(
					anonPage.getByText(backIdentification),
				).toBeVisible({timeout: 10_000});

				// Delete the future issue from the Future tab.
				await issuePage.goto(context.path);
				const futureRow = issuePage.futureRow(futureIssue);
				await expect(futureRow).toBeVisible({timeout: 15_000});
				await issuePage.confirmRowAction(futureRow, 'delete', {
					dialogText: 'Are you sure you wish to delete this item',
				});
				await expect(futureRow).toHaveCount(0, {timeout: 15_000});

				// Delete the published back issue from the Back tab.
				await issuePage.openBackTab();
				const backRow = issuePage.backRow(backIssue);
				await expect(backRow).toBeVisible({timeout: 15_000});
				await issuePage.confirmRowAction(backRow, 'delete', {
					dialogText: 'Are you sure you wish to delete this item',
				});
				await expect(backRow).toHaveCount(0, {timeout: 15_000});

				// Both rows stay gone across a reload.
				await issuePage.goto(context.path);
				await expect(issuePage.futureRow(futureIssue)).toHaveCount(0);
				await issuePage.openBackTab();
				await expect(issuePage.backRow(backIssue)).toHaveCount(0);

				// The archive no longer lists the deleted back issue.
				const after = await anonPage.goto(
					`/index.php/${context.path}/issue/archive`,
				);
				expect(after?.status()).toBe(200);
				await expect(anonPage.getByText(backIdentification)).toHaveCount(
					0,
				);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 9 — identification options + urlPath surface to readers.
	test(
		'issue title, description and urlPath save and render at /issue/view/{urlPath}',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag('ident');
			const issue = {volume: 5, number: '2', year: 2027};
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...issue, published: false}],
			});
			const issueTitle = `Special Issue ${tag}`;
			const descriptionText = `Curated description ${tag}`;
			// urlPath validator: /^[a-zA-Z0-9]+([.\-_][a-zA-Z0-9]+)*$/ —
			// the tag's dash-separated alnum shape qualifies, and tags are
			// unique per test so no per-journal collision.
			const urlPath = tag;

			const issuePage = new IssuePage(page);
			await issuePage.goto(context.path);

			// Fill Issue Data: title + showTitle (seeded issues default
			// showTitle=0), rich-text description, urlPath.
			const form = await issuePage.openIssueDataTab(
				issuePage.futureRow(issue),
			);
			await form.locator('input[name="title[en]"]').fill(issueTitle);
			await form.locator('input#showTitle').check();
			const editorId = await resolveTinyMceEditorId(page, 'description');
			await setTinyMceContent(
				page,
				editorId,
				`<p>${descriptionText}</p>`,
			);
			await form.locator('input[name="urlPath"]').fill(urlPath);
			await issuePage.saveIssueForm();

			// Persistence: reopen the form, every field round-tripped.
			const reopened = await issuePage.openIssueDataTab(
				issuePage.futureRow(issue),
			);
			await expect(
				reopened.locator('input[name="title[en]"]'),
			).toHaveValue(issueTitle);
			await expect(reopened.locator('input#showTitle')).toBeChecked();
			await expect(reopened.locator('input[name="urlPath"]')).toHaveValue(
				urlPath,
			);
			const reopenedEditorId = await resolveTinyMceEditorId(
				page,
				'description',
			);
			expect(
				await getTinyMceContent(page, reopenedEditorId),
			).toContain(descriptionText);
			// Close the modal by saving unchanged data (keeps the grid
			// interactive for the publish step).
			await issuePage.saveIssueForm();

			// Publish, then the reader loads the issue by its urlPath.
			await issuePage.publishIssue(issue);

			const anon = await browser.newContext({
				baseURL,
				storageState: ANON_STORAGE_STATE,
			});
			try {
				const anonPage = await anon.newPage();
				const resp = await anonPage.goto(
					`/index.php/${context.path}/issue/view/${urlPath}`,
				);
				expect(resp?.status()).toBe(200);
				// h1 carries the identification, which appends the title
				// when showTitle is on ("Vol. 5 No. 2 (2027): Special…").
				await expect(
					anonPage.locator('h1', {hasText: issueTitle}),
				).toBeVisible({timeout: 10_000});
				await expect(
					anonPage.locator('.obj_issue_toc .description'),
				).toContainText(descriptionText);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 10 — unpublishing an issue pulls its article from the reader
	// site and reverts it to Scheduled.
	test(
		'unpublishing an issue flips its article back to Scheduled and hides it from readers',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag('unpub');
			const issue = {volume: 6, number: '1', year: 2026};
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...issue, published: true}],
			});
			const spec = submissionPublished({tag});
			spec.journal = context.path;
			spec.publications[0].issue = {...issue};
			spec.publications[0].metadata.title.en = 'Pulled article';
			const {submission} = await pkpApi.createSubmission(spec);

			const issuePage = new IssuePage(page);
			const identification = issuePage.identification(issue);

			const anon = await browser.newContext({
				baseURL,
				storageState: ANON_STORAGE_STATE,
			});
			try {
				const anonPage = await anon.newPage();

				// Positive controls bounding the negatives below: the
				// article is live and the archive lists the issue.
				const liveResp = await anonPage.goto(
					`/index.php/${context.path}/article/view/${submission.id}`,
				);
				expect(liveResp?.status()).toBe(200);
				const archiveBefore = await anonPage.goto(
					`/index.php/${context.path}/issue/archive`,
				);
				expect(archiveBefore?.status()).toBe(200);
				await expect(anonPage.getByText(identification)).toBeVisible({
					timeout: 10_000,
				});

				// Unpublish from the Back Issues grid.
				await issuePage.goto(context.path);
				await issuePage.openBackTab();
				await issuePage.confirmRowAction(
					issuePage.backRow(issue),
					'unpublish',
					{
						dialogText:
							'Are you sure you want to unpublish this published issue',
					},
				);
				// The issue returns to the Future tab.
				await issuePage.openFutureTab();
				await expect(issuePage.futureRow(issue)).toBeVisible({
					timeout: 15_000,
				});

				// Model invariant: the attached publication reverted to
				// STATUS_SCHEDULED (unpublishIssue re-publishes it against
				// the now-unpublished issue).
				const publication = await fetchFullPublication(
					page,
					submission.id,
					context.path,
				);
				expect(publication.status).toBe(STATUS_SCHEDULED);

				// Workflow chip shows Scheduled on the publication panel.
				const workflow = new EditorialWorkflowPage(page);
				await workflow.goto(submission.id, {
					journalPath: context.path,
				});
				await workflow.openPublicationPanel('Title & Abstract');
				await expect(
					workflow.workflowModal().getByText('Status: Scheduled'),
				).toBeVisible({timeout: 15_000});

				// Reader: article 404s; archive no longer lists the issue.
				const goneResp = await anonPage.goto(
					`/index.php/${context.path}/article/view/${submission.id}`,
				);
				expect(goneResp?.status()).toBe(404);
				const archiveAfter = await anonPage.goto(
					`/index.php/${context.path}/issue/archive`,
				);
				expect(archiveAfter?.status()).toBe(200);
				await expect(anonPage.getByText(identification)).toHaveCount(0);
			} finally {
				await anon.close();
			}
		},
	);

	// Row 11 — removing one article from the TOC keeps its sibling.
	test(
		'manager removes an article from the issue TOC; the sibling stays published',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag('rm');
			const issue = {volume: 7, number: '1', year: 2026};
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				issues: [{...issue, published: true}],
			});
			const keepTitle = await seedPublishedArticle(pkpApi, {
				tag,
				journalPath: context.path,
				issue,
				title: 'Kept article',
			});
			const dropSeed = submissionPublished({tag});
			dropSeed.journal = context.path;
			dropSeed.publications[0].issue = {...issue};
			dropSeed.publications[0].metadata.title.en = 'Removed article';
			const {submission: dropSubmission} =
				await pkpApi.createSubmission(dropSeed);
			const dropTitle = `Removed article [${tag}]`;

			const issuePage = new IssuePage(page);
			await issuePage.goto(context.path);
			await issuePage.openBackTab();
			await issuePage.openIssueToc(issuePage.backRow(issue));

			// Both rows are on the TOC before the removal (positive
			// control bounding the absence checks).
			await expect(issuePage.tocEntry(keepTitle)).toBeVisible({
				timeout: 15_000,
			});
			await expect(issuePage.tocEntry(dropTitle)).toBeVisible();

			await issuePage.confirmRowAction(
				issuePage.tocArticleRow(dropTitle),
				'removeArticle',
				{
					dialogText:
						'Are you sure you wish to remove this article from the issue',
				},
			);

			// Grid refreshed: removed row gone, sibling intact.
			await expect(issuePage.tocEntry(dropTitle)).toHaveCount(0, {
				timeout: 15_000,
			});
			await expect(issuePage.tocEntry(keepTitle)).toBeVisible();

			// Model invariant: the removed article's publication is no
			// longer published in the issue (TocGridHandler::removeArticle
			// → Repo::publication()->unpublish → STATUS_QUEUED).
			const publication = await fetchFullPublication(
				page,
				dropSubmission.id,
				context.path,
			);
			expect(publication.status).toBe(STATUS_QUEUED);

			// Reader: the issue TOC keeps the sibling, drops the removed
			// article; the removed article's landing page 404s.
			const issueId = await resolveIssueId(page, context.path, issue);
			const anon = await browser.newContext({
				baseURL,
				storageState: ANON_STORAGE_STATE,
			});
			try {
				const anonPage = await anon.newPage();
				const resp = await anonPage.goto(
					`/index.php/${context.path}/issue/view/${issueId}`,
				);
				expect(resp?.status()).toBe(200);
				const toc = anonPage.locator('.obj_issue_toc');
				await expect(
					toc.getByRole('link', {name: keepTitle}),
				).toBeVisible({timeout: 10_000});
				await expect(
					toc.getByRole('link', {name: dropTitle}),
				).toHaveCount(0);

				const goneResp = await anonPage.goto(
					`/index.php/${context.path}/article/view/${dropSubmission.id}`,
				);
				expect(goneResp?.status()).toBe(404);
			} finally {
				await anon.close();
			}
		},
	);
});

/**
 * Build a worker-scoped, whitespace-free tag (journals.urlPath is
 * varchar(32); the scenario uses the tag as the journal path).
 *
 * @param {string} suffix
 */
function uniqueTag(suffix) {
	const random = Math.random().toString(36).slice(2, 8);
	return `im-w${test.info().parallelIndex}-${suffix}-${random}`;
}

/**
 * Seed one fully-processed, published submission into a scratch journal's
 * issue and return its rendered title ("<title> [<tag>]" —
 * PublicationsProcessor appends the tag to every title locale).
 *
 * @param {*} pkpApi
 * @param {{tag: string, journalPath: string, issue: object, title: string}} opts
 * @returns {Promise<string>} the tagged article title
 */
async function seedPublishedArticle(pkpApi, {tag, journalPath, issue, title}) {
	const spec = submissionPublished({tag});
	spec.journal = journalPath;
	spec.publications[0].issue = {...issue};
	spec.publications[0].metadata.title.en = title;
	await pkpApi.createSubmission(spec);
	return `${title} [${tag}]`;
}

/**
 * Resolve an issue id by volume/number/year through the issues API with
 * the page's (dbarnes) session — the manager role passes the
 * unpublished-issues gate in scratch journals.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 * @param {{volume: number|string, number: number|string, year: number|string}} issueRef
 * @returns {Promise<number>}
 */
async function resolveIssueId(page, journalPath, {volume, number, year}) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/issues?count=100`,
	);
	if (!res.ok()) {
		throw new Error(`GET issues: ${res.status()} ${await res.text()}`);
	}
	const body = await res.json();
	const items = body.items || body;
	const found = items.find(
		(i) =>
			Number(i.volume) === Number(volume) &&
			String(i.number) === String(number) &&
			Number(i.year) === Number(year),
	);
	if (!found) {
		throw new Error(
			`Issue Vol. ${volume} No. ${number} (${year}) not found in ${journalPath}`,
		);
	}
	return found.id;
}

/**
 * Fetch the full current-publication payload for a submission (the
 * collection endpoint's summary omits `issueId`/full status context).
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {string} journalPath
 */
async function fetchFullPublication(page, submissionId, journalPath) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	if (!subRes.ok()) {
		throw new Error(
			`GET submission: ${subRes.status()} ${await subRes.text()}`,
		);
	}
	const subBody = await subRes.json();
	const pubRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${subBody.currentPublicationId}`,
	);
	if (!pubRes.ok()) {
		throw new Error(
			`GET publication: ${pubRes.status()} ${await pubRes.text()}`,
		);
	}
	return pubRes.json();
}

/**
 * Resolve the runtime id of a legacy-form TinyMCE editor by its fbv id
 * prefix. fbvElement ids are runtime-suffixed (`description-en-<hash>` /
 * `description-<hash>` depending on locale count), so the exact id can't
 * be hard-coded; the prefix is stable.
 *
 * NB: OJS ships TinyMCE 7 — the `tinymce.editors` array was removed in
 * v6. `tinymce.get()` with no arguments is the supported way to list
 * editors (returns a copy of the registry).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} prefix  e.g. 'description'
 * @returns {Promise<string>}
 */
async function resolveTinyMceEditorId(page, prefix) {
	await page.waitForFunction(
		(p) =>
			(window.tinymce?.get() ?? []).some(
				(e) => e.id.startsWith(p) && e.initialized,
			),
		prefix,
		{timeout: 15_000},
	);
	return page.evaluate(
		(p) =>
			window.tinymce
				.get()
				.find((e) => e.id.startsWith(p) && e.initialized).id,
		prefix,
	);
}
