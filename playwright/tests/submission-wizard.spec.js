// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {
	SubmissionWizardPage,
} = require('../../lib/pkp/playwright/pages/SubmissionWizardPage.js');
const {
	ActivityLogModal,
} = require('../../lib/pkp/playwright/pages/ActivityLogModal.js');

/**
 * Submission wizard — one test per canonical scenario of
 * docs/product/specs/submission-wizard.md (6 scenarios).
 *
 * Placement: OJS root (journal sections, publicknowledge specifics and
 * scratch journals are OJS concepts), even though the wizard UI itself
 * is shared.
 *
 * Seeding notes:
 *   - Wizard-resumable drafts come from the scenario endpoint with an
 *     explicit `submitted: false` (submissionProgress kept, no
 *     dateSubmitted). `participants: []` keeps unassigned sub-editors
 *     genuinely unassigned (a submitted scenario would auto-assign the
 *     section editors via AssignEditors).
 *   - Journal-level settings (copyrightNotice, single-section/locale
 *     shape) live on per-test scratch journals — publicknowledge is
 *     read-only shared state.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens
 * (dashboard search OR-splits hyphenated tokens on Postgres), every
 * Mailpit read is scoped by recipient + tag, and list assertions are
 * tag-scoped presence/absence, never counts.
 */

const ARTICLE_FIXTURE = path.resolve(
	__dirname,
	'..',
	'..',
	'lib',
	'pkp',
	'playwright',
	'fixtures',
	'files',
	'default-article.pdf',
);

function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `swz${workerIndex}x${suffix}`;
}

/**
 * Sign a baseline user into a scratch journal through the login form —
 * the cached storage state is publicknowledge-scoped.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} journalPath
 * @param {string} username
 */
async function scratchLogin(page, journalPath, username) {
	await page.goto(`/index.php/${journalPath}/en/login`);
	await page.locator('input#username').fill(username);
	await page.locator('input#password').fill(`${username}${username}`);
	await page.locator('form#login button').click();
	await page.waitForURL((url) => !url.pathname.includes('/login'), {
		timeout: 15_000,
		waitUntil: 'commit',
	});
}

/**
 * Fetch the submission's current publication via REST with the page's
 * session. Used with expect.poll to anchor "the autosave has landed"
 * deterministically before Review's `_validateOnly` check runs against
 * stored state.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} submissionId
 * @param {string} [journalPath='publicknowledge']
 * @returns {Promise<object|null>}
 */
async function fetchCurrentPublication(
	page,
	submissionId,
	journalPath = 'publicknowledge',
) {
	const subRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	if (!subRes.ok()) return null;
	const sub = await subRes.json();
	if (!sub.currentPublicationId) return null;
	const pubRes = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${sub.currentPublicationId}`,
	);
	if (!pubRes.ok()) return null;
	return await pubRes.json();
}

/**
 * Minimal wizard-resumable draft spec: atester's in-progress submission
 * on publicknowledge with NO assigned participants.
 */
function draftSpec({tag, title}) {
	return {
		tag,
		journal: 'publicknowledge',
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: false,
		participants: [],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * Scope a dashboard list to this test's rows via the search box (it
 * reacts to keyup only — type real keystrokes).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} token
 */
async function searchList(page, token) {
	const search = page.locator('.pkpSearch__input');
	await expect(search).toBeVisible({timeout: 15_000});
	await search.fill('');
	await search.pressSequentially(token);
}

test.use({user: 'atester'});

test.describe('Submission wizard', () => {
	// Canonical scenario 1 — atester submits end-to-end on
	// publicknowledge; acknowledgement + editor-assignment emails fire
	// and the author's dashboard lists the submission.
	test(
		'first-time end-to-end submit with acknowledgement',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpMail}) => {
			const tag = uniqueTag();
			const title = `Endtoend ${tag}`;
			const comment = `Cover note ${tag} for the editors.`;

			const wizard = new SubmissionWizardPage(page);
			await wizard.goto();
			await expect(
				page.getByRole('heading', {name: 'Make a Submission'}),
			).toBeVisible();
			await wizard.start({title, locale: 'English', section: 'Articles'});
			const submissionId = wizard.currentSubmissionId();
			expect(submissionId).toBeTruthy();

			// Step 1 — Upload Files: PDF upload + Article Text genre.
			await wizard.expectStep('Upload Files');
			const fileItem = await wizard.uploadFile(ARTICLE_FIXTURE);
			await expect(
				fileItem.getByText('What kind of file is this?'),
			).toBeVisible();
			await wizard.assignPrimaryGenre(fileItem, 'Article Text');

			// Step 2 — Details: title is pre-seeded from the start form;
			// the Articles section requires an abstract.
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await wizard.setDetailsField(
				'abstract',
				`<p>End-to-end abstract ${tag}.</p>`,
			);

			// Step 3 — Contributors: the submitter is pre-added.
			await wizard.continueStep();
			await wizard.expectStep('Contributors');
			await expect(wizard.contributorItem('Author Tester')).toBeVisible();

			// Step 4 — For the Editors: type the cover note.
			await wizard.continueStep();
			await wizard.expectStep('For the Editors');
			await wizard.setCommentsForEditors(comment);

			// Step 5 — Reviewer Suggestions (enabled on publicknowledge;
			// empty list warns but never blocks). Anchor the autosaves
			// (abstract + comments) before Review validates stored state.
			await wizard.continueStep();
			await wizard.expectStep('Reviewer Suggestions');
			await expect
				.poll(
					async () =>
						(await fetchCurrentPublication(page, submissionId))
							?.abstract?.en ?? '',
					{timeout: 20_000},
				)
				.toContain(tag);
			await expect
				.poll(
					async () => {
						const res = await page.request.get(
							`/index.php/publicknowledge/api/v1/submissions/${submissionId}`,
						);
						if (!res.ok()) return '';
						return (await res.json()).commentsForTheEditors ?? '';
					},
					{timeout: 20_000},
				)
				.toContain(tag);

			// Step 6 — Review: no error banner, Submit enabled.
			await wizard.continueStep();
			await wizard.expectStep('Review');
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});
			await expect(wizard.reviewErrorsBanner).toHaveCount(0);

			// Confirm the "will be submitted to…" dialog.
			const dialog = await wizard.openSubmitDialog();
			await expect(dialog).toContainText(
				'will be submitted to Journal of Public Knowledge',
			);
			await dialog
				.getByRole('button', {name: 'Submit', exact: true})
				.click();

			// "Submission complete" screen with its three next-step links.
			await expect(
				page.getByRole('heading', {name: 'Submission complete'}),
			).toBeVisible({timeout: 30_000});
			await expect(
				page.getByRole('link', {name: 'Review this submission'}),
			).toBeVisible();
			await expect(
				page.getByRole('link', {name: 'Create a new submission'}),
			).toBeVisible();
			await expect(
				page.getByRole('link', {name: 'Return to your dashboard'}),
			).toBeVisible();

			// Acknowledgement email to the submitter…
			const [ack] = await pkpMail.find({
				to: 'atester@mailinator.com',
				contains: tag,
				subject: 'Thank you for your submission',
				timeoutMs: 30_000,
			});
			expect(ack).toBeTruthy();

			// …and the assignment email to an Articles section editor
			// (dbuskins is pre-assigned to the Articles section).
			const [assigned] = await pkpMail.find({
				to: 'dbuskins@mailinator.com',
				contains: tag,
				subject: 'You have been assigned as an editor',
				timeoutMs: 30_000,
			});
			expect(assigned).toBeTruthy();

			// The author's dashboard lists the submission.
			await page.goto(
				'/index.php/publicknowledge/en/dashboard/mySubmissions',
			);
			await searchList(page, tag);
			await expect(
				page.getByRole('row').filter({hasText: title}).first(),
			).toBeVisible({timeout: 20_000});
		},
	);

	// Canonical scenario 2 — walking to Review with nothing done paints
	// the warning banner + per-panel errors and disables Submit; adding
	// the file and abstract clears them and enables Submit.
	test(
		'incomplete submission is blocked at Review',
		{tag: '@regression'},
		async ({page}) => {
			const tag = uniqueTag();
			const title = `Blocked ${tag}`;

			const wizard = new SubmissionWizardPage(page);
			await wizard.goto();
			await wizard.start({title, locale: 'English', section: 'Articles'});
			const submissionId = wizard.currentSubmissionId();
			expect(submissionId).toBeTruthy();

			// Jump straight to Review with nothing done (no upload, no
			// abstract; the title is pre-seeded by the start form).
			await wizard.expectStep('Upload Files');
			await wizard.continueStep(); // → Details
			await wizard.continueStep(); // → Contributors
			await wizard.continueStep(); // → For the Editors
			await wizard.continueStep(); // → Reviewer Suggestions
			await wizard.continueStep(); // → Review
			await wizard.expectStep('Review');

			// The banner + per-panel errors appear, Submit is disabled.
			await expect(wizard.reviewErrorsBanner).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				page.getByText('You must upload at least one Article Text file.'),
			).toBeVisible();
			const abstractItem = wizard.reviewPanelItem(/^Details/, 'Abstract');
			await expect(
				abstractItem.getByText('This field is required.'),
			).toBeVisible();
			await expect(wizard.footerSubmit).toBeDisabled();

			// Supply the file…
			await wizard.gotoStep('Upload Files');
			const fileItem = await wizard.uploadFile(ARTICLE_FIXTURE);
			await wizard.assignPrimaryGenre(fileItem, 'Article Text');

			// …and the abstract.
			await wizard.gotoStep('Details');
			await wizard.setDetailsField(
				'abstract',
				`<p>Unblocking abstract ${tag}.</p>`,
			);

			// The abstract reaches the server via autosave — anchor its
			// persistence from a non-Review step before re-validating.
			await wizard.gotoStep('Contributors');
			await expect
				.poll(
					async () =>
						(await fetchCurrentPublication(page, submissionId))
							?.abstract?.en ?? '',
					{timeout: 20_000},
				)
				.toContain(tag);

			// Re-entering Review clears the errors and enables Submit.
			await wizard.gotoStep('Review');
			await wizard.expectStep('Review');
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});
			await expect(wizard.reviewErrorsBanner).toHaveCount(0);
			await expect(
				page.getByText('You must upload at least one Article Text file.'),
			).toHaveCount(0);
			await expect(
				abstractItem.getByText('This field is required.'),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 3 — on a scratch journal with a copyright
	// notice, a fully valid draft keeps Submit disabled until the
	// copyright box is ticked; the event log records the agreement.
	test(
		'copyright consent gates Submit',
		{tag: '@regression'},
		async ({pkpApi, browser, baseURL}) => {
			test.slow(); // scratch journal + full wizard walk + activity log
			const tag = uniqueTag();
			const copyrightText = `Scratch copyright notice ${tag}`;
			const title = `Copyright ${tag}`;

			// dbarnes as manager ONLY: submitting in the manager group
			// keeps his stage assignment editorial, so the workflow page
			// still offers the Activity Log after submit (an Author
			// assignment would suppress canAccessEditorialHistory). The
			// empty contributor list is fine — final validation only
			// checks the names of contributors that exist.
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
				copyrightNotice: {en: copyrightText},
			});

			const ctx = await browser.newContext({
				baseURL,
				// Explicit empty state: newContext() inherits the file-level
				// user's storageState otherwise.
				storageState: {cookies: [], origins: []},
			});
			try {
				const page = await ctx.newPage();
				await scratchLogin(page, context.path, 'dbarnes');

				const wizard = new SubmissionWizardPage(page, context.path);
				await wizard.goto();
				// Single default section, single locale, no checklist or
				// privacy statement on an EN scratch journal — title only.
				await wizard.start({title});
				const submissionId = wizard.currentSubmissionId();
				expect(submissionId).toBeTruthy();

				// Make the draft fully valid: Article Text file + abstract
				// (the default section requires one).
				await wizard.expectStep('Upload Files');
				const fileItem = await wizard.uploadFile(ARTICLE_FIXTURE);
				await wizard.assignPrimaryGenre(fileItem, 'Article Text');
				await wizard.continueStep();
				await wizard.expectStep('Details');
				await wizard.setDetailsField(
					'abstract',
					`<p>Copyright abstract ${tag}.</p>`,
				);
				await wizard.continueStep();
				await wizard.expectStep('Contributors');
				// Anchor the abstract autosave before Review validates.
				await expect
					.poll(
						async () =>
							(
								await fetchCurrentPublication(
									page,
									submissionId,
									context.path,
								)
							)?.abstract?.en ?? '',
						{timeout: 20_000},
					)
					.toContain(tag);
				await wizard.continueStep();
				await wizard.expectStep('For the Editors');
				await wizard.continueStep();
				await wizard.expectStep('Review');

				// The Confirmation section quotes the journal's notice.
				const confirmHeading = page.getByRole('heading', {
					name: 'Confirmation',
				});
				await confirmHeading.scrollIntoViewIfNeeded();
				await expect(confirmHeading).toBeVisible({timeout: 15_000});
				await expect(page.locator('blockquote')).toContainText(
					copyrightText,
				);

				// Fully valid — yet Submit stays disabled while the
				// copyright box is unticked.
				const copyrightCheckbox = page
					.locator('input[name="confirmCopyright"][type="checkbox"]')
					.first();
				await expect(copyrightCheckbox).not.toBeChecked();
				await expect(wizard.footerSubmit).toBeDisabled();
				await expect(wizard.reviewErrorsBanner).toHaveCount(0);

				// Ticking it enables Submit (proves the draft was valid and
				// the checkbox was the only gate).
				await copyrightCheckbox.check();
				await expect(wizard.footerSubmit).toBeEnabled({
					timeout: 20_000,
				});

				// Complete the submission.
				const dialog = await wizard.openSubmitDialog();
				await dialog
					.getByRole('button', {name: 'Submit', exact: true})
					.click();
				await expect(
					page.getByRole('heading', {name: 'Submission complete'}),
				).toBeVisible({timeout: 30_000});

				// The activity log records the copyright agreement.
				await page.goto(
					`/index.php/${context.path}/dashboard/editorial?workflowSubmissionId=${submissionId}`,
				);
				const activityLog = new ActivityLogModal(page);
				await activityLog.openFromWorkflow();
				await activityLog.openHistoryTab();
				await expect(
					activityLog
						.historyRow(/agreed to the copyright terms/)
						.first(),
				).toBeVisible({timeout: 20_000});
			} finally {
				await ctx.close();
			}
		},
	);

	// Canonical scenario 4 — access control on atester's draft: the
	// owner and a manager-level editor open the wizard (with the footer
	// Cancel); an unassigned section editor and a reviewer are denied;
	// the reviewer can still start their own submission.
	test(
		'only the right people can open or cancel a draft',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				draftSpec({tag, title: `Accessdraft ${tag}`}),
			);
			const wizardUrl = `/index.php/publicknowledge/submission?id=${submission.id}`;
			const deniedMessage =
				'The current role does not have access to this operation.';

			// The submitting author opens the wizard and sees Cancel.
			await page.goto(wizardUrl);
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			const ownerWizard = new SubmissionWizardPage(page);
			await expect(ownerWizard.cancelButton).toBeVisible();

			// dbarnes (manager-level editor) opens any draft + sees Cancel.
			const editorCtx = await asUser('dbarnes');
			const editorPage = await editorCtx.newPage();
			await editorPage.goto(wizardUrl);
			await expect(editorPage.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			const editorWizard = new SubmissionWizardPage(editorPage);
			await expect(editorWizard.cancelButton).toBeVisible();

			// dbuskins (section editor, unassigned to this draft) is denied.
			const subEditorCtx = await asUser('dbuskins');
			const subEditorPage = await subEditorCtx.newPage();
			await subEditorPage.goto(wizardUrl);
			await expect(subEditorPage).toHaveURL(/authorizationDenied/);
			await expect(
				subEditorPage.getByText(deniedMessage),
			).toBeVisible();

			// phudson (reviewer) is denied on someone else's draft…
			const reviewerCtx = await asUser('phudson');
			const reviewerPage = await reviewerCtx.newPage();
			await reviewerPage.goto(wizardUrl);
			await expect(reviewerPage).toHaveURL(/authorizationDenied/);
			await expect(reviewerPage.getByText(deniedMessage)).toBeVisible();

			// …but can start their own submission from /submission (the
			// journal's author role permits self-registration, so the
			// reviewer-only account gets the full start form).
			const reviewerWizard = new SubmissionWizardPage(reviewerPage);
			await reviewerWizard.goto();
			await expect(
				reviewerPage.getByRole('heading', {name: 'Make a Submission'}),
			).toBeVisible({timeout: 20_000});
			await reviewerWizard.start({
				title: `Reviewerown ${tag}`,
				locale: 'English',
				section: 'Articles',
			});
			await reviewerWizard.expectStep('Upload Files');
		},
	);

	// Canonical scenario 5 — the submitting author cancels the draft:
	// warning dialog, "Submission cancelled" landing, the wizard URL is
	// a 404 afterwards and the draft is gone from the incomplete list.
	test(
		'cancel deletes the draft',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission: target} = await pkpApi.createSubmission(
				draftSpec({tag, title: `Cancelme ${tag}`}),
			);
			// Control draft: still listed afterwards, bounding the absence
			// assertion on the cancelled one.
			await pkpApi.createSubmission(
				draftSpec({tag, title: `Cancelkeep ${tag}`}),
			);
			const wizardUrl = `/index.php/publicknowledge/submission?id=${target.id}`;

			await page.goto(wizardUrl);
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});

			// Footer Cancel → warning dialog → "Submission cancelled".
			const wizard = new SubmissionWizardPage(page);
			await wizard.cancel();
			await expect(page).toHaveURL(/\/submission\/cancelled/);

			// The old wizard URL is gone (404).
			const res = await page.request.get(wizardUrl);
			expect(res.status()).toBe(404);

			// Gone from the incomplete list; the control draft remains.
			await page.goto(
				'/index.php/publicknowledge/en/dashboard/mySubmissions?currentViewId=incomplete-submissions',
			);
			await searchList(page, tag);
			await expect(
				page.getByRole('row').filter({hasText: `Cancelkeep ${tag}`}),
			).toBeVisible({timeout: 20_000});
			await expect(
				page.getByRole('row').filter({hasText: `Cancelme ${tag}`}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 6 — reconfigure mid-flight on the 2-section,
	// 2-language publicknowledge journal (section switch re-derives the
	// abstract requirement); on a single-section, single-language
	// scratch journal the "Submitting to…" line and Change control are
	// absent entirely.
	test(
		'reconfigure mid-flight',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow(); // two journals: publicknowledge walk + scratch journal
			const tag = uniqueTag();

			const wizard = new SubmissionWizardPage(page);
			await wizard.goto();
			await wizard.start({
				title: `Reconfigure ${tag}`,
				locale: 'English',
				section: 'Articles',
			});
			await wizard.expectStep('Upload Files');
			const submissionId = wizard.currentSubmissionId();
			expect(submissionId).toBeTruthy();

			// "Submitting to the Articles section in English." + Change.
			await expect(wizard.submittingToCaption).toContainText(
				'Submitting to the Articles section in English.',
			);
			await expect(
				wizard.submittingToCaption.getByRole('button', {name: 'Change'}),
			).toBeVisible();

			// Articles requires an abstract → the Details field carries
			// the required marker.
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await expect(
				wizard.detailsFieldRequiredMarker('abstract', 'en'),
			).toBeVisible();

			// Switch the section to Reviews via Change Submission Settings.
			// Saving reloads the wizard (same #details hash → it reopens
			// on the Details step).
			await wizard.openReconfigureModal();
			await wizard.changeReconfigureSettings({sectionLabel: 'Reviews'});

			// The caption re-derives…
			await expect(wizard.submittingToCaption).toContainText(
				'Submitting to the Reviews section in English.',
				{timeout: 20_000},
			);
			// …and the abstract is no longer marked required (Reviews has
			// abstractsNotRequired). The post-save reload reopens the
			// wizard at step 1, so remount deterministically at the bare
			// wizard URL and walk back to Details.
			await page.goto(
				`/index.php/publicknowledge/submission?id=${submissionId}`,
			);
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await wizard.expectStep('Upload Files');
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await expect(
				page.locator('#titleAbstract-abstract-control-en'),
			).toBeAttached({timeout: 15_000});
			await expect(
				wizard.detailsFieldRequiredMarker('abstract', 'en'),
			).toHaveCount(0);

			// On a single-section, single-language journal the line and
			// its Change control do not exist at all.
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
			});
			const ctx = await browser.newContext({
				baseURL,
				// Explicit empty state: newContext() inherits the file-level
				// user's storageState otherwise.
				storageState: {cookies: [], origins: []},
			});
			try {
				const scratchPage = await ctx.newPage();
				await scratchLogin(scratchPage, context.path, 'dbarnes');
				const scratchWizard = new SubmissionWizardPage(
					scratchPage,
					context.path,
				);
				await scratchWizard.goto();
				await scratchWizard.start({title: `Singleshape ${tag}`});
				await scratchWizard.expectStep('Upload Files');
				await expect(scratchWizard.submittingToCaption).toHaveCount(0);
			} finally {
				await ctx.close();
			}
		},
	);
});
