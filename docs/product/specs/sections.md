---
name: sections
scope: The journal manager's section taxonomy — create/order/restrict/deactivate the sections submissions flow into and issues group by
shared: pkp-lib
status: verified
e2e-plans: [sections]
atlas-claims: [GRID-grid-settings-sections-section-grid-handler, SCHEMA-section-ojs, SCHEMA-section-pkp, DB-sections, DB-section_settings, DB-custom_section_orders, API-section-get-many, API-section-get, LOC-manager-manager-sections, LOC-default-misc]
---

# Sections

## Purpose

Sections are the journal's content taxonomy: every submission enters through exactly one
section ("Articles", "Reviews", …) and every published issue's table of contents is grouped
by section. The manager maintains sections on **Settings → Journal → Sections** — a legacy
grid (no Vue manager exists) with create/edit/delete, drag-ordering, and an inactive toggle
per row. A section carries per-section editorial policy: who may submit to it (editor
restriction), whether it still accepts submissions at all (inactivation), abstract rules
(required?, word limit), a default review form, auto-assigned section editors, and reader-TOC
display flags (hide section title / hide author names). Every new journal starts with one
default section, **Articles** (abbreviation **ART**); the test seed's `publicknowledge`
carries **Articles** (500-word abstract limit) and **Reviews** (abstracts not required).

## Actors & permissions

Baselines: the whole management surface (the Sections tab and every grid operation) is
**journal manager + site admin only** — a section editor is bounced to *Access Denied* from
the settings page (live-verified), and assistants/authors/reviewers have no path in.
"Editors" below = users holding an admin, manager, or section-editor (sub-editor) role in
the journal — the roles exempt from editor restriction.

| Action | Who may — and when |
|--------|--------------------|
| **View / manage the Sections grid** | • Manager, site admin — any time (Settings → Journal → Sections)<br>• Section editor, assistant, author, reviewer — never (settings page denies) <sup>a</sup> |
| **Create / edit a section** (all fields incl. section editors, review form, flags) | • Manager, site admin — any time <sup>b</sup> |
| **Reorder sections** (Order → drag → Done) | • Manager, site admin — any time <sup>c</sup> |
| **Deactivate a section** (grid checkbox or edit-form checkbox) | • Manager, site admin — only while at least one *other* active section remains <sup>d</sup> |
| **Reactivate a section** | • Manager, site admin — any time <sup>d</sup> |
| **Delete a section** | • Manager, site admin — only when the section has **no submissions at all** (incomplete drafts count) *and* at least one active section remains afterwards <sup>e</sup> |
| **Read sections over the API** (`GET sections`, read-only) | • Manager, site admin — no write routes exist; all mutation goes through the grid <sup>f</sup> |
| **Submit to a section** (wizard) | • Any submitting user — active, unrestricted sections<br>• Editors only — sections marked "Items can only be submitted by Editors and Section Editors"<br>• Nobody — inactive sections (hidden from everyone's wizard) <sup>g</sup> |

<sup>a</sup> `SetupGridHandler`/`CanAccessSettingsPolicy`; SectionGridHandler::__construct() role assignment `[ROLE_ID_MANAGER, ROLE_ID_SITE_ADMIN]`; live probe (dbuskins → `roleBasedAccessDenied`)
<sup>b</sup> SectionGridHandler::addSection()/editSection()/updateSection(); SectionForm
<sup>c</sup> SectionGridHandler::initFeatures() OrderGridItemsFeature → setDataElementSequence()
<sup>d</sup> SectionGridHandler::deactivateSection()/activateSection(); SectionForm::validate() (same guard on the edit-form checkbox)
<sup>e</sup> SectionGridHandler::deleteSection(); PKP\section\Repository::isEmpty()
<sup>f</sup> SectionController::getRouteGroupMiddleware()/getGroupRoutes() — GET only
<sup>g</sup> PKPSubmissionHandler::getSubmitSections()/isEditor(); PKPSection::getEditorRestrictedRoles(); PKPSubmissionController (server-side reject)

## Fields & validation

The add/edit modal (all captured live from the running form):

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| Section title | yes | Multilingual text; required in primary locale | `title`; SectionForm FormValidatorLocale |
| Abbreviation | yes | Multilingual text, max 80 chars; also becomes the section's OAI set spec | `abbrev`; SectionForm FormValidatorLocale; OAIDAO::setSpec() |
| Section Policy | no | Multilingual rich text; shown to authors in the wizard when they pick the section, and on the public About → Submissions page | `policy`; StartSubmission (FieldHTML `showWhen`); submissions.tpl |
| Word Count ("Limit abstract word counts for this section (0 for no limit)") | no | Integer; 0/empty = no limit | `wordCount` → `abstract_word_count` |
| Review Form | no | Select over the journal's **active** review forms; default "None / Free Form Review"; saved value must be an existing form of this journal | `reviewFormId`; SectionForm FormValidatorCustom (ReviewFormDAO::reviewFormExists) |
| "Mark this section as inactive and do not allow new submissions to be made to it." | no | Checkbox; refused (inline error) if no other active section would remain | `isInactive`; SectionForm::validate() |
| "Will not be peer-reviewed" | no | Checkbox (stored inverted as `metaReviewed`); only consumer is the default-disabled Publication Facts Label plugin — see ⚠ row 136 | `metaReviewed` (#2066 inverted); PflPlugin::displayArticlePfl() |
| "Do not require abstracts" | no | Checkbox; lifts the abstract requirement in the wizard and workflow | `abstractsNotRequired` |
| "Will not be included in the indexing of the journal" | no | Checkbox (stored inverted as `metaIndexed`); ⚠ **no effect** — the flag has zero consumers in 3.6 (row 136) | `metaIndexed` (#2066 inverted) |
| "Items can only be submitted by Editors and Section Editors." | no | Checkbox — editor restriction (rule 8) | `editorRestricted` |
| "Omit the title of this section from issues' table of contents." | no | Checkbox — reader TOC only (rule 12) | `hideTitle` |
| "Omit author names for section items from issues' table of contents." | no | Checkbox — reader TOC only, per-article overridable (rule 12) | `hideAuthor` |
| Identify items published in this section as a(n) | no | Multilingual text (e.g. "Peer-reviewed Article"); feeds the OAI Dublin Core `dc:type` / MARC 655 genre of published articles | `identifyType`; Dc11SchemaArticleAdapter |
| Editorial Assignments ("Select the editorial users who should be assigned automatically to all new submissions to this section.") | no | One checkbox per user ("Assign *name* as *role*") drawn from manager/sub-editor/assistant-role user groups **assigned to the Submission stage** — with default groups that is Editor, Section editor, Guest editor and Funding coordinator members; plain journal-manager-group users are *not* offered (the default Manager group has no submission-stage assignment) | `subEditors`; PKPSectionForm::fetch() (`assignableRoles` × `withStageIds`) |

Server-side schema: `contextId` + `title` are the only schema-required properties
(`lib/pkp/schemas/section.json` — shared props incl. `editorRestricted`/`isInactive`/`sequence`;
OJS overlay `schemas/section.json` adds the ten OJS props incl. `reviewFormId`/`wordCount`).

## Rules & state

1. **One grid per journal, ordered.** The grid lists every section (active and inactive) in
   sequence order with columns Title · Editors (assigned section editors' full names, or
   "None") · Inactive (live checkbox). *(SectionGridHandler::initialize())*
2. **Create appends to the bottom**, then sequence numbers are renormalized. Title and
   abbreviation are required; everything else defaults off/empty. *(SectionForm::execute() —
   `REALLY_BIG_NUMBER` + Repository::resequence(); live-verified)*
3. **Global order drives every section list.** Order-mode drag saves per-section sequence;
   the wizard's section choices and the reader TOC's section blocks follow it (both
   live-verified flipping after a reorder). Sections seeded/imported with *tied* sequence
   values render in undefined order until reordered. *(SectionGridHandler::setDataElementSequence();
   Collector::getQueryBuilder() `orderBy('s.seq')`; section DAO::getByIssueId())*
4. **Per-issue override:** an editor may re-order sections *within one issue* from the issue's
   Table of Contents grid; the reader TOC then uses the issue-specific order where present,
   falling back to the global order (`COALESCE(custom order, global seq)`). That grid belongs
   to `issue-management`; this feature owns the stored order rows (`custom_section_orders`,
   cascade-deleted with issue or section). *(TocGridHandler::setDataElementSequence() →
   Repo::section()->upsertCustomSectionOrder(); DAO::getByIssueId())*
5. **Inactive = closed to new submissions, nothing else.** An inactive section disappears
   from everyone's wizard choices (editors included); an author *resuming a draft* in a
   now-inactive section gets the "Section Closed" page ("*journal* is not accepting
   submissions to the *section* section…"); already-submitted and published content is
   untouched — the published article stays on the TOC and its landing page (all
   live-verified). *(PKPSubmissionHandler::getSubmitSections() `excludeInactive`;
   showWizard() `sectionClosed`; getByIssueId() has no inactive filter)*
6. **At least one active section, always.** Deactivating the last active section is refused —
   grid toggle shows "At least one section must be active. Visit the workflow settings to
   disable all submissions to this journal." (the journal-wide off-switch lives in
   workflow-settings); the edit-form checkbox is refused with the same message; and a delete
   that would leave zero active sections is refused too (all live-verified — the delete
   guard refuses with the same message). *(SectionGridHandler::deactivateSection()/deleteSection();
   SectionForm::validate())*
7. **Delete only when empty.** Any submission pointing at the section — including an
   incomplete wizard draft — blocks deletion: "Before this section can be deleted, you must
   move articles submitted to it into other sections." (live-verified with a draft). An empty
   section deletes after an "Are you sure…" confirm; its settings and per-issue order rows go
   with it (DB cascade). Assigned-section-editor rows are *not* cleaned up (orphaned —
   invisible to users; ledger row 137). *(Repository::isEmpty() — no status filter;
   OJSMigration FK cascades; no `deleteBySubmissionGroupId` on the delete path)*
8. **Editor restriction.** A restricted section is hidden from non-editor users in the wizard
   *and* in the About → Submissions section list; admins, managers and sub-editors see and may
   submit to it (live-verified both roles; the exemption is *role*-based — any sub-editor may
   submit to any restricted section, not just their own). The server enforces the rule at the
   two gates that matter: *creating* a submission naming a restricted (or inactive, or
   foreign) section is rejected (400), and the final *Submit* re-validates the stored section
   (refusing with the Section-Closed message). Mid-wizard draft saves are **not** validated —
   a hand-crafted publication edit can point a draft at a restricted section, but it can
   never be submitted (both gates live-verified). *(getSubmitSections();
   AboutContextHandler::submissions() `excludeEditorOnly`; PKPSubmissionController::add() —
   `api.submission.400.inactiveSection` / `submission.sectionRestrictedToEditors`;
   PKPSubmissionController::submit() — `submission.wizard.sectionClosed.message`)*
9. **Section choice in the wizard.** With more than one available section the wizard's start
   form shows a required radio list (each section's policy text appears beneath when
   selected); with exactly one, the section is assigned silently and no chooser renders
   (live-verified); the running wizard shows "Submitting to the **X** section" with a
   *Change* control that re-offers the same filtered list. *(StartSubmission::__construct();
   ReconfigureSubmission; the wizard itself is `submission-wizard`'s)*
10. **Abstract policy follows the section, live.** The wizard's Details step marks Abstract
    required unless the section says "Do not require abstracts", and shows a
    "Word Count: n/limit" counter when a limit is set. The counter is advisory while editing,
    but the final **Submit is blocked** at the Review step ("The abstract is too long. It
    should be X words or less…"); switching the draft to a section with laxer rules clears the
    error (all live-verified). The limit binds independently of the required flag — in an
    abstracts-not-required section with a word limit, an abstract may be omitted but, if
    entered, must respect the limit (the two validations are separate branches). The same
    limit governs the editor-side Title & Abstract form.
    *(TitleAbstractForm `wordLimit`/`isRequired`; submission Repository::validateSubmit() +
    publication Repository::validate() via HasWordCountValidation::validateWordCount();
    SubmissionHandler / api SubmissionController wiring)*
11. **Default review form.** The section's Review Form becomes the pre-selected "Review Form"
    when an editor assigns a reviewer to a submission in that section (live-verified —
    "Sec Default RF" preselected in Add Reviewer); the editor can still switch to
    "None / Free Form Review" or another active form. Deleting a review form nulls the
    section pointer (DB); merely *deactivating* one leaves the section pointing at it — the
    edit modal then no longer lists it, so the next section save silently drops it (OQ 2).
    *(ReviewerForm::initData(); sections FK `review_form_id … set null`;
    ReviewFormDAO::getActiveByAssocId())*
12. **Reader-TOC display flags.** "Omit the title…" suppresses the section's heading on the
    reader issue TOC (articles still listed); "Omit author names…" hides author lines for that
    section's TOC entries, overridable per article where a publication explicitly opts to show
    authors. Both are TOC-only: the article landing page always shows the section name, the
    *editorial* TOC grid ignores hideTitle (all live-verified/TOC; landing live-verified), and
    OAI and the web-feed plugin ignore both flags entirely (the section still surfaces there
    as set / dc:type). hideTitle additionally omits the section name from CSL-generated
    citations.
    *(IssueHandler::view(); issue_toc.tpl; article_summary.tpl `AUTHOR_TOC_*`;
    article_details.tpl; CitationStyleLanguagePlugin::getCitation())*
13. **Auto-assignment of section editors.** Submitting fires an event that stage-assigns the
    section's configured editors (and any category-assigned editors) with their group's
    recommend-only / metadata-edit defaults; assigned editors get a "submission submitted"
    notification + *EditorAssigned* email. If nobody ends up assigned, every journal manager
    gets an "editor assignment required" task notification + *SubmissionNeedsEditor* email.
    ⚠ **As-built this only works on an install's first journal** — a user-group id/index mix-up
    silently discards every auto-assignment whose group id is not below the journal's group
    count, i.e. all of them on every subsequently created journal (and even a first-journal
    group added after install). The section→editor *configuration* is unaffected — only the
    submit-time execution dies (row 135; live-verified both ways, independently re-driven).
    *(AssignEditors::handle(); SubEditorsDAO::assignEditors() — the faulty
    `$userGroups->keys()` filter; NOTIFICATION_TYPE_EDITOR_ASSIGNMENT_REQUIRED)*
14. **Metadata projections.** "Identify items published in this section as a(n)" feeds the
    OAI `dc:type` (default "Peer-reviewed Article" when empty) and MARC/MARCXML 655 genre.
    Each section is also an OAI *set* (`journalPath:ABBREV` — the OAI surface is `oai-pmh`'s).
    ⚠ The two "Will not be …" checkboxes are inert in practice: `metaIndexed` has **no
    consumer at all**, `metaReviewed` only gates the default-disabled Publication Facts Label
    plugin (row 136). *(Dc11SchemaArticleAdapter; OAIDAO::setSpec(); PflPlugin)*
15. **Every journal starts with "Articles".** Creating a journal auto-creates a default
    section (title "Articles", abbreviation "ART", indexed + peer-reviewed defaults).
    *(ContextService::afterAddContext(); `section.default.*` locale keys)*

## Side effects

- **Section CRUD itself** sends no email and writes no event log; grid saves surface only a
  trivial success toast, guard violations an error toast. *(SectionGridHandler — 
  createTrivialNotification() only)*
- **On submission submit** (rule 13): stage assignments; per-editor
  NOTIFICATION_TYPE_SUBMISSION_SUBMITTED + *EditorAssigned* mail, or per-manager
  NOTIFICATION_TYPE_EDITOR_ASSIGNMENT_REQUIRED (task) + *SubmissionNeedsEditor* mail —
  live-verified the manager-fallback notifications. *(SubEditorsDAO::assignEditors();
  AssignEditors::handle())*
- **Editing a section's Editorial Assignments** rewrites the assignment rows
  (delete-then-insert), affecting only future submissions — existing stage assignments are
  untouched. *(PKPSectionForm::execute())*
- **Deleting a section** cascades its settings + per-issue order rows; publications would be
  detached (`SET NULL`) only via paths that bypass the empty-guard (journal deletion).
  *(OJSMigration FKs)*

## Settings that modify behavior

- **Workflow → "disable submissions"** (journal-wide, owned by `workflow-settings`) closes the
  whole journal regardless of section state; the last-active-section error text points
  managers there for the "close everything" job.
- **Review forms** (owned by `review-forms`): the Review Form dropdown only appears when the
  journal has at least one *active* review form. *(sectionForm.tpl `{if count($reviewFormOptions)>0}`)*
- No config.inc.php or plugin toggles alter section behavior; the PFL plugin (default
  disabled) is the sole `metaReviewed` consumer (rule 14).

## Cross-feature interactions

- **submission-wizard / submission-wizard-metadata** — own the wizard itself; this spec owns
  which sections it offers (rules 5, 8, 9) and the abstract policy inputs (rule 10).
- **issue-archive-toc** — owns the reader TOC rendering; this spec owns the section
  definition, global order and display flags it projects (rules 3, 12).
- **issue-management** — owns the editorial TOC grid that writes the per-issue section order
  (rule 4) and per-issue article ordering.
- **publication-issue-assignment** — owns moving a *submission* between sections after
  submission (workflow Issue tab, `sectionId` on the publication).
- **review-forms** — owns the form manager + active/deactivate lifecycle; this spec owns the
  per-section default pointer (rule 11).
- **stage-participants / editorial-masthead / roles-permissions** — stage-participants owns
  `DB-subeditor_submission_group` (the storage rule 13 reads); roles define who counts as an
  "editor" for restriction purposes.
- **oai-pmh** — owns OAI; sections surface there as sets and as `dc:type` (rule 14).
- **about-pages** — owns About → Submissions; the per-section policy blocks that page renders
  come from this feature (rule 8 note; the sections spec's live probe confirmed the policy
  blocks DO render once a section has a policy — the seed's sections simply have none).
- **workflow-settings** — journal-wide submission off-switch (see Settings above).

## Canonical scenarios

1. **Manage sections from Settings → Journal** — Manager: opens Settings → Journal →
   Sections, creates "Probe Created" (title + abbreviation) in the modal, sees it appended
   last with Editors "None"; edits it; a section editor requesting the same page is bounced
   to Access Denied.
2. **Section order and display drive the reader TOC** — Manager + anonymous reader: with two
   sections' articles published in one issue, the TOC shows one heading-block per section;
   the manager drags a new order (Order → drag → Done) and the TOC + wizard follow; ticking
   "Omit the title…"/"Omit author names…" on one section removes its heading and author
   lines from the TOC while the article landing still names the section.
3. **Editor-restricted section** — Author vs manager: the author's wizard offers only
   unrestricted sections; the manager's wizard shows the restricted one too; a hand-crafted
   save naming the restricted section as the author is rejected server-side.
4. **Deactivate and reactivate** — Manager + author: deactivating a section (confirm dialog)
   removes it from every wizard; the author resuming a draft in it lands on "Section Closed";
   its published article remains on the TOC; deactivating the *last* active section is
   refused with the workflow-settings pointer; unticking reactivates and the section returns
   to the wizard.
5. **Delete guards** — Manager: deleting a section with any submission (even an incomplete
   draft) is refused with the "move articles first" message; deleting an empty (inactive)
   section succeeds after confirm and the row disappears.
6. **Section abstract policy in the wizard** — Author: in a 20-word-limit section the
   Details step shows "Word Count: 25/20" on an over-long abstract and the Review step blocks
   Submit ("The abstract is too long…"); switching the draft (Change → other section) to a
   "Do not require abstracts" section drops both the requirement and the counter and clears
   the error.
7. **Section editors route new submissions** — Manager + section editor: the manager ticks
   "Assign X as Section editor" on a section; a new submission to that section auto-assigns X
   (X sees it under Assigned to me) — on the install's **first** journal; on a later-created
   journal the assignment silently fails and managers get the "assign an editor" task
   instead (⚠ row 135 — the test should pin the *intended* behavior once fixed).
8. **Per-section default review form** — Manager/editor: the manager picks an active review
   form as the section's Review Form; when assigning a reviewer to a submission in that
   section, the Add Reviewer panel pre-selects that form, still switchable to
   "None / Free Form Review".

## Known deviations (as-built ≠ intent)

- ⚠ **Row 135 (new)** — Section/category editor auto-assignment is dead on all journals
  after the first: `SubEditorsDAO::assignEditors()` filters candidate assignments against
  `$userGroups->keys()` (the collection's 0…n-1 indexes) instead of the group *ids* — only
  ids below the journal's group count survive, so every 2nd+ journal on an install (ids grow
  monotonically) drops every auto-assignment; managers get the fallback "editor assignment
  required" notification + *SubmissionNeedsEditor* mail instead. Blast radius: submit-time
  execution only — the configuration (grid, `subeditor_submission_group` rows) persists
  correctly, manual stage-participant assignment is a different path, and no data is lost
  (submissions land in "Needs editor"). Live-verified negative (scratch journals 2 and 38:
  configured, in-group section editor never assigned) and positive control (publicknowledge:
  both Articles section editors assigned, group id 5 < group count 18). Fix confirmed:
  `$userGroups->pluck('id')` (the model's `id` accessor maps to `user_group_id`).
- ⚠ **Row 136 (new)** — The section form's "Will not be included in the indexing of the
  journal" checkbox (`metaIndexed`) has zero consumers in 3.6 (stored + XML round-trip only)
  — a dead affordance; and "Will not be peer-reviewed" (`metaReviewed`) is consumed solely by
  the default-disabled PFL plugin, so on a default install neither checkbox changes anything
  a user can observe.
- **Row 137 (new, low)** — Deleting a section leaves its `subeditor_submission_group` rows
  orphaned (no FK on `assoc_id`, and the delete path never calls the cleanup the edit path
  uses; category deletion has the same gap). Invisible to users; data hygiene only
  (live-verified: deleted section's settings cascade, its subeditor row survives).
- Cross-spec correction (no ledger row): `about-pages` (spec + INVENTORY) states About →
  Submissions renders no per-section policies; live probe here shows the OJS override
  template *does* render a titled policy block per section once a policy is set — the seed's
  sections just have empty policies. The about-pages statement should be softened to
  "renders none on the seed".

## Open questions

1. About → Submissions lists **inactive** sections' policies (and, for logged-in users, a
   "submit to this section" link) — the collector filters editor-restricted but not inactive
   (`AboutContextHandler::submissions()`). Should closed sections be advertised there?
2. Deactivating a review form leaves sections pointing at it; the section edit modal then
   omits it, so the next save of that section silently clears the default (rule 11). Should
   deactivation clean up (or the modal show) the stale pointer?
3. Are the `metaIndexed`/`metaReviewed` checkboxes (row 136) slated for removal, or is a
   consumer planned (e.g. search/OAI exclusion)?
4. Sections with tied sequence values (import/seed paths — the app's own create path always
   resequences) list in undefined order in the wizard and TOC; worth a deterministic
   tiebreaker?

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Sections tab (legacy grid via `load_url_in_div`) | Settings → Journal → Sections (`management/settings/context#sections`; templates/management/context.tpl) | GRID-grid-settings-sections-section-grid-handler |
| Grid component ops | `$$$call$$$/grid/settings/sections/section-grid/{fetch-grid,add-section,edit-section,update-section,delete-section,save-sequence,deactivate-section,activate-section}` | (same) |
| Read API | `GET /api/v1/{context}/sections`, `GET …/sections/{sectionId}` | API-section-get-many, API-section-get |
| Entity schemas | `lib/pkp/schemas/section.json` + OJS overlay `schemas/section.json` | SCHEMA-section-pkp, SCHEMA-section-ojs |
| Storage | `sections`, `section_settings`, `custom_section_orders` (per-issue order) | DB-sections, DB-section_settings, DB-custom_section_orders |
| Locale | `manager.sections.*` (grid/form/guards), `section.default.*` (default Articles section) | LOC-manager-manager-sections, LOC-default-misc |

Referenced, not claimed: `PAGE-management-settings-context` (journal-masthead-settings),
`DB-subeditor_submission_group` (stage-participants), `GRID-grid-toc-toc-grid-handler` +
`SCHEMA-issue` (issue-management), `NOTIF-editor-assignment-required` (editorial-tasks),
OAI atoms (oai-pmh), wizard atoms (submission-wizard).

## Reference — code anchors

- `controllers/grid/settings/sections/SectionGridHandler.php` — grid + guards (delete/deactivate/activate/order)
- `controllers/grid/settings/sections/form/SectionForm.php` + `lib/pkp/controllers/grid/settings/sections/form/PKPSectionForm.php` — the modal form (fields, inverted #2066 checkboxes, sub-editor assignment)
- `templates/controllers/grid/settings/sections/form/sectionForm.tpl` — field labels
- `classes/section/{Section,DAO,Repository}.php`, `lib/pkp/classes/section/{PKPSection,DAO,Repository,Collector}.php` — entity, per-issue order, isEmpty/resequence
- `lib/pkp/api/v1/sections/SectionController.php` — read-only API
- `lib/pkp/pages/submission/PKPSubmissionHandler.php` — getSubmitSections()/showWizard() sectionClosed
- `classes/components/forms/submission/{StartSubmission,ReconfigureSubmission}.php` — wizard section chooser + policy display
- `classes/submission/Repository.php` + `classes/publication/Repository.php` — abstract required/word-limit enforcement
- `lib/pkp/classes/context/SubEditorsDAO.php` + `lib/pkp/classes/observers/listeners/AssignEditors.php` — auto-assignment (row 135)
- `lib/pkp/controllers/grid/users/reviewer/form/ReviewerForm.php` — default review form preselect
- `pages/issue/IssueHandler.php` + `templates/frontend/objects/{issue_toc,article_summary,article_details}.tpl` — TOC projection
- `classes/services/ContextService.php` — default Articles section on journal create

---

**Verified 2026-07-06 (adversarial pass, scratch journals `secv1neg`/`secv2orph`):** all
rules survive; three refined. **Row 135 independently re-driven and bounded:** fresh scratch
`secv1neg` (group ids 668-685) — subeditor row + group membership both present, scenario
submit → only the author stage-assigned + EDITOR_ASSIGNMENT_REQUIRED to both managers;
positive control re-read on publicknowledge (submission 4: dbuskins + sberardo group 5
assigned; the also-configured dbarnes was dropped by the separate `userInGroup` leg, isolating
the id filter as the sole fault). Bounds: configuration persists, execution-on-submit only;
category assignments pass the same dead filter; sole `assignEditors()` caller is the
`SubmissionSubmitted` listener; precise condition is *group id < the journal's group count*
(ids ≤ 17 with 18 default groups — so effectively first-journal-only, and even there a
later-added group would drop). Fix `pluck('id')` confirmed against `ModelWithSettings`'s
`id`→`user_group_id` accessor. Severity kept HIGH (silent kill of a headline routing feature
on every multi-journal install) but framed as degradation, not data loss — the "Needs editor"
fallback catches every affected submission (ledger row sharpened accordingly). **Row 136
re-confirmed** by independent grep (metaIndexed: zero behavioral consumers; metaReviewed:
PFL-only, `<lazy-load>` default-disabled). **Row 137 upgraded from code-verified to
live-verified** (grid-deleted section 106 on `secv2orph`: settings cascade, subeditor row
orphaned) **and corrected**: the ledger's "category delete cleans up" contrast was wrong —
`category/Repository.php:334` is in `updateEditors()`, category delete orphans too.
**Permission attacks refuted:** sub-editor and author on the grid get "current role does not
have access" on read *and* write ops (`SetupGridHandler` role list + `CanAccessSettingsPolicy`;
note refusals return the same `status:true`/dataChanged JSON as success — the error surfaces
only as the toast); sub-editor GET on the read API → 401; POST /sections → method not
supported (no write routes). **Rule 8 refined:** enforcement sits at create + final submit;
a mid-wizard publication edit *accepts* a restricted sectionId (live: PUT → 200, DB updated)
but Submit then refuses with the Section-Closed message — and the sub-editor exemption is
role-wide, not per-section (a section editor of another section submitted to the restricted
one, 201). **Last-active DELETE guard live-verified** (was code-anchored): grid delete of the
sole active section refused with the workflow-settings pointer message. **Rules 4/10/12
code-refuted-then-confirmed:** `COALESCE(o.seq, s.seq)` per-issue override; word limit binds
independently of abstractsNotRequired (separate branches in publication
`Repository::validate()`), wordCount=0 → unlimited; hideTitle/hideAuthor have no OAI/web-feed
consumers (added to rule 12); the `getInSections()` hideTitle blanking is dead (both callers
use only `articles`). Zero-active-sections wizard shows a dedicated error page
(`SubmissionHandler::start()` `submission.wizard.noSectionAllowed.description`) — state
unreachable via UI guards. **Atom audit clean:** all 10 claims single-owner in the sweeps;
`DB-subeditor_submission_group` stays with stage-participants; API sweep GET-only, no write
atoms. Scratch journals `secv1neg` (38) and `secv2orph` (39) remain (drafts 45/46 on 38);
publicknowledge untouched (control submission 4 read-only).
