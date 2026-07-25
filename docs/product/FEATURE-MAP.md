# OJS Feature Map — v1 (agreed taxonomy, 2026-07-02)

The 9 taxonomy seams recorded in **Part B are RESOLVED** by the maintainer; Part A below is
the agreed structure that applies those decisions.

Synthesis of four independent feature-mapping drafts — **refine · ui · lifecycle · clustering** —
now reconciled into one taxonomy: **~92 features in 8 areas**, plus a **Background & pipelines**
grouping (supporting infra, not user features). Governing principle: a feature = one bounded
USER JOB with its own canonical scenarios; shared cross-cutting rules (editorial decisions,
review anonymity) get ONE home that others reference and never re-narrate; background/infra with
no user journey lives in the Background grouping. `atoms:` gives the coverage claim per feature.
Scope: **OJS only** (OMP/OPS-specific surfaces dropped — see Part C).

---

# Part A — Agreed feature map

## Area 1 — Author submission & intake

### submission-wizard — an author fills and submits a manuscript end-to-end (start, files+genres, details, confirm, consent, acknowledgement)
Core wizard job; validation and multilingual/locale entry are internal steps, not separate features.
atoms: PAGE-submission-{index,saved,wizard,cancelled}, VUE-start-submission-form, VUE-reconfigure-submission-modal, FORM-{start-submission,confirm-submission,details,title-abstract,comments-for-the-editors}, GRID-file-upload-wizard-handler, DB-submissions, MAIL-submission-acknowledgement, NOTIF-submission-submitted (~30)

### submission-wizard-metadata — the "For the Editors" metadata step (keywords/subjects/disciplines/agencies/coverage/type) with request-vs-require modes
Renamed-from: submission-metadata. The configurable For-the-Editors step of the wizard; carries its own request/require config. Shares the keyword/vocab primitive with publication-metadata-references (edit vs intake).
atoms: FORM-{pkp-metadata,pkp-data-availability,metadata-settings}, controlled_vocab keywords, LOC metadata.property (~13).

### reviewer-suggestions — author suggests reviewers in the wizard; editor sees them at assignment
References review-anonymity for who-sees-what once assignment starts.
atoms: VUE-reviewer-suggestion-manager, VUE-reviewer-suggestions-list-panel, API-reviewer-suggestion-* (5), DB-reviewer_suggestions(+settings) (~5)

### submission-drafts — save-for-later, resume, delete a draft; incomplete-submissions list
atoms: DB-submissions (submissionProgress/incomplete), API-submission-save-for-later, API-backend-submissions-bulk-delete-incomplete, API-{submission-delete,backend-submissions-delete}, MAIL-submission-saved-for-later, PAGE-submission-saved (~7)

### author-dashboard — the author's My-Submissions list and read-mostly tracking of their own submission
atoms: PAGE-authordashboard-{submission,readsubmissionemail}, PAGE-dashboard-mysubmissions (~5; VUE-submissions-list-panel moved to native-xml-import-export 2026-07-11 — no dashboard mount)

## Area 2 — Editorial workflow & peer review

### editorial-dashboards — editor/manager triage of all submissions (active, needs-editor, archived, my-assigned, review-assignments) with filters/search
atoms: PAGE-dashboard-{index,editorial,reviewassignments}, PAGE-submissions-{index,tasks}, VUE-dashboard-page, VUE-dashboard-table, FORM-submission-filters, API-backend-submissions-{get-many,assigned,reviews,get-views-count,get-review-assignments} (~13; the old `API-submissions-get-many` name was wrong — corrected 2026-07-16)

### workflow-stage-navigation — the workflow-page shell: stage tabs/bubbles, per-stage access, stage routing
The decision action-bar rendered here is documented once in editorial-decisions; this owns only the shell/routing.
atoms: PAGE-workflow-{access,index,submission,externalReview,editorial,production}, VUE-workflow-page(+ojs), AUTHZ-{workflow-stage-access,user-accessible-workflow-stage,user-accessible-workflow-stage-required,workflow-stage-required} (12; shorthand trued up 2026-07-16). References editorial-decisions.

### editorial-decisions — the decision engine (single home): record-decision UI, notify-author email (+attachments), attach files, decision→stage/status transition, decline/revert, new round, recommend — plus the variant table of OJS decision types
This is the ONE home for decision mechanics; every stage feature (send-to-review, review-rounds-and-revisions, copyediting-stage, production-stage, done transitions) REFERENCES it rather than re-documenting decision rules. Merged-from: done-stage (the Done-stage transitions folded into the variant table below).
atoms: PAGE-decision-record, SCHEMA-decision, DB-edit_decisions, API-submission-get-decisions, API-submission-add-decision, AUTHZ-decision-{write,allowed,stage-valid,type-required}, FORM-select-revision-{decision,recommendation}, ~35 Decision constants (incl. 33/34/35 Done), ~17 Decision*NotifyAuthor mailables, EVLOG-SUBM-ED-{DEC,REC,EMAIL}, NOTIF-editor-decision-*, API-submission-return-to-done, ApplyDoneWorkflowStage listener, WORKFLOW_STAGE_ID_DONE=6, I12799 backfill migration (~45)

Variant table (each decision: stage guard → resulting state):
| Decision | Stage guard | Result |
| --- | --- | --- |
| Send to External Review | submission | → review stage, round 1 |
| Accept & Skip Review | submission | → copyediting |
| Accept Submission | review | → copyediting |
| Decline / Desk Reject | submission/review | status = declined |
| Revert Decline | declined | → prior stage |
| Request Revisions | review | round stays open; author revises |
| Resubmit for Review | review | new round |
| New Review Round / Cancel Round | review | round created / cancelled |
| Send to Production (Back from Copyediting) | copyediting | → production |
| Back to Copyediting | production | → copyediting |
| Recommend {Accept/Decline/Revisions/Resubmit} | review (recommend-only) | records recommendation → recommend-only-editors |
| MoveToDone (33) | first publish (auto) | → Done stage |
| ReturnToWorkflow (34) | unpublish (auto) | → prior stage |
| ReturnToDone (35) | manual | → Done stage |

### stage-participants — add/remove stage participants, assign editors, role-based access effects, assistant scoping
atoms: VUE-participant-manager, GRID-stage-participant/user-select, DB-stage_assignments, DB-subeditor_submission_group, EVLOG-SUBM-{ADD,REM}-PART, NOTIF-editor-assign (~7)

### send-to-review — the pre-review (stage-1) workspace: incoming files, accept-and-skip vs desk-decline/withdraw, hand the submission into the review stage
Renamed-from: submission-stage. The stage-1 job; the accept-and-skip / desk-decline / send-to-review actions themselves are decisions defined in editorial-decisions (referenced, not re-documented).
atoms: PAGE-workflow-submission, GRID-submission-files-*, SCHEMA-submission-ojs, EVLOG-SUBM-SUBMIT (~8). References editorial-decisions.

### assign-and-manage-reviewers — editor assigns/manages reviewers (search picker, due dates, reviewer type), unassign/resend/reinstate/thank
Renamed-from: reviewer-assignment. The anonymity mode chosen here is defined in review-anonymity (referenced).
atoms: VUE-reviewer-manager, VUE-select-reviewer-list-panel, GRID-reviewer-grid, DB-review_assignments(+settings), MAIL-review-{request,reinstate,resend,unassign}, NOTIF-review-assignment(+updated), EVLOG-REV-{ASSIGN,CLR,REIN,CONF} (~14). References review-anonymity.

### reviewer-response — the reviewer's own journey: accept/decline invitation, review steps, recommendation, comments, attachments, one-click access
Merged-from: reviewer-invitation-response + reviewer-completes-review (one reviewer journey per decision 4).
atoms: PAGE-reviewer-{submission,step,savestep,showdeclinereview,savedeclinereview,downloadfile(documented-dead)}, VUE-reviewer-submission-page, AUTHZ-review-assignment-access-policy, API-review-get-history, GRID-reviewer-review-{files,attachments}-grid-handler, DB-{review_files,review_form_responses}, MAIL-review-{confirm,decline,complete-notify-editors}, NOTIF-reviewer-comment, EVLOG-REV-{ACCP,DECL,RDY}, LOC-reviewer-{reviewer-submission,reviewer-reviewSteps,submission-comments,misc}, LOC-common-reviewer-submission (~25). References assign-and-manage-reviewers (MAIL-review-acknowledgement is the editor's Thank Reviewer mail, not this feature).

### review-forms — a manager builds a review form with elements; a reviewer fills it; the editor reads responses
atoms: GRID-review-form-grid, GRID-review-form-elements-grid, listbuilder-response-item, DB-review_forms(+settings,elements,element_settings,form_responses) (~6)

### review-rounds-and-revisions — new round, round-status, request-revisions → author uploads/response → resubmit-for-review cycle, round history
Merged-from: review-rounds + author-review-response. The request-revisions/resubmit/new-round actions are decisions defined in editorial-decisions (referenced).
atoms: PAGE-workflow-externalreview, DB-review_rounds(+settings,files), Decisions {RequestRevisions,Resubmit,NewRound,CancelRound}, NOTIF-{review-round-status,pending-external-revisions}, PAGE-reviewresponse-requestauthorresponse, VUE-author-response-manager(+request), VUE-request-review-round-author-response, DB-review_round_author_responses(+authors,settings), API-review-*-author-response, MAIL-request-review-round-author-response (~20). References editorial-decisions.

### recommend-only-editors — a recommend-only section editor records a recommendation the deciding editor then acts on
atoms: VUE-reviewer-recommendation-manager, DB-reviewer_recommendations(+settings), Decisions RecommendAccept/Decline/Resubmit/Revisions, MAIL-recommendation-notify-editors, EVLOG-SUBM-ED-REC/REV-PROXY-REC (~4). Configurable recommendation options live in workflow-settings.

### review-anonymity — double-anonymous / anonymous / open modes: what each party sees; the cross-party visibility matrix (single home)
Own feature (decision 3): assign-and-manage-reviewers, reviewer-suggestions, tasks-discussions and article-landing REFERENCE this matrix rather than re-stating it. Public open-review display is exposed via open-peer-review-display.
atoms: SUBMISSION_REVIEW_METHOD constants, per-assignment anonymity flags, VUE-pkp-open-review, participant-blinding rules (~5)

### copyediting-stage — copyeditor assignment, copyedited-files exchange, author check, send-to-production handoff
Stage workspace only; the back-from-copyediting / send-to-production actions are decisions defined in editorial-decisions (referenced).
atoms: PAGE-workflow-editorial, GRID-copyedit-files/manage-copyedit-files, NOTIF-{copyedit-assignment,assign-copyeditor,awaiting-copyedits}, MAIL-decision-back-from-copyediting, EVLOG-EMAIL-COPY-* (~8). References editorial-decisions.

### production-stage — layout-editor assignment, production-ready/final/proof files, galley approval, schedule handoff
Stage workspace only; the back-from-production / schedule decisions are defined in editorial-decisions (referenced).
atoms: PAGE-workflow-production, GRID-{final-draft,production-ready,manage-proof}-files, NOTIF-{layout,index,awaiting-representations,assign-productionuser}, MAIL-decision-back-from-production (~8). References editorial-decisions.

### tasks-discussions — per-stage tasks (owner + due date) and threaded discussions, seeded from journal templates; in-app + email notification
Kept as ONE merged feature (decision 9), matching the shipped 3.6 unified panel and the verified pilot spec.
atoms: full `specs/tasks-discussions.md` claim-set — DB-edit_tasks/edit_task_*(5), DB-notes/submission_comments, API-editorial-task-*(12), API-edit-task-template-*(5), VUE-discussion-manager, VUE-task-template-manager, MAIL-discussion-*, NOTIF-new-query, AUTHZ-query-* (~57). References review-anonymity for discussion visibility.

### submission-files — per-stage file upload, revisions, dependent files, non-ASCII filenames, downloads, file attachers
atoms: VUE-file-manager, VUE-{submission-files,listing-files}-list-panel, VUE-file-attacher, GRID files/* (~25 grids, several base/dead), DB-submission_files(+revisions,settings), files, temporary_files, SCHEMA-submission-file, EVLOG-FILE-* (~10). file-genres config lives in workflow-settings.

### editorial-activity-log — the submission event-log surface (per-item + per-submission history modal); information-center Notes + History tabs (emails are merged INTO History — there is no separate Email tab)
atoms: GRID-{submission,file}-event-log, GRID-information-center-*, SCHEMA-event-log, DB-event_log(+settings), the EVLOG-* corpus (~36 submission/file types) rendered here (~10). Individual EVLOG-* are co-claimed by the feature that fires them; this owns the log surface.

### document-library — context & submission library files (review templates, marketing/permissions docs), distinct from per-submission media
atoms: GRID-library-file-admin, GRID-library-file, DB-library_files(+settings), API-library (~4)

## Area 3 — Publication record, issues & scheduling

The article-record tab-set (decision 2): one bounded feature per tab a PO clicks, gathered here rather than scattered across editorial/publishing, plus issue management & scheduling.

### publication-title-abstract-body — the title/abstract/prefix/subtitle tab, the full-text HTML body editor, and the Pandoc Word→HTML importer
Merged-from: publication-body-text-and-pandoc + the title/abstract portion of publication-metadata. Required placement of the Pandoc importer.
atoms: FORM-title-abstract, API-submission-get-publication-titleAbstract-form, API-body-text-{get,save,delete}, VUE-pandoc-converter (pandoc-wasm, WorkflowPublicationBodyText), LOC publication.bodyText, author-edit-published gate (~10)

### contributors — contributor CRUD, ordering, primary contact, affiliations, CRediT roles on a publication (reused in the wizard)
atoms: VUE-contributor-manager, VUE-contributor-role-manager, VUE-contributors-list-panel, FORM-contributor-form, DB-authors(+settings,affiliations), credit_contributor_roles/credit_roles, SCHEMA-author, PLUGIN-generic-credit (~12). ROR affiliation storage is Background (affiliations-ror).

### publication-metadata-references — keywords/subjects/disciplines/agencies per-locale + coverage/rights/source/type/funding, edit-permission gate, and the reference list (structured/raw citation edit)
Merged-from: the metadata portion of publication-metadata + citations-references. Background PID/metadata enrichment of citations is Background (citation-enrichment-pipeline). NOTE (verifier 2026-07-04): categories are NOT on the Metadata tab — post-submission category assignment lives on the Issue tab (`IssueEntryForm`, owned by publication-issue-assignment, which claims DB-publication_categories); the "categories" scope was dropped from this line.
atoms: FORM-{pkp-metadata,pkp-citations,citation-raw-edit,citation-structured-edit}, API-submission-get-publication-metadata-form, VUE-citation-manager, SCHEMA-citation, API-citation-* (getMany/get/edit/delete/reprocess), DB-publication_settings, DB-citations(+settings), EVLOG-SUBM-META-UPD (~20)

### galleys — galley create/edit/delete, file vs remote URL, labels, ordering, galley DOI; HTML/PDF/JATS/Lens render plugins
atoms: VUE-galley-manager, GRID-article-galley-grid, SCHEMA-galley, DB-publication_galleys(+settings), PAGE-article-download, PLUGIN-generic-{htmlArticleGalley,pdfJsViewer,jatsTemplate,lensGalley} (~10)

### media-files — the Media section: batch upload, web/high-res variant linking, sharing across galleys, dependent files, author read-only
atoms: VUE-media-file-manager, API-media-files-* (6), DB-variant_groups, SUBMISSION_FILE_MEDIA rows, MediaFilesController, PAGE-libraryfiles-download* (~8)

### publication-identifiers — the identifiers tab: DOI/URN/pages/article-number on a publication
Split-from: publication-identifiers-license. DOI config/assign lifecycle lives in doi-management (referenced).
atoms: FORM-pkp-publication-identifiers, SCHEMA-doi, DB-dois(+settings) as displayed on the publication, PLUGIN-pubIds-urn, urlPath/pages props (~5)

### publication-license — license/copyright/permissions overrides on a publication
Split-from: publication-identifiers-license. Journal defaults live in distribution-settings (referenced).
atoms: FORM-{pkp-publication-license,license}, licenseUrl/copyrightHolder/copyrightYear props (~3)

### publication-issue-assignment — assign an article to an issue/section and schedule it into a future issue
atoms: FORM-issue-entry-form, SCHEMA-submission-ojs (issueToBePublished), DB-publication_categories, API issue-assignment-status (~5)

### publication-versioning — create/edit a new version, version history & dropdown, cross-version language rules, reader display
Verified pilot spec (`specs/publication-versioning.md`).
atoms: SCHEMA-publication-{pkp,ojs} (version props), API-submission-{change,version,next-available}-version, NOTIF-submission-new-version, MAIL-{publication-version,revised-version}-notify, EVLOG-SUBM-VER-CRT (~18)

### publication-publish-flow — publish/unpublish/schedule preconditions & actions, republish, front-end visibility flip
Renamed-from: publication-scheduling. The publish/unpublish transition triggers the Done-stage MoveToDone/ReturnToWorkflow decisions (editorial-decisions).
atoms: GRID-modals-publish-publish-handler, FORM-publish-form, SCHEMA-publication (status/accessStatus), TASK-publishsubmissions, API-publications-publish/unpublish (~13). References editorial-decisions.

### publication-amendments — Summary-of-Changes + update type: author submits revisions to a published article, editor inserts them, versioned update types
New 3.6 flow. Verified spec (`specs/publication-amendments.md`, status draft). SEAM RESOLVED (verifier 2026-07-04): this feature does NOT use `DB-review_round_author_responses` — that table is single-owned by review-rounds-and-revisions (the review-round written-response flow, a distinct feature). The amendment "author submits → editor inserts" path runs through the file-level `summaryOfChanges` on review-revision files + `publications.update_type`. Feature IS live in OJS 3.6 for editor-side capture (options wired via OJS DashboardHandler override, live-probed); reader-side public display is NOT implemented (⚠). The "update-type props" resolve to the schema props on SCHEMA-publication-{pkp,ojs} (owned by versioning) + `publications.update_type` (no separate atom) — only 2 atoms are actually claimable.
atoms: VUE-insert-summary-of-changes-modal, LOC-submission-publication-updateType (NOT DB-review_round_author_responses — see seam note)

### data-availability-citations — data-set citations & the data-availability statement on a publication
Kept as a real feature (decision 8) — has its own manager/edit surface.
atoms: VUE-data-citation-manager, FORM-{data-citation-edit,pkp-data-availability}, SCHEMA-data-citation, API-data-citation-* (6), DB-data_citations(+settings) (~6)

### issue-management — issue CRUD, TOC ordering, cover image, publish issue + reader notification, current issue, unpublish/delete, issue galleys, back/future lists
atoms: PAGE-manageissues-index, DB-issues(+settings,files), issue_galleys(+settings), custom_issue_orders, GRID-{back-issue,future-issue,issue-galley,toc}-grid, API-issue-*, NOTIF-published-issue, JOB-issuepublishednotifyusers, MAIL-issue-published-notify (~13)

## Area 4 — Reader front end

### journal-homepage — journal home: current-issue display, sidebar blocks, announcements block, highlights carousel
atoms: PAGE-index-index, DB-journals/journal_settings, VUE-highlights-list-panel (render), PLUGIN-blocks-* (~7)

### highlights-featured-content — a manager curates ordered featured highlights shown on the home page (config side)
Kept as a real feature (decision 8) — has a form/CRUD surface.
atoms: VUE-highlights-list-panel, FORM-highlight-form, SCHEMA-highlight, API-highlight-* (6), DB-highlights(+settings) (~7)

### article-landing — article abstract page: metadata display, galley view/download (pdf.js smoke), license, DC/Scholar meta tags, how-to-cite, Crossmark, open-review, "recommend by" blocks
Open-review visibility follows review-anonymity (referenced).
atoms: PAGE-article-{view,download,viewfile,downloadsuppfile}, VUE-pkp-{cite,crossmark-button,orcid-display,open-review}, PLUGIN-generic-{recommendByAuthor,recommendBySimilarity,dublinCoreMeta,googleScholar} (~10). References review-anonymity.

### article-recommendations — reader sees related articles (same author / similar keywords)
**RESOLVED — merged into `article-landing` (article-landing verify, 2026-07-04).** Its only atoms are
the two recommend-by reader footer blocks, which live on the article page and are now single-owned by
`article-landing` (spec rule 13 + canonical scenario 10; atlas `plugins.md` claims them there). This
stanza is retained for traceability only — **feature 39 is dropped as a standalone feature** (no
INVENTORY row was ever created, so nothing to retire); re-split only if a dedicated config surface
appears. Superseded the "kept as a real feature (decision 8)" note above.
atoms: PLUGIN-generic-{recommendByAuthor,recommendBySimilarity} → **article-landing**

### issue-archive-toc — public archive listing, current issue, single-issue TOC, section grouping, issue-galley download
atoms: PAGE-issue-{index,current,archive,view,download}, GRID-toc-grid, SCHEMA-issue, PLUGIN-catalog (~5)

### site-search — front-end search, filters, no-result behaviour, index maintenance
atoms: PAGE-search-{index,search}, DB-submissions_fulltext, JOB-updatesubmissionsearchjob (4) — VERIFIED 2026-07-05. NB: `FORM-pkp-search-indexing-form` is the Distribution "Search Engine Indexing" SEO form (NOT the fulltext index); released to distribution-settings, which already lists it below.

### browse-category-section — category/section browse landing pages and the browse sidebar block
atoms: PAGE-catalog-{category,fullsize,thumbnail}, PLUGIN-blocks-browse, DB-categories/sections (browse hook) (~4)

### public-comments — reader comments: post, moderate, approve, report, anonymous gating
atoms: VUE-pkp-comments, VUE-user-comments-{page,table}, VUE-user-comment-reports-table, FORM-content-comments-form, API-comment-* (~12), DB-user_comments(+settings,reports), NOTIF-user-comment-{posted,reported}, PAGE-management-settings-usercomments (~10)

### about-pages — public About/Contact/Submissions-guidelines/privacy, editorial-masthead & -history public pages, custom static pages, sidebar blocks
Renders the public editorial masthead configured in editorial-masthead (referenced).
atoms: PAGE-about-{index,contact,submissions,privacy,editorialmasthead,editorialhistory,aboutthispublishingsystem}, PAGE-information-*, PLUGIN-generic-staticPages, PLUGIN-blocks-{information,developedBy,makeSubmission} (~10)

### oai-pmh — OAI-PMH protocol (Identify/ListRecords/GetRecord/resumption tokens) and its DC/MARC/MARCXML/JATS/RFC1807 metadata-format plugins
Deletion tombstones are Background (content-tombstones).
atoms: PAGE-oai-index, DB-oai_resumption_tokens, PLUGIN-oaiMetadataFormats-{dc,marc,marcxml,oaiJats,rfc1807}, PLUGIN-generic-driver (~10)

### web-feeds-syndication — sitemap.xml and RSS/Atom web feed of recent content + announcement feed
atoms: PAGE-sitemap-index, PLUGIN-generic-{webFeed,announcementFeed}, PLUGIN-blocks-browse (feed links) (~5)

## Area 5 — Users, roles & access

### registration-login — public registration (roles, consent, email validation), login, logout, failed login, account activation
atoms: PAGE-user-{register,registeruser,activateuser}, PAGE-login-{index,signin,signout}, MAIL-{user-created,validate-email-context,validate-email-site}, DB-users/sessions, AUTHZ-session policies (~8)

### password-flows — reset via email, forced change on first login, self-service change in profile
atoms: PAGE-login-{lostpassword,requestresetpassword,resetpassword,updateresetpassword,changepassword,savepassword}, MAIL-password-reset-requested (~5)

### user-profile — identity/contact/public profile, notification prefs, API key, reviewer interests
atoms: PAGE-user-{index,profile}, GRID-profile-tab-handler, DB-user_settings/user_interests, notification_settings, API-{user,vocab,interest}-* (self), SCHEMA-user (~6)

### user-management — manager user CRUD, search/filter, disable/enable, remove role, email user, merge users, notify-users
atoms: GRID-user-grid, GRID-user-api-handler, VUE-notify-users-form, API-user-{get-many,report,end-role,masthead}, DB-users/user_user_groups, MAIL-user-role-end-notify (~10)

### user-invitations — invite a new or existing user to a role; the multi-step accept/decline wizard
atoms: PAGE-invitation-{accept,decline,confirmdecline,create,edit}, VUE-{user-invitation-page,accept-invitation-page,user-invitation-manager}, API-invitation-* (~13), DB-invitations, MAIL-user-role-assignment-invitation-notify, JOB-removeexpiredinvitations (~8)

### roles-permissions — the role/user-group grid, custom role creation, stage-assignment effects, settings-URL access gates, reset-permissions tool
Owns the AUTHZ policy framework that per-feature policies build on.
atoms: PAGE-management-{settings-access,permissions,resetpermissions}, VUE-user-access-manager, GRID-user-group-grid, DB-user_groups(+settings,stage), SCHEMA-user-group, AUTHZ-{stage-role,role-based,user-roles-required}-policy (~10)

### login-as — admin impersonation of another user and return to own session
atoms: PAGE-login-{signinasuser,signoutasuser}, PAGE-admin-{confirmaccess,confirmaccesssubmit}, AUTHZ-reauthentication-required-policy, DB-sessions (~4)

### editorial-masthead — the editorial-team roster on the public masthead: which role groups appear, their order, reviewer display opt-in
Settings › Website › "Editorial Masthead" tab (`PKPAppearanceMastheadForm`) + the public /about/editorialMasthead page (rendered in about-pages, referenced). Distinct from journal-masthead-settings, the Settings › Journal › "Masthead" *identity* tab. ⚠ the public page also renders `editorialHistory`, which is set in journal-masthead-settings — cross-reference at spec time.
atoms: FORM-pkp-appearance-masthead, API-user-masthead, MAIL-user-role-masthead-update-notify (~3)

### site-access-restrictions — login-wall site access, registration disabled, disabled-journal visibility, restricted-article gating
Access control (round-1 home, keeps Area 5's "& access" honest). ⚠ read-access is jointly determined here (restrictArticleAccess) with publishing mode (distribution-settings) and subscription enforcement (subscription-access) — cross-reference at spec time.
atoms: PAGE-management-access, restrictSiteAccess/disableUserReg/restrictArticleAccess toggles, AUTHZ-{restricted-site-access,pkp-site-access,https,allowed-hosts}-policy (~4)

## Area 6 — Journal & site settings

Settings-menu features (decision 6): the per-form split collapses into ~5 features by the journal Settings menu (Journal / Website / Workflow / Distribution + standalone Emails), plus the standalone content/admin managers. (Site & journal access gating is NOT a Settings-menu tab — it lives in Area 5 as `site-access-restrictions`.)

### journal-masthead-settings — the Settings › Journal › "Masthead" tab: journal identity (name/acronym/about) plus contact, privacy and information settings that surface publicly
Renamed-from: journal-setup. The UI tab is literally "Masthead" (journal identity, `PKPMastheadForm`) — not the editorial-team roster, which is editorial-masthead (Website settings). Owns the journal-identity Masthead form (moved here from editorial-masthead).
atoms: PAGE-management-settings-context, FORM-{masthead,pkp-masthead,context,pkp-contact,pkp-privacy,pkp-information}, SCHEMA-context-{ojs,pkp}, DB-journals/journal_settings (~6)
Spec-time corrections (2026-07-05/06, spec verified): FORM-context-form + FORM-pkp-context-form → site-administration (AdminHandler-only, not the Masthead tab); DB-journals stays journal-homepage. Final claim: 9 atoms (see atlas).

### website-appearance-settings — theme options, logo/homepage image uploads, custom CSS, date/time formats, info/list pagination
Renamed-from: website-appearance.
atoms: PAGE-management-settings-website, VUE-theme-form, VUE-date-time-form, FORM-{appearance-setup,appearance-advanced,pkp-theme,pkp-date-time,pkp-lists}, PLUGIN-themes-default, PLUGIN-generic-customBlockManager (~8)
Seam (2026-07-06): the Privacy + Information forms that also sit on Settings→Website's Setup tab (FORM-pkp-privacy-form, FORM-pkp-information-form) are already owned by journal-masthead-settings — do not re-claim; this feature owns the page atom and the remaining tabs/forms.
Spec-time corrections (2026-07-06, spec drafted): final claim is 14 atoms — the ~8 above plus the PKP/APP form pairs counted separately and API-context-{get,edit}-theme (the Theme tab's own endpoint, previously hinted journal-setup). Two new ledger rows: 121 (custom-block delete 500s on Postgres — `plugin_Name` typo in `PluginSettingsDAO::deleteSetting`) and 122 (the makeSubmission block's `enabled=true` settings.xml never installs — missing `getContextSpecificPluginSettingsFile()`; journal-homepage rule 13's "ships enabled" needs a grooming fix).

### workflow-settings — Settings › Workflow: submission checklist/guidelines, components/genres, metadata request/require toggles, disable-submissions, default review mode/deadlines/reminders/guidance, review-recommendation options, and email-notification config
Merged-from: submission-settings + review-settings, folding in metadata-settings, file-genres and email-notification config (decision 6).
atoms: PAGE-management-settings-workflow, FORM-{access,metadata-settings,pkp-metadata-settings,pkp-disable-submissions,submission-guidance-settings,pkp-review-setup,review-guidance,pkp-review-guidance,reviewer-recommendation}, GRID-genre-grid, DB-genres(+settings), DB-review_assignment_settings, reviewer_recommendation_settings (~12)
Spec-time corrections (2026-07-06, spec drafted): final claim is **26 atoms** — the page, 7 forms (submission-guidance, pkp-disable-submissions, pkp-review-setup, pkp-review-guidance + APP review-guidance, reviewer-recommendation, **pkp-email-setup** — the Workflow → Emails tab IS the "email-notification config"; templates/mailables stay email-templates-management), GRID-genre + DB-genres(+settings) + API-genre-get{,-many} (read lookup, per submission-files OQ1), the reviewer-recommendation cluster (DB ×2, API ×6, AUTHZ ×3, VUE manager, form), LOC-default-default-genres. NOT claimed: FORM-{metadata-settings,pkp-metadata-settings} stay **submission-wizard-metadata**; FORM-access mounts on **Distribution** → distribution-settings (atlas hint corrected); DB-review_assignment_settings stays assign-and-manage-reviewers. New ledger rows 124 (recommendations API: SUB_EDITOR + no settings gate, live) and 125 (reminder sliders 0–14 client-only).

### distribution-settings — default license/copyright, indexing metadata, archiving display (LOCKSS/CLOCKSS), publishing mode (open vs subscription), payments enable
atoms: PAGE-management-settings-distribution, FORM-{archiving-lockss,pkp-search-indexing,pkp-license}, PAGE-gateway-{lockss,clockss}, publishing-mode config (~6)
Spec-time corrections (2026-07-06, spec drafted): final claim is **9 atoms** — the ~6 above made concrete: the "publishing-mode config" is **FORM-access-form** (OJS AccessForm on Distribution → Access: publishingMode + delayedOpenAccessDuration + **enableOai** — the OAI toggle lives here, not on the SEO form), PLUS **FORM-license-form** (the OJS journal-default LicenseForm override adding copyrightYearBasis — both license-form atoms' stale `publication-identifiers-license` hints fixed; the per-publication form stays publication-license) and **LOC-manager-manager-distribution**. NOT claimed: FORM-pkp-payment-settings-form + API-backend-payments-edit stay **payments** (77 — this spec owns only the enable-toggle's location/persistence + the nav-link effect); DOIs/Statistics tabs hosted for doi-management/usage-statistics; API-context-edit stays journal-setup. New ledger row **126** (delayedOpenAccessDuration 1–60 bound client-only; API stores 999/-5).

### email-templates-management — the Manage Emails UI: enable/disable mailables, edit/add/reset templates, role-based access; plus the bulk-email restriction setup
Stays standalone (decision 6).
atoms: PAGE-management-settings-manageemails, VUE-edit-mailable-modal, VUE-edit-template-modal, FORM-{email-template,pkp-restrict-bulk-emails}, DB-email_templates(+settings,default_data,user_group_access), API-email-template-* (~8)
Boundary (2026-07-06, workflow-settings verified): **FORM-pkp-email-setup is NOT owned here** — the Workflow → Emails tab (signature / ack routing / decision-notify / stats / bounce) is the journal "email-notification config" and is claimed by **workflow-settings**. This feature owns templates + mailables + the bulk-email restriction form only. (Earlier this line listed `pkp-email-setup`; removed to avoid a double-claim.)
Spec-time corrections (2026-07-06, spec drafted): final claim is **21 atoms** — the ~8 above made concrete (page, 2 Vue modals, FORM-email-template + SCHEMA-email-template, 6 API-email-template, 4 DB tables) PLUS **API-mailable-{get-many,get}** (the mailables read API is this page's data source), **FORM-pkp-site-bulk-emails-form** (the site-admin per-journal bulk-email GATE — one setup story with the restriction form; hint said email-delivery, which keeps the composer/_email/send side), and LOC-manager-{manager-emails,emailTemplate-variable}. NOTE: "enable/disable mailables" is as-built INDIRECT — no toggle exists on Manage Emails; mailables hide/show via workflow-settings' Emails-tab context settings (`isMailableEnabled`), and `Mailable::$canDisable` is a consumerless 3.4 vestige. New ledger rows 127 (sub-editor "Find Template" search box 401s — dead role-list entries vs CanAccessSettingsPolicy), 128 (template save without access fields wipes unrestricted marker/group access; UI-reachable for non-assignable mailables), 129 (cosmetic: Add-Template modal titled "Edit Template" + hardcoded "Edit" button label).

### navigation-menus — menu & menu-item CRUD, custom items, area assignment, front-end rendering
atoms: VUE-navigation-menu-{editor,manager-field}, GRID-navigation-menus-*, PAGE-navigationmenu-{index,view,preview}, DB-navigation_menus/items(+settings,assignments), API-navigation-menu-* (5 routes — getAllItems/getAreas/getItems/add/edit; no DELETE)

### sections — journal sections CRUD: ordering, editor restrictions, inactivation, review-form default, word count
atoms: GRID-grid-settings-sections-section-grid-handler, SCHEMA-section-{pkp,ojs}, DB-{sections,section_settings,custom_section_orders}, API-section-{get-many,get} (read-only — 2 GET routes, writes via the legacy grid), LOC-manager-manager-sections, LOC-default-misc (10)

### categories — content categories CRUD incl. nesting, assigned editors, wizard exposure, front-end browse hook
atoms: VUE-category-manager, FORM-category-form, SCHEMA-category, DB-categories(+settings), publication_categories, API-category-* (5) (~5)

Spec-time corrections (2026-07-06, spec drafted): final claim is **12 atoms** — VUE-category-manager, FORM-category-form, SCHEMA-category, DB-categories (transferred in from browse-category-section's interim claim), DB-category_settings, the 5 API-category-* routes (API-category-get-category-form-component is a registered-but-handlerless DEAD ROUTE, always 500 — ledger row 139), plus LOC-manager-{manager,grid}-category. **DB-publication_categories stays with publication-issue-assignment** (feature 30 owns the per-publication assignment; this hint over-reached). New ledger rows 138 (title-less API POST bricks the Categories tab), 139 (dead route), 140 (static expand/collapse a11y label); row 135's category leg live-confirmed via the real wizard (no duplicate row).

### announcements — announcement CRUD, types, expiry, enable toggle; reader listing/detail page + notification + feed
atoms: VUE-announcements-list-panel, GRID-announcement-type-grid, FORM-{pkp-announcement,pkp-announcement-settings}, DB-announcements(+settings,types), PAGE-announcement-{index,view}, API-announcement-* (5), NOTIF-new-announcement, JOB-newannouncementnotifyusers, MAIL-announcement-notify (~8)

### languages-locales — enable locales for UI/forms/submissions, set primary locale, multilingual form entry, install/manage locales
atoms: GRID-{admin-language,manage-language,submission-language}-grid, PLUGIN-blocks-languageToggle, API-i18n-get-translations, locale enable settings (~6). Cross-cutting multilingual machinery rides along in each feature.

### site-settings — site-wide setup, site languages, site-level appearance, security/password policy, site statistics
atoms: PAGE-admin-settings, FORM-pkp-site-{config,information,appearance,security,statistics,lists}, SCHEMA-site, DB-site/site_settings (~3)

### site-administration — hosted-journals CRUD + create-context wizard, multi-context navigation
atoms: PAGE-admin-{index,contexts,wizard}, VUE-add-context-form, GRID-context-grid, FORM-pkp-context-form, SCHEMA-context-pkp, DB-journals, API-context-* (~8)

## Area 7 — Integrations, identifiers & monetization

### plugin-management — the installed-plugins grid enable/disable + settings modal, plugin gallery install/upgrade, site vs journal scope
atoms: GRID-{settings-plugin,admin-plugin,plugin-gallery}-grid, PAGE-gateway-plugin, DB-plugin_settings, NOTIF-plugin-{enabled,disabled}, AUTHZ-plugin-access/level-required, PLUGIN-generic-{tinymce,pluginTemplate,pflPlugin} (substrate) (~5)

### doi-management — DOI config (prefix/pattern/auto-assign, agency choice), assignment on publish, versioned DOI, management-page statuses/filters/bulk actions
DOI config + assign + status UI (decision 7). Handoff to the registration agencies is doi-deposit (referenced).
atoms: PAGE-dois-index, VUE-doi-{setup,registration}-settings-form, VUE-doi-list-panel(+ojs), SCHEMA-doi, DB-dois(+settings), API-doi-* (~15) (~18). References doi-deposit.

### doi-deposit — the registration-agency deposit backends: Crossref/DataCite/DOAJ settings, export XML, deposit-status marking, scheduled deposit task, and peer-review/author-response DOI deposit
Merged-from: crossref-datacite-deposit + peer-review-doi (decision 7 collapses the 3-way DOI split to 2).
atoms: PLUGIN-generic-{crossref,datacite,doaj}, VUE-pkp-crossmark-button (Crossmark), API-context-edit-doi-registration-agency-plugin, JOB-{depositcontext,depositsubmission,depositissue,depositpeerreview}, TASK-depositdois, API-backend-doi-edit-{peer-review,author-response}, JOB-{depositorcidreview,reconcileorcidreviewputcode} (~18)

### open-peer-review-display — public transparent peer-review history exposed as citable objects
Kept as a real feature (decision 8) — a reader surface. Visibility follows review-anonymity (referenced).
atoms: VUE-pkp-open-review, API-peer-review-* (6 open-review summary/detail endpoints)

### orcid — ORCID settings, author-authorization request/email, verified/unverified badge, registration prefill, OAuth callback, submission/review deposit
atoms: PAGE-orcid-{verify,authorizeorcid,about,updatescope}, VUE-pkp-orcid-display, FORM-orcid-{settings,site-settings}, API-orcid-*, MAIL-orcid-*, JOB-{depositorcidsubmission,revokeorcidtoken,sendauthormail,sendupdatescopemail} (~10)

### citation-style-language — CSL settings (styles offered, primary), how-to-cite render, BibTeX/RIS downloads
atoms: PLUGIN-generic-citationStyleLanguage, VUE-pkp-cite (render/download), API-citation-* (~6)

### indexing-meta-tags — Dublin Core / Google Scholar / DRIVER meta-tag injection (+ Google Analytics) for indexers on public pages
atoms: PLUGIN-generic-{dublinCoreMeta,googleScholar,driver,googleAnalytics}, PLUGIN-metadata-dc11

### subscriptions-management — subscription types CRUD, policies, individual/institutional subscription records, subscription report
atoms: PAGE-payments-{subscriptions,subscriptiontypes,subscriptionpolicies}, GRID-{individual,institutional}-subscriptions-grid, DB-subscriptions/subscription_types(+settings)/institutional_subscriptions, PLUGIN-reports-subscriptions, MAIL-subscription-{notify,expired,expires-soon} (~12)

### subscription-access — access enforcement (anonymous vs subscriber vs editor bypass), delayed open access, subscriber purchase/renew flows
atoms: PAGE-user-{subscriptions,purchasesubscription,payrenewsubscription,paymembership}, GRID-subscriber-select-grid, PLUGIN-blocks-subscription, TASK-{subscriptionexpiryreminder,openaccessnotification}, MAIL-subscription-{purchase,renew}-* (~10)

### payments — enable payments, manual/PayPal method config, payments grid, submission/APC fees on decision
atoms: PAGE-payment(s)-*, FORM-{pkp-payment-settings,request-payment-decision,submission-payments}, PLUGIN-paymethod-{manual,paypal}, DB-{queued,completed}_payments, NOTIF-payment-required, MAIL-payment-request (~10)

### institutions — institution CRUD (IP ranges, ROR) backing institutional subscriptions and usage stats
atoms: VUE-institutions-list-panel, FORM-pkp-institution-form, SCHEMA-institution, API-institution-* (5), DB-institutions/institution_ip(+settings) (~4)

## Area 8 — System, communications & administration

### email-delivery — the rich email composer + template-variable rendering in real sends, per-submission email log, notify-composer with attachments, bulk send
Template *management* lives in email-templates-management.
atoms: VUE-composer, VUE-notify-users-form, DB-email_log(+users), SCHEMA-email-log, MAIL-* (~69 mailables, delivery side), JOB-bulkemailsender, API-email-* (~10)

### notifications — in-app bell/inbox, task grid, mark read, per-user + per-journal opt-outs, unsubscribe link
Per-feature NOTIF-* types are co-claimed by their firing feature; this owns the inbox/preferences framework.
atoms: VUE-top-nav-actions, PAGE-notification-{fetchnotification,unsubscribe}, GRID-{notifications,task-notifications}-grid, DB-notifications(+settings,subscription_settings), NOTIF-* framework (levels/surfaces) (~15)

### jobs-queue — the background job queue page, failed jobs list/details, requeue, drain-queue task
atoms: PAGE-admin-{jobs,failedjobs,failedjobdetails}, VUE-{jobs,failed-jobs,failed-job-details}-page, DB-jobs/failed_jobs/job_batches, API-job-*, TASK-{processqueuejobs,removefailedjobs} (~10)

### scheduled-tasks — review/editorial reminders, deposit-DOIs, auto-publish, open-access notification, cleanup tasks; admin reads task logs
atoms: PAGE-admin-{downloadscheduledtasklogfile,clearscheduledtasklogfiles}, TASK-{editorialreminders,reviewreminder,publishsubmissions,removeunvalidatedexpiredusers,updateipgeodb,openaccessnotification}, JOB-{editorialreminder,reviewreminder}, MAIL-review-remind*, NOTIF-editorial-reminder (~10)

### rest-api — token/API-key authentication and the public REST surface (submissions, issues, users, contexts), permission rejections
atoms: API-* corpus as a product surface (~285 endpoints), AUTHZ middleware (has-roles/has-user/has-context/decode-api-token), API-temporary-files-upload, DB-user_settings (api key) (~8)

### native-xml-import-export — native OJS XML round-trip of submissions and issues
The document-transform engine (filters framework) is Background.
atoms: PAGE-management-importexport, PLUGIN-importexport-native (+libpkp base), GRID-exportable-issues-list, DB-filters/filter_groups/filter_settings (transform engine) (~5)

### user-import-export — bulk XML import/export of user accounts
atoms: PLUGIN-importexport-users (+libpkp base), GRID-exportable-users-grid

### pubmed-export — PubMed/MEDLINE XML metadata export
atoms: PLUGIN-importexport-pubmed, PLUGIN-metadata-dc11

### usage-statistics — stats pages (publications, editorial activity, issues, users, context), date filter, CSV/report download
The log-ingestion & metric-compilation ETL behind these pages is Background (usage-stats-processing).
atoms: PAGE-stats-*, VUE-*-download-report-modal, VUE-pkp-usage-chart, FORM-{pkp-context-statistics,report}, API-stats-* (~30), DB-metrics_* (~15), PLUGIN-generic-usageEvent (~20)

### counter-sushi — COUNTER R5 reports and the SUSHI API
atoms: PAGE-stats-counterr5, VUE-counter-reports-page, FORM-counter-report-form, API-stats-sushi-* (~12), PLUGIN-reports-counter, DB-metrics_counter_*

### editorial-statistics — editorial activity/decision statistics + the emailed editorial report
Kept as a real feature (decision 8) — has a stats surface + scheduled report.
atoms: API-stats-editorial-get(+averages), TASK-statisticsreport, JOB-statisticsreport{mail,notify}, MAIL-statistics-report-notify, NOTIF-editorial-report

### csv-reports — pluggable CSV report plugins (article metadata, peer-review activity, subscriptions)
atoms: PLUGIN-reports-{articles,reviewReport,subscriptions}, PAGE-stats-reports

### site-maintenance — system information, phpinfo, clear template/data caches, expire sessions
atoms: PAGE-admin-{systeminfo,phpinfo,cleartemplatecache,cleardatacache,expiresessions}, PAGE-management-tools, AUTHZ-{reauthentication,allowed-hosts}-policy

### installation-upgrade — the installer & upgrade flow
Kept as a real feature (decision 8) — has installer/upgrade pages.
atoms: PAGE-install-{index,install,upgrade,installupgrade}, DB-versions, LOC installer.*

## Background & pipelines (supporting infra — not user features)

Atom clusters with real code but no bounded user journey; homed here as one-liners so nothing is
dropped and no feature has to narrate them (decision 8).

- **jats-content-api** — JATS XML full-text per publication (upload, visibility toggle, public download): API-jats-{get,add,delete,set-visibility,public-download}, PLUGIN-generic-jatsTemplate, PLUGIN-oaiMetadataFormats-oaiJats, LOC publication.jats. Content API, no page of its own; surfaced via galleys/oai-pmh.
- **citation-enrichment-pipeline** — background PID/metadata lookup enriching citations (Crossref/OpenAlex/ORCID): JOB-{crossrefjob,extractpidsjob,isprocessedjob,openalexjob,orcidcitationjob}, API-{citation-reprocess,submission-reprocess-citations}. No UI; feeds publication-metadata-references.
- **usage-stats-processing** (ETL) — log-ingestion & metric-compilation behind the stats pages: JOB-{archiveusagestats,removedoubleclicks,compile*metrics,compileusagestats,processusagestats,deleteusagestats}, TASK-{usagestatsloader,updateipgeodb}, DB-usage_stats_*_temporary_records, metrics_submission_geo_*. No direct surface; feeds usage-statistics.
- **content-tombstones** — OAI deletion-tombstone records for withdrawn/deleted content: data_object_tombstones, data_object_tombstone_settings, data_object_tombstone_oai_set_objects. No page/API; OAI-deletion completeness for oai-pmh.
- **filters-framework** — the document-transform engine behind native XML import/export and OAI: DB-filters/filter_groups/filter_settings. Infra parked under native-xml-import-export by proximity.
- **controlled-vocabularies** — shared keyword/interest primitive: controlled_vocab*, user_interests, /vocabs, /vocabs/interests. Threaded through submission-wizard-metadata (keywords) and user-profile (reviewer interests).
- **affiliations-ror** — author affiliations linked to the ROR registry (cache + registry-refresh task): SCHEMA-{ror,affiliation}, API-ror-{get,get-many,add-or-edit}, DB-rors/ror_settings, TASK-updaterorregistrydataset. Internal storage of contributors.
- **temporary/public-file-upload plumbing** — cross-cutting upload primitive used by many forms: temporary_files, /temporaryFiles, /_uploadPublicFile, AUTHZ-attach-file-upload-header. Surfaced via submission-files / media-files.

---

# Part B — Divergences (RESOLVED — decision record)

The 9 seams the panel deferred; each now carries the maintainer's resolution (2026-07-02). Kept as
the record of what was decided and why.

#### 1. editorial-decisions — one engine vs distributed vs folded-into-shell
- **RESOLVED: ONE feature `editorial-decisions`.** It owns the shared mechanics once (record-decision UI, notify-author email + attachments, decision→stage/status transition, decline/revert) plus a variant table of the OJS decision types (guard + resulting state, incl. the Done-stage MOVE_TO_DONE/RETURN_TO_DONE/RETURN_TO_WORKFLOW). `done-stage` folds in; stage features (send-to-review, review-rounds-and-revisions, copyediting/production) REFERENCE it, and the workflow-page action-bar is not re-narrated in the shell.
- The split: **refine**/**clustering** gave the engine one feature; **lifecycle** distributed it into ~4 phase features + scattered per-stage decisions; **ui** dissolved it into the `workflow-stages-and-decisions` shell.
- Trade-off: one feature keeps the ~35 near-identical decision atoms from fragmenting and states notify/attach/revert once; distributing them re-narrates the shared mechanics.

#### 2. The publication record — one multi-tab area vs scattered tabs vs entity-clusters
- **RESOLVED: its own Area 3**, a tab-set of bounded features (title-abstract-body incl. Pandoc, contributors, metadata-references, galleys, media-files, identifiers, license, issue-assignment, versioning, publish-flow, amendments) plus issues & scheduling and data-availability-citations. Scattered tabs are gathered here.
- The split: **ui** treated the article-record as its own ~11-tab area; **refine**/**lifecycle** scattered the tabs across Publishing + Editorial; **clustering** re-cut them by code family.
- Trade-off: the tab-set area mirrors the live UI a PO clicks and keeps the record coherent; scattering breaks the "one screen" mental model.

#### 3. Review-workflow granularity — ~9 jobs vs coarser
- **RESOLVED: ~7 features** — send-to-review, assign-and-manage-reviewers, reviewer-response (invitation-response + completion MERGED), review-forms, review-rounds-and-revisions (rounds + author-response merged), recommend-only-editors, with review-anonymity kept separate (see #7).
- The split: **lifecycle** cut ~9 features; **refine**/**clustering** used ~6–7.
- Trade-off: fine cuts give each micro-job its own spec; coarser cuts match the round-1 test features and reduce cross-references between tightly-coupled steps.

#### 4. Submission-wizard granularity — one feature vs step-groups
- **RESOLVED: 3 features** — submission-wizard (core; validation + language are internal steps), submission-wizard-metadata (For-the-Editors fields), reviewer-suggestions. Wider splits (step-groups / ~8 phase features) collapse into these three; drafts and author tracking stay as their own pre-existing features.
- The split: **refine**/**clustering** kept one feature; **ui** split into 4 step-groups; **lifecycle** into ~8 phase features.
- Trade-off: one core feature matches the single "submit a manuscript" job; carving out the metadata and reviewer-suggestions steps lets each configurable step carry its own request/require config and spec.

#### 5. Context / journal-settings split — clustering's ~8-way vs coarser
- **RESOLVED: ~6 features by the Settings menu** — journal-masthead-settings, website-appearance-settings, workflow-settings (folds metadata-settings + file-genres + email-notification config, and merges review-settings), distribution-settings, access-settings, email-templates-management (standalone). The per-form 8-way split collapses into these; navigation-menus/sections/categories/announcements/languages/site-admin stay as their own managers.
- The split: **clustering** broke settings into ~8 form-level features; **refine**/**ui**/**lifecycle** kept ~5–6 coarser.
- Trade-off: per-form features are thorough but heavy; coarser settings match how a manager navigates one Settings menu.

#### 6. The DOI domain — 1 vs 2 vs 3 clusters
- **RESOLVED: 2 features** — doi-management (config + assign + status UI) and doi-deposit (Crossref/DataCite/DOAJ registration-agency backends + the peer-review/author-response DOI folded in). The 3-way split collapses to 2; open-peer-review-display stays a separate reader feature.
- The split: **refine** = 2, **ui** = 2, **lifecycle**/**clustering** = 3.
- Trade-off: two clusters keep the DOI story coherent while separating the core UI from the pluggable deposit backends (which own their own jobs/endpoints).

#### 7. review-anonymity — own feature vs dissolved
- **RESOLVED: own feature `review-anonymity`.** The double-anon/anon/open visibility matrix is specced once here; assign-and-manage-reviewers, reviewer-suggestions, tasks-discussions and article-landing reference it. Public transparent display is exposed via open-peer-review-display.
- The split: **refine**/**lifecycle** kept it standalone; **ui** dissolved it into a mode on reviewer-assignment + article-landing display; **clustering** into review-settings defaults + open-peer-review-display.
- Trade-off: a standalone feature specs the cross-party matrix once (it cross-cuts assignment, discussions, reader views); dissolving avoids a screenless feature but re-tests the rules everywhere.

#### 8. Overall granularity target — 77 → 84 → 98 → 101
- **RESOLVED: ~92 features + a Background & pipelines grouping.** Infra orphans with no user journey (jats-content-api, citation-enrichment-pipeline, usage-stats-processing/ETL, content-tombstones, filters-framework, controlled-vocabularies, affiliations-ror, temporary/public-file-upload plumbing) move to Background as one-liners; the 1/4 orphans that DO have a user journey (highlights-featured-content, article-recommendations, data-availability-citations, open-peer-review-display, editorial-statistics, installation-upgrade) stay as real features.
- The split: the four drafts landed at 77 / 84 / 98 / 101; the spread was almost entirely in how many thin/orphan clusters got promoted.
- Trade-off: the Background grouping keeps completeness (nothing dropped) without inflating the feature count with screenless infra.

#### 9. tasks-discussions — merged vs split
- **RESOLVED: ONE merged feature `tasks-discussions`** — matching the shipped 3.6 unified panel and the verified pilot spec; not split into editorial-tasks + editorial-discussions.
- The split: **refine**/**lifecycle** kept it merged; **ui**/**clustering** split it into `editorial-tasks` + `editorial-discussions`.
- Trade-off: the merge matches the code (3.6 unified both into one panel) and the sizing yardstick; the split matched the two distinct data models.

---

# Part C — Coverage & the pile (residue)

Atom clusters that remain outside the feature map after the Background grouping absorbed the homed
infra. Kept so nothing is silently dropped.

- **OMP/OPS-only Vue surfaces** — ChapterManager, PublicationFormatManager, RepresentativeManager, CatalogListPanel, WorkflowPageOMP/OPS, DoiListPanelOMP/OPS: present in the shared lib but unwired in OJS's WorkflowPageOJS map. **OUT OF SCOPE — dropped** (OJS-only decision, 2026-07-02; charter Scope). Same for `NOTIFICATION_TYPE_BOOK_*` (10 atoms) and the `*_INTERNAL` review-stage decisions.
- **Dead-code candidates** (UNASSIGNED.md, ~19 atoms) — the ~6–8 superseded legacy grids (PubIdExport* lists, ProductionReadyFiles, WorkflowReviewRevisions, SelectableLibraryFile, EditorSubmissionDetailsFiles, AuthorGridHandler), PAGE-manager-legacy + ~6 routed-but-unimplemented ops, NOTIF-configure-payment-method, 10 NOTIF-BOOK-* (OMP legacy), NOTIF-query-activity, EVLOG-REV-DUE. Cleanup candidates, not features.
- **AUTHZ middleware baseline** — session/cookie/CSRF/CORS/context/roles policies (~13) + base policy machinery: cross-cutting auth gate; per-feature policies are claimed by their feature (roles-permissions owns the framework). Known ⚠: HasRoles returns 401 not 403.
- **Locale infra prefixes** — ~8 prefixes / ~380 keys (admin.cli, grid.action, validator.*, common.*, installer.*, form.dropzone, navigation.skip): i18n of already-mapped features, left cross-cutting rather than force-fit.
- **Thin plugin substrate** — pflPlugin (non-stock third-party), pluginTemplate (scaffold), tinymce (rich-text editor primitive), usageEvent (→usage-statistics), dc11/libpkp base classes (pair 1:1 with their OJS-side plugin). None warrant a feature; homed in plugin-management as substrate.
- **Crossmark button** — VUE-pkp-crossmark-button: one reader widget, no backend cluster; rides along article-landing / doi-deposit.

_(Infra clusters previously listed here — metrics/stats ETL & temporary tables, filters framework, controlled vocabularies/interests, ROR registry cache, content tombstones, temporary/public-file upload plumbing — are now homed in the Background & pipelines grouping in Part A.)_
