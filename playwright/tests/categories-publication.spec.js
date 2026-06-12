// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {EditorialWorkflowPage} = require('../pages/EditorialWorkflowPage.js');
const submissionPublished = require('../fixtures/scenarios/submission-published.js');

/**
 * Category assignment via the publication tab — row 5 of
 * docs/e2e/plans/categories.md. Split out of the lib/pkp categories
 * spec because the surface is OJS's publication "Publication Settings"
 * panel (the IssueEntryForm, side-nav item name 'issue' labelled
 * publication.publicationSettings), which only exists in the OJS tree.
 *
 * Mechanics:
 *   - The panel renders OJS's IssueEntryForm; when the journal has
 *     categories, a FieldAutosuggestPreset `categoryIds` appears with a
 *     "Select Categories" picker modal (same component as the wizard's).
 *   - useWorkflowPublicationFormIssue() injects a required `assignment`
 *     radio + (for issue-bound assignment types) a required `issueId`
 *     select on the client. Wave-7 note: those required fields block
 *     the save unless the publication already has issue placement — a
 *     PUBLISHED seed (submission-published fixture, bootstrap Vol 1
 *     No 2 2014) arrives with both prefilled, so the test waits for
 *     them to hydrate and saves cleanly.
 *   - Category assignment is per-submission state, so the shared
 *     publicknowledge journal stays read-only at the journal level;
 *     the test assigns a bootstrap category (Anthropology, nested under
 *     Social Sciences) to its own seeded submission.
 *
 * Assertions stop at assignment persistence (reload + publication REST
 * API). The category browse-page render is owned by
 * browse-category-section row 1.
 *
 * The bootstrap categories API (/api/v1/categories) is manager-gated
 * and dbarnes is an editor on publicknowledge, so the category id is
 * read back from the publication PUT/GET payloads instead of the
 * categories admin API.
 */

function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `catpub-w${workerIndex}-${suffix}`;
}

test.describe('Categories — publication assignment', () => {
	test(
		'category assigned via the Publication Settings panel persists',
		{tag: '@regression'},
		async ({pkpApi, asUser}) => {
			const tag = uniqueTag();
			const categoryLabel = 'Anthropology';

			const {submission} = await pkpApi.createSubmission(
				submissionPublished({tag}),
			);

			const ctx = await asUser('dbarnes');
			const page = await ctx.newPage();
			const workflow = new EditorialWorkflowPage(page);
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Publication Settings');

			// The issueEntry form is the active panel's only form; anchor
			// on the categories picker button it must contain.
			const form = workflow
				.workflowModal()
				.locator('form')
				.filter({
					has: page.getByRole('button', {name: 'Select Categories'}),
				})
				.first();
			await expect(
				form.getByRole('button', {name: 'Select Categories'}),
			).toBeVisible({timeout: 20_000});

			// Wait for the client-injected required fields to hydrate from
			// their API fetches (assignment status + issues) — saving
			// before that trips Form.vue's required-field validation.
			await expect(
				form.locator('input[name="assignment"]:checked'),
			).toHaveCount(1, {timeout: 20_000});
			await expect(form.locator('select[name="issueId"]')).toHaveValue(
				/\d+/,
				{timeout: 20_000},
			);

			// Pick the bootstrap category in the Select Categories modal.
			await form
				.getByRole('button', {name: 'Select Categories'})
				.click();
			const selectModal = page
				.locator('[data-cy="active-modal"]')
				.filter({
					has: page.getByRole('heading', {name: 'Select Categories'}),
				});
			await expect(
				selectModal.getByRole('heading', {name: 'Select Categories'}),
			).toBeVisible({timeout: 15_000});
			await selectModal
				.locator('label', {hasText: categoryLabel})
				.first()
				.click();
			await selectModal.getByRole('button', {name: 'Save'}).click();
			await expect(
				page.getByRole('heading', {name: 'Select Categories'}),
			).toHaveCount(0, {timeout: 10_000});

			// The field now shows the selection (breadcrumb label from
			// Repo::category()->getBreadcrumbs).
			await expect(form).toContainText(categoryLabel);

			// Save the panel and capture the publication PUT response —
			// it echoes the persisted categoryIds.
			const [saveResponse] = await Promise.all([
				page.waitForResponse(
					(res) =>
						new RegExp(
							`/api/v1/submissions/${submission.id}/publications/\\d+`,
						).test(res.url()) && res.ok(),
					{timeout: 20_000},
				),
				form.getByRole('button', {name: 'Save', exact: true}).click(),
			]);
			const savedPublication = await saveResponse.json();
			expect(Array.isArray(savedPublication.categoryIds)).toBe(true);
			expect(savedPublication.categoryIds).toHaveLength(1);
			const categoryId = savedPublication.categoryIds[0];
			expect(categoryId).toBeGreaterThan(0);

			// --- Persists across reload: re-open the panel and the field
			// still shows the assigned category.
			await workflow.goto(submission.id);
			await workflow.openPublicationPanel('Publication Settings');
			const reloadedForm = workflow
				.workflowModal()
				.locator('form')
				.filter({
					has: page.getByRole('button', {name: 'Select Categories'}),
				})
				.first();
			await expect(
				reloadedForm.getByRole('button', {name: 'Select Categories'}),
			).toBeVisible({timeout: 20_000});
			await expect(reloadedForm).toContainText(categoryLabel, {
				timeout: 15_000,
			});

			// --- Persists via the publication REST API.
			const pubResponse = await page.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${savedPublication.id}`,
			);
			expect(pubResponse.ok(), 'GET publication').toBe(true);
			const publication = await pubResponse.json();
			expect(publication.categoryIds).toEqual([categoryId]);
		},
	);
});
