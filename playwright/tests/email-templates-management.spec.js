// @ts-check
const {test, expect} = require('../support/fixtures.js');
const {
	setTinyMceContent,
} = require('../../lib/pkp/playwright/support/tinymce.js');
const {
	ReviewerManagerPage,
} = require('../../lib/pkp/playwright/pages/ReviewerManagerPage.js');

/**
 * Email templates management — the Manage Emails catalogue (browse/filter,
 * edit + reset a mailable's default template, add/remove/role-scope alternate
 * templates, Reset All) plus the site-admin bulk-email setup. One test per
 * canonical scenario of docs/product/specs/email-templates-management.md
 * (7 named, 7 tests, 1:1).
 *
 * WHAT IS DRIVEN LIVE:
 *   - The REAL Vue ManageEmailsPage: catalogue list, sidebar filters, search,
 *     the EditMailableModal (Templates list, Default badge, Reset/Remove
 *     buttons) and the EditTemplateModal (the editEmailTemplate pkp-form with
 *     the isUnrestricted radio + role checkboxes), and the Reset All dialog.
 *   - The composer effect-link (spec rule 9): the Add-Reviewer form on a
 *     review-round submission of the SAME scratch journal — its
 *     personalMessage prefill and its "Choose a message" template picker
 *     (select[name=template], hidden entirely when only one template is
 *     accessible — ReviewerForm::getEmailTemplates + reviewerFormFooter.tpl).
 *   - The sent-mail side of rule 9 via Mailpit: the Add-Reviewer send delivers
 *     the EDITED Review Request text with variables rendered. (The spec's
 *     scenario 2 words the sent-mail half through an Accept decision on the
 *     Submission Accepted mailable — that path is pinned by the retained
 *     round-1 e2e test the spec cites; here the same claim is proven on the
 *     same mailable the scenario edits, which keeps the test 1:1 with the
 *     composer surface it drives.)
 *   - The two admin bulk-email forms: Site Settings → Bulk Emails
 *     (per-journal enable checklist) and the Hosted-Journals wizard's
 *     Restrict Bulk Emails tab (role checklist / pointer note), plus the
 *     `_email` bulk endpoint's 403/200/400 verdicts and the Users & Roles
 *     Notify tab appearing/losing role options.
 *
 * KNOWN LEDGER ROWS asserted AS DOCUMENTED (feedback discipline):
 *   - Row 127: the emailTemplates read routes name sub-editors/assistants but
 *     CanAccessSettingsPolicy vetoes them — a section editor's GET is 401
 *     (test 1 asserts the documented 401, not a fix).
 *   - Row 128: saving a template WITHOUT the access fields wipes its group
 *     assignments + unrestricted marker (API-only for role-assignable
 *     mailables). Test 5 performs the wipe and proves the composer
 *     consequence (manager-only visibility); test 2 pins the boundary (a UI
 *     edit submits the radio, so NO wipe); test 6 proves Reset All heals a
 *     wiped marker.
 *   - Row 129 (cosmetic): "Add Template" opens a modal titled "Edit Template"
 *     (test 4 asserts the mislabel as-built).
 *
 * AUTH: `test.use({user: 'dbarnes'})` — dbarnes is manager of each test's OWN
 * scratch journal. The section editor (dbuskins), reviewer (jjanssen), author
 * (atester) and site admin (admin) ride site-wide sessions via `asUser`.
 *
 * PARALLEL + isolation: every test seeds its OWN scratch journal (unique
 * hyphenless `emt…` tag) and mutates email templates ONLY there —
 * publicknowledge's templates are load-bearing suite-wide (other features
 * assert on stock mailable bodies) and are NEVER touched. The bulk-email test
 * writes the site-level enableBulkEmails list, which is a per-journal id
 * list: it adds/removes only its own scratch journal id, so parallel tests
 * asserting "Notify tab absent" on THEIR journals are unaffected. Mailpit
 * reads are scoped by recipient + tag. No hard-coded waits.
 */

const MANAGER = 'dbarnes';
const REVIEW_REQUEST = 'REVIEW_REQUEST';
const REVIEW_REQUEST_NAME = 'Review Request';

/** A unique, hyphenless, lowercased alphanumeric token (parallel + re-run isolation). */
function uniqueTag(prefix = 'emt') {
	const workerIndex = test.info().parallelIndex;
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}${workerIndex}x${rand}`;
}

/** Seed a scratch journal (dbarnes as manager + spec passthrough) → context. */
async function seedJournal(pkpApi, tag, extra = {}) {
	const {context} = await pkpApi.createJournal({
		tag,
		primaryLocale: 'en',
		supportedLocales: ['en'],
		users: [{username: MANAGER, roles: ['manager']}, ...(extra.users ?? [])],
		...Object.fromEntries(
			Object.entries(extra).filter(([k]) => k !== 'users'),
		),
	});
	return context;
}

/**
 * A submitted submission in external review (round 1, no reviewers yet) on a
 * scratch journal — the Add-Reviewer composer surface. The tag rides in the
 * title so {$submissionTitle} interpolations stay Mailpit-scopable.
 */
function inReviewSpec({tag, journal, title, participants}) {
	return {
		tag,
		journal,
		submitter: 'atester',
		section: 'ART',
		locale: 'en',
		participants: participants ?? [{user: MANAGER, role: 'editor'}],
		decisions: [{type: 'sendExternalReview', by: MANAGER}],
		reviewRounds: [{reviewers: []}],
		publications: [{metadata: {title: {en: title}}}],
	};
}

/** Read the session CSRF token from a loaded backend page (window.pkp / meta). */
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

/** Read another context's CSRF token off the site-level profile page. */
const csrfCache = new WeakMap();
async function csrfFor(ctx) {
	if (csrfCache.has(ctx)) return csrfCache.get(ctx);
	const res = await ctx.request.get('/index.php/index/user/profile');
	const html = await res.text();
	const m = html.match(/name="csrf-token" content="([^"]+)"/);
	if (!m) throw new Error(`csrf meta tag not found (${res.url()})`);
	csrfCache.set(ctx, m[1]);
	return m[1];
}

// ── Templates API helpers (the same endpoints the page's Vue calls) ──────────

function tplApi(path, key = '') {
	return `/index.php/${path}/api/v1/emailTemplates${key ? `/${key}` : ''}`;
}

/** GET a template; returns {status, body} (manager session required). */
async function getTemplate(requestCtx, path, key) {
	const res = await requestCtx.get(tplApi(path, key));
	return {status: res.status(), body: res.ok() ? await res.json() : null};
}

async function putTemplate(requestCtx, path, key, data, csrf) {
	return requestCtx.put(tplApi(path, key), {
		headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
		data,
	});
}

async function postTemplate(requestCtx, path, data, csrf) {
	return requestCtx.post(tplApi(path), {
		headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
		data,
	});
}

/**
 * The journal's user groups keyed by localized name (manager session).
 * UserGroupResource flattens `name` to the localized string.
 */
async function userGroupsByName(requestCtx, path) {
	const res = await requestCtx.get(`/index.php/${path}/api/v1/userGroups`);
	expect(res.ok(), `GET userGroups ${res.status()}`).toBeTruthy();
	const map = {};
	for (const g of (await res.json()).items ?? []) {
		map[g.name] = g;
	}
	return map;
}

// ── Manage Emails page helpers ────────────────────────────────────────────────

function escapeRegex(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Open the Manage Emails catalogue and wait for the list to render. */
async function gotoManageEmails(page, path) {
	await page.goto(`/index.php/${path}/management/settings/manageEmails`);
	await expect(
		page.getByRole('heading', {name: 'Manage Emails'}),
	).toBeVisible({timeout: 20_000});
	await expect(catalogueItems(page).first()).toBeVisible({timeout: 20_000});
}

function catalogueItems(page) {
	return page.locator('.manageEmails__listPanel .listPanel__item');
}

/** The catalogue item whose title is EXACTLY `name` ("Review Request" must not match "Review Request Subsequent"). */
function mailableItem(page, name) {
	return catalogueItems(page).filter({
		has: page.locator('.listPanel__itemTitle', {
			hasText: new RegExp(`^\\s*${escapeRegex(name)}\\s*$`),
		}),
	});
}

/**
 * Open a multi-template mailable's modal (EditMailableModal) from the
 * catalogue. The Edit button's accessible name is the sr-only
 * "Edit {$name}" (the visible "Edit" is aria-hidden — ledger row 129b).
 */
async function openMailableModal(page, name) {
	await mailableItem(page, name)
		.getByRole('button', {name: `Edit ${name}`})
		.click();
	const modal = page.locator('[data-cy="active-modal"]');
	await expect(
		modal.getByRole('heading', {name: 'Templates'}),
	).toBeVisible({timeout: 20_000});
	return modal;
}

/** A template row inside the mailable modal's Templates list. */
function templateRow(modal, templateName) {
	return modal.locator('.listPanel__item').filter({
		hasText: templateName,
	});
}

/**
 * Open the template editor from a Templates-list row (or the Add Template
 * button when `row` is null) and wait for the editEmailTemplate form.
 * Returns the (new) active side modal holding the form.
 */
async function openTemplateEditor(page, modalOrRow, {add = false} = {}) {
	await modalOrRow
		.getByRole('button', {name: add ? 'Add Template' : 'Edit', exact: true})
		.first()
		.click();
	const editor = page.locator('[data-cy="active-modal"]');
	await expect(
		editor.locator('#editEmailTemplate-subject-control-en'),
	).toBeVisible({timeout: 20_000});
	return editor;
}

/** Save the template editor form and return the API response (POST or tunnelled PUT). */
async function saveTemplateEditor(page, editor) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(res) =>
				/\/api\/v1\/emailTemplates/.test(res.url()) &&
				res.request().method() === 'POST' &&
				res.ok(),
			{timeout: 20_000},
		),
		editor.getByRole('button', {name: 'Save', exact: true}).click(),
	]);
	// The modal closes itself (1s delayed) on success — anchor on the form
	// leaving the DOM so the next UI step never races the overlay.
	await expect(
		editor.locator('#editEmailTemplate-subject-control-en'),
	).toBeHidden({timeout: 15_000});
	return response;
}

// ── Add-Reviewer composer helpers (the effect-link surface) ──────────────────

/**
 * Drive the Add-Reviewer modal to the assignment form for jjanssen and
 * return {rm, modal, form}. The form's footer holds the template picker.
 */
async function openReviewerAssignmentForm(userPage, journalPath, submissionId) {
	const rm = new ReviewerManagerPage(userPage);
	await rm.gotoWorkflow(submissionId, {journalPath});
	const modal = await rm.openAddReviewerModal();
	await rm.searchSelectPanel(modal, 'jjanssen');
	const form = await rm.selectReviewer(modal, 'Julie Janssen');
	return {rm, modal, form};
}

/**
 * The template picker's option labels, or null when the picker is hidden
 * (≤ 1 accessible template server-side → reviewerFormFooter.tpl renders a
 * hidden input instead of the select). NOTE: on the Add-Reviewer form the
 * select virtually always renders — AdvancedSearchReviewerForm adds
 * REVIEW_REQUEST_SUBSEQUENT to the offering and the client JS then prunes
 * whichever of the two defaults doesn't apply to the picked reviewer
 * (AdvancedReviewerSearchHandler.js) — so a restricted ALTERNATE manifests
 * as its OPTION disappearing, not as the picker collapsing.
 */
async function templatePickerOptions(form) {
	const select = form.locator('select[name="template"]').last();
	if ((await select.count()) === 0 || !(await select.isVisible())) {
		return null;
	}
	return select.locator('option').allTextContents();
}

test.use({user: MANAGER});

test.describe('Email templates management', () => {
	// ── Scenario 1 — browse the email catalogue + permission boundary ─────────
	// The manager opens Manage Emails and sees all 66 mailables with
	// descriptions; the "Review" group + Sent From "System" filters narrow the
	// list; the search box matches by name. A section editor hitting the same
	// URL is bounced to access denied, and (row 127 / footnote c) the
	// emailTemplates + mailables APIs answer 401 despite the read routes
	// naming the sub-editor role.
	test(
		'browses, filters and searches the catalogue; section editor bounced (row 127 API 401)',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, asUser}) => {
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag, {
				users: [{username: 'dbuskins', roles: ['sectionEditor']}],
			});

			await gotoManageEmails(page, ctx.path);

			// The full catalogue: 66 active mailables (55 shared + 11 OJS),
			// name + description per entry (spec rule 1).
			await expect(catalogueItems(page)).toHaveCount(66, {timeout: 20_000});
			const reviewRequestItem = mailableItem(page, REVIEW_REQUEST_NAME);
			await expect(reviewRequestItem).toHaveCount(1);
			await expect(
				reviewRequestItem.locator('.listPanel__itemSubtitle'),
			).not.toBeEmpty();

			// Filters: workflow group "Review" + Sent From "System" → the
			// automated review reminders remain, editor-sent Review Request
			// does not.
			await page.getByRole('button', {name: 'Review', exact: true}).click();
			await page.getByRole('button', {name: 'System', exact: true}).click();
			await expect(
				mailableItem(page, 'Review Response Overdue (Automated)'),
			).toHaveCount(1);
			await expect(mailableItem(page, REVIEW_REQUEST_NAME)).toHaveCount(0);

			// Toggle both filters back off — the full list returns.
			await page.getByRole('button', {name: 'Review', exact: true}).click();
			await page.getByRole('button', {name: 'System', exact: true}).click();
			await expect(catalogueItems(page)).toHaveCount(66);

			// The search box narrows by name (client-side, debounced keyup).
			const search = page.locator('.pkpSearch__input');
			await search.pressSequentially('Review Request');
			await expect(mailableItem(page, REVIEW_REQUEST_NAME)).toHaveCount(1, {
				timeout: 10_000,
			});
			await expect(mailableItem(page, 'Password Reset')).toHaveCount(0);

			// The section editor is bounced from the page…
			const seCtx = await asUser('dbuskins');
			const pageRes = await seCtx.request.get(
				`/index.php/${ctx.path}/management/settings/manageEmails`,
			);
			expect(pageRes.url()).toMatch(/authorizationDenied/);

			// …and (row 127) the read APIs deny the role the routes name:
			// CanAccessSettingsPolicy vetoes the section editor → 401. Asserted
			// as documented, NOT as a fix.
			const seTemplates = await seCtx.request.get(
				`${tplApi(ctx.path)}?searchPhrase=review`,
			);
			expect(seTemplates.status(), 'row 127: emailTemplates GET 401').toBe(401);
			const seMailables = await seCtx.request.get(
				`/index.php/${ctx.path}/api/v1/mailables`,
			);
			expect(seMailables.status(), 'mailables GET 401').toBe(401);
		},
	);

	// ── Scenario 2 — rewrite a default template and see it used ───────────────
	// The manager edits Review Request's subject/body with marker text through
	// the REAL template editor. The Add-Reviewer composer prefills the marker
	// body, and the sent request delivers the edited text with the template
	// variables rendered (spec rule 9). The UI save submits the access radio,
	// so the unrestricted marker survives (rule 7's boundary — the row-128
	// wipe is API-only for role-assignable mailables; test 5 proves the wipe).
	test(
		'edited default prefills the Add-Reviewer composer and reaches the sent mail',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi, pkpMail}) => {
			test.slow();
			const tag = uniqueTag();
			const subjectMarker = `EMT subject ${tag}`;
			const bodyMarker = `EMT body ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				users: [
					{username: 'jjanssen', roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
			});
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({tag, journal: ctx.path, title: `EMT edit ${tag}`}),
			);

			// Edit the default template through the real modals.
			await gotoManageEmails(page, ctx.path);
			const modal = await openMailableModal(page, REVIEW_REQUEST_NAME);
			const editor = await openTemplateEditor(
				page,
				templateRow(modal, REVIEW_REQUEST_NAME),
			);
			await editor
				.locator('#editEmailTemplate-subject-control-en')
				.fill(subjectMarker);
			await setTinyMceContent(
				page,
				'editEmailTemplate-body-control-en',
				`<p>${bodyMarker}: Dear {$recipientName}, please respond by {$responseDueDate}.</p>`,
			);
			const saveRes = await saveTemplateEditor(page, editor);
			const echoed = await saveRes.json();
			expect(echoed.subject.en).toBe(subjectMarker);
			expect(echoed.body.en).toContain(bodyMarker);
			// Rule 7 boundary: the UI always submits the radio for a
			// role-assignable mailable, so the save does NOT wipe the marker.
			expect(echoed.isUnrestricted).toBe(true);

			// The Add-Reviewer composer prefills the edited body verbatim.
			const {rm, modal: composerModal, form} =
				await openReviewerAssignmentForm(page, ctx.path, submission.id);
			await rm.awaitRichTextContains(form, 'personalMessage', bodyMarker);
			await rm.ensureDueDatesOrdered(form);
			await rm.submitLegacyForm(form, 'Add Reviewer', composerModal);
			await expect(rm.row('Julie Janssen')).toContainText('Request Sent', {
				timeout: 20_000,
			});

			// The sent request carries the edited subject + body with the
			// variables rendered — no raw {$…} placeholders survive.
			const [msg] = await pkpMail.find({
				to: 'jjanssen@mailinator.com',
				contains: tag,
				timeoutMs: 30_000,
			});
			expect(msg.Subject).toContain(subjectMarker);
			const full = await pkpMail.fullMessage(msg.ID);
			const sentBody = `${full.HTML}${full.Text}`;
			expect(sentBody).toContain(bodyMarker);
			expect(sentBody).toContain('Julie Janssen'); // {$recipientName} rendered
			expect(sentBody).not.toContain('{$');
		},
	);

	// ── Scenario 3 — reset a modified template ─────────────────────────────────
	// A pristine default offers no Reset button; after an edit the button
	// appears; Reset (confirm dialog) restores the shipped subject/body
	// immediately and the button disappears again (spec rule 4).
	test(
		'resets a modified default template to the shipped text',
		{tag: '@regression'},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);

			await gotoManageEmails(page, ctx.path);

			// Capture the shipped text before any modification.
			const pristine = (await getTemplate(page.request, ctx.path, REVIEW_REQUEST))
				.body;
			expect(pristine.id, 'pristine default has no override row').toBeFalsy();

			// Pristine: the default row is badged and offers Edit but no Reset.
			let modal = await openMailableModal(page, REVIEW_REQUEST_NAME);
			const row = templateRow(modal, REVIEW_REQUEST_NAME);
			await expect(row.getByText('Default', {exact: true})).toBeVisible();
			await expect(
				row.getByRole('button', {name: 'Reset', exact: true}),
			).toHaveCount(0);

			// Modify subject + body through the editor.
			const editor = await openTemplateEditor(page, row);
			await editor
				.locator('#editEmailTemplate-subject-control-en')
				.fill(`EMT modified subject ${tag}`);
			await setTinyMceContent(
				page,
				'editEmailTemplate-body-control-en',
				`<p>EMT modified body ${tag}</p>`,
			);
			await saveTemplateEditor(page, editor);

			// The row now offers Reset (an override exists).
			const resetButton = row.getByRole('button', {name: 'Reset', exact: true});
			await expect(resetButton).toBeVisible({timeout: 15_000});

			// Reset → warning dialog → the override is deleted and the row
			// re-fetched: the Reset button disappears again.
			await resetButton.click();
			const dialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: 'Reset Template'});
			await expect(dialog).toBeVisible({timeout: 10_000});
			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes(`/api/v1/emailTemplates/${REVIEW_REQUEST}`) &&
						res.request().method() === 'POST' && // tunnelled DELETE
						res.ok(),
					{timeout: 20_000},
				),
				dialog
					.getByRole('button', {name: 'Reset Template', exact: true})
					.click(),
			]);
			await expect(resetButton).toHaveCount(0, {timeout: 15_000});

			// The shipped subject/body are back (API round-trip).
			const fresh = (await getTemplate(page.request, ctx.path, REVIEW_REQUEST))
				.body;
			expect(fresh.subject.en).toBe(pristine.subject.en);
			expect(fresh.body.en).toBe(pristine.body.en);
			expect(fresh.id).toBeFalsy();
		},
	);

	// ── Scenario 4 — offer an alternate template ───────────────────────────────
	// Add Template on Review Request creates a named alternate (the modal is
	// mislabeled "Edit Template" — ledger row 129a, asserted as-built); a
	// section editor's Add-Reviewer picker then offers it next to the default;
	// Remove deletes it after a confirm naming the template (spec rule 5).
	test(
		'adds an alternate (row 129a mislabel), offers it in the picker, removes it',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const altName = `EMT Friendly ${tag}`;
			const altSubject = `EMT alt subject ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				users: [
					{username: 'dbuskins', roles: ['sectionEditor']},
					{username: 'jjanssen', roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
			});
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					journal: ctx.path,
					title: `EMT alt ${tag}`,
					participants: [
						{user: MANAGER, role: 'editor'},
						{user: 'dbuskins', role: 'sectionEditor'},
					],
				}),
			);

			// Add Template through the mailable modal.
			await gotoManageEmails(page, ctx.path);
			const modal = await openMailableModal(page, REVIEW_REQUEST_NAME);
			const editor = await openTemplateEditor(page, modal, {add: true});

			// Row 129a (cosmetic, as-built): the ADD modal is titled "Edit
			// Template" — the add-title branch is unreachable.
			await expect(
				editor.locator('[data-cy="sidemodal-header"]'),
			).toContainText('Edit Template');

			await editor.locator('#editEmailTemplate-name-control-en').fill(altName);
			await editor
				.locator('#editEmailTemplate-subject-control-en')
				.fill(altSubject);
			await setTinyMceContent(
				page,
				'editEmailTemplate-body-control-en',
				`<p>EMT alt body ${tag}</p>`,
			);
			// Unrestricted is the pre-checked default (Fields table).
			await expect(
				editor.locator('input[name="isUnrestricted"][value="true"]').first(),
			).toBeChecked();
			const saveRes = await saveTemplateEditor(page, editor);
			const created = await saveRes.json();
			expect(created.alternateTo).toBe(REVIEW_REQUEST);
			expect(created.name.en).toBe(altName);
			const altKey = created.key;

			// The alternate is listed in the Templates list with a Remove button.
			const altRow = templateRow(modal, altName);
			await expect(altRow).toBeVisible({timeout: 15_000});
			await expect(
				altRow.getByRole('button', {name: 'Remove', exact: true}),
			).toBeVisible();

			// The section editor's Add-Reviewer picker offers default + alternate.
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.newPage();
			const {form: seForm} = await openReviewerAssignmentForm(
				sePage,
				ctx.path,
				submission.id,
			);
			const seOptions = await templatePickerOptions(seForm);
			expect(seOptions).not.toBeNull();
			expect(seOptions).toEqual(
				expect.arrayContaining([REVIEW_REQUEST_NAME, altName]),
			);
			expect(seOptions).toHaveLength(2);

			// Remove — the confirm names the template; the row disappears and
			// the key answers 404.
			await altRow.getByRole('button', {name: 'Remove', exact: true}).click();
			const dialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: 'Remove Template'});
			await expect(dialog).toBeVisible({timeout: 10_000});
			await expect(dialog).toContainText(altSubject);
			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes(`/api/v1/emailTemplates/${altKey}`) &&
						res.request().method() === 'POST' && // tunnelled DELETE
						res.ok(),
					{timeout: 20_000},
				),
				dialog
					.getByRole('button', {name: 'Remove Template', exact: true})
					.click(),
			]);
			await expect(templateRow(modal, altName)).toHaveCount(0, {
				timeout: 15_000,
			});
			expect((await getTemplate(page.request, ctx.path, altKey)).status).toBe(
				404,
			);
		},
	);

	// ── Scenario 5 — limit a template to specific roles (+ row 128) ────────────
	// Restricting an alternate to Authors removes it from the section editor's
	// picker while the manager keeps seeing it; adding the Section-editor
	// group restores it (spec rule 6). Then the row-128 wipe: an API save
	// WITHOUT the access fields deletes the group assignments + unrestricted
	// marker, leaving the template manager-only — asserted as documented.
	test(
		'role-scopes an alternate: SE loses/regains it; access-fieldless save wipes (row 128)',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const altName = `EMT Scoped ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {
				users: [
					{username: 'dbuskins', roles: ['sectionEditor']},
					{username: 'jjanssen', roles: ['reviewer']},
					{username: 'atester', roles: ['author']},
				],
			});
			const {submission} = await pkpApi.createSubmission(
				inReviewSpec({
					tag,
					journal: ctx.path,
					title: `EMT scoped ${tag}`,
					participants: [
						{user: MANAGER, role: 'editor'},
						{user: 'dbuskins', role: 'sectionEditor'},
					],
				}),
			);

			// Seed the alternate over the API (the UI add path is scenario 4's).
			await gotoManageEmails(page, ctx.path);
			const csrf = await csrfToken(page);
			const createRes = await postTemplate(
				page.request,
				ctx.path,
				{
					name: {en: altName},
					subject: {en: `EMT scoped subject ${tag}`},
					body: {en: `<p>EMT scoped body ${tag}</p>`},
					alternateTo: REVIEW_REQUEST,
					isUnrestricted: true,
					assignedUserGroupIds: [],
				},
				csrf,
			);
			expect(createRes.status(), await createRes.text()).toBe(200);
			const altKey = (await createRes.json()).key;
			const groups = await userGroupsByName(page.request, ctx.path);
			const authorGid = groups['Author'].id;
			const seGid = groups['Section editor'].id;

			// Unrestricted: the section editor's picker offers it.
			const seCtx = await asUser('dbuskins');
			const sePage = await seCtx.newPage();
			let seOptions = await templatePickerOptions(
				(await openReviewerAssignmentForm(sePage, ctx.path, submission.id))
					.form,
			);
			expect(seOptions).toContain(altName);

			// The manager flips it to "Limit access" + Authors only through the
			// REAL editor (the radio reveals the role checkboxes — showWhen).
			const modal = await openMailableModal(page, REVIEW_REQUEST_NAME);
			const editor = await openTemplateEditor(page, templateRow(modal, altName));
			await expect(
				editor.getByRole('checkbox', {name: 'Author', exact: true}),
			).toBeHidden();
			await editor
				.locator('input[name="isUnrestricted"][value="false"]')
				.first()
				.check();
			const authorBox = editor.getByRole('checkbox', {
				name: 'Author',
				exact: true,
			});
			await expect(authorBox).toBeVisible(); // revealed by the radio flip
			await authorBox.check();
			const flipRes = await saveTemplateEditor(page, editor);
			const flipped = await flipRes.json();
			expect(flipped.isUnrestricted).toBe(false);
			expect(flipped.assignedUserGroupIds).toEqual([authorGid]);

			// The section editor's picker loses it (only the default remains).
			seOptions = await templatePickerOptions(
				(await openReviewerAssignmentForm(sePage, ctx.path, submission.id))
					.form,
			);
			expect(seOptions, 'restricted alternate gone for the SE').not.toContain(
				altName,
			);
			expect(seOptions).toContain(REVIEW_REQUEST_NAME);

			// …while the manager keeps seeing it (managers see everything).
			const managerOptions = await templatePickerOptions(
				(await openReviewerAssignmentForm(page, ctx.path, submission.id))
					.form,
			);
			expect(managerOptions).toContain(altName);

			// Adding the Section-editor group restores it for the SE.
			const addSeRes = await putTemplate(
				page.request,
				ctx.path,
				altKey,
				{isUnrestricted: false, assignedUserGroupIds: [authorGid, seGid]},
				csrf,
			);
			expect(addSeRes.status(), await addSeRes.text()).toBe(200);
			seOptions = await templatePickerOptions(
				(await openReviewerAssignmentForm(sePage, ctx.path, submission.id))
					.form,
			);
			expect(seOptions).toContain(altName);

			// ⚠ Row 128 (as documented, NOT a fix): a save omitting the access
			// fields treats "nothing submitted" as "assign to nobody" — the
			// group assignments AND the unrestricted marker are wiped, leaving
			// the template visible to managers/admins only.
			const wipeRes = await putTemplate(
				page.request,
				ctx.path,
				altKey,
				{subject: {en: `EMT wiped subject ${tag}`}},
				csrf,
			);
			expect(wipeRes.status(), await wipeRes.text()).toBe(200);
			const wiped = (await getTemplate(page.request, ctx.path, altKey)).body;
			expect(wiped.isUnrestricted, 'row 128: marker wiped').toBe(false);
			expect(wiped.assignedUserGroupIds, 'row 128: groups wiped').toEqual([]);

			// Composer consequence: gone for the SE again (manager-only now).
			seOptions = await templatePickerOptions(
				(await openReviewerAssignmentForm(sePage, ctx.path, submission.id))
					.form,
			);
			expect(
				seOptions,
				'row 128: manager-only after the wipe',
			).not.toContain(altName);
			expect(seOptions).toContain(REVIEW_REQUEST_NAME);
		},
	);

	// ── Scenario 6 — reset all templates ───────────────────────────────────────
	// Reset All (warning dialog) deletes every journal-local template row:
	// the edited default reverts to shipped text, the stock alternates are
	// re-installed fresh (new ids), the custom alternate is PERMANENTLY
	// deleted, and a previously wiped unrestricted marker is healed (rule 8).
	test(
		'Reset All reverts overrides, reinstalls stock alternates, deletes customs, heals row-128 wipe',
		{tag: ['@smoke', '@regression']},
		async ({page, pkpApi}) => {
			test.slow();
			const tag = uniqueTag();
			const ctx = await seedJournal(pkpApi, tag);

			await gotoManageEmails(page, ctx.path);
			const csrf = await csrfToken(page);

			// Shipped state to compare against.
			const pristine = (await getTemplate(page.request, ctx.path, REVIEW_REQUEST))
				.body;
			const stockAlt = (await getTemplate(page.request, ctx.path, 'COPYEDIT_REQUEST'))
				.body;
			expect(stockAlt.id, 'stock alternates are journal rows').toBeTruthy();

			// An access-fieldless override of the default — the row-128 wipe —
			// plus a custom alternate that Reset All must permanently delete.
			const editRes = await putTemplate(
				page.request,
				ctx.path,
				REVIEW_REQUEST,
				{subject: {en: `EMT overridden ${tag}`}},
				csrf,
			);
			expect(editRes.status(), await editRes.text()).toBe(200);
			const wiped = (await getTemplate(page.request, ctx.path, REVIEW_REQUEST))
				.body;
			expect(wiped.subject.en).toContain(tag);
			expect(wiped.isUnrestricted, 'row 128 wipe in place').toBe(false);

			const customRes = await postTemplate(
				page.request,
				ctx.path,
				{
					name: {en: `EMT Custom ${tag}`},
					subject: {en: `EMT custom subject ${tag}`},
					body: {en: `<p>EMT custom body ${tag}</p>`},
					alternateTo: REVIEW_REQUEST,
					isUnrestricted: true,
					assignedUserGroupIds: [],
				},
				csrf,
			);
			expect(customRes.status(), await customRes.text()).toBe(200);
			const customKey = (await customRes.json()).key;

			// Reset All through the real header button + warning dialog.
			await gotoManageEmails(page, ctx.path);
			await page.getByRole('button', {name: 'Reset All', exact: true}).click();
			const dialog = page
				.locator('[data-cy="dialog"]')
				.filter({hasText: 'all modifications to the email templates will be lost'});
			await expect(dialog).toBeVisible({timeout: 10_000});
			// The response body (the deleted-keys list) can't be read here:
			// the page's success callback fires window.location.reload(),
			// which evicts the resource before json() resolves. The wipe's
			// full extent is asserted through the API round-trips below
			// instead; the ok-response is the synchronization anchor.
			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes('/api/v1/emailTemplates/restoreDefaults') &&
						res.ok(),
					{timeout: 30_000},
				),
				dialog.getByRole('button', {name: 'Reset All', exact: true}).click(),
			]);
			// The page reloads itself after the reset.
			await expect(
				page.getByRole('heading', {name: 'Manage Emails'}),
			).toBeVisible({timeout: 20_000});

			// The override reverted to shipped text AND the wiped unrestricted
			// marker is healed (rule 8 — Reset All heals; single reset doesn't).
			const restored = (await getTemplate(page.request, ctx.path, REVIEW_REQUEST))
				.body;
			expect(restored.subject.en).toBe(pristine.subject.en);
			expect(restored.body.en).toBe(pristine.body.en);
			expect(restored.id).toBeFalsy();
			expect(restored.isUnrestricted, 'row-128 wipe healed').toBe(true);

			// The custom alternate is gone for good; the stock alternate came
			// back as a FRESH row (re-installed, new id).
			expect(
				(await getTemplate(page.request, ctx.path, customKey)).status,
			).toBe(404);
			const freshStock = (
				await getTemplate(page.request, ctx.path, 'COPYEDIT_REQUEST')
			).body;
			expect(freshStock.id).toBeTruthy();
			expect(freshStock.id).not.toBe(stockAlt.id);
			expect(freshStock.alternateTo).toBe(stockAlt.alternateTo);
		},
	);

	// ── Scenario 7 — set up bulk email ─────────────────────────────────────────
	// The two-level gate (rules 11/12): the site admin checks the journal on
	// Site Settings → Bulk Emails (level 1 — Notify tab + endpoint unlock),
	// then excludes Readers on the wizard's Restrict Bulk Emails tab (level 2
	// — option dropped + send refused). The manager can neither reach the
	// wizard nor store the restriction (400 admin-only). Unchecking the
	// journal returns the endpoint to 403-disabled.
	test(
		'bulk email: site enable gate, Reader restriction, manager walled, disable again',
		{tag: '@regression'},
		async ({page, pkpApi, asUser}) => {
			test.slow();
			const tag = uniqueTag();
			const journalName = `EMT Bulk ${tag}`;
			const ctx = await seedJournal(pkpApi, tag, {name: {en: journalName}});
			const emailApi = `/index.php/${ctx.path}/api/v1/_email`;
			const wizardUrl = `/index.php/index/admin/wizard/${ctx.id}`;

			// Manager baseline: no Notify tab, bulk endpoint 403-disabled.
			await page.goto(`/index.php/${ctx.path}/management/settings/access`);
			await expect(page.getByRole('tab', {name: 'Users'})).toBeVisible({
				timeout: 20_000,
			});
			await expect(page.getByRole('tab', {name: 'Notify'})).toHaveCount(0);
			const csrf = await csrfToken(page);
			const groups = await userGroupsByName(page.request, ctx.path);
			const readerGid = groups['Reader'].id;
			const authorGid = groups['Author'].id;
			const bulkSend = (userGroupIds) =>
				page.request.post(emailApi, {
					headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
					data: {
						subject: `EMT bulk ${tag}`,
						body: `<p>EMT bulk body ${tag}</p>`,
						userGroupIds,
					},
				});
			let sendRes = await bulkSend([readerGid]);
			expect(sendRes.status(), 'level 1 closed').toBe(403);
			expect(await sendRes.text()).toContain(
				'has not been enabled for this journal',
			);

			// Admin pre-state: the wizard's Restrict tab shows the pointer note
			// instead of the form while the journal is not bulk-enabled.
			const adminCtx = await asUser('admin');
			const adminPage = await adminCtx.newPage();
			await adminPage.goto(wizardUrl);
			await adminPage.locator('#restrictBulkEmails-button').click();
			const restrictPanel = adminPage.locator('#restrictBulkEmails');
			await expect(restrictPanel).toContainText(
				'The bulk email feature has been disabled for this journal',
			);
			await expect(
				restrictPanel.getByRole('checkbox', {name: 'Reader', exact: true}),
			).toHaveCount(0);

			// Level 1: the admin checks the journal on the REAL Site Settings →
			// Bulk Emails form (a per-journal id list — only this journal's
			// entry is touched, parallel-safe).
			await adminPage.goto('/index.php/index/admin/settings');
			await adminPage.locator('#bulkEmails-button').click();
			const bulkPanel = adminPage.locator('#bulkEmails');
			await expect(bulkPanel.locator('form').first()).toBeVisible({
				timeout: 20_000,
			});
			await bulkPanel
				.getByRole('checkbox', {name: journalName, exact: true})
				.check();
			await Promise.all([
				adminPage.waitForResponse(
					(res) =>
						/\/api\/v1\/site$/.test(res.url()) &&
						res.request().method() === 'POST' && // tunnelled PUT
						res.ok(),
					{timeout: 20_000},
				),
				bulkPanel.getByRole('button', {name: 'Save', exact: true}).click(),
			]);

			// The journal's Users & Roles grows the Notify tab and the endpoint
			// accepts (Reader group is empty → zero job batches, no mail).
			await page.goto(`/index.php/${ctx.path}/management/settings/access`);
			const notifyTab = page.getByRole('tab', {name: 'Notify'});
			await expect(notifyTab).toBeVisible({timeout: 20_000});
			await notifyTab.click();
			const notifyPanel = page.locator('#notify');
			await expect(
				notifyPanel.getByRole('checkbox', {name: 'Reader', exact: true}),
			).toBeVisible();
			sendRes = await bulkSend([readerGid]);
			expect(sendRes.status(), 'level 1 open').toBe(200);
			expect(await sendRes.json()).toHaveProperty('totalBulkJobs');

			// Level 2: the admin excludes Readers on the wizard's (now-live)
			// Restrict Bulk Emails form.
			await adminPage.goto(wizardUrl);
			await adminPage.locator('#restrictBulkEmails-button').click();
			const readerBox = restrictPanel.getByRole('checkbox', {
				name: 'Reader',
				exact: true,
			});
			await expect(readerBox).toBeVisible({timeout: 20_000});
			await readerBox.check();
			await Promise.all([
				adminPage.waitForResponse(
					(res) =>
						/\/api\/v1\/contexts\/\d+/.test(res.url()) &&
						res.request().method() === 'POST' && // tunnelled PUT
						res.ok(),
					{timeout: 20_000},
				),
				restrictPanel
					.getByRole('button', {name: 'Save', exact: true})
					.click(),
			]);

			// The Notify form stops offering Readers (Author remains) and a
			// direct send to Readers is refused.
			await page.goto(`/index.php/${ctx.path}/management/settings/access`);
			await page.getByRole('tab', {name: 'Notify'}).click();
			await expect(
				notifyPanel.getByRole('checkbox', {name: 'Author', exact: true}),
			).toBeVisible({timeout: 20_000});
			await expect(
				notifyPanel.getByRole('checkbox', {name: 'Reader', exact: true}),
			).toHaveCount(0);
			sendRes = await bulkSend([readerGid]);
			expect(sendRes.status(), 'restricted group refused').toBe(400);
			expect(await sendRes.text()).toContain(
				'You are not allowed to send an email to users in one or more of the selected roles',
			);

			// The manager can neither reach the wizard…
			const wizardAsManager = await page.request.get(wizardUrl);
			expect(wizardAsManager.url()).toMatch(/authorizationDenied/);
			// …nor store the restriction (server-side admin-only validation).
			const managerPut = await page.request.put(
				`/index.php/${ctx.path}/api/v1/contexts/${ctx.id}`,
				{
					headers: {'X-Csrf-Token': csrf, 'Content-Type': 'application/json'},
					data: {disableBulkEmailUserGroups: [authorGid]},
				},
			);
			expect(managerPut.status(), 'rule 12: manager PUT refused').toBe(400);
			expect(await managerPut.text()).toContain(
				'Only an administrator is allowed to modify this setting',
			);

			// Unchecking the journal (site API, own id only) closes the gate.
			const adminCsrf = await csrfFor(adminCtx);
			const siteRes = await adminCtx.request.get('/index.php/index/api/v1/site');
			expect(siteRes.ok()).toBeTruthy();
			const enabledList = ((await siteRes.json()).enableBulkEmails ?? []).filter(
				(id) => id !== ctx.id,
			);
			const disableRes = await adminCtx.request.put(
				'/index.php/index/api/v1/site',
				{
					headers: {
						'X-Csrf-Token': adminCsrf,
						'Content-Type': 'application/json',
					},
					data: {enableBulkEmails: enabledList},
				},
			);
			expect(disableRes.ok(), await disableRes.text()).toBeTruthy();
			sendRes = await bulkSend([authorGid]);
			expect(sendRes.status(), 'gate closed again').toBe(403);
		},
	);
});
