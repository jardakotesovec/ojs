// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {SectionsSettingsPage} = require('../pages/SectionsSettingsPage.js');
const {
	SubmissionWizardPage,
} = require('../../lib/pkp/playwright/pages/SubmissionWizardPage.js');
const {
	ReviewerManagerPage,
} = require('../../lib/pkp/playwright/pages/ReviewerManagerPage.js');

/**
 * Sections (the journal's content taxonomy) — one test per canonical
 * scenario of docs/product/specs/sections.md (8 scenarios → 8 tests).
 *
 * The management surface is a LEGACY pkp jQuery grid (SectionGridHandler,
 * loaded via load_url_in_div into the Vue Settings shell — NO Vue manager
 * exists). Every mutation goes through the grid's server-rendered fbv
 * AjaxModal (form#sectionForm) or the row-level confirm actions, driven
 * through the SectionsSettingsPage POM. Downstream projections are read
 * where users read them: the submission wizard's start form / Details
 * step / Review gate, the anonymous reader's issue TOC + article landing
 * page, and the editor's Add Reviewer panel.
 *
 * Parallel-safety: EVERY mutation runs on a per-test scratch journal
 * (unique `sect…` tag = urlPath) — the publicknowledge sections
 * ("Articles"/"Reviews") are load-bearing across the wizard/TOC suites
 * and are only ever READ here (scenario 1's permission probe). No toast
 * assertions (the trivial-notification queue is shared per-user across
 * parallel workers); guard outcomes are asserted on grid/server state.
 * No hard-coded waits: web-first assertions, the POM's jQuery-idle +
 * response anchors, and REST polls for wizard autosaves.
 *
 * AS-BUILT realities pinned here (assert reality, not intent):
 *   - ⚠ ROW 135 (test 7): section-editor auto-assignment is DEAD on any
 *     journal whose user-group ids exceed its group count — i.e. every
 *     scratch journal (and every 2nd+ journal of a real install).
 *     SubEditorsDAO::assignEditors() filters against $userGroups->keys()
 *     (collection indexes 0…n−1) instead of the group ids, silently
 *     dropping every assignment. The test configures a section editor
 *     through the grid, seeds a real submit (which fires AssignEditors),
 *     and asserts the editor is NOT assigned + the submission falls into
 *     the managers' "Needs editor" view. The positive control lives on
 *     publicknowledge only (spec author's probe — not re-seeded here).
 *   - Rows 136/137 (metaIndexed/metaReviewed inert; delete orphans
 *     subeditor rows) are not scenario surfaces — not driven.
 */

/** Unique hyphenless alphanumeric tag; doubles as the scratch urlPath (≤32). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `sect${workerIndex}x${suffix}`;
}

/** A fresh anonymous browser context (test.use({user}) otherwise leaks in). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/** Bare reader/backend base for a single-locale scratch journal. */
function base(path) {
	return `/index.php/${path}`;
}

/**
 * Create a single-locale scratch journal. dbarnes is always seeded as
 * manager (grid + API access); extra users/sections/issues via overrides.
 */
async function createJournal(pkpApi, tag, overrides = {}) {
	const spec = {
		tag,
		path: tag,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users: [{username: 'dbarnes', roles: ['manager']}],
		...overrides,
	};
	const res = await pkpApi.createJournal(spec);
	return res.context.path;
}

/**
 * A VoR submission published into an already-published issue → appears
 * on that issue's reader TOC. atester authors, dbarnes edits.
 */
function publishedIntoIssueSpec({tag, title, journal, section, volume, number, year}) {
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
			{
				versionStage: 'VoR',
				metadata: {title: {en: title}},
				issue: {volume, number, year},
				published: true,
			},
		],
	};
}

/**
 * The wizard start form's section chooser (FieldOptions radios named
 * sectionId). Returns the option labels in DOM order — the order the
 * global section sequence projects into the wizard (rule 3).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function sectionChooserLabels(page) {
	const chooser = page.locator('fieldset.pkpFormField--options', {
		has: page.locator('input[name="sectionId"]'),
	});
	const options = chooser.locator('label.pkpFormField--options__option');
	return (await options.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
}

/** Wait for the wizard start form to be ready (Begin Submission rendered). */
async function awaitStartForm(page) {
	await expect(
		page.getByRole('button', {name: 'Begin Submission'}),
	).toBeVisible({timeout: 20_000});
}

/**
 * CSRF token of a logged-in backend page (no /_csrf API route exists).
 *
 * @param {import('@playwright/test').Page} page
 */
async function csrfToken(page) {
	await page.waitForFunction(
		() =>
			!!window.pkp?.currentUser?.csrfToken ||
			!!document.querySelector('meta[name="csrf-token"]'),
		null,
		{timeout: 15_000},
	);
	return page.evaluate(
		() =>
			window.pkp?.currentUser?.csrfToken ||
			document
				.querySelector('meta[name="csrf-token"]')
				?.getAttribute('content'),
	);
}

/**
 * The submission's current publication via REST (the page's session) —
 * the deterministic "autosave has landed" anchor before the wizard's
 * Review step validates stored state.
 */
async function fetchCurrentPublication(page, submissionId, journalPath) {
	const subRes = await page.request.get(
		`${base(journalPath)}/api/v1/submissions/${submissionId}`,
	);
	if (!subRes.ok()) return null;
	const sub = await subRes.json();
	if (!sub.currentPublicationId) return null;
	const pubRes = await page.request.get(
		`${base(journalPath)}/api/v1/submissions/${submissionId}/publications/${sub.currentPublicationId}`,
	);
	if (!pubRes.ok()) return null;
	return await pubRes.json();
}

/**
 * Stage-1 participant usernames of a submission (manager session).
 * Closes the loop on row 135: who actually got stage-assigned on submit.
 */
async function stage1ParticipantUsernames(page, submissionId, journalPath) {
	const res = await page.request.get(
		`${base(journalPath)}/api/v1/submissions/${submissionId}/participants/1`,
	);
	if (!res.ok()) {
		throw new Error(
			`GET participants failed: ${res.status()} ${await res.text()}`,
		);
	}
	const users = await res.json();
	return users.map((u) => u.userName);
}

test.use({user: 'dbarnes'}); // default actor: journal manager

test.describe('Sections', () => {
	// Canonical scenario 1 — Manage sections from Settings → Journal.
	// The manager creates "Probe Created" (title + abbreviation) in the
	// grid's AjaxModal; it is APPENDED LAST (rule 2) with Editors "None"
	// (rule 1); an edit renames it in place. The whole surface is
	// manager/site-admin only: a section editor is bounced from the
	// settings page (authorizationDenied) and the grid handler itself
	// refuses the fetch-grid op (spec footnote a) — probed READ-ONLY on
	// publicknowledge.
	test(
		'manager creates and edits a section; section editor is denied',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const path = await createJournal(pkpApi, tag);
			const created = `Probe Created ${tag}`;
			const edited = `Probe Edited ${tag}`;

			const sections = new SectionsSettingsPage(page, path);
			await sections.goto();

			// Scratch journals start with the default "Articles" (rule 15).
			expect(await sections.rowTitlesInOrder()).toEqual(['Articles']);

			// Create: title + abbreviation are the only required fields.
			const addForm = await sections.openAddForm();
			await addForm.locator('input[name="title[en]"]').fill(created);
			await addForm.locator('input[name="abbrev[en]"]').fill('PC');
			await sections.saveForm();

			// Appended last, Editors column "None" (td order: title ·
			// editors · inactive).
			const titles = await sections.rowTitlesInOrder();
			expect(titles[titles.length - 1]).toBe(created);
			await expect(
				sections.rowByTitle(created).first().locator('td').nth(1),
			).toHaveText('None');
			await expect(sections.inactiveCheckbox(created)).not.toBeChecked();

			// Edit: the modal round-trips the stored title; renaming
			// replaces the row in place.
			const editForm = await sections.openEditForm(created);
			await expect(editForm.locator('input[name="title[en]"]')).toHaveValue(
				created,
			);
			await editForm.locator('input[name="title[en]"]').fill(edited);
			await sections.saveForm();
			await expect(sections.rowByTitle(edited).first()).toBeVisible();
			await expect(sections.rowByTitle(created)).toHaveCount(0);

			// Permission boundary (read-only, on publicknowledge): dbuskins
			// (section editor) is bounced from the settings page…
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.newPage();
			await sePage.goto(
				'/index.php/publicknowledge/management/settings/context',
			);
			await expect(sePage).toHaveURL(/authorizationDenied|accessDenied/i);

			// …and the grid handler's own authorize() refuses him, while the
			// manager passes (JSONMessage verdicts off the component router).
			const gridUrl =
				'/index.php/publicknowledge/$$$call$$$/grid/settings/sections/section-grid/fetch-grid';
			const managerJson = await (await page.request.get(gridUrl)).json();
			expect(managerJson.status).toBe(true);
			const seJson = await (await seCtx.request.get(gridUrl)).json();
			expect(seJson.status).toBe(false);
			expect(JSON.stringify(seJson)).toContain(
				'The current role does not have access to this operation.',
			);
		},
	);

	// Canonical scenario 2 — Section order and display flags drive the
	// reader TOC. Two sections with one published article each: the TOC
	// groups one heading-block per section in global sequence order; the
	// manager drags a new order (Order → drag → Done) and the TOC AND the
	// wizard's section chooser follow (rule 3); ticking "Omit the
	// title…" / "Omit author names…" on one section removes its heading
	// and author lines from the TOC while the article landing page still
	// names the section (rule 12).
	test(
		'section order and display flags drive the reader TOC and wizard',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow(); // 2 published seeds + drag-ordering + 2 anon reads
			const tag = uniqueTag();
			const issue = {volume: 1, number: 1, year: 2030};
			const path = await createJournal(pkpApi, tag, {
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				sections: [
					{abbrev: {en: 'ART'}, title: {en: 'Articles'}},
					{abbrev: {en: 'REV'}, title: {en: 'Reviews'}},
				],
				issues: [{...issue, published: true}],
			});
			const artTitle = `Articles paper ${tag}`;
			const revTitle = `Reviews paper ${tag}`;
			await pkpApi.createSubmission(
				publishedIntoIssueSpec({
					tag: `${tag}a`,
					title: artTitle,
					journal: path,
					section: 'ART',
					...issue,
				}),
			);
			await pkpApi.createSubmission(
				publishedIntoIssueSpec({
					tag: `${tag}r`,
					title: revTitle,
					journal: path,
					section: 'REV',
					...issue,
				}),
			);

			const anon = await newAnonContext(browser, baseURL);
			try {
				// BEFORE: the TOC groups one block per section, each holding
				// only its own article. NO order claim yet: seeded sections
				// carry TIED sequence values, which render in undefined
				// order until reordered (spec rule 3's caveat / OQ 4).
				const reader = await anon.newPage();
				await reader.goto(`${base(path)}/issue/current`);
				const toc = reader.locator('.obj_issue_toc');
				await expect(toc).toBeVisible();
				const artBlockBefore = toc
					.locator('.sections .section')
					.filter({has: reader.getByRole('link', {name: artTitle})});
				await expect(
					artBlockBefore.getByRole('heading', {name: 'Articles', exact: true}),
				).toBeVisible();
				await expect(
					artBlockBefore.getByRole('link', {name: revTitle}),
				).toHaveCount(0);
				const revBlockBefore = toc
					.locator('.sections .section')
					.filter({has: reader.getByRole('link', {name: revTitle})});
				await expect(
					revBlockBefore.getByRole('heading', {name: 'Reviews', exact: true}),
				).toBeVisible();
				await expect(
					revBlockBefore.getByRole('link', {name: artTitle}),
				).toHaveCount(0);

				// Manager drags the currently-second section above the first
				// (Order → drag → Done) — an explicit order that supersedes
				// the tied seeds. jQuery-UI sortable drags can be swallowed
				// under parallel load — retry the whole order-mode cycle
				// until the grid shows the new order.
				const sections = new SectionsSettingsPage(page, path);
				await sections.goto();
				const [initialFirst, initialSecond] =
					await sections.rowTitlesInOrder();
				const newOrder = [initialSecond, initialFirst];
				await expect(async () => {
					if ((await sections.rowTitlesInOrder())[0] !== initialSecond) {
						await sections.startOrdering();
						await sections.dragRowAbove(
							sections.rowByTitle(initialSecond).first(),
							sections.rowByTitle(initialFirst).first(),
						);
						await sections.finishOrdering();
					}
					expect((await sections.rowTitlesInOrder())[0]).toBe(
						initialSecond,
					);
				}).toPass({timeout: 60_000});

				// The wizard's section chooser follows the new global order…
				await page.goto(`${base(path)}/submission`);
				await awaitStartForm(page);
				const chooser = await sectionChooserLabels(page);
				expect(chooser).toHaveLength(2);
				expect(chooser[0]).toContain(newOrder[0]);
				expect(chooser[1]).toContain(newOrder[1]);

				// …and so does the reader TOC.
				await reader.goto(`${base(path)}/issue/current`);
				const headingsAfter = await toc
					.locator('.sections .section h2')
					.allInnerTexts();
				expect(headingsAfter.map((h) => h.trim())).toEqual(newOrder);

				// Tick both TOC display flags on Reviews.
				await sections.goto();
				const editForm = await sections.openEditForm('Reviews');
				await editForm.locator('input#hideTitle').check();
				await editForm.locator('input#hideAuthor').check();
				await sections.saveForm();

				// TOC: the Reviews heading is gone, its article is still
				// listed WITHOUT an author line; the Articles block keeps
				// heading + author line.
				await reader.goto(`${base(path)}/issue/current`);
				await expect(toc).toBeVisible();
				await expect(
					toc.getByRole('heading', {name: 'Reviews', exact: true}),
				).toHaveCount(0);
				await expect(
					toc.getByRole('heading', {name: 'Articles', exact: true}),
				).toBeVisible();
				const revBlock = toc
					.locator('.sections .section')
					.filter({has: reader.getByRole('link', {name: revTitle})});
				await expect(
					revBlock.getByRole('link', {name: revTitle}),
				).toBeVisible();
				await expect(revBlock.locator('.authors')).toHaveCount(0);
				const artBlock = toc
					.locator('.sections .section')
					.filter({has: reader.getByRole('link', {name: artTitle})});
				await expect(artBlock.locator('.authors')).toContainText(
					'Author Tester',
				);

				// The article landing page still names the section (the
				// flags are TOC-only).
				await reader
					.getByRole('link', {name: revTitle})
					.click();
				const sectionItem = reader
					.locator('.item.issue .sub_item')
					.filter({hasText: 'Section'});
				await expect(sectionItem).toContainText('Reviews');
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 3 — Editor-restricted section. The author's
	// wizard offers only the unrestricted sections; the manager's wizard
	// shows the restricted one too (rule 8); a hand-crafted POST naming
	// the restricted section as the author is rejected server-side
	// regardless of what the client sends.
	test(
		'editor-restricted section is hidden from authors and rejected server-side',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const restricted = `Editors Only ${tag}`;
			const path = await createJournal(pkpApi, tag, {
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				sections: [
					{abbrev: {en: 'OPA'}, title: {en: 'Open Alpha'}},
					{abbrev: {en: 'OPB'}, title: {en: 'Open Beta'}},
					{
						abbrev: {en: 'RES'},
						title: {en: restricted},
						editorRestricted: true,
					},
				],
			});

			// The author's start form offers ONLY the two open sections.
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(`${base(path)}/submission`);
			await awaitStartForm(authorPage);
			const authorChoices = await sectionChooserLabels(authorPage);
			expect(authorChoices).toHaveLength(2);
			expect(authorChoices.join(' ')).toContain('Open Alpha');
			expect(authorChoices.join(' ')).toContain('Open Beta');
			expect(authorChoices.join(' ')).not.toContain(restricted);

			// The manager's start form shows the restricted one too.
			await page.goto(`${base(path)}/submission`);
			await awaitStartForm(page);
			const managerChoices = await sectionChooserLabels(page);
			expect(managerChoices).toHaveLength(3);
			expect(managerChoices.join(' ')).toContain(restricted);

			// Server-side reject: resolve the restricted section's id (as
			// the manager), then POST a submission naming it as the author.
			const secRes = await page.request.get(
				`${base(path)}/api/v1/sections?count=100`,
			);
			expect(secRes.ok()).toBeTruthy();
			const restrictedSection = (await secRes.json()).items.find(
				(s) => s.title?.en === restricted,
			);
			expect(restrictedSection).toBeTruthy();

			const csrf = await csrfToken(authorPage);
			const postRes = await authorCtx.request.post(
				`${base(path)}/api/v1/submissions`,
				{
					headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
					data: {
						sectionId: restrictedSection.id,
						locale: 'en',
					},
				},
			);
			expect(postRes.status()).toBe(400);
			expect(await postRes.text()).toContain(
				'Only editorial staff are allowed to submit to this section.',
			);
		},
	);

	// Canonical scenario 4 — Deactivate and reactivate. Deactivating a
	// section (grid checkbox + confirm) removes it from EVERY wizard
	// (editors included); the author resuming a draft in it lands on
	// "Section Closed"; its published article stays on the TOC (rule 5);
	// deactivating the LAST active section is refused (rule 6 — asserted
	// on grid/server state, not the shared toast queue); unticking
	// reactivates and the section returns to the wizard.
	test(
		'deactivate closes the section to new submissions only; last-active guard; reactivate',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL, asUser}) => {
			test.slow(); // published seed + draft + 3 toggle round-trips
			const tag = uniqueTag();
			const issue = {volume: 1, number: 1, year: 2031};
			const path = await createJournal(pkpApi, tag, {
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				sections: [
					{abbrev: {en: 'KPR'}, title: {en: 'Keeper'}},
					{abbrev: {en: 'CLS'}, title: {en: 'Closing'}},
				],
				issues: [{...issue, published: true}],
			});
			const publishedTitle = `Closing published ${tag}`;
			await pkpApi.createSubmission(
				publishedIntoIssueSpec({
					tag: `${tag}p`,
					title: publishedTitle,
					journal: path,
					section: 'CLS',
					...issue,
				}),
			);
			const {submission: draft} = await pkpApi.createSubmission({
				tag: `${tag}d`,
				journal: path,
				submitter: 'atester',
				section: 'CLS',
				locale: 'en',
				submitted: false,
				participants: [],
				publications: [{metadata: {title: {en: `Closing draft ${tag}`}}}],
			});

			// Both sections active → the wizard shows a 2-option chooser.
			await page.goto(`${base(path)}/submission`);
			await awaitStartForm(page);
			expect((await sectionChooserLabels(page)).join(' ')).toContain(
				'Closing',
			);

			// Deactivate Closing (confirm dialog) — checkbox flips checked.
			const sections = new SectionsSettingsPage(page, path);
			await sections.goto();
			await expect(sections.inactiveCheckbox('Closing')).not.toBeChecked();
			await sections.toggleInactive('Closing');
			await expect(sections.inactiveCheckbox('Closing')).toBeChecked({
				timeout: 15_000,
			});

			// Gone from the wizard for EVERYONE — the manager's start form
			// now has exactly one eligible section, so no chooser renders at
			// all (rule 9; the lone section rides along as a HIDDEN input).
			await page.goto(`${base(path)}/submission`);
			await awaitStartForm(page);
			await expect(
				page.locator('input[name="sectionId"][type="radio"]'),
			).toHaveCount(0);
			await expect(page.getByText('Closing')).toHaveCount(0);

			// The author resuming the draft lands on "Section Closed".
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(`${base(path)}/submission?id=${draft.id}`);
			await expect(
				authorPage.getByRole('heading', {name: 'Section Closed'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				authorPage.getByText(
					'is not accepting submissions to the Closing section',
				),
			).toBeVisible();

			// The already-published article is untouched on the reader TOC.
			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				await reader.goto(`${base(path)}/issue/current`);
				await expect(
					reader.getByRole('link', {name: publishedTitle}),
				).toBeVisible();
			} finally {
				await anon.close();
			}

			// Last-active guard: deactivating Keeper is refused — the grid
			// refresh leaves the checkbox unchecked (state assertion; the
			// error toast queue is shared across parallel workers). A
			// reload double-checks the persisted state.
			await sections.goto();
			await sections.toggleInactive('Keeper');
			await expect(sections.inactiveCheckbox('Keeper')).not.toBeChecked({
				timeout: 15_000,
			});
			await sections.goto();
			await expect(sections.inactiveCheckbox('Keeper')).not.toBeChecked();

			// Reactivate Closing — it returns to the wizard chooser.
			await sections.toggleInactive('Closing');
			await expect(sections.inactiveCheckbox('Closing')).not.toBeChecked({
				timeout: 15_000,
			});
			await page.goto(`${base(path)}/submission`);
			await awaitStartForm(page);
			const reactivated = await sectionChooserLabels(page);
			expect(reactivated).toHaveLength(2);
			expect(reactivated.join(' ')).toContain('Closing');
		},
	);

	// Canonical scenario 5 — Delete guards. ANY submission pointing at a
	// section — even an incomplete wizard draft — blocks deletion (rule
	// 7; the row survives the confirmed delete round-trip); an empty
	// (inactive) section deletes after the "Are you sure…" confirm and
	// its row disappears.
	test(
		'delete is refused for a section with a draft; an empty inactive section deletes',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const path = await createJournal(pkpApi, tag, {
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				sections: [
					{abbrev: {en: 'KPR'}, title: {en: 'Keeper'}},
					{abbrev: {en: 'DMD'}, title: {en: 'Doomed'}},
				],
			});
			// The incomplete draft that blocks the delete.
			await pkpApi.createSubmission({
				tag: `${tag}d`,
				journal: path,
				submitter: 'atester',
				section: 'DMD',
				locale: 'en',
				submitted: false,
				participants: [],
				publications: [{metadata: {title: {en: `Doomed draft ${tag}`}}}],
			});

			const sections = new SectionsSettingsPage(page, path);
			await sections.goto();

			// Refused: the confirmed delete round-trips but the row stays.
			await sections.deleteSection('Doomed');
			await expect(sections.rowByTitle('Doomed').first()).toBeVisible();

			// An empty section: created through the grid, made inactive,
			// then deleted — the row disappears.
			const disposable = `Disposable ${tag}`;
			const addForm = await sections.openAddForm();
			await addForm.locator('input[name="title[en]"]').fill(disposable);
			await addForm.locator('input[name="abbrev[en]"]').fill('DSP');
			await sections.saveForm();
			await expect(sections.rowByTitle(disposable).first()).toBeVisible();

			await sections.toggleInactive(disposable);
			await expect(sections.inactiveCheckbox(disposable)).toBeChecked({
				timeout: 15_000,
			});

			await sections.deleteSection(disposable);
			await expect(sections.rowByTitle(disposable)).toHaveCount(0, {
				timeout: 15_000,
			});
			// The blocked section is still listed (nothing else was deleted).
			await expect(sections.rowByTitle('Doomed').first()).toBeVisible();
		},
	);

	// Canonical scenario 6 — Section abstract policy in the wizard (rule
	// 10). In a 20-word-limit section the Details step marks Abstract
	// required and shows the live "Word Count: 25/20" counter on an
	// over-long abstract; the Review step blocks Submit with "The
	// abstract is too long…". Switching the draft (Change → other
	// section) to a "Do not require abstracts" section drops the
	// requirement and the counter and clears the error.
	test(
		'abstract word limit blocks Submit; switching section clears it',
		{tag: ['@smoke', '@regression']},
		async ({pkpApi, asUser}) => {
			test.slow(); // full wizard walk ×2 around a section switch
			const tag = uniqueTag();
			const strict = 'Strict Limit';
			const lax = 'No Abstract Needed';
			const path = await createJournal(pkpApi, tag, {
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				sections: [
					{abbrev: {en: 'STR'}, title: {en: strict}, wordCount: 20},
					{
						abbrev: {en: 'LAX'},
						title: {en: lax},
						abstractsNotRequired: true,
					},
				],
			});

			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const wizard = new SubmissionWizardPage(authorPage, path);
			await wizard.goto();
			await wizard.start({title: `Wordy ${tag}`, section: strict});
			const submissionId = wizard.currentSubmissionId();
			expect(submissionId).toBeTruthy();

			// 25 words, the tag being one of them (the autosave anchor).
			const words = [tag];
			for (let i = 1; i < 25; i++) words.push(`lexeme${i}`);
			const overLongAbstract = words.join(' ');

			// Details: the Strict section requires an abstract and caps it
			// at 20 words — the live counter reads 25/20 once filled.
			await wizard.expectStep('Upload Files');
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await expect(
				wizard.detailsFieldRequiredMarker('abstract', 'en'),
			).toBeVisible();
			await wizard.setDetailsField('abstract', overLongAbstract);
			const abstractField = authorPage.locator('.pkpFormField', {
				has: authorPage.locator('#titleAbstract-abstract-control-en'),
			});
			await expect(
				abstractField.locator('.pkpFormField--richTextarea__wordLimit'),
			).toContainText('Word Count: 25/20');

			// Anchor the autosave, then walk to Review: the entry
			// validation paints the banner + the word-count error and
			// disables Submit (the hard block).
			await wizard.continueStep();
			await wizard.expectStep('Contributors');
			await expect
				.poll(
					async () =>
						(await fetchCurrentPublication(authorPage, submissionId, path))
							?.abstract?.en ?? '',
					{timeout: 20_000},
				)
				.toContain(tag);
			await wizard.continueStep();
			await wizard.expectStep('For the Editors');
			await wizard.continueStep();
			await wizard.expectStep('Review');
			await expect(wizard.reviewErrorsBanner).toBeVisible({timeout: 20_000});
			// (The message also paints into the banner's jump button and
			// the Details step's hidden field error — assert the visible
			// instance on the Review panel's Abstract item.)
			await expect(
				wizard
					.reviewPanelItem(/^Details/, 'Abstract')
					.getByText(
						'The abstract is too long. It should be 20 words or less. It is currently 25 words long.',
					)
					.first(),
			).toBeVisible();
			await expect(wizard.footerSubmit).toBeDisabled();

			// Change → the "Do not require abstracts" section.
			await wizard.openReconfigureModal();
			await wizard.changeReconfigureSettings({sectionLabel: lax});
			await expect(wizard.submittingToCaption).toContainText(lax, {
				timeout: 20_000,
			});

			// Remount deterministically and re-walk: the requirement and
			// the counter are gone from Details…
			await authorPage.goto(`${base(path)}/submission?id=${submissionId}`);
			await expect(authorPage.locator('.submissionWizard')).toBeVisible({
				timeout: 20_000,
			});
			await wizard.expectStep('Upload Files');
			await wizard.continueStep();
			await wizard.expectStep('Details');
			await expect(
				authorPage.locator('#titleAbstract-abstract-control-en'),
			).toBeAttached({timeout: 15_000});
			await expect(
				wizard.detailsFieldRequiredMarker('abstract', 'en'),
			).toHaveCount(0);
			await expect(
				abstractField.locator('.pkpFormField--richTextarea__wordLimit'),
			).toHaveCount(0);

			// …and Review no longer reports the abstract error (the still
			// 25-word abstract is fine in the lax section). Only the
			// missing-file error could remain — none: no file was needed to
			// probe the abstract gate, so assert the specific error is gone.
			await wizard.continueStep();
			await wizard.expectStep('Contributors');
			await wizard.continueStep();
			await wizard.expectStep('For the Editors');
			await wizard.continueStep();
			await wizard.expectStep('Review');
			await expect(
				authorPage.getByText('The abstract is too long', {exact: false}),
			).toHaveCount(0, {timeout: 20_000});
		},
	);

	// Canonical scenario 7 — Section editors route new submissions.
	// ⚠ ROW 135, AS-BUILT: on a scratch journal (user-group ids > group
	// count — every journal after an install's first) the auto-assignment
	// is SILENTLY DEAD: the manager configures a section editor through
	// the grid (persisted — Editors column), a real submit fires
	// AssignEditors, and the editor is NOT assigned; the submission falls
	// into the managers' "Needs editor" view and the section editor's
	// "Assigned to me" stays empty. The positive control (assignment DOES
	// work on the install's FIRST journal, group ids ≤ 17) lives on
	// publicknowledge and is not re-seeded here. When the keys()→ids bug
	// is fixed this test MUST be flipped to the intended behavior.
	test(
		'configured section editor is NOT auto-assigned on a scratch journal (row 135)',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const path = await createJournal(pkpApi, tag, {
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'minoue', roles: ['sectionEditor']},
					{username: 'atester', roles: ['author']},
				],
			});

			// The manager ticks "Assign Minoti Inoue as Section editor" on
			// the default Articles section.
			const sections = new SectionsSettingsPage(page, path);
			await sections.goto();
			const editForm = await sections.openEditForm('Articles');
			const assignCheckbox = editForm
				.locator('label', {
					hasText: 'Assign Minoti Inoue as Section editor',
				})
				.locator('input[type="checkbox"]');
			await expect(assignCheckbox).not.toBeChecked();
			await assignCheckbox.check();
			await sections.saveForm();

			// Persisted: the grid's Editors column now names her (rule 1).
			await expect(
				sections.rowByTitle('Articles').first().locator('td').nth(1),
			).toHaveText('Minoti Inoue');

			// A real submit to Articles — `submitted: true` runs
			// Repo::submission()->submit(), which fires the AssignEditors
			// listener (the row-135 code path).
			const title = `Routing probe ${tag}`;
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				submitted: true,
				participants: [],
				publications: [{metadata: {title: {en: title}}}],
			});

			// AS-BUILT (row 135): the configured section editor was NOT
			// stage-assigned — only the submitting author holds a stage
			// assignment.
			const usernames = await stage1ParticipantUsernames(
				page,
				submission.id,
				path,
			);
			expect(usernames).toContain('atester');
			expect(usernames).not.toContain('minoue');

			// The manager gets the editor-assignment-required fallback: the
			// submission lands in the journal's "Needs editor" dashboard
			// view (counts are deterministic on a per-test journal).
			await page.goto(
				`${base(path)}/dashboard/editorial?currentViewId=needs-editor`,
			);
			await expect(
				page.getByRole('heading', {name: /Needs editor \(1\)/}),
			).toBeVisible({timeout: 20_000});
			await expect(
				page.getByRole('row').filter({hasText: title}).first(),
			).toBeVisible();

			// And the section editor's "Assigned to me" on this journal is
			// empty — she never sees the submission (the scratch journal is
			// per-test, so the zero count is deterministic).
			const seCtx = await asUser('minoue');
			const sePage = await seCtx.newPage();
			await sePage.goto(
				`${base(path)}/dashboard/editorial?currentViewId=assigned-to-me`,
			);
			await expect(
				sePage.getByRole('heading', {name: /Assigned to me \(0\)/}),
			).toBeVisible({timeout: 20_000});
			await expect(
				sePage.getByRole('row').filter({hasText: title}),
			).toHaveCount(0);
		},
	);

	// Canonical scenario 8 — Per-section default review form (rule 11).
	// The manager picks an active review form as the section's Review
	// Form; when an editor assigns a reviewer to a submission in that
	// section, the Add Reviewer panel PRE-SELECTS that form — still
	// switchable to "None / Free Form Review".
	test(
		'section default review form is preselected at reviewer assignment',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // review seed + legacy grid + Add Reviewer modal
			const tag = uniqueTag();
			const formTitle = `Sec Default RF ${tag}`;
			const res = await pkpApi.createJournal({
				tag,
				path: tag,
				primaryLocale: 'en',
				supportedLocales: ['en'],
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'jjanssen', roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
				reviewForms: [
					{
						title: formTitle,
						elements: [
							{type: 'textarea', question: `Assessment ${tag}`},
						],
					},
				],
			});
			const path = res.context.path;
			const reviewFormId = res.reviewForms?.[0]?.id;
			expect(reviewFormId, 'seeded review form id').toBeTruthy();

			// The manager points Articles at the active review form. The
			// dropdown only renders because the journal has an active form.
			const sections = new SectionsSettingsPage(page, path);
			await sections.goto();
			const editForm = await sections.openEditForm('Articles');
			const select = editForm.locator('select[name="reviewFormId"]');
			await expect(select).toBeVisible();
			await select.selectOption({label: formTitle});
			await sections.saveForm();

			// Persisted: re-open the modal and the pointer round-trips.
			const reopened = await sections.openEditForm('Articles');
			await expect(
				reopened.locator('select[name="reviewFormId"]'),
			).toHaveValue(String(reviewFormId));

			// A submission in review in that section, dbarnes deciding.
			const {submission} = await pkpApi.createSubmission({
				tag,
				journal: path,
				submitter: 'atester',
				section: 'ART',
				locale: 'en',
				participants: [{user: 'dbarnes', role: 'editor'}],
				decisions: [{type: 'sendExternalReview', by: 'dbarnes'}],
				reviewRounds: [{reviewers: []}],
				publications: [{metadata: {title: {en: `RF routing ${tag}`}}}],
			});

			// Add Reviewer: after picking the reviewer, the assignment
			// form's Review Form dropdown is PRE-SELECTED to the section's
			// default…
			const rm = new ReviewerManagerPage(page);
			await rm.gotoWorkflow(submission.id, {journalPath: path});
			const modal = await rm.openAddReviewerModal();
			await rm.searchSelectPanel(modal, 'jjanssen');
			await rm.selectReviewer(modal, 'Julie Janssen');
			const reviewFormSelect = modal
				.locator('select[name="reviewFormId"]')
				.last();
			await expect(reviewFormSelect).toBeVisible({timeout: 15_000});
			await expect(reviewFormSelect).toHaveValue(String(reviewFormId));

			// …and still switchable to "None / Free Form Review".
			const optionLabels = await reviewFormSelect
				.locator('option')
				.allTextContents();
			expect(optionLabels).toContain('None / Free Form Review');
			await reviewFormSelect.selectOption({label: 'None / Free Form Review'});
			await expect(reviewFormSelect).not.toHaveValue(String(reviewFormId));
		},
	);
});
