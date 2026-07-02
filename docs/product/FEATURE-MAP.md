# OJS Feature Map — panel consensus

Synthesis of four independent feature-mapping drafts:
**refine** (77, round-1 refinement) · **ui** (84, UI/IA navigation) ·
**lifecycle** (98, editorial-lifecycle spine) · **clustering** (101, atom bottom-up).

- Consensus features: **101**, in 8 areas.
- `support:` counts how many of the four strategies proposed a feature *as a distinct
  feature* (a strategy that folds it into a larger feature is named as a "fold", not
  counted). **4/4 = 66 features** (high-confidence). **1/4 = 11 features** (kept for
  completeness, flagged ⚑). The remaining 24 are 2/4–3/4.
- Where strategies split or lump the same ground, the map picks a provisional
  representation and the real decision is deferred to **Part B**.
- Sizing target: one bounded user job ≈ `specs/tasks-discussions.md` (~57 atoms).

---

# Part A — Consensus feature map

## Area 1 — Author submission & intake

### submission-wizard — an author fills and submits a manuscript end-to-end (start, files+genres, details, confirm, consent, acknowledgement)
support: 4/4 (refine/ui/lifecycle/clustering)
atoms: PAGE-submission-{index,saved,wizard,cancelled}, VUE-start-submission-form, VUE-reconfigure-submission-modal, FORM-{start-submission,confirm-submission,details,title-abstract,comments-for-the-editors}, GRID-file-upload-wizard-handler, DB-submissions, MAIL-submission-acknowledgement, NOTIF-submission-submitted (~30)
aliases: ui splits into `submission-wizard-start-files-details` + `-contributors-metadata` + `-confirm-and-consent`; lifecycle splits into `submission-wizard-start-and-files` + `-confirm-and-submit` + `multilingual-submission-and-locale`. Granularity seam → Part B.

### submission-metadata — the "For the Editors" metadata surface (keywords/subjects/disciplines/agencies/coverage/type/data-availability) with request-vs-require modes
support: 2/4 (refine, clustering) — ui & lifecycle fold it into a wizard step (`-contributors-metadata` / `submission-wizard-metadata`)
atoms: FORM-{pkp-metadata,pkp-data-availability,metadata-settings}, controlled_vocab keywords, LOC metadata.property (~13). Shared with publication-metadata (edit vs intake).

### submission-drafts — save-for-later, resume, delete a draft; incomplete-submissions list
support: 4/4 (refine/ui/lifecycle/clustering)
atoms: DB-submissions (submissionProgress/incomplete), API-submission-save-for-later, API-backend-submissions-bulk-delete-incomplete, MAIL-submission-saved-for-later, VUE-submissions-list-panel (~6)

### reviewer-suggestions — author suggests reviewers in the wizard; editor sees them at assignment
support: 3/4 (refine, lifecycle, clustering) — ui folds it into the wizard step-group
atoms: VUE-reviewer-suggestion-manager, VUE-reviewer-suggestions-list-panel, API-reviewer-suggestion-* (5), DB-reviewer_suggestions(+settings) (~5)

### author-dashboard — the author's My-Submissions list and read-mostly tracking of their own submission
support: 3/4 (refine, ui, lifecycle) — clustering folds it into `editorial-dashboard`
atoms: PAGE-authordashboard-{submission,readsubmissionemail}, PAGE-dashboard-mysubmissions, VUE-submissions-list-panel (author variant) (~6)

## Area 2 — Editorial workflow & peer review

### editorial-dashboards — editor/manager triage of all submissions (active, needs-editor, archived, my-assigned, review-assignments) with filters/search
support: 4/4
atoms: PAGE-dashboard-{index,editorial,reviewassignments}, PAGE-submissions-{index,tasks}, VUE-dashboard-page, VUE-dashboard-table, FORM-submission-filters, API-submissions-get-many (~12)
aliases: ui splits reviewer/author views out (`reviewer-assignments-dashboard` = ui-only 1/4). Dashboard-split seam.

### workflow-stage-navigation — the workflow-page shell: stage tabs/bubbles, per-stage access, stage routing
support: 2/4 (ui `workflow-stages-and-decisions`, clustering) — refine folds it into `submission-stage`; lifecycle leaves it implicit in the stage features
atoms: PAGE-workflow-{access,index,submission,editorial,production}, VUE-workflow-page(+ojs), AUTHZ-workflow-stage-access/user-accessible (~9). ⚠ ui also hoists the decision action-bar in here → Part B.

### submission-stage — the pre-review (stage-1) workspace: assign editor, incoming files, accept-and-skip, desk-decline/withdraw, send to review
support: 2/4 (refine, ui) — lifecycle distributes into `send-submission-to-review`/`accept-or-decline`; clustering into `workflow-stage-navigation`
atoms: PAGE-workflow-submission, GRID-submission-files-*, SCHEMA-submission-ojs, EVLOG-SUBM-SUBMIT (~8)

### editorial-decisions — the decision engine: which decisions each stage offers, record a decision, notify-author email (+attachments), decline/revert, new round, recommend
support: 4/4 (all propose a decision concept; representation differs sharply)
atoms: PAGE-decision-record, SCHEMA-decision, DB-edit_decisions, API-submission-{get,add}-decision, AUTHZ-decision-{write,allowed,stage-valid,type-required}, FORM-select-revision-{decision,recommendation}, ~35 Decision constants, ~17 Decision*NotifyAuthor mailables, EVLOG-SUBM-ED-{DEC,REC,EMAIL}, NOTIF-editor-decision-* (~40)
aliases: lifecycle distributes into `record-editorial-decision` + `accept-or-decline-submission` + `advance-through-workflow-stages`; ui folds the action-bar into `workflow-stages-and-decisions`. **Biggest structural seam → Part B.**

### done-stage — the 6th workflow stage (WORKFLOW_STAGE_ID_DONE): auto MoveToDone on first publish, ReturnToWorkflow on unpublish, manual ReturnToDone
support: 3/4 (refine, lifecycle `move-submission-to-done`, clustering `done-workflow-stage`) — ui folds it into `workflow-stages-and-decisions`
atoms: WORKFLOW_STAGE_ID_DONE=6 (writes submissions.stage_id, no table), Decisions 33/34/35, API-submission-return-to-done, ApplyDoneWorkflowStage listener, I12799 backfill migration (~5). New-in-3.6 gap all four flagged.

### stage-participants — add/remove stage participants, role-based access effects, assistant scoping
support: 4/4 (lifecycle names it `manage-stage-participants-and-editors`, folding assign-editor in)
atoms: VUE-participant-manager, GRID-stage-participant/user-select, DB-stage_assignments, DB-subeditor_submission_group, EVLOG-SUBM-{ADD,REM}-PART, NOTIF-editor-assign (~7)

### reviewer-assignment — editor assigns/manages reviewers (search picker, due dates, anonymity mode, reviewer type), unassign/resend/reinstate/thank
support: 4/4
atoms: VUE-reviewer-manager, VUE-select-reviewer-list-panel, GRID-reviewer-grid, DB-review_assignments(+settings), MAIL-review-{request,reinstate,resend,unassign}, NOTIF-review-assignment(+updated), EVLOG-REV-{ASSIGN,CLR,REIN,CONF} (~14)

### reviewer-response — the reviewer's own review: accept/decline invitation, review steps, recommendation, comments, attachments, one-click access
support: 4/4 (lifecycle splits into `reviewer-invitation-response` + `reviewer-completes-review`)
atoms: PAGE-reviewer-{submission,step,savestep,showdeclinereview,savedeclinereview}, VUE-reviewer-submission-page, DB-review_form_responses, review_files, MAIL-review-{confirm,decline,acknowledgement}, EVLOG-REV-{ACCP,DECL,RDY,RECOMMENDATION} (~14)

### review-rounds — new round, round-status, request-revisions → author uploads → resubmit-for-review cycle, round history
support: 4/4 (lifecycle splits into `manage-review-rounds` + `request-revisions-and-resubmit`)
atoms: PAGE-workflow-externalreview, DB-review_rounds(+settings,files), Decisions {RequestRevisions,Resubmit,NewRound,CancelRound}, NOTIF-{review-round-status,pending-external-revisions} (~12)

### author-review-response — editor requests / author submits a response to a review round
support: 2/4 (ui `review-recommendations-and-author-responses`, clustering `author-response-to-review`) — refine folds it into reviewer-response; lifecycle into request-revisions
atoms: PAGE-reviewresponse-requestauthorresponse, VUE-author-response-manager(+request), VUE-request-review-round-author-response, DB-review_round_author_responses(+authors,settings), API-review-*-author-response, MAIL-request-review-round-author-response (~8)

### review-forms — a manager builds a review form with elements; a reviewer fills it; the editor reads responses
support: 4/4
atoms: GRID-review-form-grid, GRID-review-form-elements-grid, listbuilder-response-item, DB-review_forms(+settings,elements,element_settings,form_responses) (~6). Placement seam: settings (ui/lifecycle/clustering) vs editorial (refine).

### review-anonymity — double-anonymous / anonymous / open modes: what each party sees; public open-review display
support: 2/4 (refine, lifecycle `review-anonymity-modes`) — ui dissolves into reviewer-assignment mode + article-landing display; clustering into review-settings defaults + `open-peer-review-display`
atoms: SUBMISSION_REVIEW_METHOD constants, per-assignment anonymity flags, VUE-pkp-open-review, participant-blinding rules (~5). Seam → Part B.

### recommend-only-editors — a recommend-only section editor records a recommendation the deciding editor then acts on
support: 4/4
atoms: VUE-reviewer-recommendation-manager, DB-reviewer_recommendations(+settings), Decisions RecommendAccept/Decline/Resubmit/Revisions, MAIL-recommendation-notify-editors, EVLOG-SUBM-ED-REC/REV-PROXY-REC (~4)
sub-note: clustering also carved a 1/4 `reviewer-recommendations-vocab` (configurable recommendation options) — folded here / into review-settings; flag ⚑ if it grows.

### copyediting-stage — copyeditor assignment, copyedited-files exchange, author check, send-to-production handoff
support: 4/4
atoms: PAGE-workflow-editorial, GRID-copyedit-files/manage-copyedit-files, NOTIF-{copyedit-assignment,assign-copyeditor,awaiting-copyedits}, MAIL-decision-back-from-copyediting, EVLOG-EMAIL-COPY-* (~8)

### production-stage — layout-editor assignment, production-ready/final/proof files, galley approval, schedule handoff
support: 4/4
atoms: PAGE-workflow-production, GRID-{final-draft,production-ready,manage-proof}-files, NOTIF-{layout,index,awaiting-representations,assign-productionuser}, MAIL-decision-back-from-production (~8)

### tasks-discussions — per-stage tasks (owner + due date) and threaded discussions, seeded from journal templates; in-app + email notification
support: 4/4 (the verified pilot spec; refine & lifecycle keep it merged, ui & clustering split it into `editorial-tasks` + `editorial-discussions`)
atoms: full `specs/tasks-discussions.md` claim-set — DB-edit_tasks/edit_task_*(5), DB-notes/submission_comments, API-editorial-task-*(12), API-edit-task-template-*(5), VUE-discussion-manager, VUE-task-template-manager, MAIL-discussion-*, NOTIF-new-query, AUTHZ-query-* (~57). Merge-vs-split → Part B.

### submission-files — per-stage file upload, revisions, dependent files, non-ASCII filenames, downloads, file attachers
support: 4/4
atoms: VUE-file-manager, VUE-{submission-files,listing-files}-list-panel, VUE-file-attacher, GRID files/* (~25 grids, several base/dead), DB-submission_files(+revisions,settings), files, temporary_files, SCHEMA-submission-file, EVLOG-FILE-* (~10). file-genres config folds into submission-settings.

### editorial-activity-log — the submission event-log surface (per-item + per-submission history modal); information-center notes/history/email tabs
support: 4/4
atoms: GRID-{submission,file}-event-log, GRID-information-center-*, SCHEMA-event-log, DB-event_log(+settings), the EVLOG-* corpus (~36 submission/file types) rendered here (~10). Note: individual EVLOG-* are co-claimed by the feature that fires them; this owns the log surface.

### document-library — context & submission library files (review templates, marketing/permissions docs), distinct from per-submission media
support: 2/4 (clustering `document-library`, lifecycle `publisher-library-documents`) — ui/refine fold library grids into media/settings
atoms: GRID-library-file-admin, GRID-library-file, DB-library_files(+settings), API-library (~4)

## Area 3 — Publishing, publication record & issues

### publication-scheduling — publish/unpublish/schedule preconditions & actions, republish, front-end visibility flip
support: 4/4 (refine merges issue-assignment in; ui `publication-publish-flow`; lifecycle `publish-and-schedule-publication`; clustering `publication-publishing`)
atoms: GRID-modals-publish-publish-handler, FORM-publish-form, SCHEMA-publication (status/accessStatus), TASK-publishsubmissions, API-publications-publish/unpublish (~13)

### publication-versioning — create/edit a new version, version history & dropdown, cross-version language rules, reader display
support: 4/4 (second verified pilot spec, `specs/publication-versioning.md`)
atoms: SCHEMA-publication-{pkp,ojs} (version props), API-submission-{change,version,next-available}-version, NOTIF-submission-new-version, MAIL-{publication-version,revised-version}-notify, EVLOG-SUBM-VER-CRT (~18)

### publication-metadata — editing the publication's bibliographic metadata: title/abstract/keywords/subjects per-locale, categories, edit-permission gate
support: 4/4 (refine keeps one big feature; ui splits `publication-title-abstract-body` + `-metadata-references`; lifecycle `publication-metadata-and-categories`; clustering `submission-metadata-editing`)
atoms: FORM-{title-abstract,pkp-metadata}, API-submission-get-publication-{metadata,titleAbstract}-form, author-edit-published gate, DB-publication_settings, EVLOG-SUBM-META-UPD (~15). Tab-set seam → Part B.

### publication-body-text-and-pandoc — full-text HTML body editor + the Pandoc Word→HTML importer
support: 2/4 (lifecycle `jats-and-body-text-fulltext`, clustering `publication-body-text`) — ui folds Pandoc into the title/abstract/body tab; refine into publication-metadata
atoms: API-body-text-{get,save,delete}, VUE-pandoc-converter (pandoc-wasm, WorkflowPublicationBodyText), LOC publication.bodyText (~4). **Required placement (Pandoc importer).**

### jats-content ⚑ — JATS XML full-text per publication (upload, visibility toggle, public download)
support: 1/4 (clustering; lifecycle merges into `jats-and-body-text-fulltext`) — a content API with no page of its own, easy to miss top-down
atoms: API-jats-{get,add,delete,set-visibility,public-download} (5), PLUGIN-generic-jatsTemplate, PLUGIN-oaiMetadataFormats-oaiJats, LOC publication.jats (~13)

### citations-references — reference list, structured/raw citation edit
support: 2/4 (clustering `citations-references`; ui folds into `publication-metadata-references`) — refine & lifecycle fold references into publication-metadata / identifiers-license
atoms: VUE-citation-manager, FORM-{citation-raw-edit,citation-structured-edit,pkp-citations}, SCHEMA-citation, API-citation-* (getMany/get/edit/delete/reprocess), DB-citations(+settings) (~10)

### citation-enrichment-pipeline ⚑ — background PID/metadata lookup enriching citations (Crossref/OpenAlex/ORCID)
support: 1/4 (clustering orphan) — refine folds the jobs into publication-metadata; ui notes them under the references tab
atoms: JOB-{crossrefjob,extractpidsjob,isprocessedjob,openalexjob,orcidcitationjob}, API-{citation-reprocess,submission-reprocess-citations} (~7). No UI.

### data-availability-citations ⚑ — data-set citations & availability statement
support: 1/4 (clustering) — others fold into submission/publication metadata
atoms: VUE-data-citation-manager, FORM-{data-citation-edit,pkp-data-availability}, SCHEMA-data-citation, API-data-citation-* (6), DB-data_citations(+settings) (~6)

### contributors — contributor CRUD, ordering, primary contact, affiliations, CRediT roles on a publication (reused in the wizard)
support: 4/4 (lifecycle splits `submission-wizard-contributors` from `contributors-and-affiliations`)
atoms: VUE-contributor-manager, VUE-contributor-role-manager, VUE-contributors-list-panel, FORM-contributor-form, DB-authors(+settings,affiliations), credit_contributor_roles/credit_roles, SCHEMA-author, PLUGIN-generic-credit (~12)

### affiliations-ror ⚑ — author affiliations linked to the ROR registry (cache + registry-refresh task)
support: 1/4 (clustering) — refine/ui/lifecycle attach ROR as internal storage of contributors
atoms: SCHEMA-{ror,affiliation}, API-ror-{get,get-many,add-or-edit}, DB-rors/ror_settings, TASK-updaterorregistrydataset (~5)

### galleys — galley create/edit/delete, file vs remote URL, labels, ordering, galley DOI; HTML/PDF/JATS/Lens render plugins
support: 4/4
atoms: VUE-galley-manager, GRID-article-galley-grid, SCHEMA-galley, DB-publication_galleys(+settings), PAGE-article-download, PLUGIN-generic-{htmlArticleGalley,pdfJsViewer,jatsTemplate,lensGalley} (~10)

### publication-identifiers-license — the identifiers tab (DOI/URN/pages/article-number) and license/copyright/permissions overrides on a publication
support: 4/4 (ui splits into `publication-identifiers` + `publication-license-permissions`)
atoms: FORM-{pkp-publication-identifiers,pkp-publication-license,license}, SCHEMA-doi, DB-dois(+settings) as displayed on the publication, PLUGIN-pubIds-urn, urlPath/pages props (~8)

### publication-issue-assignment — assign an article to an issue/section and schedule it into a future issue
support: 2/4 (ui, lifecycle `issue-scheduling-and-assignment`) — refine merges into publication-scheduling; clustering into issues-management
atoms: FORM-issue-entry-form, SCHEMA-submission-ojs (issueToBePublished), DB-publication_categories, API issue-assignment-status (~5)

### publication-amendments — Summary-of-Changes + update type: author submits revisions to a published article, editor inserts them, versioned update types
support: 3/4 (refine, ui, lifecycle) — clustering folds InsertSummaryOfChanges into submission-metadata-editing
atoms: VUE-insert-summary-of-changes-modal, DB-review_round_author_responses (published-version path), update-type props (~6). New 3.6 flow.

### media-files — the Media section: batch upload, web/high-res variant linking, sharing across galleys, dependent files, author read-only
support: 4/4
atoms: VUE-media-file-manager, API-media-files-* (6), DB-variant_groups, SUBMISSION_FILE_MEDIA rows, MediaFilesController, PAGE-libraryfiles-download* (~8)

### issue-management — issue CRUD, TOC ordering, cover image, publish issue + reader notification, current issue, unpublish/delete, issue galleys, back/future lists
support: 4/4 (ui merges manager + reader TOC into one; lifecycle splits `issue-galleys-and-cover` out)
atoms: PAGE-manageissues-index, DB-issues(+settings,files), issue_galleys(+settings), custom_issue_orders, GRID-{back-issue,future-issue,issue-galley,toc}-grid, API-issue-*, NOTIF-published-issue, JOB-issuepublishednotifyusers, MAIL-issue-published-notify (~13). Split candidate → Part B.

## Area 4 — Reader front end

### journal-homepage — journal home: current-issue display, sidebar blocks, announcements block, highlights carousel
support: 4/4
atoms: PAGE-index-index, DB-journals/journal_settings, VUE-highlights-list-panel (render), PLUGIN-blocks-* (~7)

### highlights-featured-content ⚑ — a manager curates ordered featured highlights shown on the home page (config side)
support: 1/4 (lifecycle promotes it; clustering calls it a full sub-feature but homes it in journal-homepage) — refine/ui place the render in journal-homepage / config in website-appearance
atoms: VUE-highlights-list-panel, FORM-highlight-form, SCHEMA-highlight, API-highlight-* (6), DB-highlights(+settings). Thin config/render seam.

### article-landing — article abstract page: metadata display, galley view/download (pdf.js smoke), license, DC/Scholar meta tags, how-to-cite, Crossmark, open-review, "recommend by" blocks
support: 4/4
atoms: PAGE-article-{view,download,viewfile,downloadsuppfile}, VUE-pkp-{cite,crossmark-button,orcid-display,open-review}, PLUGIN-generic-{recommendByAuthor,recommendBySimilarity,dublinCoreMeta,googleScholar} (~10)

### article-recommendations ⚑ — reader sees related articles (same author / similar keywords)
support: 1/4 (lifecycle) — others fold into article-landing
atoms: PLUGIN-generic-{recommendByAuthor,recommendBySimilarity}. Round-2 backlog plugins.

### issue-archive-toc — public archive listing, current issue, single-issue TOC, section grouping, issue-galley download
support: 4/4
atoms: PAGE-issue-{index,current,archive,view,download}, GRID-toc-grid, SCHEMA-issue, PLUGIN-catalog (~5)

### site-search — front-end search, filters, no-result behaviour, index maintenance
support: 4/4
atoms: PAGE-search-{index,search}, FORM-pkp-search-indexing-form, DB-submissions_fulltext, JOB-updatesubmissionsearchjob (~6)

### browse-category-section — category/section browse landing pages and the browse sidebar block
support: 4/4
atoms: PAGE-catalog-{category,fullsize,thumbnail}, PLUGIN-blocks-browse, DB-categories/sections (browse hook) (~4)

### public-comments — reader comments: post, moderate, approve, report, anonymous gating
support: 4/4
atoms: VUE-pkp-comments, VUE-user-comments-{page,table}, VUE-user-comment-reports-table, FORM-content-comments-form, API-comment-* (~12), DB-user_comments(+settings,reports), NOTIF-user-comment-{posted,reported}, PAGE-management-settings-usercomments (~10)

### about-pages — public About/Contact/Submissions-guidelines/privacy, editorial-masthead & -history public pages, custom static pages, sidebar blocks
support: 4/4 (ui splits `static-content-and-blocks`; clustering `static-pages`)
atoms: PAGE-about-{index,contact,submissions,privacy,editorialmasthead,editorialhistory,aboutthispublishingsystem}, PAGE-information-*, PLUGIN-generic-staticPages, PLUGIN-blocks-{information,developedBy,makeSubmission} (~10)

### oai-pmh — OAI-PMH protocol (Identify/ListRecords/GetRecord/resumption tokens) and its DC/MARC/MARCXML/JATS/RFC1807 metadata-format plugins
support: 4/4 (ui combines with sitemap/feeds into `oai-sitemap-and-feeds`)
atoms: PAGE-oai-index, DB-oai_resumption_tokens, PLUGIN-oaiMetadataFormats-{dc,marc,marcxml,oaiJats,rfc1807}, PLUGIN-generic-driver (~10)

### content-tombstones ⚑ — OAI deletion-tombstone records for withdrawn/deleted content
support: 1/4 (clustering orphan) — lifecycle attaches to oai-pmh; others fold in
atoms: DB-data_object_tombstones, data_object_tombstone_settings, data_object_tombstone_oai_set_objects (3 tables, no page/API/plan)

### web-feeds-syndication — sitemap.xml and RSS/Atom web feed of recent content + announcement feed
support: 3/4 (refine, lifecycle, clustering) — ui combines into `oai-sitemap-and-feeds`
atoms: PAGE-sitemap-index, PLUGIN-generic-{webFeed,announcementFeed}, PLUGIN-blocks-browse (feed links) (~5)

## Area 5 — Users, roles & access

### registration-login — public registration (roles, consent, email validation), login, logout, failed login, account activation
support: 4/4
atoms: PAGE-user-{register,registeruser,activateuser}, PAGE-login-{index,signin,signout}, MAIL-{user-created,validate-email-context,validate-email-site}, DB-users/sessions, AUTHZ-session policies (~8)

### password-flows — reset via email, forced change on first login, self-service change in profile
support: 4/4
atoms: PAGE-login-{lostpassword,requestresetpassword,resetpassword,updateresetpassword,changepassword,savepassword}, MAIL-password-reset-requested (~5)

### user-profile — identity/contact/public profile, notification prefs, API key, reviewer interests
support: 4/4
atoms: PAGE-user-{index,profile}, GRID-profile-tab-handler, DB-user_settings/user_interests, notification_settings, API-{user,vocab,interest}-* (self), SCHEMA-user (~6)

### user-management — manager user CRUD, search/filter, disable/enable, remove role, email user, merge users, notify-users
support: 4/4
atoms: GRID-user-grid, GRID-user-api-handler, VUE-notify-users-form, API-user-{get-many,report,end-role,masthead}, DB-users/user_user_groups, MAIL-user-role-end-notify (~10)
sub-note: clustering carved a 1/4 `user-role-lifecycle-notices` (role-end / masthead-update mail) — folded here.

### user-invitations — invite a new or existing user to a role; the multi-step accept/decline wizard
support: 4/4
atoms: PAGE-invitation-{accept,decline,confirmdecline,create,edit}, VUE-{user-invitation-page,accept-invitation-page,user-invitation-manager}, API-invitation-* (~13), DB-invitations, MAIL-user-role-assignment-invitation-notify, JOB-removeexpiredinvitations (~8)

### roles-permissions — the role/user-group grid, custom role creation, stage-assignment effects, settings-URL access gates, reset-permissions tool
support: 4/4
atoms: PAGE-management-{settings-access,permissions,resetpermissions}, VUE-user-access-manager, GRID-user-group-grid, DB-user_groups(+settings,stage), SCHEMA-user-group, AUTHZ-{stage-role,role-based,user-roles-required}-policy (~10)

### login-as — admin impersonation of another user and return to own session
support: 4/4
atoms: PAGE-login-{signinasuser,signoutasuser}, PAGE-admin-{confirmaccess,confirmaccesssubmit}, AUTHZ-reauthentication-required-policy, DB-sessions (~4)

### site-access-restrictions — login-wall site access, registration disabled, disabled-journal visibility, restricted-article gating
support: 4/4
atoms: PAGE-management-access, restrictSiteAccess/disableUserReg/restrictArticleAccess toggles, AUTHZ-{restricted-site-access,pkp-site-access,https,allowed-hosts}-policy (~4)

### editorial-masthead — masthead configuration (role order, reviewer display opt-in) that drives the public masthead page
support: 4/4
atoms: FORM-{masthead,pkp-masthead,pkp-appearance-masthead}, API-user-masthead, MAIL-user-role-masthead-update-notify (~4). Config vs public-display seam (public render lives in about-pages) → Part B note.

## Area 6 — Journal & site settings

### journal-setup — journal masthead/identity/contact/info/privacy context settings that persist and surface publicly
support: 4/4 (ui `journal-details-settings`; lifecycle `journal-masthead-and-contact-setup`)
atoms: PAGE-management-settings-context, FORM-{context,pkp-contact,pkp-privacy,pkp-information}, SCHEMA-context-{ojs,pkp}, DB-journals/journal_settings (~4)

### website-appearance — theme options, logo/homepage image uploads, custom CSS, date/time formats, info/list pagination
support: 4/4 (ui splits `website-info-and-lists` out)
atoms: PAGE-management-settings-website, VUE-theme-form, VUE-date-time-form, FORM-{appearance-setup,appearance-advanced,pkp-theme,pkp-date-time,pkp-lists}, PLUGIN-themes-default, PLUGIN-generic-customBlockManager (~8)

### navigation-menus — menu & menu-item CRUD, custom items, area assignment, front-end rendering
support: 4/4
atoms: VUE-navigation-menu-{editor,manager-field}, GRID-navigation-menus-*, PAGE-navigationmenu-{index,view,preview}, DB-navigation_menus/items(+settings,assignments), API-navigation-menu-* (~6)

### sections — journal sections CRUD: ordering, editor restrictions, inactivation, review-form default, word count
support: 4/4 (clustering places it with Publishing; three place it in settings)
atoms: GRID-section-grid, SCHEMA-section-{pkp,ojs}, DB-sections(+settings), custom_section_orders, API-section-* (~6)

### categories — content categories CRUD incl. nesting, assigned editors, wizard exposure, front-end browse hook
support: 4/4
atoms: VUE-category-manager, FORM-category-form, SCHEMA-category, DB-categories(+settings), publication_categories, API-category-* (5) (~5)

### submission-settings — Workflow › Submission: checklist, author guidelines, components/genres, metadata request/require toggles, disable-submissions
support: 4/4 (clustering splits `file-genres` + `metadata-settings` out)
atoms: PAGE-management-settings-workflow, FORM-{access,metadata-settings,pkp-metadata-settings,pkp-disable-submissions,submission-guidance-settings}, GRID-genre-grid, DB-genres(+settings) (~4)
sub-note: clustering's 1/4 `metadata-settings` (which fields the journal collects) folded here.

### review-settings — default review mode, response/review deadlines, reminder config, reviewer guidance, custom reviewer-recommendation options
support: 4/4
atoms: FORM-{pkp-review-setup,review-guidance,pkp-review-guidance,reviewer-recommendation}, DB-review_assignment_settings, reviewer_recommendation_settings (~6)

### email-templates-management — the Manage Emails UI: enable/disable mailables, edit/add/reset templates, role-based access; plus journal email setup (signature/bounce/bulk restrictions)
support: 4/4 (ui merges with email-setup as `email-setup-and-templates`; clustering splits `email-settings` out)
atoms: PAGE-management-settings-manageemails, VUE-edit-mailable-modal, VUE-edit-template-modal, FORM-{email-template,pkp-email-setup,pkp-restrict-bulk-emails}, DB-email_templates(+settings,default_data,user_group_access), API-email-template-* (~8)

### announcements — announcement CRUD, types, expiry, enable toggle; reader listing/detail page + notification + feed
support: 4/4
atoms: VUE-announcements-list-panel, GRID-announcement-type-grid, FORM-{pkp-announcement,pkp-announcement-settings}, DB-announcements(+settings,types), PAGE-announcement-{index,view}, API-announcement-* (5), NOTIF-new-announcement, JOB-newannouncementnotifyusers, MAIL-announcement-notify (~8)

### languages-locales — enable locales for UI/forms/submissions, set primary locale, multilingual form entry, install/manage locales
support: 4/4
atoms: GRID-{admin-language,manage-language,submission-language}-grid, PLUGIN-blocks-languageToggle, API-i18n-get-translations, locale enable settings (~6). Cross-cutting multilingual machinery (per-form entry rides along in each feature).

### distribution-settings — default license/copyright, indexing metadata, archiving display (LOCKSS/CLOCKSS), publishing mode (open vs subscription), payments enable
support: 4/4 (ui `distribution-indexing-archiving`; lifecycle `distribution-and-indexing-settings`)
atoms: PAGE-management-settings-distribution, FORM-{archiving-lockss,pkp-search-indexing,pkp-license}, PAGE-gateway-{lockss,clockss}, publishing-mode config (~6)

### site-settings — site-wide setup, site languages, site-level appearance, security/password policy, site statistics
support: 4/4
atoms: PAGE-admin-settings, FORM-pkp-site-{config,information,appearance,security,statistics,lists}, SCHEMA-site, DB-site/site_settings (~3)

### site-administration — hosted-journals CRUD + create-context wizard, multi-context navigation
support: 4/4 (ui splits `site-maintenance` out — see Area 8)
atoms: PAGE-admin-{index,contexts,wizard}, VUE-add-context-form, GRID-context-grid, FORM-pkp-context-form, SCHEMA-context-pkp, DB-journals, API-context-* (~8)

## Area 7 — Integrations, identifiers & monetization

### plugin-management — the installed-plugins grid enable/disable + settings modal, plugin gallery install/upgrade, site vs journal scope
support: 4/4
atoms: GRID-{settings-plugin,admin-plugin,plugin-gallery}-grid, PAGE-gateway-plugin, DB-plugin_settings, NOTIF-plugin-{enabled,disabled}, AUTHZ-plugin-access/level-required, PLUGIN-generic-{tinymce,pluginTemplate,pflPlugin} (substrate) (~5)

### doi-management — DOI settings (prefix/pattern/auto-assign, agency choice), assignment on publish, versioned DOI, management-page statuses/filters/bulk actions, deposit-DOI scheduled task
support: 4/4 (ui splits `doi-configuration` from `doi-assignment-and-deposit`)
atoms: PAGE-dois-index, VUE-doi-{setup,registration}-settings-form, VUE-doi-list-panel(+ojs), SCHEMA-doi, DB-dois(+settings), API-doi-* (~15), JOB-{depositcontext,depositsubmission,depositissue}, TASK-depositdois (~12). DOI-domain seam → Part B.

### crossref-datacite-deposit — Crossref/DataCite/DOAJ deposit backends: settings, export XML, deposit-status marking
support: 3/4 (refine `crossref-deposit`, lifecycle `crossref-datacite-deposit`, clustering `registration-agency-plugins`) — ui folds into `doi-assignment-and-deposit`
atoms: PLUGIN-generic-{crossref,datacite,doaj}, VUE-pkp-crossmark-button (Crossmark), API-context-edit-doi-registration-agency-plugin (~6)

### peer-review-doi — DOI deposit for peer reviews & author responses
support: 2/4 (lifecycle `peer-review-doi-and-open-reviews`, clustering `peer-review-doi`) — refine folds JOB-depositpeerreview into crossref-deposit; ui into doi-assignment-and-deposit
atoms: JOB-depositpeerreview, API-backend-doi-edit-{peer-review,author-response}, JOB-{depositorcidreview,reconcileorcidreviewputcode}. **Required placement.**

### open-peer-review-display ⚑ — public transparent peer-review history exposed as citable objects
support: 1/4 (clustering) — lifecycle merges into peer-review-doi; ui/refine fold the display into article-landing / review-anonymity
atoms: VUE-pkp-open-review, API-peer-review-* (6 open-review summary/detail endpoints)

### orcid — ORCID settings, author-authorization request/email, verified/unverified badge, registration prefill, OAuth callback, submission/review deposit
support: 4/4 (placement varies: identity [ui] / distribution [lifecycle] / users [clustering] / integrations [refine])
atoms: PAGE-orcid-{verify,authorizeorcid,about,updatescope}, VUE-pkp-orcid-display, FORM-orcid-{settings,site-settings}, API-orcid-*, MAIL-orcid-*, JOB-{depositorcidsubmission,revokeorcidtoken,sendauthormail,sendupdatescopemail} (~10)

### citation-style-language — CSL settings (styles offered, primary), how-to-cite render, BibTeX/RIS downloads
support: 3/4 (refine, ui `citation-formats-csl`, lifecycle `how-to-cite-and-citation-export`) — clustering folds the render into `citations-references`
atoms: PLUGIN-generic-citationStyleLanguage, VUE-pkp-cite (render/download), API-citation-* (~6). Reader-facing render vs citation-data editing seam.

### indexing-meta-tags — Dublin Core / Google Scholar / DRIVER meta-tag injection (+ Google Analytics) for indexers on public pages
support: 2/4 (lifecycle, clustering) — refine/ui fold into article-landing / distribution-indexing-archiving
atoms: PLUGIN-generic-{dublinCoreMeta,googleScholar,driver,googleAnalytics}, PLUGIN-metadata-dc11

### subscriptions-management — subscription types CRUD, policies, individual/institutional subscription records, subscription report
support: 4/4 (lifecycle splits `subscription-types-and-policies` from the records)
atoms: PAGE-payments-{subscriptions,subscriptiontypes,subscriptionpolicies}, GRID-{individual,institutional}-subscriptions-grid, DB-subscriptions/subscription_types(+settings)/institutional_subscriptions, PLUGIN-reports-subscriptions, MAIL-subscription-{notify,expired,expires-soon} (~12)

### subscription-access — access enforcement (anonymous vs subscriber vs editor bypass), delayed open access, subscriber purchase/renew flows
support: 4/4
atoms: PAGE-user-{subscriptions,purchasesubscription,payrenewsubscription,paymembership}, GRID-subscriber-select-grid, PLUGIN-blocks-subscription, TASK-{subscriptionexpiryreminder,openaccessnotification}, MAIL-subscription-{purchase,renew}-* (~10)

### payments — enable payments, manual/PayPal method config, payments grid, submission/APC fees on decision
support: 4/4
atoms: PAGE-payment(s)-*, FORM-{pkp-payment-settings,request-payment-decision,submission-payments}, PLUGIN-paymethod-{manual,paypal}, DB-{queued,completed}_payments, NOTIF-payment-required, MAIL-payment-request (~10)

### institutions — institution CRUD (IP ranges, ROR) backing institutional subscriptions and usage stats
support: 4/4 (refine places it in settings; ui/lifecycle/clustering with commerce)
atoms: VUE-institutions-list-panel, FORM-pkp-institution-form, SCHEMA-institution, API-institution-* (5), DB-institutions/institution_ip(+settings) (~4)

## Area 8 — System, communications & administration

### email-delivery — the rich email composer + template-variable rendering in real sends, per-submission email log, notify-composer with attachments, bulk send
support: 4/4 (ui `email-delivery-and-composer`; lifecycle `email-communication-and-log`)
atoms: VUE-composer, VUE-notify-users-form, DB-email_log(+users), SCHEMA-email-log, MAIL-* (~69 mailables, delivery side), JOB-bulkemailsender, API-email-* (~10). Template *management* lives in email-templates-management.

### notifications — in-app bell/inbox, task grid, mark read, per-user + per-journal opt-outs, unsubscribe link
support: 4/4 (ui/lifecycle `notifications-inbox-and-preferences`; clustering `notifications-system`)
atoms: VUE-top-nav-actions, PAGE-notification-{fetchnotification,unsubscribe}, GRID-{notifications,task-notifications}-grid, DB-notifications(+settings,subscription_settings), NOTIF-* framework (levels/surfaces) (~15). Per-feature NOTIF-* types co-claimed by their firing feature.

### jobs-queue — the background job queue page, failed jobs list/details, requeue, drain-queue task
support: 4/4
atoms: PAGE-admin-{jobs,failedjobs,failedjobdetails}, VUE-{jobs,failed-jobs,failed-job-details}-page, DB-jobs/failed_jobs/job_batches, API-job-*, TASK-{processqueuejobs,removefailedjobs} (~10)

### scheduled-tasks — review/editorial reminders, deposit-DOIs, auto-publish, open-access notification, cleanup tasks; admin reads task logs
support: 4/4
atoms: PAGE-admin-{downloadscheduledtasklogfile,clearscheduledtasklogfiles}, TASK-{editorialreminders,reviewreminder,publishsubmissions,removeunvalidatedexpiredusers,updateipgeodb,openaccessnotification}, JOB-{editorialreminder,reviewreminder}, MAIL-review-remind*, NOTIF-editorial-reminder (~10)

### rest-api — token/API-key authentication and the public REST surface (submissions, issues, users, contexts), permission rejections
support: 3/4 (refine, ui `rest-api-access`, lifecycle `rest-api-and-authentication`) — clustering treats it as a cross-cutting framework, not a feature
atoms: API-* corpus as a product surface (~285 endpoints), AUTHZ middleware (has-roles/has-user/has-context/decode-api-token), API-temporary-files-upload, DB-user_settings (api key) (~8)

### native-xml-import-export — native OJS XML round-trip of submissions and issues
support: 4/4
atoms: PAGE-management-importexport, PLUGIN-importexport-native (+libpkp base), GRID-exportable-issues-list, DB-filters/filter_groups/filter_settings (transform engine) (~5)

### user-import-export — bulk XML import/export of user accounts
support: 3/4 (ui, lifecycle, clustering) — refine folds it into user-management
atoms: PLUGIN-importexport-users (+libpkp base), GRID-exportable-users-grid

### pubmed-export — PubMed/MEDLINE XML metadata export
support: 3/4 (ui `pubmed-and-metadata-export`, lifecycle, clustering) — refine folds it into native-xml-import-export
atoms: PLUGIN-importexport-pubmed, PLUGIN-metadata-dc11

### usage-statistics — stats pages (publications, editorial activity, issues, users, context), date filter, CSV/report download
support: 4/4
atoms: PAGE-stats-*, VUE-*-download-report-modal, VUE-pkp-usage-chart, FORM-{pkp-context-statistics,report}, API-stats-* (~30), DB-metrics_* (~15), PLUGIN-generic-usageEvent (~20)

### usage-stats-processing ⚑ — the log-ingestion & metric-compilation ETL behind the stats pages
support: 1/4 (clustering orphan) — lifecycle notes it under usage-statistics but flags it could stand alone; ui/refine fold in
atoms: JOB-{archiveusagestats,removedoubleclicks,compile*metrics,compileusagestats,processusagestats,deleteusagestats} (~15), TASK-{usagestatsloader,updateipgeodb}, DB-usage_stats_*_temporary_records, metrics_submission_geo_*. No direct surface.

### counter-sushi — COUNTER R5 reports and the SUSHI API
support: 2/4 (lifecycle `counter-r5-and-sushi`, clustering `counter-sushi`) — refine/ui fold into usage-statistics
atoms: PAGE-stats-counterr5, VUE-counter-reports-page, FORM-counter-report-form, API-stats-sushi-* (~12), PLUGIN-reports-counter, DB-metrics_counter_*

### editorial-statistics ⚑ — editorial activity/decision statistics + the emailed editorial report
support: 1/4 (clustering) — others fold into usage-statistics
atoms: API-stats-editorial-get(+averages), TASK-statisticsreport, JOB-statisticsreport{mail,notify}, MAIL-statistics-report-notify, NOTIF-editorial-report

### csv-reports — pluggable CSV report plugins (article metadata, peer-review activity, subscriptions)
support: 3/4 (ui `content-and-review-reports`, lifecycle, clustering) — refine folds into usage-statistics
atoms: PLUGIN-reports-{articles,reviewReport,subscriptions}, PAGE-stats-reports

### site-maintenance — system information, phpinfo, clear template/data caches, expire sessions
support: 2/4 (ui `site-maintenance`, lifecycle `system-maintenance-and-caches`) — refine & clustering fold into site-administration
atoms: PAGE-admin-{systeminfo,phpinfo,cleartemplatecache,cleardatacache,expiresessions}, PAGE-management-tools, AUTHZ-{reauthentication,allowed-hosts}-policy

### installation-upgrade ⚑ — the installer & upgrade flow
support: 1/4 (clustering) — lifecycle folds into system-maintenance; refine drops it as ops/test-harness
atoms: PAGE-install-{index,install,upgrade,installupgrade}, DB-versions, LOC installer.*

---

# Part B — Divergences to resolve (maintainer's call)

#### 1. editorial-decisions — one engine vs distributed vs folded-into-shell
- The split: **refine** and **clustering** give the decision engine one feature (`editorial-decisions`, owning all ~35 Decision constants + notify-author mailables). **lifecycle** distributes it into ~4 phase features (`record-editorial-decision` for the engine, then `accept-or-decline-submission`, `advance-through-workflow-stages`, `move-to-done`) plus per-phase decisions scattered into review/copyediting/production. **ui** dissolves the engine into the workflow-page shell (`workflow-stages-and-decisions`, the decision action-bar).
- Trade-off: one feature keeps the ~35 near-identical decision atoms from fragmenting and states the notify/attach/revert rules once; distributing them puts each decision where the actor actually meets it (better narrative, but re-narrates the shared mechanics).

#### 2. The publication record — one multi-tab area vs scattered tabs vs entity-clusters
- The split: **ui** treats the article-record as its own area of ~11 tab-features (title/abstract/body, contributors, metadata/references, galleys, media, identifiers, license, issue, versioning, publish, amendments). **refine** and **lifecycle** scatter the same tabs across their Publishing + Editorial areas. **clustering** re-cuts them by code family (metadata-editing, body-text, jats-content, citations-references, data-availability, galleys, identifiers-license).
- Trade-off: the tab-set area mirrors the live UI a PO clicks and keeps the record coherent; scattering follows the editorial lifecycle / code proximity but breaks the "one screen" mental model.

#### 3. Review-workflow granularity — ~9 jobs vs coarser
- The split: **lifecycle** cuts peer review into ~9 features (send-to-review, assign-reviewers, invitation-response, completes-review, forms, anonymity-modes, manage-rounds, request-revisions, recommend-only). **refine** and **clustering** use ~6–7, folding invitation-response + completion into one `reviewer-response`/`reviewer-workflow` and revisions into `review-rounds`.
- Trade-off: fine cuts give each reviewer/editor micro-job its own spec (cleaner QA per actor step); coarser cuts match the round-1 test features and reduce cross-references between tightly-coupled steps.

#### 4. Submission-wizard granularity — one feature vs step-groups
- The split: **refine** and **clustering** keep the wizard as one feature (metadata/files/contributors/language are steps). **ui** splits it into 4 step-group features; **lifecycle** into ~8 phase-1 features (start-and-files, metadata, contributors, confirm, multilingual, drafts, suggestions, tracking).
- Trade-off: one feature matches the single "submit a manuscript" job and the `components/forms/submission/` code cluster; step-groups let each configurable step (esp. For-the-Editors metadata, reviewer-suggestions) carry its own request/require config and spec.

#### 5. Context / journal-settings split — clustering's ~8-way vs coarser
- The split: **clustering** breaks the settings area into ~8 form-level features (journal-setup, website-appearance, distribution, submission-config, metadata-settings, email-settings, review-settings, masthead). **refine/ui/lifecycle** keep ~5–6 coarser settings features, folding metadata-settings + email-settings + genres into their parents.
- Trade-off: `manager.setup` alone is 207 locale keys, so per-form features are defensible and thorough; a coarser "journal-settings" grouping is far less to maintain and matches how a manager navigates one Settings menu.

#### 6. The DOI domain — 1 vs 2 vs 3 clusters
- The split: **refine** = core `doi-management` + a separate `crossref-deposit` (peer-review DOI folded into it). **ui** = 2 (`doi-configuration` settings + `doi-assignment-and-deposit`). **lifecycle** and **clustering** = 3 (management + agency-deposit backends + `peer-review-doi`), and each additionally surfaces `open-peer-review-display`.
- Trade-off: fewer clusters keep the DOI story in one place; three clusters separate the core UI, the pluggable registration-agency backends, and the newer peer-review-DOI surface (which has its own jobs/endpoints and no plan yet).

#### 7. review-anonymity — own feature vs dissolved
- The split: **refine** and **lifecycle** keep `review-anonymity` as its own feature (the double-anon/anon/open visibility rules). **ui** dissolves it into a mode setting on `reviewer-assignment` + the open-review display on `article-landing`. **clustering** dissolves it into `review-settings` defaults + `open-peer-review-display`.
- Trade-off: a standalone feature specs the cross-party visibility matrix once (it cross-cuts assignment, discussions, and reader views); dissolving it avoids a feature with no screen of its own and tests the rules where they surface.

#### 8. Overall granularity target — 77 → 84 → 98 → 101
- The split: the four drafts land at **77** (refine), **84** (ui), **98** (lifecycle), **101** (clustering); this consensus keeps orphans and lands at **101**. The spread is almost entirely in how many thin/orphan clusters get promoted (jats-content, citation-enrichment, usage-stats-ETL, content-tombstones, affiliations-ror, peer-review-doi, done-stage) and how finely decisions/review/settings are cut.
- Trade-off: a higher count is more complete and gives each orphan a home (nothing silently dropped); a lower count is closer to the round-1 test budget and the tasks-discussions sizing, at the cost of burying orphans inside larger features.

#### 9. tasks-discussions — merged vs split
- The split: **refine** and **lifecycle** keep one `tasks-discussions` feature (matching the shipped 3.6 unified panel and the verified pilot spec). **ui** and **clustering** split it back into `editorial-tasks` + `editorial-discussions`.
- Trade-off: the merge matches the code (3.6 unified both into one panel) and the sizing yardstick; the split matches the two distinct data models (edit_tasks vs notes/submission_comments) and separate QA stories.

---

# Part C — Coverage & the pile

Atom clusters that none of the four placed cleanly into a user-facing feature (kept so
nothing is silently dropped). All four drafts converge on this residue:

- **OMP/OPS-only Vue surfaces** — ChapterManager, PublicationFormatManager, RepresentativeManager, CatalogListPanel, WorkflowPageOMP/OPS, DoiListPanelOMP/OPS: present in the shared lib but unwired in OJS's WorkflowPageOJS map. Out of OJS scope; parked (all four agree).
- **Dead-code candidates** (UNASSIGNED.md, ~19 atoms) — the ~6–8 superseded legacy grids (PubIdExport* lists, ProductionReadyFiles, WorkflowReviewRevisions, SelectableLibraryFile, EditorSubmissionDetailsFiles, AuthorGridHandler), PAGE-manager-legacy + ~6 routed-but-unimplemented ops, NOTIF-configure-payment-method, 10 NOTIF-BOOK-* (OMP legacy), NOTIF-query-activity, EVLOG-REV-DUE. Cleanup candidates, not features.
- **Metrics/stats ETL & temporary tables** (~15) — usage_stats_*_temporary_records, metrics_submission_geo_*, the compile/loader/dedup jobs: promoted by clustering to `usage-stats-processing` (1/4 ⚑); background-only, no dedicated surface.
- **Filters framework** — DB-filters/filter_groups/filter_settings: the document-transform engine behind native XML import/export and OAI. Infra; parked under native-xml-import-export by proximity.
- **Controlled vocabularies / interests** — controlled_vocab*, user_interests, /vocabs, /vocabs/interests: a shared keyword/interest primitive threaded through submission-metadata (keywords) and user-profile (reviewer interests). No feature of its own.
- **ROR registry cache** — rors/ror_settings + UpdateRorRegistryDataset: clustering promoted it to `affiliations-ror` (1/4 ⚑); the other three attach it as internal storage of contributors.
- **Content tombstones** — data_object_tombstone* (3 tables): clustering's `content-tombstones` (1/4 ⚑); no page/API/plan, pure OAI-deletion completeness find.
- **Temporary / public-file upload plumbing** — temporary_files, /temporaryFiles, /_uploadPublicFile, AUTHZ-attach-file-upload-header: a cross-cutting upload primitive used by many forms; belongs to no single feature (lives under submission-files / media where surfaced).
- **AUTHZ middleware baseline** — session/cookie/CSRF/CORS/context/roles policies (~13) + base policy machinery: cross-cutting auth gate; per-feature policies claimed by their feature (roles-permissions owns the framework). Known ⚠: HasRoles returns 401 not 403.
- **Locale infra prefixes** — ~8 prefixes / ~380 keys (admin.cli, grid.action, validator.*, common.*, installer.*, form.dropzone, navigation.skip): i18n of already-mapped features, left cross-cutting rather than force-fit.
- **Thin plugin substrate** — pflPlugin (non-stock third-party), pluginTemplate (scaffold), tinymce (rich-text editor primitive, rides along wherever used), usageEvent (→usage-statistics), dc11/libpkp base classes (pair 1:1 with their OJS-side plugin). None warrant a feature; homed in plugin-management as substrate.
- **Crossmark button** — VUE-pkp-crossmark-button: one reader widget, no backend cluster; rides along article-landing / crossref-datacite-deposit.
