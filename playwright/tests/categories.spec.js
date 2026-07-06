// @ts-check
const path = require('path');
const {test, expect} = require('../support/fixtures.js');
const {
	CategoriesSettingsPage,
} = require('../pages/CategoriesSettingsPage.js');
const {CatalogPage} = require('../pages/CatalogPage.js');
const {
	SubmissionWizardPage,
} = require('../../lib/pkp/playwright/pages/SubmissionWizardPage.js');

/**
 * Categories (the journal's subject taxonomy) — one test per canonical
 * scenario of docs/product/specs/categories.md (5 scenarios → 5 tests).
 *
 * The management surface is the VUE table manager
 * (lib/ui-library CategoryManager, `editCategory` side-modal form,
 * REST /api/v1/{context}/categories) — no legacy grid. Downstream
 * projections are read where users read them: the wizard's
 * For-the-Editors "Select Categories" picker (chips) and the anonymous
 * reader's `/catalog/category/{path}` landing pages (page owned by
 * browse-category-section; the article-appears effect-link is asserted
 * here).
 *
 * Parallel-safety: EVERY mutation runs on a per-test scratch journal
 * (unique `catt…` tag = urlPath). publicknowledge's 7-category tree is
 * load-bearing for the browse-category-section suite and is NEVER
 * touched here (not even read). No toast assertions (shared per-user
 * queue across workers); outcomes are asserted on table/REST/reader
 * state. No hard-coded waits: web-first assertions, API response
 * anchors on every form save, REST polls for wizard autosaves, and
 * reload-polls for the async search index on reader listings.
 *
 * AS-BUILT realities pinned here (assert reality, not intent):
 *   - ⚠ ROW 135, category leg (test 3): category assigned-editor
 *     auto-assignment at submit is SILENTLY DEAD on any journal whose
 *     user-group ids exceed its group count — i.e. every scratch journal
 *     (and every 2nd+ journal of a real install). The shared
 *     SubEditorsDAO::assignEditors() filters on $userGroups->keys()
 *     (collection indexes) instead of group ids. The test configures a
 *     category editor through the Vue manager (persisted — Assigned To
 *     column + reopened form), submits a category-tagged draft through
 *     the REAL wizard (so categoryIds are on the publication when
 *     AssignEditors fires), and asserts the editor is NOT assigned +
 *     the managers get the "Needs editor" fallback. MUST be flipped to
 *     the intended routing when the keys()→ids bug is fixed.
 *   - Row 140 (test 1, rides along): the tree-row expand/collapse
 *     button's accessible label is CONSTANT ("Expand sub-categories" in
 *     both states) — a `.value` misuse on a Boolean prop cancels against
 *     swapped label bindings; only the chevron icon reflects state.
 *   - Row 138 (titleless POST bricks the tab) is API-only — the UI
 *     always posts the title key — and is NOT probed here (a bricked
 *     row would take the whole manager down for parallel workers).
 *     Row 139 (dead formComponent route) and row 103 (reader ignores
 *     Sort-by; browse-category-section's) are not scenario surfaces.
 */

/** Unique hyphenless alphanumeric tag; doubles as the scratch urlPath. */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `catt${workerIndex}x${suffix}`;
}

/** A fresh anonymous browser context (test.use({user}) otherwise leaks in). */
async function newAnonContext(browser, baseURL) {
	return browser.newContext({
		baseURL,
		storageState: {cookies: [], origins: []},
	});
}

/** Bare reader/backend base for a single-locale scratch journal. */
function base(journalPath) {
	return `/index.php/${journalPath}`;
}

const IMAGE_FIXTURE = path.join(
	__dirname,
	'../../lib/pkp/playwright/fixtures/files/dependent-image.png',
);

/**
 * Create a single-locale scratch journal. dbarnes is always seeded as
 * manager; categories / users / issues via overrides. Returns the
 * journal path + the {categoryPath: id} map the scenario response echoes.
 */
async function createJournal(pkpApi, tag, overrides = {}) {
	const res = await pkpApi.createJournal({
		tag,
		path: tag,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users: [{username: 'dbarnes', roles: ['manager']}],
		...overrides,
	});
	return {path: res.context.path, categoryIds: res.categories ?? {}};
}

/**
 * A wizard-resumable draft owned by atester (no participants), filed
 * under `categories` (paths) with title + abstract seeded so the Review
 * step is fully valid — walking the wizard only has to Submit.
 */
function draftSpec({tag, journal, title, categories}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		submitted: false,
		participants: [],
		publications: [
			{
				metadata: {title: {en: title}, abstract: {en: `${title} abstract.`}},
				...(categories ? {categories} : {}),
			},
		],
	};
}

/**
 * A VoR submission published into an already-published issue and filed
 * under `categories` (paths) — the reader-listing seed.
 */
function publishedSpec({tag, journal, title, categories}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
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
				issue: {volume: 1, number: 1, year: 2032},
				categories,
				published: true,
			},
		],
	};
}

/**
 * The submission's current publication via REST (the page's session) —
 * the deterministic "the autosave/save has landed" anchor.
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
 * Stage-1 participant usernames of a submission (manager session) —
 * who actually got stage-assigned on submit (the row-135 verdict).
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
	return (await res.json()).map((u) => u.userName);
}

/**
 * Open a seeded draft's wizard and wait for it to mount.
 */
async function openWizard(page, journalPath, submissionId) {
	await page.goto(`${base(journalPath)}/submission?id=${submissionId}`);
	await expect(page.locator('.submissionWizard')).toBeVisible({
		timeout: 20_000,
	});
}

/**
 * Walk forward through the wizard (footer Continue) until the named
 * step is current — robust to which step a freshly loaded wizard opens
 * on (submission-wizard-metadata idiom).
 *
 * @param {import('@playwright/test').Page} page
 * @param {SubmissionWizardPage} wizard
 * @param {string} stepName
 */
async function walkToStep(page, wizard, stepName) {
	const current = page.locator('.pkpSteps__step__label--current');
	await expect(current).toBeVisible({timeout: 20_000});
	const target = new RegExp(
		stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
	);
	for (let i = 0; i < 8; i++) {
		const label = ((await current.textContent()) ?? '').trim();
		if (target.test(label)) {
			await wizard.expectStep(stepName);
			return;
		}
		await wizard.continueStep();
		await expect(current).not.toHaveText(label, {timeout: 20_000});
	}
	throw new Error(`walkToStep: never reached "${stepName}"`);
}

/**
 * Reload the category page until its "N Items" count settles — the
 * async search index (browse-category-section rule 5) makes a
 * just-published article listable only once its job runs; each
 * reload's end-of-request JobRunner drains more of the queue.
 */
async function pollUntilItems(catalog, categoryPath, count) {
	await expect
		.poll(
			async () => {
				await catalog.gotoCategory(categoryPath);
				return (await catalog.itemCount.innerText())
					.replace(/\s+/g, ' ')
					.trim();
			},
			{timeout: 45_000, intervals: [1000, 2000, 3000, 5000]},
		)
		.toContain(`${count} Items`);
}

test.use({user: 'dbarnes'}); // default actor: journal manager

test.describe('Categories', () => {
	// Canonical scenario 1 — Manager builds and edits the category tree.
	// A fresh journal starts with ZERO categories; the manager creates two
	// top-level categories (Name + Path in the side-modal), which list
	// alphabetically by name (rule 2 — no manual ordering); a row's More
	// Actions → Add nests a child under it (auto-expanded after save,
	// collapsible via the chevron — whose accessible label is CONSTANT,
	// row 140); Edit renames/re-paths in place; a duplicate path is
	// refused inline (rule 4 uniqueness); a section editor is bounced
	// from the settings page and 401'd by the API (permissions table).
	test(
		'manager builds the tree: create, nest, alphabetical order, edit, duplicate path refused; section editor denied',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // 4 side-modal round-trips + a second actor
			const tag = uniqueTag();
			const {path: journalPath} = await createJournal(pkpApi, tag, {
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'dbuskins', roles: ['sectionEditor']},
				],
			});
			const zebra = `Zebra Studies ${tag}`;
			const alpha = `Alpha Studies ${tag}`;
			const child = `Zebra Child ${tag}`;

			const categories = new CategoriesSettingsPage(page, journalPath);
			await categories.goto();

			// A fresh journal starts with zero categories (no default) —
			// the table renders only its "No Items" placeholder row.
			await expect(categories.noItemsCell).toBeVisible();
			await expect(categories.dataRows).toHaveCount(0);

			// Create two top-level categories, deliberately Z before A.
			await categories.openAddForm();
			await categories.fillForm({name: zebra, path: `zebra${tag}`});
			await categories.saveForm();
			await expect(categories.rowByName(zebra)).toHaveCount(1);

			await categories.openAddForm();
			await categories.fillForm({name: alpha, path: `alpha${tag}`});
			await categories.saveForm();

			// Alphabetical by name at every level (rule 2): A before Z.
			await expect
				.poll(async () => categories.rowNamesInOrder())
				.toEqual([alpha, zebra]);

			// Nest a child under Zebra via the row's More Actions → Add.
			// (The modal is titled just "Add Category" — it does not name
			// the parent; spec Known deviations, minor.)
			await categories.openRowForm(zebra, 'Add');
			await categories.fillForm({name: child, path: `zchild${tag}`});
			await categories.saveForm();

			// The parent auto-expands so the new child is visible, indented
			// below it (rule 1; store categorySaved()).
			await expect(categories.rowByName(child)).toHaveCount(1);
			await expect
				.poll(async () => categories.rowNamesInOrder())
				.toEqual([alpha, zebra, child]);

			// The parent row now carries the expand/collapse chevron.
			// Collapse hides the child; expand shows it again. ⚠ Row 140
			// AS-BUILT: the button's accessible label never updates — it
			// reads "Expand sub-categories" in BOTH states (a `.value`
			// misuse cancelling against swapped label bindings).
			const toggle = categories.expandToggle(zebra);
			await expect(toggle).toHaveAccessibleName('Expand sub-categories');
			await toggle.click(); // collapse
			await expect(categories.rowByName(child)).toHaveCount(0);
			await expect(toggle).toHaveAccessibleName('Expand sub-categories');
			await toggle.click(); // expand again
			await expect(categories.rowByName(child)).toHaveCount(1);

			// Edit round-trips the stored values and renames in place; a
			// duplicate path is refused inline first (rule 4 / pathExists).
			const edited = `Alpha Edited ${tag}`;
			await categories.openRowForm(alpha, 'Edit');
			await expect(categories.nameInput).toHaveValue(alpha);
			await expect(categories.pathInput).toHaveValue(`alpha${tag}`);
			await categories.fillForm({name: edited, path: `zebra${tag}`});
			await categories.saveForm({expectError: true});
			// (The message paints twice: the inline field error + the form's
			// error-summary jump button — assert the visible inline one.)
			await expect(
				categories.formModal
					.getByText(
						'The category path already exists. Please enter a unique path.',
					)
					.first(),
			).toBeVisible();
			// Fix the path — the save now lands and the row is replaced.
			await categories.fillForm({path: `alphaedit${tag}`});
			await categories.saveForm();
			await expect(categories.rowByName(edited)).toHaveCount(1);
			await expect(categories.rowByName(alpha)).toHaveCount(0);

			// Permission boundary: the section editor is bounced from the
			// settings page and gets 401 from the categories API.
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.newPage();
			await sePage.goto(
				`${base(journalPath)}/management/settings/context`,
			);
			await expect(sePage).toHaveURL(/authorizationDenied|accessDenied/i);
			const seRes = await seCtx.request.get(
				`${base(journalPath)}/api/v1/categories`,
			);
			expect(seRes.status()).toBe(401);
			// …while the manager's session reads the tree fine.
			const tree = await categories.fetchTree();
			expect(tree.map((c) => c.title.en).sort()).toEqual(
				[edited, zebra].sort(),
			);
		},
	);

	// Canonical scenario 2 — Author files a submission under a category
	// and readers find it. With submitWithCategories on and a tree
	// defined, the wizard's For-the-Editors step shows the "Select
	// Categories" picker (checkbox tree in a side-modal, children behind
	// the parent's expand toggle); the picked child renders as a
	// breadcrumb chip (Physics > Optics) and persists on the DRAFT's
	// publication immediately (rule 11 — join row pre-submit). A
	// published article filed under the category is listed on the
	// anonymous reader's /catalog/category/{path} page (page owned by
	// browse-category-section; the effect-link is asserted here).
	test(
		'wizard category picker: breadcrumb chip persists on the draft; published article reaches the reader page',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser, browser, baseURL}) => {
			test.slow(); // wizard walk + published seed + index poll
			const tag = uniqueTag();
			const physics = `Physics ${tag}`;
			const optics = `Optics ${tag}`;
			const opticsPath = `opt${tag}`;
			const {path: journalPath, categoryIds} = await createJournal(
				pkpApi,
				tag,
				{
					users: [
						{username: 'dbarnes', roles: ['manager']},
						{username: 'atester', roles: ['author']},
					],
					submitWithCategories: true,
					categories: [
						{
							path: `phys${tag}`,
							title: {en: physics},
							children: [{path: opticsPath, title: {en: optics}}],
						},
					],
					issues: [{volume: 1, number: 1, year: 2032, published: true}],
				},
			);
			const opticsId = categoryIds[opticsPath];
			expect(opticsId, 'category id echoed by the scenario').toBeTruthy();

			// The author opens a seeded draft and walks to For the Editors.
			const {submission: draft} = await pkpApi.createSubmission(
				draftSpec({tag, journal: journalPath, title: `Chip draft ${tag}`}),
			);
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const wizard = new SubmissionWizardPage(authorPage, journalPath);
			await openWizard(authorPage, journalPath, draft.id);
			await walkToStep(authorPage, wizard, 'For the Editors');

			// The opt-in picker renders (rule 11). Open the "Select
			// Categories" side-modal and tick the CHILD (if the tree ever
			// renders it collapsed, pop the parent's expand toggle first).
			await authorPage
				.getByRole('button', {name: 'Select Categories'})
				.click();
			const picker = authorPage.getByRole('dialog', {
				name: 'Select Categories',
			});
			await expect(picker).toBeVisible({timeout: 15_000});
			const opticsCheckbox = picker.getByRole('checkbox', {name: optics});
			if (!(await opticsCheckbox.isVisible())) {
				await picker
					.getByRole('row')
					.filter({hasText: physics})
					.locator('[data-cy="category-manager-toggle-sub-categories"]')
					.click();
			}
			await opticsCheckbox.check();
			await picker.getByRole('button', {name: 'Save', exact: true}).click();
			await expect(picker).toBeHidden({timeout: 15_000});

			// The selection renders as a breadcrumb chip: Physics > Optics.
			await expect(
				authorPage.getByRole('button', {
					name: `Remove ${physics} > ${optics}`,
				}),
			).toBeVisible();

			// It persists on the DRAFT immediately (autosaves flush on step
			// change; join row exists pre-submit — rule 11).
			await wizard.continueStep();
			await wizard.expectStep('Review');
			await expect
				.poll(
					async () =>
						(await fetchCurrentPublication(authorPage, draft.id, journalPath))
							?.categoryIds ?? [],
					{timeout: 20_000},
				)
				.toContain(opticsId);

			// Reader effect-link: a published article filed under the same
			// category is listed on its (anonymous) category landing page.
			const publishedTitle = `Reader-visible paper ${tag}`;
			const {submission: published} = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}p`,
					journal: journalPath,
					title: publishedTitle,
					categories: [opticsPath],
				}),
			);
			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const catalog = new CatalogPage(reader, {journalPath});
				await pollUntilItems(catalog, opticsPath, 1);
				await expect(catalog.heading).toHaveText(optics);
				await expect(catalog.articleLink(published.id)).toBeVisible();
				await expect(
					reader.getByRole('link', {name: publishedTitle}),
				).toBeVisible();
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 3 — Category assigned editors: configuration
	// works, submit-time routing is DEAD (⚠ ROW 135, category leg,
	// AS-BUILT). The manager ticks "Assign … as Section editor" in the
	// category form (persists: Assigned To column + DB row read back via
	// the API). An author then submits a draft filed under that category
	// through the REAL wizard (categoryIds are on the publication when
	// submit fires AssignEditors) — the editor is NOT stage-assigned and
	// the submission falls into the managers' "Needs editor" view. When
	// the keys()→ids bug is fixed, flip this to the intended routing.
	test(
		'configured category editor is NOT auto-assigned on submit (row 135)',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // manager form + full author wizard submit
			const tag = uniqueTag();
			const catName = `Routing ${tag}`;
			const catPath = `route${tag}`;
			const {path: journalPath} = await createJournal(pkpApi, tag, {
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'minoue', roles: ['sectionEditor']},
					{username: 'atester', roles: ['author']},
				],
				categories: [{path: catPath, title: {en: catName}}],
			});

			// The manager assigns Minoti Inoue to the category.
			const categories = new CategoriesSettingsPage(page, journalPath);
			await categories.goto();
			await categories.openRowForm(catName, 'Edit');
			const assignCheckbox = categories.formModal.getByRole('checkbox', {
				name: 'Assign Minoti Inoue as Section editor',
			});
			await expect(assignCheckbox).not.toBeChecked();
			await assignCheckbox.check();
			await categories.saveForm();

			// Persisted: the Assigned To column names her (2nd td)…
			await expect(
				categories.rowByName(catName).locator('td').nth(1),
			).toHaveText('Minoti Inoue');
			// …and the API tree carries the assignedEditors row.
			const tree = await categories.fetchTree();
			expect(
				tree.find((c) => c.path === catPath)?.assignedEditors?.map((e) => e.name),
			).toEqual(['Minoti Inoue']);

			// The author submits a draft filed under the category through
			// the real wizard (the join row is on the draft pre-submit, so
			// AssignEditors sees the categoryIds when Submit fires).
			const title = `Routing probe ${tag}`;
			const {submission: draft} = await pkpApi.createSubmission(
				draftSpec({
					tag,
					journal: journalPath,
					title,
					categories: [catPath],
				}),
			);
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			const wizard = new SubmissionWizardPage(authorPage, journalPath);
			await openWizard(authorPage, journalPath, draft.id);
			await walkToStep(authorPage, wizard, 'Review');
			await expect(wizard.footerSubmit).toBeEnabled({timeout: 20_000});
			await wizard.submit();

			// AS-BUILT (row 135): the configured category editor was NOT
			// stage-assigned — only the submitting author holds one.
			const usernames = await stage1ParticipantUsernames(
				page,
				draft.id,
				journalPath,
			);
			expect(usernames).toContain('atester');
			expect(usernames).not.toContain('minoue');

			// The managers get the editor-assignment-required fallback: the
			// submission lands in "Needs editor" (deterministic on a
			// per-test journal).
			await page.goto(
				`${base(journalPath)}/dashboard/editorial?currentViewId=needs-editor`,
			);
			await expect(
				page.getByRole('heading', {name: /Needs editor \(1\)/}),
			).toBeVisible({timeout: 20_000});
			await expect(
				page.getByRole('row').filter({hasText: title}).first(),
			).toBeVisible();

			// And the category editor never sees it: her "Assigned to me"
			// on this journal is empty.
			const seCtx = await asUser('minoue');
			const sePage = await seCtx.newPage();
			await sePage.goto(
				`${base(journalPath)}/dashboard/editorial?currentViewId=assigned-to-me`,
			);
			await expect(
				sePage.getByRole('heading', {name: /Assigned to me \(0\)/}),
			).toBeVisible({timeout: 20_000});
		},
	);

	// Canonical scenario 4 — Deleting a parent category is loud, typed,
	// and total (rule 10). The dialog names the category, reports the
	// sub-category count, and keeps the red confirm button disabled until
	// the EXACT name is typed. On confirm the whole subtree disappears
	// (manager + API), the publications lose (only) their category links
	// (publication_categories cascade — the submissions survive), and the
	// category's reader page 404s.
	test(
		'recursive delete: type-to-confirm, subtree + join rows gone, reader page 404',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow(); // published seed + delete round-trip
			const tag = uniqueTag();
			const parent = `Doomed Parent ${tag}`;
			const parentPath = `par${tag}`;
			const childPath = `chld${tag}`;
			const {path: journalPath} = await createJournal(pkpApi, tag, {
				users: [
					{username: 'dbarnes', roles: ['manager']},
					{username: 'atester', roles: ['author']},
				],
				categories: [
					{
						path: parentPath,
						title: {en: parent},
						children: [
							{
								path: childPath,
								title: {en: `Doomed Child ${tag}`},
								children: [
									{path: `grnd${tag}`, title: {en: `Doomed Grandchild ${tag}`}},
								],
							},
						],
					},
				],
				issues: [{volume: 1, number: 1, year: 2032, published: true}],
			});

			// Assigned publications: a published article on the child + a
			// wizard draft on the parent — both carry join rows.
			const {submission: pubSub} = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}p`,
					journal: journalPath,
					title: `Published in child ${tag}`,
					categories: [childPath],
				}),
			);
			const {submission: draftSub} = await pkpApi.createSubmission(
				draftSpec({
					tag: `${tag}d`,
					journal: journalPath,
					title: `Draft in parent ${tag}`,
					categories: [parentPath],
				}),
			);
			expect(
				(await fetchCurrentPublication(page, pubSub.id, journalPath))
					?.categoryIds?.length,
			).toBe(1);

			const categories = new CategoriesSettingsPage(page, journalPath);
			await categories.goto();
			await categories.openRowAction(parent, 'Delete Category');

			// The dialog names the category and reports the subtree count.
			const dialog = page.getByRole('dialog').filter({
				hasText: `Are you absolutely sure you want to delete "${parent}" category?`,
			});
			await expect(dialog).toBeVisible({timeout: 15_000});
			await expect(dialog).toContainText(
				'Deleting this category will remove all 2 sub-categories within it.',
			);
			await expect(dialog).toContainText(
				'This will not delete the submissions themselves',
			);

			// Type-to-confirm: disabled empty, disabled on a near-miss,
			// enabled only on the exact name.
			const confirmButton = dialog.getByRole('button', {
				name: 'I understand the consequences, delete this category',
			});
			const nameInput = dialog.locator('input[type="text"]');
			await expect(confirmButton).toBeDisabled();
			await nameInput.fill(parent.toLowerCase());
			await expect(confirmButton).toBeDisabled();
			await nameInput.fill(parent);
			await expect(confirmButton).toBeEnabled();

			// Confirm; the DELETE lands (tunneled as POST +
			// X-Http-Method-Override, pkp/pkp-lib#5981) and the summary
			// dialog reports the subtree count.
			const [deleteRes] = await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/api\/v1\/categories\/\d+/.test(res.url()) &&
						res.request().method() === 'POST',
					{timeout: 20_000},
				),
				confirmButton.click(),
			]);
			expect(deleteRes.status()).toBe(200);
			const deletedDialog = page
				.getByRole('dialog')
				.filter({hasText: 'Category Deleted'});
			await expect(deletedDialog).toContainText(
				`"${parent}" and its 2 sub-categories have been successfully deleted.`,
			);
			await deletedDialog
				.getByRole('button', {name: 'Back to Categories'})
				.click();

			// The whole subtree is gone from the manager and the API.
			await expect(categories.dataRows).toHaveCount(0);
			await expect(categories.noItemsCell).toBeVisible();
			expect(await categories.fetchTree()).toEqual([]);

			// The publications lost (only) their category links: join rows
			// cascaded, the submissions and the published status survive.
			const pubAfter = await fetchCurrentPublication(
				page,
				pubSub.id,
				journalPath,
			);
			expect(pubAfter?.categoryIds).toEqual([]);
			expect(pubAfter?.status).toBe(3); // still STATUS_PUBLISHED
			const draftAfter = await fetchCurrentPublication(
				page,
				draftSub.id,
				journalPath,
			);
			expect(draftAfter?.categoryIds).toEqual([]);

			// The reader pages 404 (whole subtree).
			const anon = await newAnonContext(browser, baseURL);
			try {
				const catalog = new CatalogPage(await anon.newPage(), {journalPath});
				for (const p of [parentPath, childPath, `grnd${tag}`]) {
					const res = await anon.request.get(catalog.categoryUrl(p));
					expect(res.status(), `deleted category ${p} → 404`).toBe(404);
				}
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 5 — Cover image round-trip (rule 7). The manager
	// uploads a PNG with alt text through the category form's real
	// dropzone → temporary-files → PUT pipeline; the stored image JSON
	// round-trips on the API (name + generated thumbnail + alt text), and
	// the anonymous reader's category page shows the cover — the
	// thumbnail img wrapped in a fullSize link — with both catalog
	// serving ops answering 200 image/png (ops owned by
	// browse-category-section).
	test(
		'cover image round-trip: upload with alt text; reader page shows thumbnail linking to full size',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			const tag = uniqueTag();
			const catName = `Covered ${tag}`;
			const catPath = `cov${tag}`;
			const altText = `Cover alt ${tag}`;
			const {path: journalPath, categoryIds} = await createJournal(
				pkpApi,
				tag,
				{categories: [{path: catPath, title: {en: catName}}]},
			);
			const catId = categoryIds[catPath];
			expect(catId, 'category id echoed by the scenario').toBeTruthy();

			// Upload through the form's dropzone (hidden file input; the
			// image field is not multilingual — no locale suffix).
			const categories = new CategoriesSettingsPage(page, journalPath);
			await categories.goto();
			await categories.openRowForm(catName, 'Edit');
			const hiddenInput = page.locator(
				'[id^="editCategory-image-hiddenFileId"]',
			);
			await hiddenInput.waitFor({state: 'attached', timeout: 15_000});
			const uploaded = page.waitForResponse(
				(res) =>
					/\/api\/v1\/temporaryFiles/.test(res.url()) &&
					res.ok() &&
					res.request().method() === 'POST',
				{timeout: 20_000},
			);
			await hiddenInput.setInputFiles(IMAGE_FIXTURE);
			await uploaded;
			const altInput = page.locator('#editCategory-image-altText');
			await expect(altInput).toBeVisible({timeout: 15_000});
			await altInput.fill(altText);
			await categories.saveForm();

			// The stored image JSON round-trips on the API: original +
			// generated thumbnail + the alt text.
			const cat = (await categories.fetchTree()).find(
				(c) => c.path === catPath,
			);
			expect(cat?.image?.altText).toBe(altText);
			expect(cat?.image?.uploadName).toMatch(/\.png$/);
			expect(cat?.image?.thumbnailName).toMatch(/thumbnail/);

			// The anonymous reader's category page shows the cover: the
			// thumbnail img wrapped in the fullSize-linked .cover element.
			const anon = await newAnonContext(browser, baseURL);
			try {
				const reader = await anon.newPage();
				const catalog = new CatalogPage(reader, {journalPath});
				await catalog.gotoCategory(catPath);
				await expect(catalog.heading).toHaveText(catName);
				await expect(catalog.coverLink).toBeVisible();
				await expect(catalog.coverLink).toHaveAttribute(
					'href',
					/catalog\/fullSize.*type=category/,
				);
				await expect(catalog.coverLink.locator('img')).toHaveAttribute(
					'src',
					/catalog\/thumbnail.*type=category/,
				);

				// Both serving ops answer 200 image/png.
				for (const op of ['fullSize', 'thumbnail']) {
					const res = await anon.request.get(
						catalog.coverUrl({op, id: catId}),
					);
					expect(res.status(), `${op} → 200`).toBe(200);
					expect(res.headers()['content-type']).toContain('image/png');
				}
			} finally {
				await anon.close();
			}
		},
	);
});
