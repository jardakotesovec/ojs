// @ts-check
const {test, expect} = require('../support/fixtures.js');

/**
 * Publication — License, copyright holder & copyright year (Permissions &
 * Disclosure) — the per-publication OVERRIDE of the journal's license/copyright
 * defaults, edited on the workflow Publication → Permissions & Disclosure tab.
 * One test per canonical scenario of docs/product/specs/publication-license.md
 * (6 scenarios; scenarios 1+2 — both the License URL field — merged → 5 tests).
 *
 * As-built reality this spec drives (spec author live-verified 2026-07-04, and
 * re-confirmed against source here):
 *   - The tab's PHP form id is `publicationLicense` (label "Permissions &
 *     Disclosure"); it holds exactly three FieldTexts, in order: copyrightHolder
 *     (multilingual), copyrightYear (integer), licenseUrl (url-validated).
 *     Control ids follow FieldBase.compileId: `#publicationLicense-<field>-control`
 *     (single) / `-control-<locale>` (multilingual).
 *   - Each field inherits the journal default until OVERRIDDEN. While empty AND a
 *     default exists the input renders DISABLED with the computed default in its
 *     description and an "Override" button (optIntoEdit). On publicknowledge:
 *       • Copyright Holder — Override (default = journal name, per-locale)
 *       • Copyright Year   — Override (default described by copyrightYearBasis=issue)
 *       • License URL      — NO Override, directly editable (journal has NO default
 *         license). Rule 6, live-confirmed.
 *   - At publish, Repository::publish() snapshots each still-empty field with the
 *     computed journal default (holder→journal name, year→issue/submission date,
 *     license→journal default). An overridden field is left untouched.
 *   - The form HONOURS the published-lock like Identifiers (and unlike Galleys):
 *     a manager/editor is warn-not-locked on a published version (edit persists
 *     behind the yellow banner); an author never sees the tab at all and the form
 *     endpoint refuses the author (live 401 — the campaign-wide HasRoles baseline).
 *
 * ⚠ SEED-vs-LABEL nuance surfaced here (NOT a product bug): the copyright-year
 * snapshot for the ISSUE basis reads the issue's `datePublished` YEAR, not the
 * issue's `year` LABEL. The scenario/bootstrap IssueProcessor stamps a published
 * issue's datePublished with Core::getCurrentDate() (today), so publicknowledge's
 * "Vol 1 No 2 2014" issue has datePublished = the seed date → an inherited
 * copyright year of the CURRENT year, not 2014. Test 3 fetches the issue's
 * datePublished and asserts against its year (robust across re-seeds) rather than
 * hard-coding 2014. Product code is correct (it reads datePublished); the 2014 is
 * only a display label.
 *
 * Placement: OJS root — publicknowledge, its ART section, issues and the
 * copyrightYearBasis/licenseUrl journal defaults are OJS distribution concepts
 * (the Vue license form + url validator ship from pkp-lib, but what's driven here
 * is OJS journal configuration + the publish-time snapshot).
 *
 * Parallel-safety: tags are single hyphenless alphanumeric tokens; every journal
 * license-default flip lives on a per-test scratch journal (publicknowledge stays
 * read-only — only fresh submissions are added to it); every persistence
 * assertion reads the value back through the publication REST API. No Mailpit use.
 */

const STATUS_PUBLISHED = 3; // PKPSubmission::STATUS_PUBLISHED

// Journal-default license form uses these seeded on publicknowledge (schema
// defaults; bootstrap sets none): copyrightHolderType unset → journal name,
// copyrightYearBasis=issue, no default licenseUrl.
const JOURNAL_NAME_EN = 'Journal of Public Knowledge';
const JOURNAL_NAME_FR = 'Journal de la connaissance du public';

// Field descriptions the Override fields advertise (the computed journal default).
const YEAR_ISSUE_DESC = 'when this is published in an issue';
const YEAR_SUBMISSION_DESC = 'based on the publication date';

// url-validation message (validator.url) rendered under a malformed License URL.
const INVALID_URL_MESSAGE = 'This is not a valid URL.';

// EDITORIAL published-version banner (WorkflowPublicationEditWarning) — the
// warn-not-lock: managers/editors keep editing behind the yellow warning.
const EDITOR_EDIT_WARNING =
	'Warning: This version has been published. Editing it may impact the published content.';

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag() {
	const workerIndex = test.info().parallelIndex;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `plic${workerIndex}x${suffix}`;
}

/** The workflow side modal (outer wrapper reports visibility:hidden — scope only). */
function workflowModal(page) {
	return page.locator('[data-cy="active-modal"]').first();
}

/**
 * A submitted stage-1 submission with dbarnes as the deciding editor. Optional
 * `metadata` lets a test seed license overrides / datePublished directly.
 */
function submittedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	submitter = 'atester',
	participants = [{user: 'dbarnes', role: 'editor'}],
	metadata = {},
}) {
	return {
		tag,
		journal,
		submitter,
		section: 'ART',
		locale: 'en',
		participants,
		publications: [{metadata: {title: {en: title}, ...metadata}}],
	};
}

/**
 * A VoR-published submission assigned to a published issue, license fields left
 * empty (inheriting) unless `metadata` overrides. On publicknowledge use its
 * published issue (Vol 1 No 2 2014); on a scratch journal seed + pass the issue.
 */
function publishedSpec({
	tag,
	title,
	journal = 'publicknowledge',
	issue = {volume: 1, number: 2, year: 2014},
	participants = [{user: 'dbarnes', role: 'editor', canChangeMetadata: true}],
	metadata = {},
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
				metadata: {title: {en: title}, ...metadata},
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

/** GET an issue as JSON (for the issue-basis copyright-year year). */
async function fetchIssue(page, issueId, journalPath) {
	const res = await page.request.get(
		`/index.php/${journalPath}/api/v1/issues/${issueId}`,
	);
	expect(res.ok(), `GET issue ${issueId}: ${res.status()}`).toBeTruthy();
	return res.json();
}

/**
 * Deep-link the workflow onto the Permissions & Disclosure pane (nav item name
 * `license`, menu key `publication_<pubId>_license`).
 */
function licenseLink(journalPath, submissionId, pubId, author = false) {
	const dash = author ? 'mySubmissions' : 'editorial';
	return (
		`/index.php/${journalPath}/en/dashboard/${dash}` +
		`?workflowSubmissionId=${submissionId}` +
		`&workflowMenuKey=publication_${pubId}_license`
	);
}

/** The Permissions & Disclosure form (holds the three license FieldTexts). */
function licenseForm(page) {
	return page.locator('form.pkpForm', {
		has: page.locator('#publicationLicense-licenseUrl-control'),
	});
}

/** A license FieldText's control input by field + optional locale. */
function fieldControl(page, field, locale) {
	const suffix = locale ? `-${locale}` : '';
	return page.locator(`#publicationLicense-${field}-control${suffix}`);
}

/** A license FieldText's rendered description element. */
function fieldDescription(page, field, locale) {
	const suffix = locale ? `-${locale}` : '';
	return page.locator(`#publicationLicense-${field}-description${suffix}`);
}

/** The FieldText wrapper (root .pkpFormField--text) that owns a given control. */
function fieldWrapper(page, field, locale) {
	const suffix = locale ? `-${locale}` : '';
	return page.locator('.pkpFormField--text', {
		has: page.locator(`#publicationLicense-${field}-control${suffix}`),
	});
}

/** The "Override" (optIntoEdit) button scoped to one field's wrapper. */
function overrideButton(page, field, locale) {
	return fieldWrapper(page, field, locale).getByRole('button', {
		name: 'Override',
		exact: true,
	});
}

/** Click a field's Override button and wait for its input to become editable. */
async function clickOverride(page, field, locale) {
	await overrideButton(page, field, locale).click();
	await expect(fieldControl(page, field, locale)).toBeEnabled();
}

/** Reveal a secondary locale's sub-fields via the license form's locale toggle. */
async function toggleFormLocale(page, localeLabel) {
	await licenseForm(page)
		.locator('button.pkpFormLocales__locale', {hasText: localeLabel})
		.click();
}

/** Open the Permissions & Disclosure pane and wait for it to mount. */
async function openLicenseTab(page, journalPath, submissionId, pubId, author = false) {
	await page.goto(licenseLink(journalPath, submissionId, pubId, author), {
		waitUntil: 'commit',
	});
	await expect(fieldControl(page, 'licenseUrl')).toBeVisible({timeout: 20_000});
}

/**
 * Click the license form's Save and wait for the publication PUT (tunnelled as
 * POST). Returns the response so the caller can assert the status.
 */
async function saveLicenseForm(page, pubId) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(res) =>
				new RegExp(`/publications/${pubId}(?:\\?|$)`).test(res.url()) &&
				res.request().method() === 'POST',
			{timeout: 20_000},
		),
		licenseForm(page)
			.getByRole('button', {name: 'Save', exact: true})
			.click(),
	]);
	return response;
}

test.use({user: 'dbarnes'}); // the assigned editor (editorial + production)

test.describe('Publication — License / copyright (Permissions & Disclosure)', () => {
	// Canonical scenarios 1 + 2 (merged) — License URL: on publicknowledge (no
	// journal default license) the field is directly editable with NO Override,
	// while Copyright Holder / Year DO show Override (inherit-until-overridden).
	// A malformed URL is refused on save (url validation) and the publication is
	// unchanged; a valid Creative Commons URL saves and persists on the version.
	test(
		'License URL directly editable (no Override); invalid refused, valid CC URL persists',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `License URL ${tag}`}),
			);
			const pubId = await currentPublicationId(
				page,
				submission.id,
				'publicknowledge',
			);

			await openLicenseTab(page, 'publicknowledge', submission.id, pubId);

			// License URL — no journal default → directly editable, NO Override.
			await expect(fieldControl(page, 'licenseUrl')).toBeEnabled();
			await expect(overrideButton(page, 'licenseUrl')).toHaveCount(0);

			// Copyright Holder / Year — a computed journal default exists → each is
			// disabled behind an Override button (inherit-until-overridden).
			await expect(fieldControl(page, 'copyrightHolder', 'en')).toBeDisabled();
			await expect(overrideButton(page, 'copyrightHolder', 'en')).toBeVisible();
			await expect(fieldControl(page, 'copyrightYear')).toBeDisabled();
			await expect(overrideButton(page, 'copyrightYear')).toBeVisible();
			// … and the descriptions advertise the journal defaults (rules 4/5).
			await expect(fieldDescription(page, 'copyrightHolder', 'en')).toContainText(
				JOURNAL_NAME_EN,
			);
			await expect(fieldDescription(page, 'copyrightYear')).toContainText(
				YEAR_ISSUE_DESC,
			);

			// (a) A malformed License URL is refused on save (400 + field error),
			// and the publication's licenseUrl is left empty.
			await fieldControl(page, 'licenseUrl').fill('not a url');
			const badRes = await saveLicenseForm(page, pubId);
			expect(badRes.status()).toBe(400);
			await expect(
				workflowModal(page).locator('#publicationLicense-licenseUrl-error'),
			).toContainText(INVALID_URL_MESSAGE, {timeout: 20_000});
			const afterBad = await fetchPublication(
				page,
				submission.id,
				pubId,
				'publicknowledge',
			);
			expect(afterBad.licenseUrl ?? '').toBe('');

			// (b) A valid Creative Commons URL saves and persists on the version.
			const ccUrl = 'https://creativecommons.org/licenses/by/4.0/';
			await fieldControl(page, 'licenseUrl').fill(ccUrl);
			const okRes = await saveLicenseForm(page, pubId);
			expect(okRes.status(), await okRes.text()).toBe(200);
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
						).licenseUrl,
					{timeout: 20_000},
				)
				.toBe(ccUrl);
		},
	);

	// Canonical scenario 3 — Override the copyright holder (multilingual) and the
	// copyright year. Both fields start disabled behind Override. The editor
	// overrides Copyright Holder, enters an English statement, toggles French
	// (Canada) and enters a different French statement; overrides Copyright Year
	// and enters an integer. All three per-publication values persist.
	test(
		'override copyright holder (en + fr_CA) and copyright year; all persist',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission} = await pkpApi.createSubmission(
				submittedSpec({tag, title: `Copyright ${tag}`}),
			);
			const pubId = await currentPublicationId(
				page,
				submission.id,
				'publicknowledge',
			);

			await openLicenseTab(page, 'publicknowledge', submission.id, pubId);

			const holderEn = `Copyright ${tag} held by the authors`;
			const holderFr = `Droit d'auteur ${tag} detenu par les auteurs`;
			const year = '2029';

			// Copyright Holder (en): disabled → Override → type the English value.
			await expect(fieldControl(page, 'copyrightHolder', 'en')).toBeDisabled();
			await clickOverride(page, 'copyrightHolder', 'en');
			await fieldControl(page, 'copyrightHolder', 'en').fill(holderEn);

			// Reveal French (Canada), Override its own instance, type a different value.
			await toggleFormLocale(page, 'French (Canada)');
			await expect(
				fieldControl(page, 'copyrightHolder', 'fr_CA'),
			).toBeAttached({timeout: 20_000});
			await clickOverride(page, 'copyrightHolder', 'fr_CA');
			await fieldControl(page, 'copyrightHolder', 'fr_CA').fill(holderFr);

			// Copyright Year: disabled → Override → type an integer year.
			await clickOverride(page, 'copyrightYear');
			await fieldControl(page, 'copyrightYear').fill(year);

			const saveRes = await saveLicenseForm(page, pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);

			// Both copyright-holder locales + the year persist on the version.
			await expect
				.poll(
					async () =>
						JSON.stringify(
							(
								await fetchPublication(
									page,
									submission.id,
									pubId,
									'publicknowledge',
								)
							).copyrightHolder ?? {},
						),
					{timeout: 20_000},
				)
				.toContain(holderEn);
			const pub = await fetchPublication(
				page,
				submission.id,
				pubId,
				'publicknowledge',
			);
			expect(pub.copyrightHolder?.en).toBe(holderEn);
			expect(pub.copyrightHolder?.fr_CA).toBe(holderFr);
			expect(String(pub.copyrightYear)).toBe(year);
		},
	);

	// Canonical scenario 4 (+ issue-basis half of scenario 5) — Inherit the
	// journal defaults at publish. With all three fields left empty, publishing
	// into an issue snapshots the computed journal defaults onto the publication:
	// copyright holder = the journal name (per locale), copyright year = the
	// ISSUE's published year, license = the journal default (empty on
	// publicknowledge, which has no default license). An overridden field would
	// be left untouched (covered by scenario 1/3); here nothing is overridden.
	test(
		'publish snapshots the journal defaults onto an un-overridden publication',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({tag, title: `Inherit ${tag}`}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			const pub = await fetchPublication(
				page,
				submission.id,
				pubId,
				'publicknowledge',
			);

			// Copyright holder snapshotted from the journal name, per locale
			// (copyrightHolderType unset → context name map).
			expect(pub.copyrightHolder?.en).toBe(JOURNAL_NAME_EN);
			expect(pub.copyrightHolder?.fr_CA).toBe(JOURNAL_NAME_FR);

			// Copyright year snapshotted from the ISSUE's datePublished YEAR (issue
			// basis). NB the issue's `year` LABEL is 2014 but its seeded
			// datePublished is the bootstrap date — assert against datePublished so
			// the test is robust across re-seeds (see file header nuance).
			expect(pub.issueId).toBeTruthy();
			const issue = await fetchIssue(page, pub.issueId, 'publicknowledge');
			const issueYear = String(issue.datePublished).slice(0, 4);
			expect(String(pub.copyrightYear)).toBe(issueYear);

			// License URL: publicknowledge has no journal default → nothing is
			// snapshotted; the field stays empty.
			expect(pub.licenseUrl ?? '').toBe('');
		},
	);

	// Canonical scenario 5 — Copyright-year basis drives the default, and the
	// License URL Override toggle appears once a journal default license exists.
	// On a scratch journal set to SUBMISSION-based copyright years + a default
	// license: the year description reads "…based on the publication date" and
	// License URL now shows an Override button (contrast publicknowledge). At
	// publish, an un-overridden year snapshots the PUBLICATION's own publish year
	// (not the issue's) and the license snapshots the journal default.
	test(
		'submission-based copyright year + default license: description, Override, snapshot',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const defaultLicense = 'https://creativecommons.org/licenses/by-nc/4.0/';
			const {context: journal} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
				copyrightYearBasis: 'submission',
				licenseUrl: defaultLicense,
				issues: [{volume: 1, number: 1, year: 2020, published: true}],
			});

			// --- Form state on an un-published submission (inherit/override UI) ---
			const {submission: subForm} = await pkpApi.createSubmission(
				submittedSpec({
					tag: `${tag}f`,
					title: `Basis form ${tag}`,
					journal: journal.path,
					participants: [],
				}),
			);
			const formPub = await currentPublicationId(page, subForm.id, journal.path);
			await openLicenseTab(page, journal.path, subForm.id, formPub);

			// Copyright Year description reflects the SUBMISSION basis.
			await expect(fieldDescription(page, 'copyrightYear')).toContainText(
				YEAR_SUBMISSION_DESC,
			);
			// License URL now has an Override button (journal has a default license)
			// and starts disabled — the opposite of publicknowledge (scenario 1).
			await expect(overrideButton(page, 'licenseUrl')).toBeVisible();
			await expect(fieldControl(page, 'licenseUrl')).toBeDisabled();

			// --- Publish-time snapshot on a second submission (datePublished 2019) ---
			const {submission: subPub, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag: `${tag}p`,
					title: `Basis publish ${tag}`,
					journal: journal.path,
					issue: {volume: 1, number: 1, year: 2020},
					participants: [
						{user: 'dbarnes', role: 'manager', canChangeMetadata: true},
					],
					metadata: {datePublished: '2019-09-01 00:00:00'},
				}),
			);
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			const pub = await fetchPublication(
				page,
				subPub.id,
				publications[0].id,
				journal.path,
			);
			// Submission basis → the publication's OWN publish year (2019), even
			// though it is assigned to an issue whose year label is 2020.
			expect(String(pub.copyrightYear)).toBe('2019');
			// License URL inherited the journal default at publish.
			expect(pub.licenseUrl).toBe(defaultLicense);
			// Copyright holder inherited the scratch journal's name.
			expect(pub.copyrightHolder?.en).toBe(`Scratch context ${tag}`);
		},
	);

	// Canonical scenario 6 — Published-lock (HONOURED, unlike Galleys) + author
	// boundary. On a PUBLISHED version a manager is warn-not-locked: the yellow
	// warning shows, yet License URL stays editable, Save stays enabled, and the
	// edit persists. An author-role user never reaches the tab: the form endpoint
	// refuses the author (live 401) and the author's Publication menu has no
	// Permissions & Disclosure item.
	test(
		'published version: editor warn-not-locked (edit persists); author 401 + no tab',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			// Scratch journal (NO default license → License URL directly editable)
			// with a published issue to publish into.
			const {context: journal} = await pkpApi.createJournal({
				tag,
				users: [
					{username: 'atester', roles: ['author']},
					{username: 'dbarnes', roles: ['manager']},
				],
				issues: [{volume: 1, number: 1, year: 2025, published: true}],
			});
			const {submission, publications} = await pkpApi.createSubmission(
				publishedSpec({
					tag,
					title: `Published license ${tag}`,
					journal: journal.path,
					issue: {volume: 1, number: 1, year: 2025},
					participants: [
						{user: 'dbarnes', role: 'manager', canChangeMetadata: true},
					],
				}),
			);
			const pubId = publications[0].id;
			expect(publications[0].status).toBe(STATUS_PUBLISHED);

			// --- Editor: warned, not locked ---
			await openLicenseTab(page, journal.path, submission.id, pubId);
			await expect(
				workflowModal(page).getByText(EDITOR_EDIT_WARNING),
			).toBeVisible({timeout: 20_000});
			// License URL stays editable and Save stays enabled behind the warning.
			await expect(fieldControl(page, 'licenseUrl')).toBeEnabled();
			await expect(
				licenseForm(page).getByRole('button', {name: 'Save', exact: true}),
			).toBeEnabled();

			// The edit persists on the published version (warn-not-lock confirmed —
			// the license form HONOURS the lock, opposite of the Galleys manager).
			const ccUrl = 'https://creativecommons.org/licenses/by-sa/4.0/';
			await fieldControl(page, 'licenseUrl').fill(ccUrl);
			const saveRes = await saveLicenseForm(page, pubId);
			expect(saveRes.status(), await saveRes.text()).toBe(200);
			await expect
				.poll(
					async () =>
						(await fetchPublication(page, submission.id, pubId, journal.path))
							.licenseUrl,
					{timeout: 20_000},
				)
				.toBe(ccUrl);

			// --- Author: hard-locked out of the tab entirely ---
			const authorCtx = await asUser('atester');
			// The form endpoint excludes ROLE_ID_AUTHOR — OJS answers an
			// authenticated-but-unauthorized role with 401 (patterns.md wave 2).
			const authorFormRes = await authorCtx.request.get(
				`/index.php/${journal.path}/api/v1/submissions/${submission.id}/publications/${pubId}/_components/permissionDisclosure`,
			);
			expect([401, 403]).toContain(authorFormRes.status());

			// And the author's Publication menu has no Permissions & Disclosure
			// item. Open the author-reachable Metadata pane so the nav renders.
			const authorPage = await authorCtx.newPage();
			await authorPage.goto(
				`/index.php/${journal.path}/en/dashboard/mySubmissions` +
					`?workflowSubmissionId=${submission.id}` +
					`&workflowMenuKey=publication_${pubId}_metadata`,
				{waitUntil: 'commit'},
			);
			const authorNav = workflowModal(authorPage).locator('nav');
			await expect(
				authorNav.getByText('Metadata', {exact: true}).first(),
			).toBeVisible({timeout: 20_000});
			await expect(
				authorNav.getByText('Permissions & Disclosure', {exact: true}),
			).toHaveCount(0);
		},
	);
});
