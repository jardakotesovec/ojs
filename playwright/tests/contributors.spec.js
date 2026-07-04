// @ts-check
const {test, expect} = require('../support/fixtures.js');

/**
 * Contributors manager — one test per canonical scenario of
 * docs/product/specs/contributors.md (11 scenarios; scenarios 5 + 6 —
 * "set primary contact" and "primary-contact deletion leaves none" — are
 * merged into a single narrative, landing at 10 tests).
 *
 * This is the publication Contributors manager (Publication → Contributors
 * tab, ContributorManager → ContributorsListPanel), reused verbatim by the
 * submission wizard's Contributors step. Placement is OJS root: the
 * publicknowledge journal, its seeded Author/Translator contributor roles
 * and the scratch-journal ContributorRoleManager settings surface are
 * journal concepts, even though the panel/form ship from pkp-lib.
 *
 * LIVE MUTATIONS. The spec author rendered the SPA read-only but never
 * executed the add/edit/delete/reorder/set-primary/CRediT mutations (etiquette
 * on the shared publicknowledge journal, single-contributor seeds). These
 * tests execute those mutations LIVE on their OWN freshly seeded submissions —
 * asserting BOTH the rendered manager AND the contributor/publication REST
 * state (author schema `creditRoles`/`contributorRoles`/`seq`, publication
 * `primaryContactId`).
 *
 * As-built confirmed live here (2026-07-04):
 *   - CRediT is CORE: the FieldCreditRoles picker renders and stores roles
 *     with the credit plugin OFF by default (scenario "assign CRediT roles").
 *   - Reorder is arrow-based: Order mode shows up/down arrows + Save Order /
 *     Cancel; the drag handle is CSS-hidden (scenario "reorder").
 *   - Published-lock mirrors canEditPublication: an author is hard-locked to
 *     Preview-only on a published version, while a warn-not-locked editor
 *     (canChangeMetadata) still sees the full edit controls (scenario
 *     "published version read-only").
 *
 * Parallel-safety: single hyphenless alphanumeric tags ride in every name;
 * every persistence assertion reads back the tag through the publication REST
 * API (never a shared list); the ContributorRoleManager-settings scenario
 * mutates a per-test SCRATCH journal so publicknowledge stays read-only. No
 * Mailpit use.
 */

// CRediT NISO term URIs (the FieldCreditRoles option values) — from
// lib/pkp/lib/creditRoles/credit_roles.json (stable NISO taxonomy).
const CREDIT_WRITING_ORIGINAL =
	'https://credit.niso.org/contributor-roles/writing-original-draft/';
const CREDIT_METHODOLOGY =
	'https://credit.niso.org/contributor-roles/methodology/';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `ctrb${workerIndex}x${suffix}`;
}

/**
 * A submitted stage-1 submission with dbarnes as the deciding (section)
 * editor. Seeds a single contributor: the submitter (atester), who is the
 * primary contact automatically.
 */
function submittedSpec({
	tag,
	title,
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
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * A production-staged, VoR-published submission assigned to the published
 * issue (Vol. 1 No. 2, 2014). dbarnes is seeded warn-not-locked
 * (canChangeMetadata) so his editorial assignment keeps edit rights on the
 * published version; atester (submitter/author) is hard-locked once published.
 */
function publishedSpec({tag, title}) {
	return {
		tag,
		journal: 'publicknowledge',
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

/** The Contributors manager panel (ContributorManager wraps ContributorsListPanel). */
function contributorPanel(page) {
	return page.locator('[data-cy="contributor-manager"]');
}

/** A single contributor row, located by (unique-tagged) name text. */
function contributorRow(page, name) {
	return contributorPanel(page).locator('.listPanel__item').filter({hasText: name});
}

/**
 * The add/edit contributor form (its id is `contributor`; every control is
 * id-anchored `#contributor-<field>-control[-<locale>]`). The email control is
 * present for both Person and Organization types, so it uniquely anchors the
 * form element across the whole page.
 */
function contributorForm(page) {
	return page.locator('form:has(#contributor-email-control)');
}

/** Read the page's CSRF token (for direct REST calls). */
async function csrfFrom(page) {
	const csrf = await page.evaluate(() => window.pkp?.currentUser?.csrfToken);
	expect(csrf, 'csrf token from page').toBeTruthy();
	return csrf;
}

/**
 * Resolve the current publication id for a submission.
 */
async function currentPublicationId(page, submissionId, journalPath = 'publicknowledge') {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(res.ok(), `GET submission ${submissionId}`).toBeTruthy();
	return (await res.json()).currentPublicationId;
}

/**
 * GET a submission's current publication as JSON, via the page's session.
 */
async function fetchCurrentPublication(page, submissionId, journalPath = 'publicknowledge') {
	const pubId = await currentPublicationId(page, submissionId, journalPath);
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(res.ok(), `GET publication ${pubId}`).toBeTruthy();
	return res.json();
}

/** The publication's contributors, sorted by seq (the on-page order). */
async function fetchAuthorsBySeq(page, submissionId, journalPath = 'publicknowledge') {
	const pub = await fetchCurrentPublication(page, submissionId, journalPath);
	return [...(pub.authors ?? [])].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

/**
 * Add a contributor to a publication directly through the REST API — used to
 * seed a SECOND contributor for the reorder / primary-contact / delete tests
 * (the submission scenario endpoint only seeds the submitter). Reuses the
 * submitter-author's Author-role id so no manager-only role lookup is needed.
 */
async function addContributorViaApi(page, submissionId, pubId, {givenName, familyName = '', email, roleIds}) {
	const csrf = await csrfFrom(page);
	const res = await page.request.post(
		`/index.php/publicknowledge/api/v1/submissions/${submissionId}/publications/${pubId}/contributors`,
		{
			headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
			data: {
				contributorType: 'PERSON',
				givenName: {en: givenName},
				familyName: {en: familyName},
				email,
				country: 'US',
				contributorRoles: roleIds,
				includeInBrowse: true,
			},
		},
	);
	expect(res.status(), await res.text()).toBe(200);
	return res.json();
}

/**
 * Deep-link the editorial workflow onto the Publication → Contributors pane
 * and wait for the manager to mount.
 */
async function openEditorialContributors(page, submissionId, pubId) {
	await page.goto(
		`/index.php/publicknowledge/en/dashboard/editorial` +
			`?workflowSubmissionId=${submissionId}` +
			`&workflowMenuKey=publication_${pubId}_contributors`,
		{waitUntil: 'commit'},
	);
	await expect(contributorPanel(page)).toBeVisible({timeout: 20_000});
	await expect(
		contributorPanel(page).getByRole('heading', {name: 'Contributors'}),
	).toBeVisible({timeout: 20_000});
}

/**
 * Click the contributor form's Save and wait for the add (POST …/contributors)
 * or edit (POST …/contributors/{id}, PUT tunnelled) response. Returns it.
 */
async function saveContributorForm(page) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(res) =>
				/\/contributors(?:\/\d+)?(?:\?|$)/.test(res.url()) &&
				!/\/saveOrder/.test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 20_000},
		),
		contributorForm(page).getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	return response;
}

test.use({user: 'dbarnes'});

test.describe('Publication — Contributors manager', () => {
	// Canonical scenario 1 — Add a person contributor. Editor opens the
	// Contributors tab, clicks Add Contributor, keeps type Person, enters
	// given/family name + email + country, ticks Author, saves. The new
	// contributor lands at the END of the list with the Author badge and the
	// publication's author list now carries both.
	test(
		'add a person contributor',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Add ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialContributors(page, submission.id, pubId);

			// Seeded with exactly one contributor (the submitter).
			const before = await fetchAuthorsBySeq(page, submission.id);
			expect(before).toHaveLength(1);

			const given = `Ada${tag}`;
			const family = `Newperson${tag}`;
			await contributorPanel(page)
				.getByRole('button', {name: 'Add Contributor'})
				.click();
			await expect(page.locator('#contributor-givenName-control-en')).toBeVisible({
				timeout: 20_000,
			});

			await page.locator('#contributor-givenName-control-en').fill(given);
			await page.locator('#contributor-familyName-control-en').fill(family);
			await page.locator('#contributor-email-control').fill(`${given}@mailinator.com`);
			await page.locator('#contributor-country-control').selectOption('US');
			await contributorForm(page)
				.getByRole('checkbox', {name: 'Author', exact: true})
				.check();

			const res = await saveContributorForm(page);
			expect(res.status()).toBe(200);

			// The new row shows in the list with the Author badge …
			const newRow = contributorRow(page, family);
			await expect(newRow).toBeVisible({timeout: 20_000});
			await expect(newRow.getByText('Author', {exact: true})).toBeVisible();

			// … and lands at the END of the publication's author list (seq max+1).
			await expect
				.poll(async () => (await fetchAuthorsBySeq(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(2);
			const after = await fetchAuthorsBySeq(page, submission.id);
			expect(after[after.length - 1].familyName?.en).toBe(family);
			expect(after[after.length - 1].contributorRoles?.map((r) => r.contributorRoleIdentifier)).toContain(
				'AUTHOR',
			);
		},
	);

	// Canonical scenario 2 — Edit a contributor. Editor opens a contributor's
	// Edit, changes a field and adds the Translator role, saves; the row
	// updates in place (now carrying both Author and Translator badges).
	test(
		'edit a contributor: add the Translator role and update a field',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Edit ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialContributors(page, submission.id, pubId);

			// The submitter (Author Tester) is the one seeded contributor.
			const row = contributorRow(page, 'Tester');
			await expect(row).toBeVisible({timeout: 20_000});
			await row.getByRole('button', {name: 'Edit', exact: true}).click();
			await expect(page.locator('#contributor-email-control')).toBeVisible({
				timeout: 20_000,
			});

			// Set a tagged preferred public name and add the Translator role
			// (Author stays ticked from the loaded value).
			const preferred = `Preferred ${tag}`;
			await page.locator('#contributor-preferredPublicName-control-en').fill(preferred);
			await expect(
				contributorForm(page).getByRole('checkbox', {name: 'Author', exact: true}),
			).toBeChecked();
			await contributorForm(page)
				.getByRole('checkbox', {name: 'Translator', exact: true})
				.check();

			const res = await saveContributorForm(page);
			expect(res.status()).toBe(200);

			// The row updates in place: the preferred name now heads the row and
			// both role badges show.
			const updated = contributorRow(page, preferred);
			await expect(updated).toBeVisible({timeout: 20_000});
			await expect(updated.getByText('Author', {exact: true})).toBeVisible();
			await expect(updated.getByText('Translator', {exact: true})).toBeVisible();

			// API: same contributor, two roles, no duplication of contributors.
			await expect
				.poll(
					async () => {
						const authors = await fetchAuthorsBySeq(page, submission.id);
						return authors[0]?.contributorRoles?.length ?? 0;
					},
					{timeout: 20_000},
				)
				.toBe(2);
			const authors = await fetchAuthorsBySeq(page, submission.id);
			expect(authors).toHaveLength(1);
			expect(authors[0].contributorRoles.map((r) => r.contributorRoleIdentifier).sort()).toEqual(
				['AUTHOR', 'TRANSLATOR'],
			);
			expect(authors[0].preferredPublicName?.en).toBe(preferred);
		},
	);

	// Canonical scenario 3 — Delete a contributor. Editor deletes a
	// non-primary contributor, confirms the "are you sure" dialog; the
	// contributor is removed and the remaining ones renumber gaplessly.
	test(
		'delete a non-primary contributor renumbers the rest gaplessly',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Delete ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialContributors(page, submission.id, pubId);

			// Seed a second (non-primary) contributor via the API, reusing the
			// submitter's Author-role id.
			const seeded = await fetchAuthorsBySeq(page, submission.id);
			const authorRoleId = seeded[0].contributorRoles[0].id;
			const family = `Todelete${tag}`;
			await addContributorViaApi(page, submission.id, pubId, {
				givenName: `Gone${tag}`,
				familyName: family,
				email: `gone${tag}@mailinator.com`,
				roleIds: [authorRoleId],
			});
			await openEditorialContributors(page, submission.id, pubId);
			await expect
				.poll(async () => (await fetchAuthorsBySeq(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(2);

			// Delete the second contributor (not the primary contact).
			const row = contributorRow(page, family);
			await expect(row).toBeVisible({timeout: 20_000});
			await row.getByRole('button', {name: 'Delete', exact: true}).click();

			// Confirm the "are you sure" dialog (its action button is
			// "Delete Contributor"). The delete is a DELETE tunnelled as POST.
			const dialog = page.getByRole('dialog').filter({hasText: 'Delete Contributor'});
			const [delRes] = await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/contributors\/\d+(?:\?|$)/.test(res.url()) &&
						res.request().method() === 'POST' &&
						res.status() === 200,
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'Delete Contributor'}).click(),
			]);
			expect(delRes.ok()).toBeTruthy();

			// Gone from the list; the primary contributor remains, renumbered
			// gaplessly (seq 0).
			await expect(contributorRow(page, family)).toHaveCount(0, {timeout: 20_000});
			await expect
				.poll(async () => (await fetchAuthorsBySeq(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(1);
			const remaining = await fetchAuthorsBySeq(page, submission.id);
			expect(remaining[0].seq).toBe(0);
			expect(remaining[0].familyName?.en).not.toBe(family);
		},
	);

	// Canonical scenario 4 — Reorder with the Order mode. On a two-contributor
	// submission the editor clicks Order, moves the second author up with the
	// arrow control, clicks Save Order; the new sequence persists. No drag
	// handle is offered — reordering is arrow-based. The final DB order is
	// asserted through the API (robust to the known optimistic-revert ⚠).
	test(
		'reorder contributors with the arrow-based Order mode',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow(); // seed + API-add + reorder round trips
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Reorder ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialContributors(page, submission.id, pubId);

			const seeded = await fetchAuthorsBySeq(page, submission.id);
			const authorRoleId = seeded[0].contributorRoles[0].id;
			const secondFamily = `Second${tag}`;
			await addContributorViaApi(page, submission.id, pubId, {
				givenName: `Bella${tag}`,
				familyName: secondFamily,
				email: `bella${tag}@mailinator.com`,
				roleIds: [authorRoleId],
			});
			await openEditorialContributors(page, submission.id, pubId);
			await expect
				.poll(async () => (await fetchAuthorsBySeq(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(2);

			const initial = await fetchAuthorsBySeq(page, submission.id);
			const firstFamily = initial[0].familyName?.en; // the submitter, seq 0
			expect(initial[1].familyName?.en).toBe(secondFamily);

			// Enter Order mode: Save Order + Cancel appear, and there is no
			// visible drag handle (arrow-based ordering only).
			const panel = contributorPanel(page);
			await panel.getByRole('button', {name: 'Order', exact: true}).click();
			await expect(panel.getByRole('button', {name: 'Save Order'})).toBeVisible({
				timeout: 20_000,
			});
			await expect(panel.getByRole('button', {name: 'Cancel'})).toBeVisible();
			await expect(panel.locator('.orderer__up').first()).toBeVisible();
			// The drag handle exists in markup but is CSS-hidden (spec-confirmed:
			// drag is disabled, ordering is arrow-driven only).
			await expect(panel.locator('.orderer__dragDrop').first()).toBeHidden();

			// Move the SECOND contributor up one position, then Save Order.
			await contributorRow(page, secondFamily).locator('.orderer__up').click();
			// Optimistic swap landed in the DOM before we commit.
			await expect(panel.locator('.listPanel__item').first()).toContainText(
				secondFamily,
			);
			const [orderRes] = await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/contributors\/saveOrder(?:\?|$)/.test(res.url()) &&
						res.request().method() === 'POST' &&
						res.status() === 200,
					{timeout: 20_000},
				),
				panel.getByRole('button', {name: 'Save Order'}).click(),
			]);
			// The saveOrder POST itself carried the new order (the authoritative
			// signal; a background refetch may still flip the optimistic UI — the
			// known ledger-row-20 ⚠ — but the DB write is done).
			const orderBody = await orderRes.json();
			expect(orderBody[0].familyName?.en).toBe(secondFamily);

			// DB truth: the second contributor is now first (seq 0).
			await expect
				.poll(
					async () =>
						(await fetchAuthorsBySeq(page, submission.id))[0].familyName?.en,
					{timeout: 20_000},
				)
				.toBe(secondFamily);
			const reordered = await fetchAuthorsBySeq(page, submission.id);
			expect(reordered.map((a) => a.familyName?.en)).toEqual([
				secondFamily,
				firstFamily,
			]);
			expect(reordered.map((a) => a.seq)).toEqual([0, 1]);
		},
	);

	// Canonical scenarios 5 + 6 (merged) — Set the primary contact, then
	// deleting the primary-contact contributor leaves none. With two
	// contributors the editor sets the second as Primary Contact (its badge
	// moves there and publication.primaryContactId updates); deleting that
	// same contributor then NULLs primaryContactId — it is not reassigned.
	test(
		'set primary contact, then deleting the primary leaves none',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Primary ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialContributors(page, submission.id, pubId);

			const seeded = await fetchAuthorsBySeq(page, submission.id);
			const authorRoleId = seeded[0].contributorRoles[0].id;
			const submitterId = seeded[0].id;
			const secondFamily = `Corr${tag}`;
			const {id: secondId} = await addContributorViaApi(page, submission.id, pubId, {
				givenName: `Cora${tag}`,
				familyName: secondFamily,
				email: `cora${tag}@mailinator.com`,
				roleIds: [authorRoleId],
			});
			await openEditorialContributors(page, submission.id, pubId);
			await expect(contributorRow(page, secondFamily)).toBeVisible({timeout: 20_000});

			// The submitter is primary contact by default (has the badge, not the
			// Set button); the second offers "Set Primary Contact".
			const pubBefore = await fetchCurrentPublication(page, submission.id);
			expect(pubBefore.primaryContactId).toBe(submitterId);

			// --- Set the second contributor as primary contact ---
			const secondRow = contributorRow(page, secondFamily);
			const [setRes] = await Promise.all([
				page.waitForResponse(
					(res) =>
						new RegExp(`/publications/${pubId}(?:\\?|$)`).test(res.url()) &&
						res.request().method() === 'POST' &&
						res.status() === 200,
					{timeout: 20_000},
				),
				secondRow.getByRole('button', {name: 'Set Primary Contact'}).click(),
			]);
			expect(setRes.ok()).toBeTruthy();

			// The badge moves to the second contributor, and the publication
			// pointer updates (the action saves the publication).
			await expect(secondRow.getByText('Primary Contact')).toBeVisible({
				timeout: 20_000,
			});
			await expect
				.poll(async () => (await fetchCurrentPublication(page, submission.id)).primaryContactId, {
					timeout: 20_000,
				})
				.toBe(secondId);

			// --- Delete the primary-contact contributor → pointer cleared ---
			await secondRow.getByRole('button', {name: 'Delete', exact: true}).click();
			const dialog = page.getByRole('dialog').filter({hasText: 'Delete Contributor'});
			await Promise.all([
				page.waitForResponse(
					(res) =>
						/\/contributors\/\d+(?:\?|$)/.test(res.url()) &&
						res.request().method() === 'POST' &&
						res.status() === 200,
					{timeout: 20_000},
				),
				dialog.getByRole('button', {name: 'Delete Contributor'}).click(),
			]);

			// primaryContactId is NULLed (not reassigned to the remaining author).
			await expect
				.poll(async () => (await fetchAuthorsBySeq(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(1);
			const pubAfter = await fetchCurrentPublication(page, submission.id);
			expect(pubAfter.primaryContactId ?? null).toBeNull();
		},
	);

	// Canonical scenario 7 — Assign CRediT roles. Editor opens a contributor,
	// in "CRediT roles and the degrees of contribution" selects Writing –
	// original draft at Lead and Methodology at Supporting, saves; the roles
	// store against the contributor. The picker renders and stores with the
	// credit plugin OFF by default — CRediT collection is core OJS.
	test(
		'assign CRediT roles (core picker, credit plugin off)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Credit ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialContributors(page, submission.id, pubId);

			const row = contributorRow(page, 'Tester');
			await row.getByRole('button', {name: 'Edit', exact: true}).click();
			await expect(page.locator('#contributor-email-control')).toBeVisible({
				timeout: 20_000,
			});

			// The core CRediT picker is present even with the plugin disabled.
			const credit = page.locator('.pkpFormField--creditRoles');
			await expect(credit).toBeVisible();

			// Row 1: Writing – original draft @ Lead.
			await credit.getByRole('button', {name: 'Add Another Role'}).click();
			await credit.locator('select[name="role"]').nth(0).selectOption(CREDIT_WRITING_ORIGINAL);
			await credit.locator('select[name="degree"]').nth(0).selectOption({label: 'Lead'});
			// Row 2: Methodology @ Supporting.
			await credit.getByRole('button', {name: 'Add Another Role'}).click();
			await credit.locator('select[name="role"]').nth(1).selectOption(CREDIT_METHODOLOGY);
			await credit.locator('select[name="degree"]').nth(1).selectOption({label: 'Supporting'});

			const res = await saveContributorForm(page);
			expect(res.status()).toBe(200);

			// Stored against the contributor (author schema `creditRoles`).
			await expect
				.poll(
					async () => (await fetchAuthorsBySeq(page, submission.id))[0].creditRoles?.length ?? 0,
					{timeout: 20_000},
				)
				.toBe(2);
			const authors = await fetchAuthorsBySeq(page, submission.id);
			const credits = authors[0].creditRoles;
			const byRole = Object.fromEntries(credits.map((c) => [c.role, c.degree]));
			expect(byRole[CREDIT_WRITING_ORIGINAL]).toBe('LEAD');
			expect(byRole[CREDIT_METHODOLOGY]).toBe('SUPPORTING');
		},
	);

	// Canonical scenario 8 — Organization contributor. Editor clicks Add
	// Contributor, switches type to Organization or group; the person
	// name/ORCID fields disappear and Organization Name (required) + ROR ID
	// appear; saves an institutional contributor.
	test(
		'add an organization contributor (type switch reshapes the form)',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Org ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialContributors(page, submission.id, pubId);

			await contributorPanel(page).getByRole('button', {name: 'Add Contributor'}).click();
			await expect(page.locator('#contributor-givenName-control-en')).toBeVisible({
				timeout: 20_000,
			});

			// Switch to Organization: person fields disappear, org fields appear.
			await contributorForm(page)
				.getByRole('radio', {name: 'Organization or group'})
				.check();
			await expect(page.locator('#contributor-givenName-control-en')).toBeHidden();
			await expect(page.locator('#contributor-organizationName-control-en')).toBeVisible();
			await expect(page.locator('#contributor-rorId-control')).toBeVisible();

			const orgName = `Institute ${tag}`;
			await page.locator('#contributor-organizationName-control-en').fill(orgName);
			await page.locator('#contributor-email-control').fill(`org${tag}@mailinator.com`);
			await page.locator('#contributor-country-control').selectOption('US');
			await contributorForm(page).getByRole('checkbox', {name: 'Author', exact: true}).check();

			const res = await saveContributorForm(page);
			expect(res.status()).toBe(200);

			await expect(contributorRow(page, orgName)).toBeVisible({timeout: 20_000});
			await expect
				.poll(async () => (await fetchAuthorsBySeq(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(2);
			const authors = await fetchAuthorsBySeq(page, submission.id);
			const added = authors.find((a) => (a.fullName ?? '').includes(tag));
			expect(added).toBeTruthy();
			expect(String(added.contributorType).toUpperCase()).toBe('ORGANIZATION');
		},
	);

	// Canonical scenario 9 — Multilingual name. On the en + fr_CA
	// publicknowledge journal the editor switches the form's French language
	// tab and enters the given/family name in that language; both language
	// values save. The submission-language (en) name is the one required at
	// final submit; the secondary is optional.
	test(
		'multilingual name saves a second locale independently',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Multi ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);
			await openEditorialContributors(page, submission.id, pubId);

			await contributorPanel(page).getByRole('button', {name: 'Add Contributor'}).click();
			await expect(page.locator('#contributor-givenName-control-en')).toBeVisible({
				timeout: 20_000,
			});

			const enGiven = `Marie${tag}`;
			const enFamily = `Anglais${tag}`;
			await page.locator('#contributor-givenName-control-en').fill(enGiven);
			await page.locator('#contributor-familyName-control-en').fill(enFamily);
			await page.locator('#contributor-email-control').fill(`marie${tag}@mailinator.com`);
			await page.locator('#contributor-country-control').selectOption('CA');
			await contributorForm(page).getByRole('checkbox', {name: 'Author', exact: true}).check();

			// Reveal the French (Canada) sub-fields via the form's locale toggle.
			await contributorForm(page)
				.locator('button.pkpFormLocales__locale', {hasText: 'French (Canada)'})
				.click();
			await expect(page.locator('#contributor-givenName-control-fr_CA')).toBeVisible({
				timeout: 20_000,
			});
			const frGiven = `Marie${tag}`;
			const frFamily = `Francais${tag}`;
			await page.locator('#contributor-givenName-control-fr_CA').fill(frGiven);
			await page.locator('#contributor-familyName-control-fr_CA').fill(frFamily);

			const res = await saveContributorForm(page);
			expect(res.status()).toBe(200);

			// Both locale values persist independently on the same author.
			await expect
				.poll(async () => (await fetchAuthorsBySeq(page, submission.id)).length, {
					timeout: 20_000,
				})
				.toBe(2);
			const added = (await fetchAuthorsBySeq(page, submission.id)).find(
				(a) => a.familyName?.en === enFamily,
			);
			expect(added).toBeTruthy();
			expect(added.familyName?.en).toBe(enFamily);
			expect(added.familyName?.fr_CA).toBe(frFamily);
			expect(added.givenName?.fr_CA).toBe(frGiven);
		},
	);

	// Canonical scenario 10 — Published version is read-only. On a published
	// version an AUTHOR (hard-locked once any version publishes) sees only
	// Preview — Add/Order/Edit/Delete are gone — while a warn-not-locked EDITOR
	// (canChangeMetadata) on the same version still sees the full edit controls.
	test(
		'published version: author locked to Preview, editor still edits (warn-not-lock)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow(); // publish seed + two actor views
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Locked ${tag}`}),
			);
			const pubId = await currentPublicationId(page, submission.id);

			// --- Author (atester): hard-locked → Preview only ---
			const authorCtx = await asUser('atester');
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(
				`/index.php/publicknowledge/en/dashboard/mySubmissions` +
					`?workflowSubmissionId=${submission.id}` +
					`&workflowMenuKey=publication_${pubId}_contributors`,
				{waitUntil: 'commit'},
			);
			await expect(contributorPanel(authorPage)).toBeVisible({timeout: 20_000});
			await expect(
				contributorPanel(authorPage).getByRole('button', {name: 'Preview', exact: true}),
			).toBeVisible({timeout: 20_000});
			// No editing controls for the locked author.
			await expect(
				contributorPanel(authorPage).getByRole('button', {name: 'Add Contributor'}),
			).toHaveCount(0);
			await expect(
				contributorPanel(authorPage).getByRole('button', {name: 'Order', exact: true}),
			).toHaveCount(0);
			await expect(
				contributorPanel(authorPage).getByRole('button', {name: 'Edit', exact: true}),
			).toHaveCount(0);
			await expect(
				contributorPanel(authorPage).getByRole('button', {name: 'Delete', exact: true}),
			).toHaveCount(0);

			// --- Editor (dbarnes, warn-not-lock): full edit controls remain ---
			await openEditorialContributors(page, submission.id, pubId);
			await expect(
				contributorPanel(page).getByRole('button', {name: 'Add Contributor'}),
			).toBeVisible({timeout: 20_000});
			await expect(
				contributorPanel(page).getByRole('button', {name: 'Order', exact: true}),
			).toBeVisible();
		},
	);

	// Canonical scenario 11 — Configure the journal's contributor roles. On a
	// SCRATCH journal (publicknowledge stays read-only), a manager opens
	// Settings → Workflow → Submission → Contributor Roles, adds an Editor
	// role, edits the Translator name, then tries to delete Author and is
	// refused because it is the last Author role.
	test(
		'configure contributor roles: add Editor, edit Translator, Author delete refused',
		{tag: '@regression'},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow(); // scratch journal + settings page + three role mutations
			const tag = uniqueTag();
			const {context} = await pkpApi.createJournal({
				tag,
				users: [{username: 'dbarnes', roles: ['manager']}],
			});

			const ctx = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const p = await ctx.newPage();
				// Log dbarnes into the scratch journal (cached storage state is
				// publicknowledge-scoped).
				await p.goto(`/index.php/${context.path}/en/login`);
				await p.locator('input#username').fill('dbarnes');
				await p.locator('input#password').fill('dbarnesdbarnes');
				await p.locator('form#login button').click();
				await p.waitForURL((url) => !url.pathname.includes('/login'), {
					timeout: 15_000,
					waitUntil: 'commit',
				});

				// Settings → Workflow → Submission → Contributor Roles.
				await p.goto(`/index.php/${context.path}/management/settings/workflow`, {
					waitUntil: 'commit',
				});
				await p.getByRole('tab', {name: 'Contributor Roles'}).click();

				// The scratch journal is seeded with Author + Translator (the role
				// name is a row header; the identifier is a plain cell — match the
				// whole row by its unique identifier text).
				const addRoleBtn = p.getByRole('button', {name: 'Add Role'});
				await expect(addRoleBtn).toBeVisible({timeout: 20_000});
				await expect(p.getByRole('row').filter({hasText: 'AUTHOR'})).toBeVisible();
				await expect(p.getByRole('row').filter({hasText: 'TRANSLATOR'})).toBeVisible();

				// --- Add an Editor role ---
				await addRoleBtn.click();
				await expect(
					p.locator('#editContributorRole-contributorRoleIdentifier-control'),
				).toBeVisible({timeout: 20_000});
				await p
					.locator('#editContributorRole-contributorRoleIdentifier-control')
					.selectOption('EDITOR');
				const editorRoleName = `Guest Editor ${tag}`;
				await p.locator('#editContributorRole-name-control-en').fill(editorRoleName);
				const roleForm = p.locator('form:has(#editContributorRole-name-control-en)');
				await Promise.all([
					p.waitForResponse(
						(res) =>
							/\/contributorRoles(?:\?|$)/.test(res.url()) &&
							res.request().method() === 'POST' &&
							res.status() === 200,
						{timeout: 20_000},
					),
					roleForm.getByRole('button', {name: 'Save', exact: true}).click(),
				]);
				await expect(
					p.getByRole('row').filter({hasText: editorRoleName}),
				).toBeVisible({timeout: 20_000});
				await expect(p.getByRole('row').filter({hasText: 'EDITOR'})).toBeVisible();

				// --- Edit the Translator name ---
				const translatorRow = p.getByRole('row').filter({hasText: 'TRANSLATOR'});
				await translatorRow.getByRole('button', {name: 'More Actions'}).click();
				await p.getByRole('menuitem', {name: 'Edit'}).click();
				await expect(p.locator('#editContributorRole-name-control-en')).toBeVisible({
					timeout: 20_000,
				});
				const newTranslatorName = `Localizer ${tag}`;
				await p.locator('#editContributorRole-name-control-en').fill(newTranslatorName);
				const editForm = p.locator('form:has(#editContributorRole-name-control-en)');
				await Promise.all([
					p.waitForResponse(
						(res) =>
							/\/contributorRoles\/\d+(?:\?|$)/.test(res.url()) &&
							res.request().method() === 'POST' &&
							res.status() === 200,
						{timeout: 20_000},
					),
					editForm.getByRole('button', {name: 'Save', exact: true}).click(),
				]);
				await expect(
					p.getByRole('row').filter({hasText: newTranslatorName}),
				).toBeVisible({timeout: 20_000});

				// --- Try to delete Author → refused (last Author role) ---
				const authorRow = p.getByRole('row').filter({hasText: 'AUTHOR'});
				await authorRow.getByRole('button', {name: 'More Actions'}).click();
				await p.getByRole('menuitem', {name: 'Delete Role'}).click();
				// Type-to-confirm dialog: enter the identifier, then confirm; the
				// server refuses with 406 (last AUTHOR role cannot be deleted).
				const confirmDialog = p.getByRole('dialog').filter({hasText: 'AUTHOR'});
				await confirmDialog.locator('input[type="text"]').fill('AUTHOR');
				// The confirm action is a PkpButton (the dialog's Close "X" is not);
				// the Cancel PkpButton is excluded by its text.
				const [delRes] = await Promise.all([
					p.waitForResponse(
						(res) =>
							/\/contributorRoles\/\d+(?:\?|$)/.test(res.url()) &&
							res.request().method() === 'POST' &&
							[403, 406].includes(res.status()),
						{timeout: 20_000},
					),
					confirmDialog
						.locator('button.pkpButton')
						.filter({hasNotText: 'Cancel'})
						.click(),
				]);
				expect(delRes.status()).toBe(406);

				// Author survives the refused delete (the 406 pops the generic
				// network-error dialog over the page, so assert via the API — the
				// AUTHOR-identifier role is still present on the journal).
				const rolesRes = await p.request.get(
					`/index.php/${context.path}/api/v1/contributorRoles`,
				);
				expect(rolesRes.ok()).toBeTruthy();
				const roles = await rolesRes.json();
				expect(
					roles.some((r) => r.contributorRoleIdentifier === 'AUTHOR'),
				).toBeTruthy();
			} finally {
				await ctx.close();
			}
		},
	);
});
