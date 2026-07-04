// @ts-check
const {test, expect} = require('../support/fixtures.js');

/**
 * Publication — Identifiers (DOI / URN / URL path / pages / article number) —
 * the identifier fields as experienced on the workflow Publication tabs.
 * One test per canonical scenario of docs/product/specs/publication-identifiers.md
 * (6 scenarios; the negative gating + DOI-seam merged → 5 tests).
 *
 * CRITICAL as-built reality the spec documents: the identifier fields are
 * SCATTERED across three tabs, not gathered on one:
 *   - Identifiers tab (formName `identifier`, PHP form id `publicationIdentifiers`)
 *     — URN + custom pub-ids ONLY, and GATED on a pub-id *plugin* being enabled
 *     for Publications (NOT on DOIs). publicknowledge has DOIs on / URN off, so
 *     the tab 403s (`noEnabledIdentifiers`) and is absent from the nav.
 *   - Issue tab (formName `issue`, PHP form id `issueEntry`, label "Publication
 *     Settings") — URL Path (#issueEntry-urlPath-control) + Pages
 *     (#issueEntry-pages-control). Editorial/production only; authors can't reach.
 *   - Metadata tab — article-number / publisher-id (owned by
 *     publication-metadata-references; not re-driven here).
 *   - DOI — NO field on any Publication tab; only a read-only `doiObject`
 *     surfaces (value + resolvingUrl). Assign/clear lives on the DOIs page
 *     (doi-management). publicknowledge auto-assigns a DOI on publish.
 *
 * THE liveness gap solved here (per the task brief): the URN field renders only
 * when the URN plugin is enabled THROUGH THE PLUGIN — `register()` adds the
 * `Form::config::before` field-injection hook only when the plugin's per-journal
 * `enabled` flag is on, and `addPublicationFormFields()` then needs
 * `enablePublicationURN`. Setting only `enablePublicationURN` (as the spec author
 * did via raw SQL) opens the tab gate to 200 but the field never injects. This
 * spec enables URN via the scenario `plugins` passthrough
 * (`plugins.urnpubidplugin = {enabled: true, settings: {enablePublicationURN,
 * urnPrefix, urnSuffix: 'customId', ...}}`), which sets BOTH flags — so the URN
 * text field (`input[name="pub-id::other::urn"]`, component `field-text-urn`,
 * manual/customId mode) actually renders and saves. Verified live.
 *
 * Placement: OJS root — the Issue tab's IssueEntryForm, the URN plugin, the DOI
 * auto-assign-on-publish and the reader article page are OJS surfaces (the Vue
 * identifiers form + urlPath validator ship from pkp-lib, but what's driven here
 * is OJS).
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every URN /
 * setting flip lives on a per-test scratch journal (publicknowledge stays
 * read-only); every persistence assertion reads the value back through the REST
 * API (publication GET or the identifier form re-fetch). No Mailpit use.
 */

const STATUS_PUBLISHED = 3; // PKPSubmission::STATUS_PUBLISHED

// URL-path validation messages (publication.urlPath.*).
const URLPATH_NUMBER_INVALID = 'The URL path can not be a number.';
const URLPATH_DUPLICATE =
	'The URL path has already been used and can not be used again.';

// EDITORIAL published-version banner (warn-not-lock) — the same banner prepended
// to every publication panel on a published version.
const EDITOR_EDIT_WARNING =
	'Warning: This version has been published. Editing it may impact the published content.';

// The 403 body the identifier-form endpoint returns when no pub-id plugin is
// enabled for Publications (api.publications.403.noEnabledIdentifiers).
const NO_ENABLED_IDENTIFIERS = 'there are no enabled Identifiers';

// URN plugin (scenario `plugins` key = LazyLoadPlugin::getName() = lowercased
// class name). Manual/customId mode → a plain text field the editor types into.
const URN_PREFIX = 'urn:nbn:de:0000-';
function urnPluginSpec() {
	return {
		urnpubidplugin: {
			enabled: true,
			settings: {
				enablePublicationURN: true,
				urnPrefix: URN_PREFIX,
				urnSuffix: 'customId',
				urnCheckNo: false,
			},
		},
	};
}

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `pid${workerIndex}x${suffix}`;
}

/** The workflow side modal (outer wrapper is visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/**
 * A submitted stage-1 submission with dbarnes as the deciding editor.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {string} [opts.journal='publicknowledge']
 * @param {string} [opts.submitter='atester']
 * @param {object[]} [opts.participants]
 */
function submittedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	submitter = 'atester',
	participants = [{user: 'dbarnes', role: 'editor'}],
}) {
	return {
		tag,
		journal,
		submitter,
		section: 'ART',
		locale: 'en',
		participants,
		publications: [{metadata: {title: {en: title}}}],
	};
}

/**
 * A VoR-published submission assigned to an already-published issue. On
 * publicknowledge use its published issue (Vol. 1 No. 2, 2014); on a scratch
 * journal seed the issue first and pass it in.
 *
 * @param {object} opts
 * @param {string} opts.tag
 * @param {string} opts.title
 * @param {string} [opts.journal='publicknowledge']
 * @param {{volume:number, number:number, year:number}} [opts.issue]
 * @param {object[]} [opts.participants]
 */
function publishedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	issue = {volume: 1, number: 2, year: 2014},
	participants = [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
}) {
	return {
		tag,
		journal,
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
				metadata: {title: {en: title}},
				issue,
				published: true,
			},
		],
	};
}

/** Resolve the current publication id for a submission (page session). */
async function currentPublicationId(page, submissionId, journalPath) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}`,
	);
	expect(res.ok(), `GET submission ${submissionId}`).toBeTruthy();
	return (await res.json()).currentPublicationId;
}

/** GET a submission's publication as JSON (page session). */
async function fetchPublication(page, submissionId, pubId, journalPath) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
	);
	expect(res.ok(), `GET publication ${pubId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/**
 * The live-stored URN, read back through the identifier form config (the form
 * reads `publication->getData('pub-id::other::urn')`, so this reflects the
 * persisted value regardless of the publication schema-map surface).
 */
async function fetchUrnValue(pageOrCtx, submissionId, pubId, journalPath) {
	const res = await pageOrCtx.request.get(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}/_components/identifier`,
	);
	expect(res.status(), 'identifier form GET').toBe(200);
	const json = await res.json();
	const field = (json.fields ?? []).find(
		(f) => f.name === 'pub-id::other::urn',
	);
	return field ? field.value : undefined;
}

/**
 * CSRF token from a loaded OJS page. window.pkp boots asynchronously under
 * `waitUntil:'commit'`, so wait for it before reading.
 */
async function getCsrf(page) {
	await page.waitForFunction(() => !!window.pkp?.currentUser?.csrfToken, null, {
		timeout: 20_000,
	});
	const token = await page.evaluate(() => window.pkp?.currentUser?.csrfToken);
	expect(token, 'csrf token from page').toBeTruthy();
	return token;
}

/** PUT a publication (tunnelled as POST + override, matching useFetch). */
async function putPublication(ctx, journalPath, submissionId, pubId, data, csrf) {
	return ctx.request.post(
		`/index.php/${journalPath}/api/v1/submissions/${submissionId}/publications/${pubId}`,
		{
			headers: {
				'X-Csrf-Token': csrf,
				'X-Http-Method-Override': 'PUT',
				'Content-Type': 'application/json',
			},
			data,
		},
	);
}

/**
 * Deep-link the workflow onto a specific Publication pane.
 *
 * @param {string} journalPath
 * @param {number} submissionId
 * @param {number} pubId
 * @param {string} name  pane name: 'issue' | 'identifiers' | 'metadata'
 * @param {boolean} [author=false] author (mySubmissions) vs editorial dashboard
 */
function pubLink(journalPath, submissionId, pubId, name, author = false) {
	const dash = author ? 'mySubmissions' : 'editorial';
	return (
		`/index.php/${journalPath}/en/dashboard/${dash}` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_${name}`
	);
}

/** The Issue-tab form (IssueEntryForm; holds urlPath + pages). */
function issueForm(page) {
	return page.locator('form.pkpForm', {
		has: page.locator('#issueEntry-urlPath-control'),
	});
}

/** The Identifiers-tab form (holds the URN field). */
function identifierForm(page) {
	return page.locator('form.pkpForm', {
		has: page.locator('[name="pub-id::other::urn"]'),
	});
}

/** Open the Issue pane and wait for the URL-path control to mount. */
async function openIssueTab(page, journalPath, submissionId, pubId, author = false) {
	await page.goto(pubLink(journalPath, submissionId, pubId, 'issue', author), {
		waitUntil: 'commit',
	});
	await expect(page.locator('#issueEntry-urlPath-control')).toBeVisible({
		timeout: 20_000,
	});
}

/**
 * The Issue-tab form injects a REQUIRED `assignment` radio (via the
 * useWorkflowPublicationFormIssue composable, since publicknowledge has
 * issues). Picking "Don't Assign To An Issue" satisfies it AND hides the
 * conditionally-required `issueId` field, so a urlPath/pages-only save can go
 * through without an issue assignment. (Issue assignment itself is owned by
 * publication-issue-assignment.)
 */
async function selectDontAssignToIssue(page) {
	await page
		.getByRole('radio', {name: "Don't Assign To An Issue"})
		.check();
}

/** Open the Identifiers pane and wait for the URN field to mount. */
async function openIdentifiersTab(page, journalPath, submissionId, pubId) {
	await page.goto(
		pubLink(journalPath, submissionId, pubId, 'identifiers'),
		{waitUntil: 'commit'},
	);
	await expect(page.locator('[name="pub-id::other::urn"]')).toBeVisible({
		timeout: 20_000,
	});
}

/**
 * Click a publication form's Save and wait for the publication PUT (tunnelled
 * as POST). Returns the response so the caller can assert the status.
 */
async function savePublicationForm(page, form, pubId) {
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

test.use({user: 'dbarnes'}); // the assigned editor (editorial + production)

test.describe('Publication — Identifiers (DOI / URN / URL path / pages)', () => {
	// Canonical scenario 1 — Edit the URL path and pages on the ISSUE tab (where
	// they actually live, not the Identifiers tab). The editor sets URL Path and
	// Pages and saves; both persist on the selected version. Clearing URL Path
	// reverts the article to its numeric id.
	test(
		'editor edits URL path + pages on the Issue tab; blank URL path reverts',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Issue fields ${tag}`}),
			);
			const pubId = await currentPublicationId(
				page,
				submission.id,
				'publicknowledge',
			);

			await openIssueTab(page, 'publicknowledge', submission.id, pubId);

			const slug = `on-widgets-${tag}`;
			const pages = '12-24';
			await selectDontAssignToIssue(page);
			await page.locator('#issueEntry-urlPath-control').fill(slug);
			await page.locator('#issueEntry-pages-control').fill(pages);

			const saveRes = await savePublicationForm(page, issueForm(page), pubId);
			expect(saveRes.status()).toBe(200);

			// Both persist on the selected version (server truth).
			await expect
				.poll(
					async () =>
						(
							await fetchPublication(
								page,
								submission.id,
								pubId,
								'publicknowledge',
							)
						).urlPath,
					{timeout: 20_000},
				)
				.toBe(slug);
			const pub = await fetchPublication(
				page,
				submission.id,
				pubId,
				'publicknowledge',
			);
			expect(pub.pages).toBe(pages);
			// The public URL now uses the slug rather than the numeric id.
			expect(pub.urlPublished).toContain(`/${slug}`);

			// Clearing URL Path reverts the article to the numeric id. Re-open the
			// tab fresh (the successful save re-fetches the issue form) so the
			// required assignment radio is re-selected cleanly.
			await openIssueTab(page, 'publicknowledge', submission.id, pubId);
			await selectDontAssignToIssue(page);
			await page.locator('#issueEntry-urlPath-control').fill('');
			const revertRes = await savePublicationForm(page, issueForm(page), pubId);
			expect(revertRes.status()).toBe(200);
			await expect
				.poll(
					async () =>
						(
							await fetchPublication(
								page,
								submission.id,
								pubId,
								'publicknowledge',
							)
						).urlPath ?? '',
					{timeout: 20_000},
				)
				.toBe('');
		},
	);

	// Canonical scenario 2 — URL-path validation boundary (Issue tab). An
	// all-digit slug (2024) is refused ("…can not be a number"); a slug already
	// used by another submission in the journal is refused ("…already been
	// used"); a valid unique alphanumeric slug saves. Validation is the shared
	// publication validator, driven live through the Issue tab.
	test(
		'URL-path validation: all-digit + duplicate refused, valid slug saves',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();

			// Submission A is edited; submission B holds a "taken" slug.
			const {submission: subA} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Boundary A ${tag}`}),
			);
			const {submission: subB} = await pkpApi.createSubmission(
				submittedSpec({tag: `${tag}b`, title: `Boundary B ${tag}`}),
			);
			const pubA = await currentPublicationId(page, subA.id, 'publicknowledge');
			const pubB = await currentPublicationId(page, subB.id, 'publicknowledge');

			// Give submission B a URL path via the API (the "already used" value).
			const takenSlug = `taken-${tag}`;
			await page.goto('/index.php/publicknowledge/en/dashboard/editorial', {
				waitUntil: 'commit',
			});
			const csrf = await getCsrf(page);
			const seedRes = await putPublication(
				page,
				'publicknowledge',
				subB.id,
				pubB,
				{urlPath: takenSlug},
				csrf,
			);
			expect(seedRes.status(), await seedRes.text()).toBe(200);

			await openIssueTab(page, 'publicknowledge', subA.id, pubA);
			const urlPathInput = page.locator('#issueEntry-urlPath-control');
			// Satisfy the required assignment radio so the save reaches the
			// server-side URL-path validation (rather than stalling client-side).
			await selectDontAssignToIssue(page);

			// (a) All-digit slug → refused with the number-invalid message.
			await urlPathInput.fill('2024');
			const numRes = await savePublicationForm(page, issueForm(page), pubA);
			expect(numRes.status()).toBe(400);
			// The field error renders as a <span> (exact) — disambiguate from the
			// "Go to URL Path: …" error-summary jump button that repeats the text.
			await expect(
				workflowModal(page).getByText(URLPATH_NUMBER_INVALID, {exact: true}),
			).toBeVisible({timeout: 20_000});

			// (b) Slug already used by another submission → refused as duplicate.
			await urlPathInput.fill(takenSlug);
			const dupRes = await savePublicationForm(page, issueForm(page), pubA);
			expect(dupRes.status()).toBe(400);
			await expect(
				workflowModal(page).getByText(URLPATH_DUPLICATE, {exact: true}),
			).toBeVisible({timeout: 20_000});

			// (c) A valid, unique alphanumeric slug saves.
			const validSlug = `unique-${tag}`;
			await urlPathInput.fill(validSlug);
			const okRes = await savePublicationForm(page, issueForm(page), pubA);
			expect(okRes.status()).toBe(200);
			await expect
				.poll(
					async () =>
						(await fetchPublication(page, subA.id, pubA, 'publicknowledge'))
							.urlPath,
					{timeout: 20_000},
				)
				.toBe(validSlug);
		},
	);

	// Canonical scenario 3 (+ positive gating of scenario 4) — Assign a URN. With
	// the URN plugin enabled for publications on a scratch journal (manual/
	// customId mode → a plain text URN field), the Identifiers tab exists and the
	// URN field renders. The editor types a URN (starting with the plugin prefix)
	// and saves; it persists and is validated for uniqueness (a second submission
	// can't reuse it). Clearing the field empties it.
	test(
		'editor assigns + clears a URN on the URN-enabled Identifiers tab; uniqueness enforced',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {context: journal} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
				plugins: urnPluginSpec(),
			});
			const {submission: sub} = await pkpApi.createSubmission(
				submittedSpec({
					tag,
					title: `URN one ${tag}`,
					journal: journal.path,
					participants: [],
				}),
			);
			const {submission: sub2} = await pkpApi.createSubmission(
				submittedSpec({
					tag: `${tag}b`,
					title: `URN two ${tag}`,
					journal: journal.path,
					participants: [],
				}),
			);
			const pubId = await currentPublicationId(page, sub.id, journal.path);
			const pub2 = await currentPublicationId(page, sub2.id, journal.path);

			await openIdentifiersTab(page, journal.path, sub.id, pubId);

			// The URN field renders (label + text input + working Save).
			const urnInput = page.locator('[name="pub-id::other::urn"]');
			await expect(urnInput).toBeVisible({timeout: 20_000});
			await expect(
				workflowModal(page).getByText('URN', {exact: true}).first(),
			).toBeVisible();

			// Assign a URN (must begin with the plugin prefix) and save.
			const urn = `${URN_PREFIX}widgets${tag}`;
			await urnInput.fill(urn);
			const saveRes = await savePublicationForm(page, identifierForm(page), pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);

			// It persists on the publication (read back via the form).
			await expect
				.poll(
					async () => fetchUrnValue(page, sub.id, pubId, journal.path),
					{timeout: 20_000},
				)
				.toBe(urn);

			// Uniqueness: a second submission can't reuse the same URN — the
			// plugin's Publication::validate hook rejects it (400, urn field error).
			const csrf = await getCsrf(page);
			const dupRes = await putPublication(
				page,
				journal.path,
				sub2.id,
				pub2,
				{'pub-id::other::urn': urn},
				csrf,
			);
			expect(dupRes.status()).toBe(400);
			expect(await dupRes.text()).toContain('pub-id::other::urn');

			// Clearing the field empties it on save.
			await page.locator('[name="pub-id::other::urn"]').fill('');
			const clearRes = await savePublicationForm(
				page,
				identifierForm(page),
				pubId,
			);
			expect(clearRes.status()).toBe(200);
			await expect
				.poll(
					async () =>
						(await fetchUrnValue(page, sub.id, pubId, journal.path)) ?? '',
					{timeout: 20_000},
				)
				.toBe('');
		},
	);

	// Canonical scenario 4 (negative) + scenario 5 — Identifiers-tab gating +
	// DOI display-vs-assign seam. On publicknowledge (DOIs enabled, no pub-id
	// plugin): the Publication menu shows NO Identifiers tab and the identifier-
	// form endpoint returns 403 ("no enabled Identifiers") — even though DOIs are
	// on. The published article's assigned DOI surfaces only read-only (as
	// `doiObject` + a resolving link on the reader page); there is no DOI assign/
	// clear affordance anywhere in the publication workflow (that lives on the
	// DOIs management page — doi-management).
	test(
		'publicknowledge: Identifiers tab gated off (403) while the DOI is display-only',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, browser, baseURL}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `DOI seam ${tag}`}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			// The identifier-form endpoint is gated shut (403) — DOIs on, URN off.
			const idRes = await page.request.get(
				`/index.php/publicknowledge/api/v1/submissions/${submission.id}/publications/${pubId}/_components/identifier`,
			);
			expect(idRes.status()).toBe(403);
			expect(await idRes.text()).toContain(NO_ENABLED_IDENTIFIERS);

			// The editorial Publication menu has NO Identifiers item (open the
			// reachable Issue tab so the nav renders, then assert the absence).
			await openIssueTab(page, 'publicknowledge', submission.id, pubId);
			await expect(
				workflowModal(page)
					.locator('nav')
					.getByText('Identifiers', {exact: true}),
			).toHaveCount(0);
			// And the Issue form (a reachable tab) carries no DOI field — the DOI
			// is not editable on any Publication tab.
			await expect(workflowModal(page).locator('[name="doi"]')).toHaveCount(0);

			// The publication carries the assigned DOI read-only as `doiObject`
			// (value + resolving URL) — auto-minted on publish.
			const pub = await fetchPublication(
				page,
				submission.id,
				pubId,
				'publicknowledge',
			);
			expect(pub.doiObject, 'doiObject present on published pub').toBeTruthy();
			expect(pub.doiObject.doi).toBeTruthy();
			const resolvingUrl = pub.doiObject.resolvingUrl;
			expect(resolvingUrl).toContain('doi.org');

			// The reader article page renders the DOI as a resolving link.
			const anon = await browser.newContext({
				baseURL,
				storageState: {cookies: [], origins: []},
			});
			try {
				const reader = await anon.newPage();
				await reader.goto(
					`/index.php/publicknowledge/en/article/view/${submission.id}`,
				);
				const doiLink = reader
					.locator('.item.doi a')
					.filter({hasText: resolvingUrl});
				await expect(doiLink).toBeVisible({timeout: 20_000});
				await expect(doiLink).toHaveAttribute('href', resolvingUrl);
			} finally {
				await anon.close();
			}
		},
	);

	// Canonical scenario 6 — Published-lock + author boundary. On a PUBLISHED
	// version the Identifiers form honours the lock the way the spec describes
	// (opposite of Galleys): a manager/editor is warn-not-locked — the URN field
	// stays editable (Save enabled) behind the "this version has been published"
	// warning, and the edit persists. An author is hard-locked AND never sees the
	// tab: the author's Publication menu has no Identifiers tab and no Issue
	// ("Publication Settings") tab, and both form endpoints refuse the author.
	test(
		'published version: editor warn-not-locked on URN; author cannot reach Identifiers/Issue',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			// Scratch journal: URN enabled + a published issue to publish into.
			const {context: journal} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
				plugins: urnPluginSpec(),
				issues: [{volume: 1, number: 1, year: 2025, published: true}],
			});
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Published URN ${tag}`,
					journal: journal.path,
					issue: {volume: 1, number: 1, year: 2025},
					participants: [
						{user: 'dbarnes', role: 'manager', canChangeMetadata: true},
					],
				}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			// --- Editor: warn-not-locked on the published version ---
			await openIdentifiersTab(page, journal.path, submission.id, pubId);
			// The yellow published-version warning is shown …
			await expect(
				workflowModal(page).getByText(EDITOR_EDIT_WARNING),
			).toBeVisible({timeout: 20_000});
			// … yet the URN field stays editable and Save is enabled.
			const urnInput = page.locator('[name="pub-id::other::urn"]');
			await expect(urnInput).toBeEnabled();
			await expect(
				identifierForm(page).getByRole('button', {name: 'Save', exact: true}),
			).toBeEnabled();

			// The edit persists on the published version (warn-not-lock confirmed).
			const urn = `${URN_PREFIX}published${tag}`;
			await urnInput.fill(urn);
			const saveRes = await savePublicationForm(page, identifierForm(page), pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);
			await expect
				.poll(
					async () => fetchUrnValue(page, submission.id, pubId, journal.path),
					{timeout: 20_000},
				)
				.toBe(urn);

			// --- Author: hard-locked out of both tabs ---
			const authorCtx = await asUser('atester');
			// The author is refused both identifier + issue form endpoints (the
			// routes exclude ROLE_ID_AUTHOR). OJS's role authorizer answers an
			// authenticated-but-unauthorized role with 401 (see patterns.md wave 2).
			const authorIdRes = await authorCtx.request.get(
				`/index.php/${journal.path}/api/v1/submissions/${submission.id}/publications/${pubId}/_components/identifier`,
			);
			expect([401, 403]).toContain(authorIdRes.status());
			const authorIssueRes = await authorCtx.request.get(
				`/index.php/${journal.path}/api/v1/submissions/${submission.id}/publications/${pubId}/_components/issue`,
			);
			expect([401, 403]).toContain(authorIssueRes.status());

			// And the author's Publication menu has neither tab. Open the
			// author-reachable Metadata pane so the nav renders, then assert both
			// editorial-only items are absent.
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(
				pubLink(journal.path, submission.id, pubId, 'metadata', true),
				{waitUntil: 'commit'},
			);
			const authorNav = workflowModal(authorPage).locator('nav');
			await expect(
				authorNav.getByText('Metadata', {exact: true}).first(),
			).toBeVisible({timeout: 20_000});
			await expect(
				authorNav.getByText('Identifiers', {exact: true}),
			).toHaveCount(0);
			await expect(
				authorNav.getByText('Publication Settings', {exact: true}),
			).toHaveCount(0);
		},
	);
});
