// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {
	SubmissionWizardPage,
} = require('../../lib/pkp/playwright/pages/SubmissionWizardPage.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const {
	DiscussionManagerPage,
} = require('../../lib/pkp/playwright/pages/DiscussionManagerPage.js');
const {
	ActivityLogModal,
} = require('../../lib/pkp/playwright/pages/ActivityLogModal.js');
const {
	RolesSettingsPage,
} = require('../../lib/pkp/playwright/pages/RolesSettingsPage.js');
const {
	UserProfilePage,
} = require('../../lib/pkp/playwright/pages/UserProfilePage.js');
const {TasksGridModal} = require('../../lib/pkp/playwright/pages/TasksGridModal.js');
const {SectionsSettingsPage} = require('../pages/SectionsSettingsPage.js');
const {DashboardPage} = require('../../lib/pkp/playwright/pages/DashboardPage.js');

/**
 * Submission wizard — one test per canonical scenario of
 * docs/product/specs/submission-wizard.md (12 scenarios → 12 tests).
 * The wizard frame is shared pkp-lib, but every scenario leans on OJS
 * machinery (sections, the publicknowledge journal, OJS scratch
 * journals via the scenario API), so the spec lives at the OJS root —
 * mirroring tasks-discussions.spec.js.
 *
 * As-built facts the spec verifies (do NOT "fix" these to intent):
 *  - Section-editor auto-assignment on submit is broken
 *    (SubEditorsDAO::assignEditors() keys() bug) — scenario 11 asserts
 *    the managers-get-needs-editor fallback, and that the section
 *    editor hears nothing.
 *  - A manager-role submitter gets no acknowledgement email while the
 *    completion screen still claims one was sent (scenario 8).
 *  - Consents are client-side only; scenario 9 asserts the UI gate and
 *    the copyright-agreed event-log row.
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens;
 * every mutating scenario runs on a per-test scratch journal;
 * publicknowledge is used read-only + additively (real author
 * submissions, like the seeded-scenario submissions every suite
 * creates); Mailpit reads are recipient+tag scoped (never clearAll).
 */

const PDF = path.resolve(
	__dirname,
	'../../lib/pkp/playwright/fixtures/files/dummy.pdf',
);

const ALEX = {name: 'Alex Author', email: 'author.alex@mailinator.com'};

/** A unique, hyphenless, alphanumeric tag (parallel isolation + mail scoping). */
function uniqueTag(prefix = 'swz') {
	const workerLetter = String.fromCharCode(97 + (test.info().parallelIndex % 26));
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/** The wizard address for a given submission. */
function wizardUrl(submissionId, journalPath = 'publicknowledge') {
	return `/index.php/${journalPath}/submission?id=${submissionId}`;
}

/** Read the logged-in page's CSRF token (exposed on any backend page). */
async function readCsrf(page) {
	await page.waitForFunction(() => !!window.pkp?.currentUser?.csrfToken, null, {
		timeout: 15_000,
	});
	return page.evaluate(() => window.pkp.currentUser.csrfToken);
}

/**
 * Walk the wizard forward with Continue until `stepName` is the current
 * step. Step counts differ per journal (Reviewer Suggestions is
 * conditional), so walk by name, not by count.
 */
async function walkTo(wizard, stepName, max = 7) {
	const current = wizard.page.locator('.pkpSteps__step__label--current');
	const done = new RegExp(
		stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
	);
	for (let i = 0; i < max; i++) {
		const label = ((await current.textContent()) ?? '').trim();
		if (done.test(label)) {
			return;
		}
		await wizard.continueStep();
	}
	await wizard.expectStep(stepName);
}

/**
 * Wait out the Review step's transient "Checking your submission"
 * state (the entry validation call). If it never rendered (fast
 * validation), this passes immediately; banner/submit assertions that
 * follow are themselves auto-waiting.
 */
async function awaitReviewCheck(page) {
	await expect(page.getByText('Checking your submission')).toBeHidden({
		timeout: 30_000,
	});
}

/** Scenario spec for a resumable wizard draft (submitted: false). */
function draftSpec({tag, title, journal = 'publicknowledge', section = 'ART', submitter = 'author.alex'}) {
	return {
		tag,
		journal,
		submitter,
		section,
		locale: 'en',
		submitted: false,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** A throwaway user spec (created server-side because `password` is present). */
function throwawayUser(username, roles, extra = {}) {
	return {
		username,
		password: username + username, // getPassword() derivation, so asUser works
		roles,
		...extra,
	};
}

test.use({user: 'author.alex'}); // the default actor: a pure-author account

test.describe('Submission wizard', () => {
	// Canonical scenario 1 — an author submits end-to-end on
	// publicknowledge: start form (title/section/checklist/privacy),
	// upload + file kind, Details, Contributors (themselves), a Comment
	// for the Editor, Review with all panels and no problems, the
	// confirm dialog copy, "Submission complete", the thank-you email,
	// and — editorial side — the submission visible with the cover note
	// as a discussion.
	test(
		'Author submits end-to-end',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpMail, asUser}) => {
			test.slow(); // full wizard walk + mail + second actor
			const tag = uniqueTag('s1');
			const title = `End to end ${tag}`;

			const wizard = new SubmissionWizardPage(page);
			await wizard.goto();
			await expect(
				page.getByRole('heading', {name: 'Make a Submission'}).first(),
			).toBeVisible();
			await wizard.start({title, section: 'Articles'});

			// Upload Files: every file must be labelled with a file kind.
			await wizard.expectStep('Upload Files');
			const item = await wizard.uploadFile(PDF);
			await wizard.assignPrimaryGenre(item, 'Article Text');

			// Details: the ART section requires an abstract.
			await walkTo(wizard, 'Details');
			await wizard.setDetailsField('abstract', `Abstract for ${tag}`);

			// Contributors: the author was added from their user profile.
			await walkTo(wizard, 'Contributors');
			await expect(wizard.contributorItem(ALEX.name)).toBeVisible();

			// For the Editors: the cover note.
			await walkTo(wizard, 'For the Editors');
			await wizard.setCommentsForEditors(`<p>Cover note ${tag}</p>`);

			// Review: all panels filled, no problems.
			await walkTo(wizard, 'Review');
			await awaitReviewCheck(page);
			const submissionId = wizard.currentSubmissionId();
			expect(submissionId).not.toBeNull();
			await expect(wizard.reviewErrorsBanner).toBeHidden();
			await expect(wizard.reviewPanel(/Files/)).toContainText('dummy.pdf');
			await expect(wizard.reviewPanel(/^Details \(English\)/)).toContainText(
				`Abstract for ${tag}`,
			);

			// Submit: confirm-dialog copy, then the completion screen.
			const dialog = await wizard.openSubmitDialog();
			await expect(dialog).toContainText('will be submitted to');
			await expect(dialog).toContainText('Journal of Public Knowledge');
			await dialog.getByRole('button', {name: 'Submit'}).click();
			await expect(
				page.getByRole('heading', {name: 'Submission complete'}),
			).toBeVisible({timeout: 20_000});

			// The thank-you email lands in the author's inbox.
			const [ack] = await pkpMail.find({
				to: ALEX.email,
				contains: tag,
				subject: 'Thank you for your submission',
				timeoutMs: 30_000,
			});
			expect(ack, 'author receives the acknowledgement').toBeTruthy();

			// Editorial side: submitted, with the cover note as a discussion.
			const editorCtx = await asUser('editor.diana');
			const editorPage = await editorCtx.newPage();
			const workflow = new EditorialWorkflowPage(editorPage);
			await workflow.goto(submissionId);
			await expect(
				editorPage.getByRole('heading', {name: 'Workflow: Submission'}),
			).toBeVisible({timeout: 20_000});
			const dm = new DiscussionManagerPage(editorPage);
			await dm.expectVisible();
			await dm.expectInGroup('Comments for the Editor', 'In progress');
		},
	);

	// Canonical scenario 2 — a logged-in user with no submitting role:
	// with author self-registration enabled they get the start form and
	// are auto-enrolled as an Author on Begin Submission; with it
	// disabled the page reads "Not Allowed".
	test(
		'User without an author role',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			test.slow(); // scratch journal + legacy roles grid + two actors
			const tag = uniqueTag('s2');
			const userA = `nra${tag}`;
			const userB = `nrb${tag}`;
			const {context} = await pkpApi.createJournal({
				tag,
				users: [
					// Reader is not a submitting role; only a self-registering
					// Author group can rescue these users on the start page.
					throwawayUser(userA, ['reader'], {givenName: 'Nora', familyName: 'Roleless'}),
					throwawayUser(userB, ['reader'], {givenName: 'Nero', familyName: 'Roleless'}),
				],
			});
			const journalPath = context.path;

			// --- Self-registration enabled (the scratch-journal default):
			//     the start form renders and Begin Submission enrols. ---
			const ctxA = await asUser(userA);
			const pageA = await ctxA.newPage();
			const wizardA = new SubmissionWizardPage(pageA, journalPath);
			await wizardA.goto();
			await expect(
				pageA.getByRole('button', {name: 'Begin Submission'}),
			).toBeVisible();
			await wizardA.start({title: `Self registered ${tag}`});
			// The wizard mounted on their own new submission — the user was
			// enrolled as an Author automatically (only enrolled users can
			// hold a wizard).
			await expect(pageA.locator('.submissionWizard')).toBeVisible();
			expect(wizardA.currentSubmissionId()).not.toBeNull();

			// --- Disable self-registration on the Author group
			//     (Users & Roles → Roles, as the journal's manager). ---
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			const roles = new RolesSettingsPage(adminPage);
			await roles.goto(journalPath);
			const rowId = await roles.resolveActionableRowId('Author');
			const form = await roles.openEditForm(rowId);
			await roles.fillRoleForm(form, {
				options: {permitSelfRegistration: false},
			});
			await roles.saveForm(form);

			// --- A second role-less user now reads "Not Allowed". ---
			const ctxB = await asUser(userB);
			const pageB = await ctxB.newPage();
			await pageB.goto(`/index.php/${journalPath}/submission`);
			await expect(
				pageB.getByRole('heading', {name: 'Not Allowed'}),
			).toBeVisible();
			await expect(
				pageB.getByText(
					'You are not allowed to submit to this journal because authors must be registered by the editorial staff',
				),
			).toBeVisible();
			await expect(
				pageB.getByRole('button', {name: 'Begin Submission'}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 3 — the Review step's completeness check: a
	// missing abstract and no file of the required kind paint the
	// warning banner + per-panel errors and disable Submit; fixing both
	// via the panels' Edit links clears the warning and enables Submit.
	test(
		'Completeness check on Review',
		{tag: '@regression'},
		async ({page}) => {
			test.slow(); // three Review entries, each re-running validation
			const tag = uniqueTag('s3');

			const wizard = new SubmissionWizardPage(page);
			await wizard.goto();
			await wizard.start({title: `Incomplete ${tag}`, section: 'Articles'});

			// Skip the upload AND the abstract; walk straight to Review.
			await walkTo(wizard, 'Review');
			await awaitReviewCheck(page);

			await expect(wizard.reviewErrorsBanner).toBeVisible();
			await expect(wizard.reviewErrorsBanner).toContainText(
				'There are one or more problems that need to be fixed before you can submit',
			);
			const filesPanel = wizard.reviewPanel(/Files/);
			await expect(filesPanel).toContainText(
				'You must upload at least one Article Text file.',
			);
			// The abstract error renders (unlabeled) in the submission
			// language's Details panel — a known deviation; the text is
			// the generic required-field error.
			const detailsPanel = wizard.reviewPanel(/^Details \(English\)/);
			await expect(detailsPanel).toContainText('This field is required.');
			await expect(wizard.footerSubmit).toBeDisabled();

			// Fix the file via the Files panel's Edit link.
			await filesPanel.getByRole('button', {name: 'Edit'}).click();
			await wizard.expectStep('Upload Files');
			const item = await wizard.uploadFile(PDF);
			await wizard.assignPrimaryGenre(item, 'Article Text');

			// Back to Review; fix the abstract via the Details panel's Edit.
			await wizard.gotoStep('Review');
			await awaitReviewCheck(page);
			await wizard
				.reviewPanel(/^Details \(English\)/)
				.getByRole('button', {name: 'Edit'})
				.click();
			await wizard.expectStep('Details');
			await wizard.setDetailsField('abstract', `Fixed abstract ${tag}`);

			// Back to Review: the warning is gone and Submit activates.
			await wizard.gotoStep('Review');
			await awaitReviewCheck(page);
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});
			await expect(wizard.reviewErrorsBanner).toBeHidden();
			await expect(filesPanel).not.toContainText(
				'You must upload at least one Article Text file.',
			);
			await expect(detailsPanel).not.toContainText('This field is required.');
		},
	);

	// Canonical scenario 4 — Save for Later from the Contributors step:
	// the "Saved for Later" page shows the submission's link and the
	// "We have emailed a copy of this link to you at {email}" note, and
	// following the link reopens the wizard on the same step.
	test('Save for later and the saved page', {tag: '@regression'}, async ({page}) => {
		const tag = uniqueTag('s4');

		const wizard = new SubmissionWizardPage(page);
		await wizard.goto();
		await wizard.start({title: `Saved later ${tag}`, section: 'Articles'});
		await walkTo(wizard, 'Contributors');
		const submissionId = wizard.currentSubmissionId();

		await wizard.saveForLater(); // asserts the "Saved for Later" heading
		await expect(
			page.getByText(
				`We have emailed a copy of this link to you at ${ALEX.email}`,
			),
		).toBeVisible();

		// The page shows the submission's own wizard link; following it
		// reopens the wizard on the step where they left off.
		const resumeLink = page.locator('a[href*="submission?id="]').first();
		await expect(resumeLink).toBeVisible();
		await expect(resumeLink).toHaveAttribute(
			'href',
			new RegExp(`submission\\?id=${submissionId}`),
		);
		await resumeLink.click();
		await expect(page.locator('.submissionWizard')).toBeVisible({
			timeout: 20_000,
		});
		await wizard.expectStep('Contributors');
	});

	// Canonical scenario 5 — Cancel from the wizard footer: the warning
	// dialog, the "Submission cancelled" landing page with its two
	// links, the draft gone from My Submissions, and the dead wizard
	// address.
	test('Cancel a submission', {tag: '@regression'}, async ({page, pkpApi}) => {
		const tag = uniqueTag('s5');
		const title = `Cancel sub ${tag}`;
		const {submission} = await pkpApi.createSubmission(
			draftSpec({tag, title}),
		);

		await page.goto(wizardUrl(submission.id));
		await expect(page.locator('.submissionWizard')).toBeVisible({
			timeout: 20_000,
		});

		// POM cancel() asserts the dialog's deletion warning and the
		// "Submission cancelled" heading; assert the rest of the copy.
		await wizard5Cancel(page);

		await expect(
			page.getByText(
				'Submission has been cancelled, and all associated data has been deleted.',
			),
		).toBeVisible();
		await expect(
			page.getByRole('link', {name: 'Create a new submission'}),
		).toBeVisible();
		await expect(
			page.getByRole('link', {name: 'Return to your dashboard'}),
		).toBeVisible();

		// Gone from My Submissions.
		const dash = new DashboardPage(page);
		await dash.gotoMySubmissions();
		const searched = page.waitForResponse(
			(res) => res.url().includes(`searchPhrase=${tag}`) && res.ok(),
			{timeout: 20_000},
		);
		await dash.search(tag);
		await searched;
		await expect(dash.row(tag)).toHaveCount(0);

		// The old wizard address no longer works — no wizard, no steps.
		await page.goto(wizardUrl(submission.id));
		await expect(page.locator('.submissionWizard')).toHaveCount(0);
		await expect(page.getByText(/404 Not Found|no longer exist|not found/i).first()).toBeVisible({
			timeout: 15_000,
		});
	});

	// Canonical scenario 6 — Change Submission Settings mid-flight in a
	// two-section / two-language journal: the "Submitting…" note and its
	// Change control, the modal offering Section + Submission Language,
	// and the reload after which the abstract requirement follows the
	// new section and required entries move to the new language.
	test(
		'Change section and language mid-flight',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // scratch journal + wizard + reconfigure reload
			const tag = uniqueTag('s6');
			const {context} = await pkpApi.createJournal({
				tag,
				supportedLocales: ['en', 'fr_CA'],
				sections: [
					{
						abbrev: {en: 'ART'},
						title: {en: 'Articles'},
					},
					{
						abbrev: {en: 'ESS'},
						title: {en: 'Essays'},
						abstractsNotRequired: true,
					},
				],
				users: [{username: 'author.alex', roles: ['author']}],
			});
			const journalPath = context.path;

			const wizard = new SubmissionWizardPage(page, journalPath);
			await wizard.goto();
			await wizard.start({
				title: `Reconfigure ${tag}`,
				locale: 'English',
				section: 'Articles',
			});

			// The note reflects the start-form choices in both dimensions.
			await expect(wizard.submittingToCaption).toContainText('Articles');
			await expect(wizard.submittingToCaption).toContainText('English');

			// The abstract is required by the Articles section.
			await walkTo(wizard, 'Details');
			await expect(
				wizard.detailsFieldRequiredMarker('abstract', 'en'),
			).toBeVisible();

			// Change to Essays (abstracts waived) + French.
			await wizard.openReconfigureModal();
			const modal = page.locator('[data-cy="active-modal"]');
			await expect(modal.getByText('Section', {exact: true}).first()).toBeVisible();
			await expect(
				modal.getByText('Submission Language').first(),
			).toBeVisible();
			await wizard.changeReconfigureSettings({
				localeLabel: 'French',
				sectionLabel: 'Essays',
			});

			// Saving reloads the wizard: the note updates…
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 30_000,
			});
			await expect(wizard.submittingToCaption).toContainText('Essays', {
				timeout: 20_000,
			});
			await expect(wizard.submittingToCaption).toContainText('French');

			// …the abstract stops being required, and the required entries
			// (the title) must now be written in French. The reload resets
			// the started-steps rail (the wizard reopens on Upload Files),
			// so walk forward rather than jumping.
			await walkTo(wizard, 'Details');
			await expect(
				wizard.detailsFieldRequiredMarker('title', 'fr_CA'),
			).toBeVisible({timeout: 20_000});
			await expect(
				wizard.detailsFieldRequiredMarker('abstract', 'fr_CA'),
			).toHaveCount(0);
			await expect(
				wizard.detailsFieldRequiredMarker('abstract', 'en'),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 7 — the chosen section is deactivated while a
	// draft is in progress: the wizard address renders "Section Closed"
	// naming the journal contact, the steps are unreachable, and the
	// submit endpoint refuses with the same message.
	test(
		'Section closes under a draft',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // scratch journal + legacy sections grid
			const tag = uniqueTag('s7');
			const contact = {
				name: `Journal Contact ${tag}`,
				email: `contact${tag}@mailinator.com`,
			};
			const {context} = await pkpApi.createJournal({
				tag,
				contact,
				sections: [
					{abbrev: {en: 'ART'}, title: {en: 'Articles'}},
					{abbrev: {en: 'CLS'}, title: {en: 'Closing'}},
				],
				users: [{username: 'author.alex', roles: ['author']}],
			});
			const journalPath = context.path;
			const {submission} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					title: `Stranded draft ${tag}`,
					journal: journalPath,
					section: 'CLS',
				}),
			);

			// Sanity: the draft's wizard opens before the section closes.
			await page.goto(wizardUrl(submission.id, journalPath));
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});

			// A manager deactivates the section (Settings → Journal → Sections).
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			const sections = new SectionsSettingsPage(adminPage, journalPath);
			await sections.goto();
			await sections.toggleInactive('Closing');
			await expect(sections.inactiveCheckbox('Closing')).toBeChecked();

			// The author's wizard link now renders "Section Closed".
			await page.goto(wizardUrl(submission.id, journalPath));
			await expect(
				page.getByRole('heading', {name: 'Section Closed'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				page.getByText('is not accepting submissions to the Closing section'),
			).toBeVisible();
			await expect(
				page.locator(`a[href^="mailto:${contact.email}"]`),
			).toBeVisible();
			await expect(page.locator('.submissionWizard')).toHaveCount(0);

			// Submitting is refused with the same message (server re-check).
			await page.goto(
				`/index.php/${journalPath}/dashboard/mySubmissions`,
				{waitUntil: 'commit'},
			);
			const csrf = await readCsrf(page);
			const res = await page.request.put(
				`/index.php/${journalPath}/api/v1/submissions/${submission.id}/submit`,
				{headers: {'X-Csrf-Token': csrf}, data: {}},
			);
			expect(res.ok()).toBe(false);
			expect(await res.text()).toContain('is not accepting submissions to the');
		},
	);

	// Canonical scenario 8 — a Journal Manager who also holds an Author
	// role: the Submit As choice with the editorial-role hint, Cancel in
	// the footer, completion routing to the editorial workflow, and — the
	// as-built deviation — no acknowledgement email to anyone while the
	// completion screen still claims one was sent.
	test(
		'A Journal Manager submits on someone\'s behalf',
		{tag: '@regression'},
		async ({pkpApi, pkpMail, asUser}) => {
			test.slow(); // scratch journal + full wizard walk + mail
			const tag = uniqueTag('s8');
			const mgr = `mgr${tag}`;
			const mgrEmail = `${mgr}@mailinator.com`;
			const {context} = await pkpApi.createJournal({
				tag,
				sections: [
					{
						abbrev: {en: 'ART'},
						title: {en: 'Articles'},
						abstractsNotRequired: true,
					},
				],
				users: [
					// 'editor' resolves to the "Journal editor" group — a
					// ROLE_ID_MANAGER group WITH first-workflow-stage access
					// (registry/userGroups.xml:18), i.e. a Journal Manager the
					// start form can offer as a submitting role. The plain
					// "Journal manager" group carries no stage assignments, so
					// it never qualifies as a submit-as candidate.
					throwawayUser(mgr, ['editor', 'author'], {
						givenName: 'Mano',
						familyName: 'Manager',
					}),
				],
			});
			const journalPath = context.path;

			const mgrCtx = await asUser(mgr);
			const page = await mgrCtx.newPage();
			const wizard = new SubmissionWizardPage(page, journalPath);
			await wizard.goto();

			// Submit As lists both roles, with the editorial-role hint.
			await expect(page.getByText('Submit As')).toBeVisible();
			await expect(
				page.getByText(
					'Select an editorial role if you want to edit and publish this submission yourself.',
				),
			).toBeVisible();
			const managerRadio = page
				.locator('label', {hasText: 'Journal editor'})
				.first();
			await expect(managerRadio).toBeVisible();
			await expect(
				page.locator('label', {hasText: 'Author'}).first(),
			).toBeVisible();
			await managerRadio.click();

			await wizard.start({title: `On behalf ${tag}`});

			// Managers always see the footer Cancel.
			await expect(wizard.cancelButton).toBeVisible();

			// Complete the wizard (abstract waived; empty contributor list
			// passes as-built — no author entry is created for a
			// manager-role submitter).
			await wizard.expectStep('Upload Files');
			const item = await wizard.uploadFile(PDF);
			await wizard.assignPrimaryGenre(item, 'Article Text');
			await walkTo(wizard, 'Review');
			await awaitReviewCheck(page);
			const dialog = await wizard.openSubmitDialog();
			await expect(dialog).toContainText('will be submitted to');
			await dialog.getByRole('button', {name: 'Submit'}).click();
			await expect(
				page.getByRole('heading', {name: 'Submission complete'}),
			).toBeVisible({timeout: 20_000});

			// "Review this submission" routes to the editorial workflow, not
			// the author tracking view.
			await expect(
				page.getByRole('link', {name: 'Review this submission'}),
			).toHaveAttribute('href', /dashboard\/editorial/);

			// ⚠ As-built: the completion copy still claims an email was sent…
			await expect(
				page.getByText(/emailed a confirmation/),
			).toBeVisible();

			// …but no acknowledgement goes to anyone. The manager's own
			// needs-an-editor email (managers fallback) is the positive
			// control that bounds the negative assertion.
			await pkpMail.find({
				to: mgrEmail,
				contains: tag,
				subject: 'needs an editor',
				timeoutMs: 30_000,
			});
			const tagged = await pkpMail.find({to: mgrEmail, contains: tag});
			for (const message of tagged) {
				expect(message.Subject).not.toMatch(/thank you for your submission/i);
			}
		},
	);

	// Canonical scenario 9 — the copyright agreement: the Review step's
	// Confirmation section quotes the journal's notice; Submit is gated
	// on the checkbox (reversibly); after submitting, the activity log
	// carries the copyright-agreed entry alongside "submission
	// submitted".
	test('Copyright agreement', {tag: '@regression'}, async ({page, pkpApi, asUser}) => {
		test.slow(); // scratch journal + wizard walk + activity log
		const tag = uniqueTag('s9');
		const noticeText = `Authors agree to the ${tag} terms of publication.`;
		const {context} = await pkpApi.createJournal({
			tag,
			copyrightNotice: {en: `<p>${noticeText}</p>`},
			sections: [
				{
					abbrev: {en: 'ART'},
					title: {en: 'Articles'},
					abstractsNotRequired: true,
				},
			],
			users: [{username: 'author.alex', roles: ['author']}],
		});
		const journalPath = context.path;

		const wizard = new SubmissionWizardPage(page, journalPath);
		await wizard.goto();
		await wizard.start({title: `Copyright ${tag}`});
		await wizard.expectStep('Upload Files');
		const item = await wizard.uploadFile(PDF);
		await wizard.assignPrimaryGenre(item, 'Article Text');
		await walkTo(wizard, 'Review');
		await awaitReviewCheck(page);
		const submissionId = wizard.currentSubmissionId();

		// The Confirmation section quotes the notice.
		await expect(
			page.getByText('Please confirm the following before you submit.'),
		).toBeVisible();
		await expect(page.getByText(noticeText)).toBeVisible();
		const agreeBox = page
			.locator('input[name="confirmCopyright"][type="checkbox"]')
			.first();
		await expect(
			page.getByText('Yes, I agree to the copyright statement.'),
		).toBeVisible();

		// Submit is disabled until the box is ticked — and disables again
		// when unticked.
		await expect(wizard.footerSubmit).toBeDisabled();
		await agreeBox.check();
		await expect(wizard.footerSubmit).toBeEnabled();
		await agreeBox.uncheck();
		await expect(wizard.footerSubmit).toBeDisabled();
		await agreeBox.check();

		const dialog = await wizard.openSubmitDialog();
		await dialog.getByRole('button', {name: 'Submit'}).click();
		await expect(
			page.getByRole('heading', {name: 'Submission complete'}),
		).toBeVisible({timeout: 20_000});

		// Activity log: copyright agreed + submission submitted.
		const adminCtx = await asUser('admin');
		const adminPage = await adminCtx.newPage();
		const workflow = new EditorialWorkflowPage(adminPage);
		await workflow.goto(submissionId, {journalPath});
		await expect(
			adminPage.getByRole('heading', {name: 'Workflow: Submission'}),
		).toBeVisible({timeout: 20_000});
		const log = new ActivityLogModal(adminPage);
		await log.openFromWorkflow();
		// OJS overrides submission.event.submissionSubmitted with
		// "Article submitted" (the pkp-lib default is "Initial submission
		// completed.").
		await expect(
			adminPage.getByText('Article submitted').first(),
		).toBeVisible({timeout: 20_000});
		await expect(
			adminPage
				.getByText('agreed to the copyright terms for submission')
				.first(),
		).toBeVisible();
	});

	// Canonical scenario 10 — acknowledgement audience settings: in
	// "all authors" mode the submitter gets the thank-you email, an
	// accountless co-author gets the named-on-a-submission variant, and
	// the journal's copy address is BCC'd; with the setting off, the
	// same flow sends none of them.
	test(
		'Acknowledgement audience settings',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail, asUser}) => {
			test.slow(); // scratch journal + wizard walk + two submissions + mail
			const tag = uniqueTag('s10');
			const tagOff = `${tag}off`;
			const copyEmail = `copyack${tag}@mailinator.com`;
			const coauthorEmail = `coauthor${tag}@mailinator.com`;
			const ctl = `ctl${tag}`; // throwaway manager: mail-control recipient
			const {context} = await pkpApi.createJournal({
				tag,
				sections: [
					{
						abbrev: {en: 'ART'},
						title: {en: 'Articles'},
						abstractsNotRequired: true,
					},
				],
				users: [
					{username: 'author.alex', roles: ['author']},
					throwawayUser(ctl, ['manager'], {
						givenName: 'Cora',
						familyName: 'Control',
					}),
				],
			});
			const journalPath = context.path;

			// The copy address is a settings-form field (not seedable) —
			// set it via the contexts API as the journal's manager (admin).
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			await adminPage.goto(`/index.php/${journalPath}/dashboard/editorial`, {
				waitUntil: 'commit',
			});
			const adminCsrf = await readCsrf(adminPage);
			const setContext = async (data) => {
				const res = await adminPage.request.put(
					`/index.php/${journalPath}/api/v1/contexts/${context.id}`,
					{
						headers: {
							'X-Csrf-Token': adminCsrf,
							'Content-Type': 'application/json',
						},
						data,
					},
				);
				expect(res.ok(), `context settings update: ${res.status()}`).toBe(true);
			};
			await setContext({
				submissionAcknowledgement: 'allAuthors',
				copySubmissionAckAddress: copyEmail,
			});

			// --- Leg A ("all authors"): seed a draft, add the accountless
			//     co-author on the Contributors step, submit. ---
			const {submission: subA} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					title: `Ack on ${tag}`,
					journal: journalPath,
					section: 'ART',
				}),
			);
			const wizard = new SubmissionWizardPage(page, journalPath);
			await page.goto(wizardUrl(subA.id, journalPath));
			await expect(page.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await walkTo(wizard, 'Contributors');
			await wizard.addContributor({
				givenName: 'Coco',
				familyName: 'Coauthor',
				email: coauthorEmail,
			});
			await walkTo(wizard, 'Review');
			await awaitReviewCheck(page);
			const dialogA = await wizard.openSubmitDialog();
			await dialogA.getByRole('button', {name: 'Submit'}).click();
			await expect(
				page.getByRole('heading', {name: 'Submission complete'}),
			).toBeVisible({timeout: 20_000});

			// Submitter: the thank-you email.
			const [ackMail] = await pkpMail.find({
				to: ALEX.email,
				contains: tag,
				subject: 'Thank you for your submission',
				timeoutMs: 30_000,
			});
			// Accountless co-author: the separate variant.
			const [coMail] = await pkpMail.find({
				to: coauthorEmail,
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(coMail, 'co-author receives the other-authors variant').toBeTruthy();
			// The journal's copy address is BCC'd. Mailpit's `to:` SEARCH
			// matches the To header only (verified live — the Bcc'd copy is
			// invisible to `find`), so assert on the ack message's own Bcc
			// envelope instead.
			const bccAddresses = (ackMail.Bcc ?? []).map((b) => b.Address);
			expect(bccAddresses).toContain(copyEmail);

			// --- Leg B (setting off): the same flow sends neither. ---
			await setContext({submissionAcknowledgement: ''});
			const {submission: subB} = await pkpApi.createSubmission(
				draftSpec({
					tag: tagOff,
					title: `Ack off ${tagOff}`,
					journal: journalPath,
					section: 'ART',
				}),
			);
			// Submit the draft through the same server path the wizard's
			// Submit uses (the wizard walk itself is leg A's business).
			await page.goto(`/index.php/${journalPath}/dashboard/mySubmissions`, {
				waitUntil: 'commit',
			});
			const authorCsrf = await readCsrf(page);
			const resB = await page.request.put(
				`/index.php/${journalPath}/api/v1/submissions/${subB.id}/submit`,
				{headers: {'X-Csrf-Token': authorCsrf}, data: {}},
			);
			expect(resB.ok(), `submit B: ${resB.status()} ${await resB.text()}`).toBe(
				true,
			);

			// The needs-an-editor email to a journal manager is the positive
			// control bounding the negative assertion: with the setting off,
			// no acknowledgement reaches the submitter (and with no
			// acknowledgement message at all, there is nothing to BCC — the
			// copy address rides the ack, asserted in leg A).
			await pkpMail.expectNone({
				to: ALEX.email,
				contains: tagOff,
				afterControl: {to: `${ctl}@mailinator.com`, contains: tagOff},
				timeoutMs: 30_000,
			});
		},
	);

	// Canonical scenario 11 — how the editorial team learns of a
	// submission, as built: the section's assigned Section Editor is NOT
	// assigned and hears nothing (SubEditorsDAO keys() bug); instead
	// every Journal Manager gets the editor-assignment task in the Tasks
	// bell plus the needs-an-editor email; a manager who blocked the
	// in-app type keeps the email but loses the bell task.
	test(
		'The editorial team learns of a submission',
		{tag: '@regression'},
		async ({page, pkpApi, pkpMail, asUser}) => {
			test.slow(); // scratch journal + profile edit + multi-actor bells
			const tag = uniqueTag('s11');
			const se = `se${tag}`;
			const mgrOne = `mga${tag}`;
			const mgrTwo = `mgb${tag}`;
			const bellText = 'an editor needs to be assigned';
			const {context} = await pkpApi.createJournal({
				tag,
				sections: [
					{
						abbrev: {en: 'ART'},
						title: {en: 'Articles'},
						abstractsNotRequired: true,
						sectionEditors: [se],
					},
				],
				users: [
					throwawayUser(se, ['sectionEditor'], {
						givenName: 'Sela',
						familyName: 'SectionEditor',
					}),
					throwawayUser(mgrOne, ['manager'], {
						givenName: 'Mira',
						familyName: 'ManagerOne',
					}),
					throwawayUser(mgrTwo, ['manager'], {
						givenName: 'Mona',
						familyName: 'ManagerTwo',
					}),
					{username: 'author.alex', roles: ['author']},
				],
			});
			const journalPath = context.path;

			// mgrTwo blocks the in-app editor-assignment notification type.
			// The in-app checkbox is an "allow" toggle (checked by default;
			// UNchecking blocks), unlike the email checkbox next to it which
			// is a "do not email" toggle — notificationSettingsForm.tpl.
			const mgrTwoCtx = await asUser(mgrTwo);
			const mgrTwoPage = await mgrTwoCtx.newPage();
			const profile = new UserProfilePage(mgrTwoPage, journalPath);
			await profile.goto('notificationSettings');
			await mgrTwoPage
				.locator('#notificationEditorAssignmentRequired')
				.uncheck();
			await profile.save('notificationSettings');

			// The author submits (seeded draft, submitted through the same
			// server path the wizard's Submit uses — the wizard walk itself
			// is scenario 1's business).
			const {submission} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					title: `Team learns ${tag}`,
					journal: journalPath,
					section: 'ART',
				}),
			);
			await page.goto(`/index.php/${journalPath}/dashboard/mySubmissions`, {
				waitUntil: 'commit',
			});
			const csrf = await readCsrf(page);
			const res = await page.request.put(
				`/index.php/${journalPath}/api/v1/submissions/${submission.id}/submit`,
				{headers: {'X-Csrf-Token': csrf}, data: {}},
			);
			expect(res.ok(), `submit: ${res.status()} ${await res.text()}`).toBe(true);

			// Every manager gets the needs-an-editor email…
			await pkpMail.find({
				to: `${mgrOne}@mailinator.com`,
				contains: tag,
				subject: 'needs an editor',
				timeoutMs: 30_000,
			});
			// …including the one who blocked only the in-app type.
			await pkpMail.find({
				to: `${mgrTwo}@mailinator.com`,
				contains: tag,
				subject: 'needs an editor',
				timeoutMs: 30_000,
			});

			// mgrOne's Tasks bell carries the editor-assignment task. (The
			// task text is generic — safe because these managers are
			// throwaway users receiving nothing else.)
			const mgrOneCtx = await asUser(mgrOne);
			const mgrOnePage = await mgrOneCtx.newPage();
			await mgrOnePage.goto(`/index.php/${journalPath}/dashboard/editorial`, {
				waitUntil: 'commit',
			});
			const bellOne = new TasksGridModal(mgrOnePage);
			await expect(bellOne.bellButton).toBeVisible({timeout: 20_000});
			await bellOne.open();
			await expect(bellOne.task(bellText).first()).toBeVisible({
				timeout: 15_000,
			});

			// mgrTwo's bell has no such task (their email above bounds the
			// wait — the in-app notice is written before the email is sent).
			await mgrTwoPage.goto(`/index.php/${journalPath}/dashboard/editorial`, {
				waitUntil: 'commit',
			});
			const bellTwo = new TasksGridModal(mgrTwoPage);
			await expect(bellTwo.bellButton).toBeVisible({timeout: 20_000});
			await bellTwo.open();
			await expect(bellTwo.task(bellText)).toHaveCount(0);

			// ⚠ As-built: the section's assigned Section Editor was NOT
			// auto-assigned (no participant entry) and hears nothing.
			// (Read the roster as mgrOne — the participants endpoint is
			// closed to author-role requesters.)
			const participantsRes = await mgrOnePage.request.get(
				`/index.php/${journalPath}/api/v1/submissions/${submission.id}/participants`,
			);
			expect(participantsRes.ok()).toBe(true);
			const participants = await participantsRes.json();
			const usernames = (Array.isArray(participants) ? participants : [])
				.map((p) => p.userName ?? p.username)
				.filter(Boolean);
			expect(usernames).not.toContain(se);
			await pkpMail.expectNone({
				to: `${se}@mailinator.com`,
				contains: tag,
				afterControl: {to: `${mgrOne}@mailinator.com`, contains: tag},
				timeoutMs: 30_000,
			});
		},
	);

	// Canonical scenario 12 — submitted means submitted: the wizard
	// address permanently shows "Submission complete" with its three
	// next-step links (the author's "Review this submission" points at
	// the My Submissions tracking view), and a repeat submit is refused
	// with a pointer to the dashboard.
	test('Submitted means submitted', {tag: '@regression'}, async ({page, pkpApi}) => {
		const tag = uniqueTag('s12');
		const {submission} = await pkpApi.createSubmission({
			tag,
			journal: 'publicknowledge',
			submitter: 'author.alex',
			section: 'ART',
			locale: 'en',
			submitted: true,
			publications: [{metadata: {title: {en: `Done deal ${tag}`}}}],
		});

		// The wizard address shows the completion screen, not the steps.
		await page.goto(wizardUrl(submission.id));
		await expect(
			page.getByRole('heading', {name: 'Submission complete'}),
		).toBeVisible({timeout: 20_000});
		await expect(page.locator('.submissionWizard')).toHaveCount(0);
		await expect(
			page.getByRole('link', {name: 'Review this submission'}),
		).toHaveAttribute('href', /dashboard\/mySubmissions/);
		await expect(
			page.getByRole('link', {name: 'Create a new submission'}),
		).toBeVisible();
		await expect(
			page.getByRole('link', {name: 'Return to your dashboard'}),
		).toBeVisible();

		// A repeat submit is refused, pointing at the dashboard.
		const csrf = await readCsrf(page);
		const res = await page.request.put(
			`/index.php/publicknowledge/api/v1/submissions/${submission.id}/submit`,
			{headers: {'X-Csrf-Token': csrf}, data: {}},
		);
		expect(res.ok()).toBe(false);
		const body = await res.text();
		expect(body).toContain('This submission has already been submitted');
		expect(body).toContain('dashboard');
	});
});

/**
 * Scenario 5's cancel: drive the footer Cancel and assert the full
 * warning copy (the POM's cancel() checks the second sentence only),
 * then wait for the "Submission cancelled" landing page.
 */
async function wizard5Cancel(page) {
	await page.locator('#cancelSubmission').click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({timeout: 10_000});
	await expect(dialog).toContainText(
		'Are you sure you wish to cancel this submission?',
	);
	await expect(dialog).toContainText(
		'This will delete the submission and all associated data. This action cannot be undone.',
	);
	await dialog.getByRole('button', {name: 'OK'}).click();
	await expect(
		page.getByRole('heading', {name: 'Submission cancelled'}),
	).toBeVisible({timeout: 20_000});
}
