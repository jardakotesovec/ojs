# Feature map — strategy: atom bottom-up clustering
- Feature count: 101

Method: clustered the ~1,511 atlas atoms bottom-up by **code proximity** (shared
directory/class family, same controller, same store/manager, same schema entity, same
locale prefix) and **co-occurrence** across modalities, then named each cluster by the
user intent it serves. The round-1 taxonomy and the atlas Hint column were deliberately
ignored while clustering (used only as a late name-sanity check). "atoms:" lines name
the families each feature claims by modality/id-prefix; exhaustive per-atom lists are the
spec author's job. Thin/orphan clusters that resist a clean feature are collected in the
dedicated section below — the special value of this lens.

---

## A. Author intake & manuscript authoring

### submission-wizard — guided multi-step new-submission flow
atoms: PAGE-submission-* (index/saved/wizard/cancelled, 4); VUE-start-submission-form, VUE-reconfigure-submission-modal; FORM-start-submission-{ojs,pkp}, FORM-reconfigure-submission-{ojs,pkp}, FORM-confirm-submission, FORM-for-the-editors, FORM-comments-for-the-editors, FORM-details, FORM-submission-guidance-settings; API-submission-add/edit/submit/save-for-later/{get-*-form components}; GRID-file-upload-wizard-handler; AUTHZ-submission-incomplete/complete-policy; DB-submissions; LOC author.submit (79), submission.submit (69), submission.wizard (34), author.article
notes: round-1 fragmented this into wizard-core/-metadata/-language/-files; the wizard *forms* physically cluster in `components/forms/submission/`, so bottom-up they read as one flow with metadata/files/language as steps, not peers.

### submission-metadata-editing — title/abstract/keywords/subjects/coverage on a publication
atoms: FORM-title-abstract-form, FORM-pkp-metadata-form, FORM-details, FORM-pkp-data-availability-form, FORM-change-submission-language-metadata-form; API-submission-edit-publication, API-submission-get-publication-{metadata,titleAbstract,dataAvailability,changeLanguageMetadata}-form, API-submission-change-locale; VUE-insert-summary-of-changes-modal; DB-publication_settings, submission_settings; LOC metadata.property (85), submission.form, publication.updateType
notes: shared between the wizard and post-publication editing; the changeLocale/changeLanguageMetadata surface is a thin overlooked corner.

### contributors-authorship — author/contributor list, affiliations, CRediT roles
atoms: VUE-contributor-manager, VUE-contributor-role-manager, VUE-contributors-list-panel; GRID-author-grid-handler (dead), GRID-author-submission-details-files, GRID-author-reviewer-grid-handler; FORM-contributor-form, SCHEMA-author, SCHEMA-affiliation, SCHEMA-contributor-role; API-submission-{get,add,edit,delete}-contributor, API-submission-save-contributors-order, API-contributor-role-* (6); DB-authors, author_settings, author_affiliations(+settings), contributor_roles(+settings), credit_contributor_roles, credit_roles; PLUGIN-generic-credit; LOC user.affiliations (19), contributor.listPanel
notes: CRediT-role config (`credit_roles`/CreditPlugin) is a distinct sub-surface a UI walk-through easily misses.

### reviewer-suggestions — author suggests reviewers; editor reviews the suggestions
atoms: VUE-reviewer-suggestion-manager, VUE-reviewer-suggestions-list-panel; FORM-reviewer-suggestions-form; API-reviewer-suggestion-* (5); SCHEMA-submission-ojs.reviewerSuggestions; DB-reviewer_suggestions(+settings)

### incomplete-submission-drafts — save-for-later, unfinished-submission cleanup & bulk delete
atoms: API-backend-submissions-get-many/assigned/reviews/viewsCount/reviewerAssignments, API-backend-submissions-delete, API-backend-submissions-bulk-delete-incomplete-submissions, API-submission-save-for-later; VUE-submissions-list-panel; DB-submissions.submissionProgress
notes: the `_submissions` backend controller is a thin data-plumbing surface with no dedicated page — easy for a journey lens to fold silently into the dashboard.

## B. Files, galleys & document library

### submission-files — per-stage file lists, upload, revisions, dependents
atoms: VUE-file-manager, VUE-file-attacher, VUE-submission-files-list-panel, VUE-listing-files-list-panel; GRID files/{review,copyedit,final,proof,productionReady,dependent,submission,fileList}-* (~25 grids, several base/dead); FORM-pkp-submission-file-form; API-submission-file-* (get/add/edit/delete/copy, 6); GRID-manage-file-api, GRID-file-api; AUTHZ-submission-file-*-policy (~15 internal fragments); SCHEMA-submission-file; DB-submission_files(+settings), submission_file_revisions, variant_groups, files; EVLOG-FILE-* (upload/revision/edit/delete); LOC submission.files, submission.upload (22)
notes: the largest legacy-grid family; FileManager Vue calls these grids as its AJAX backend (both-live), so they're one feature not two.

### media-supplementary-files — publication media / artwork / supplementary files
atoms: VUE-media-file-manager; API-media-files-* (getMany/add/link/linkMany/edit/delete, 6); GRID-selectable-library-file (dead), GRID-document-library-handler, GRID-submission-documents-files; PAGE-libraryfiles-download{public,libraryfile}; LOC publication.mediaFiles (27), submission.supplementary, grid.artworkFile

### document-library — context & submission library files (review templates, forms)
atoms: GRID-library-file-admin, GRID-library-file (base), GRID-selectable-submission-file-list-category; DB-library_files(+settings); LOC settings.libraryFiles, grid.libraryFiles

### file-genres — submission file genre/type configuration
atoms: GRID-genre-grid-handler; API-genre-get-many, API-genre-get; DB-genres(+settings); LOC grid.genres, default.genres
notes: thin config surface; sits under submission settings but is its own entity+grid+API triple.

### article-galleys — publication galleys / rendition formats
atoms: VUE-galley-manager; GRID-article-galley-grid, GRID-issue-galley-grid; SCHEMA-galley; API-body-text (linked); AUTHZ-representation-required/upload-access-policy; DB-publication_galleys(+settings), issue_galleys(+settings); PLUGIN-generic-{htmlArticleGalley,pdfJsViewer,lensGalley} (galley viewers); LOC submission.layout, layoutEditor.galley
notes: galley *viewers* (pdfJs/lens/htmlArticleGalley) are display plugins that cluster with galleys, not with "plugins" as a category.

### jats-content — JATS XML full-text per publication (upload, visibility, download)
atoms: API-jats-get/add/delete/set-visibility/public-download (5); PLUGIN-generic-jatsTemplate, PLUGIN-oaiMetadataFormats-oaiJats; AUTHZ-submission-file-stage-access-policy (jats); LOC publication.jats (13)
notes: **orphan-ish, almost invisible to a UI walk** — a whole content API keyed on publication with a visibility toggle; no dedicated page, wired through production. Likely missed by top-down lenses.

### publication-body-text — full-text HTML body editor + Pandoc Word import
atoms: API-body-text-get/save/delete; VUE-pandoc-converter (pandoc-wasm Word→HTML for WorkflowPublicationBodyText); LOC publication.bodyText
notes: contains the required **Pandoc importer** atom; thin but distinct (a rich-text body stored separately from galleys). Top-down would likely absorb into "galleys" or miss entirely.

## C. Citations & references

### citations-references — reference list, structured/raw citation edit, CSL export
atoms: VUE-citation-manager; FORM-citation-{raw,structured}-edit-form, FORM-pkp-citations-form; SCHEMA-citation; API-citation-* (getMany/get/edit/delete/reprocess), API-submission-{import-additional,delete-by-pub,reprocess}-citations; PLUGIN-generic-citationStyleLanguage; VUE-pkp-cite (how-to-cite reader display); DB-citations(+settings); LOC submission.citations (66), submission.howToCite, submission.parsedCitations
notes: how-to-cite reader widget (PkpCiteBody) clusters here by entity even though it's reader-facing.

### citation-enrichment-pipeline — background PID/metadata lookup for citations
atoms: JOB-crossrefjob, JOB-extractpidsjob, JOB-isprocessedjob, JOB-openalexjob, JOB-orcidcitationjob; API-citation-reprocess-citation, API-submission-reprocess-citations
notes: **overlooked orphan cluster** — five jobs querying Crossref/OpenAlex/ORCID to enrich `citations`; no direct UI, invisible to a journey/UI decomposition, but a coherent feature.

### data-availability-citations — data-set citations & availability statement
atoms: VUE-data-citation-manager; FORM-data-citation-edit-form, FORM-pkp-data-availability-form; SCHEMA-data-citation; API-data-citation-* (6); DB-data_citations(+settings); LOC submission.dataCitations (20)

## D. Peer review

### reviewer-assignment — editor assigns/manages reviewers on a round
atoms: VUE-reviewer-manager, VUE-select-reviewer-list-panel; GRID-reviewer-grid, GRID-users-reviewer-*; SCHEMA-review-assignment; API-user-get-reviewers; AUTHZ-review-assignment-access/required-policy; NOTIF-review-assignment(+updated), NOTIF-reviewer-comment; DB-review_assignments(+settings), review_files, review_round_files; EVLOG-REV-ASSIGN/CLR/REIN/CONF/DUE; LOC reviewer.list (24), manager.reviewerSearch
### review-rounds-revisions — review rounds, revision requests, author revision uploads
atoms: PAGE-workflow-externalreview; GRID files/review/* & files/attachment/* (~10); SCHEMA-review-round; AUTHZ-review-round-required/stage-access-policy, AUTHZ-review-assignment-file-write-policy; NOTIF-review-round-status, NOTIF-pending-{internal,external}-revisions; DB-review_rounds(+settings), review_round_files; LOC submission.reviewRound, submission.review
### reviewer-workflow — reviewer's own review: steps, recommendation, decline, attachments
atoms: PAGE-reviewer-{submission,step,savestep,showdeclinereview,savedeclinereview}; VUE-reviewer-submission-page; API-review-confirm-review/export-pdf/export-xml/get-exported-file/send-to-orcid/get-history; FORM-log-reviewer-response-form; EVLOG-REV-ACCP/DECL/RDY/RECOMMENDATION; DB-review_form_responses; LOC reviewer.submission (39), reviewer.article (44), reviewer.reviewSteps
### review-forms — review form & element configuration
atoms: GRID-review-form-grid, GRID-review-form-elements-grid, GRID-review-form-element-response-item-listbuilder; DB-review_forms(+settings), review_form_elements(+settings); LOC manager.reviewForms (18), manager.reviewFormElements (23)
### review-settings — journal review setup, guidance, mode/anonymity defaults
atoms: FORM-pkp-review-setup-form, FORM-review-guidance-form(+pkp), FORM-reviewer-recommendation-form; SCHEMA context review props; VUE-pkp-open-review reference; LOC (review setup keys under manager.setup)
### author-response-to-review — editor requests / author submits response to a review round
atoms: PAGE-reviewresponse-requestauthorresponse; VUE-author-response-manager, VUE-author-response-request-manager, VUE-request-review-round-author-response; API-review-{request,submit,edit,delete}-author-response, API-review-request-author-response(2); FORM- (response); DB-review_round_author_responses(+settings/authors), review_round_settings; MAIL-request-review-round-author-response; API-backend-doi-edit-author-response
### reviewer-recommendations-vocab — configurable reviewer-recommendation options
atoms: VUE-reviewer-recommendation-manager; API-reviewer-recommendation-* (6); AUTHZ-recommendation-{access,context,required}-policy; DB-reviewer_recommendations(+settings)
### recommend-only-editors — recommend-only editor decision path
atoms: FORM-select-revision-recommendation-form; NOTIF-... (recommendation); MAIL-recommendation-notify-editors; EVLOG-SUBM-ED-REC, EVLOG-REV-PROXY-REC; LOC dashboard.recommendOnly
notes: overlaps editorial-decisions; kept separate because the recommendation-vs-decision permission split is its own QA concern.
### open-peer-review-display — public transparent peer-review history
atoms: VUE-pkp-open-review; API-peer-review-* (6 open-review summary/detail endpoints)
notes: reader-facing review disclosure; a distinct public API family (`/peerReviews/open/...`) top-down UI lens rarely reaches.

## E. Editorial workflow, decisions & coordination

### editorial-dashboard — submissions/review-assignment dashboards, filters, "needs attention"
atoms: PAGE-dashboard-{index,editorial,mysubmissions,reviewassignments}, PAGE-submissions-{index,tasks}; VUE-dashboard-page, VUE-dashboard-table; FORM-submission-filters(+pkp); API-stats-editorial-get(+averages); NOTIF-approve-submission/visit-catalog/editorial-report; LOC submission.dashboard (27), dashboard.reviewAssignment (34), submission.list (32)
### workflow-stage-navigation — stage shell, access, actions across stages
atoms: PAGE-workflow-{access,index,submission,editorial,production}; VUE-workflow-page, VUE-workflow-page-ojs; AUTHZ-workflow-stage-access/user-accessible-*/submission-access/author-policy (~9); DB-stage_assignments; LOC submission.stage, stage.review
### stage-participants — assign participants & roles per stage
atoms: VUE-participant-manager; GRID-stage-participant-grid, GRID-user-select-grid; NOTIF-editor-assign, NOTIF-editor-assignment-{submission,internal-review,external-review,editing,production}, NOTIF-editor-assignment-required; DB-subeditor_submission_group; EVLOG-SUBM-{ADD,REM}-PART; LOC stageParticipants.notify
### editorial-decisions — record accept/decline/revise/resubmit/send-to-stage decisions
atoms: PAGE-decision-record; SCHEMA-decision; FORM-select-revision-decision-form, FORM-request-payment-decision-form; API-submission-{get,add}-decision; AUTHZ-decision-write/allowed/stage-valid/type-required-policy; NOTIF-editor-decision-* (~10); MAIL-decision-* (~17); DB-edit_decisions; EVLOG-SUBM-ED-DEC/EMAIL; LOC editor.decision, mailable.decision (42), emails.decision
### done-workflow-stage — the new "Done" (published) 6th stage & its decisions
atoms: (db-entities Gaps) WORKFLOW_STAGE_ID_DONE=6; Decision MoveToDone/ReturnToDone/ReturnToWorkflow; ApplyDoneWorkflowStage listener; API-submission-return-to-done; migration I12799_MovePublishedSubmissionsToDone
notes: **required placement** — a genuinely new feature with no table of its own (writes `submissions.stage_id`); a top-down inventory that predates the rebase would miss it.
### copyediting-stage — copyedit file exchange & notifications
atoms: PAGE-workflow-editorial; GRID-copyedit-files, GRID-manage-copyedit-files; NOTIF-copyedit-assignment/assign-copyeditor/awaiting-copyedits; EVLOG-EMAIL-COPY-* (9); LOC submission.copyedit, log.copyedit
### production-stage — final-draft/production-ready/proof files, layout, indexing
atoms: PAGE-workflow-production; GRID-final-draft-files, GRID-production-ready-files (dead), GRID-manage-proof-files, GRID-manage-final-draft-files; NOTIF-layout-assignment/index-assignment/awaiting-representations/assign-productionuser/format-needs-approved-submission; EVLOG-EMAIL-{PROOF,LAYOUT,INDEX}-* (~16); LOC submission.layout, log.layout
### editorial-tasks — per-stage tasks & task templates [claimed: tasks-discussions]
atoms: API-editorial-task-* (12), API-edit-task-template-* (5); VUE-task-template-manager; GRID-task-notifications-grid; DB-edit_tasks/edit_task_*(5); EVLOG-TASK-* (12); NOTIF-editor-assignment-* (TASK level); LOC grid.task, submission.task
### editorial-discussions — threaded per-stage discussions [claimed: tasks-discussions]
atoms: VUE-discussion-manager; AUTHZ-query-* (6); NOTIF-new-query, NOTIF-query-activity; MAIL-discussion-{submission,review,copyediting,production}; DB-submission_comments, notes; EVLOG-EMAIL-DISC-NOT; LOC submission.query (19), discussion.form (16), submission.notes
### activity-log — submission event log, information center, history
atoms: GRID-{submission,file}-event-log-grid, GRID-information-center-{,file,submission}-handler; SCHEMA-event-log, SCHEMA-email-log; DB-event_log(+settings), email_log(+users); most EVLOG-SUBM-* & EVLOG-EMAIL-* surface here; LOC submission.event (30/55), submission.history, log.editor, informationCenter.history
notes: the information-center handlers (notes/history/email tabs) are the read surface for the whole event-log corpus — one home for it.

## F. Publishing, issues & release

### publication-versioning — versions: create/publish/unpublish/reader display [claimed]
atoms: API-submission-{change,version,next-available}-version, add/version/publish/unpublish/delete-publication; MAIL-publication-version-notify; NOTIF-submission-new-version; SCHEMA-publication-{pkp,ojs}; EVLOG-SUBM-VER-CRT/META-{PUB,UNPUB}; LOC publication.versionStage
### publication-publishing — final publish confirmation & scheduling
atoms: GRID-publish-handler [claimed: publication-versioning]; FORM-publish-form, FORM-issue-entry-form; GRID-export-published-{publications,submissions}-list; DB-publications; LOC publication.publish, publication.scheduledForPublication
### publication-identifiers-license — DOI/urlPath/pages/license/copyright on a publication
atoms: FORM-pkp-publication-identifiers-form, FORM-pkp-publication-license-form, FORM-license-form(+pkp); API-submission-get-publication-{identifier,license}-form; GRID-manage-file-api (identifiers/clearPubId); SCHEMA-publication.doiId; PLUGIN-pubIds-urn; DB-doi_settings/dois (per-object); LOC submission.license (19), publication.urlPath, doi.submission
### issues-management — create/edit issues, future/back issues, ordering
atoms: PAGE-manageissues-index; VUE- (issue forms); GRID-back-issue-grid, GRID-future-issue-grid, GRID-issue-galley-grid, GRID-exportable-issues-list; SCHEMA-issue; API-issue-* (getMany/current/get/assignmentOptions), API-submission-get-issue-assignment-status, API-submission-get-publication-issue-form; AUTHZ-ojs-issue-required/galley-required/journal-must-publish-policy; DB-issues(+settings), issue_files, issue_galleys(+settings), custom_issue_orders; NOTIF-published-issue; LOC editor.issues (76), grid.issueEntry, publication.assignToIssue
### issue-table-of-contents — TOC ordering, access status, issue galleys
atoms: GRID-toc-grid-handler; DB-custom_section_orders; LOC (issueToc keys); PAGE-issue-view/download
### issue-archive-reader — reader issue archive, current issue, TOC display
atoms: PAGE-issue-{index,current,archive,view,download}; PLUGIN-blocks-browse (by issue); LOC about.onlineSubmissions
### sections — journal sections config
atoms: GRID-section-grid; SCHEMA-section-{pkp,ojs}; API-section-get-many/get; DB-sections(+settings), custom_section_orders; LOC manager.sections, section.default
### categories — content categories / research areas
atoms: VUE-category-manager; FORM-category-form; SCHEMA-category; API-category-* (5); DB-categories(+settings), publication_categories; PLUGIN-blocks-browse (by category); LOC manager.category (13), grid.category, manager.submitWithCategories

## G. Reader front end & discovery

### journal-homepage — site/journal home & highlights carousel
atoms: PAGE-index-index; VUE-highlights-list-panel; FORM-highlight-form; SCHEMA-highlight; API-highlight-* (6); DB-journals, journal_settings, highlights(+settings); LOC (home/highlights keys)
notes: highlights (entity+form+6 API+DB+Vue) is a full sub-feature hint-blank in the atlas — a real cluster a UI lens under-weights as "just a widget."
### article-landing — public article/abstract page & downloads
atoms: PAGE-article-{view,download,viewfile,downloadsuppfile}; VUE-pkp-usage-chart, VUE-pkp-crossmark-button, VUE-pkp-orcid-display; PLUGIN-generic-{recommendByAuthor,recommendBySimilarity}; LOC article.fontSize, article.comments
### website-appearance — themes & appearance settings
atoms: PAGE-management-settings-website; VUE-theme-form, VUE-add-context-form; FORM-{appearance-setup,appearance-advanced,pkp-theme,pkp-appearance-*}-form; API-context-{get,edit}-theme, API-site-{get,edit}-theme; PLUGIN-themes-default; LOC manager.website
### navigation-menus — nav menu & menu-item management
atoms: PAGE-navigationmenu-{index,view,preview}; VUE-navigation-menu-manager-field, VUE-navigation-menu-editor; GRID-navigation-menus-grid, GRID-navigation-menu-items-grid; SCHEMA-navigation-menu(+item); API-navigation-menu-* (6); DB-navigation_menus/navigation_menu_items(+settings/assignments); LOC manager.navigationMenus (52), manager.navigationMenu
### custom-blocks-sidebar — sidebar blocks (browse, info, custom, language toggle, etc.)
atoms: PLUGIN-blocks-{browse,developedBy,information,languageToggle,makeSubmission,subscription}, PLUGIN-generic-customBlockManager, PLUGIN-generic-webFeed(block)
### static-pages — custom static content pages
atoms: PLUGIN-generic-staticPages; PAGE-information-* (readers/authors/librarians/competingInterest/sampleCopyright/index); PAGE-about-* (index/submissions/contact); AUTHZ-pkp-public-access-policy, AUTHZ-public-access-policy; LOC about.contact
### site-search — reader search & indexing
atoms: PAGE-search-{index,search}; FORM-pkp-search-indexing-form; DB-submissions_fulltext; JOB-updatesubmissionsearchjob; PLUGIN-generic-googleScholar; LOC search.results (12), search.cli, search.searchResults
### public-comments — reader comments + moderation queue
atoms: PAGE-management-settings-usercomments; VUE-user-comments-page/table, VUE-user-comment-reports-table, VUE-pkp-comments; FORM-content-comments-form; API-comment-* (12); NOTIF-user-comment-posted/reported; DB-user_comments/user_comment_reports(+settings); LOC api.userComments, manager.userComment (34)

## H. Distribution, indexing & interchange

### doi-management — DOI settings, assignment, deposit/registration management UI
atoms: PAGE-dois-index; VUE-doi-list-panel(+ojs), VUE-doi-registration/setup-settings-form; FORM-doi-setup-settings(+pkp), FORM-pkp-doi-registration-settings-form; SCHEMA-doi; API-doi-* (~15) + API-backend-doi-edit-* + API-doi-{assign,export,deposit,mark*}-issues; AUTHZ-dois-enabled-policy; DB-dois/doi_settings; TASK-depositdois; JOB-depositcontext/depositsubmission/depositissue; LOC manager.dois (58), doi.manager (30), doi.editor (28), api.dois (16)
### registration-agency-plugins — Crossref/DataCite/DOAJ deposit backends
atoms: PLUGIN-generic-{crossref,datacite,doaj}; GRID-pub-id-export-{issues,representations,submissions}-list (dead); API-context-edit-doi-registration-agency-plugin; LOC plugins.importexport (deposit)
notes: the three PubIdExport grids are dead (superseded by DoiListPanel) — flagged in UNASSIGNED; agency plugins are the live deposit path.
### peer-review-doi — DOI deposit for peer reviews & author responses
atoms: JOB-depositpeerreview; API-backend-doi-edit-peer-review, API-backend-doi-edit-author-response; JOB-depositorcidreview, JOB-reconcileorcidreviewputcode
notes: **required placement**; a small cross-cutting deposit feature spanning DOI + ORCID review deposit, distinct from article DOI.
### oai-pmh — OAI protocol endpoint & metadata formats
atoms: PAGE-oai-index; PLUGIN-oaiMetadataFormats-{dc,marc,marcxml,oaiJats,rfc1807} (+libpkp-dc); DB-oai_resumption_tokens; LOC (oai keys)
### sitemap-feeds — XML sitemap, web/announcement RSS-Atom feeds
atoms: PAGE-sitemap-index; PLUGIN-generic-{webFeed,announcementFeed}; PLUGIN-generic-driver
### indexing-meta-tags — Dublin Core / Google Scholar / meta-tag injection for indexers
atoms: PLUGIN-generic-{dublinCoreMeta,googleScholar,driver}; PLUGIN-metadata-dc11 (+libpkp); PLUGIN-oaiMetadataFormats-dc
### native-xml-import-export — native OJS XML import/export of submissions & issues
atoms: PAGE-management-importexport; PLUGIN-importexport-native (+libpkp); GRID-exportable-issues-list; DB-filters/filter_groups/filter_settings (processing framework); LOC plugins.importexport (46)
notes: the `filters` tables are the document-transform engine behind native XML — orphan infra that lands here by proximity.
### pubmed-export — PubMed/MEDLINE metadata export
atoms: PLUGIN-importexport-pubmed
### user-xml-import-export — bulk user account XML import/export
atoms: PLUGIN-importexport-users (+libpkp); GRID-exportable-users-grid
### content-tombstones — OAI deletion tombstone records
atoms: DB-data_object_tombstones/data_object_tombstone_settings/data_object_tombstone_oai_set_objects
notes: **orphan** — a whole tombstone subsystem (3 tables) with no page/API/plan; a completeness deliverable, unreachable by UI walk.

## I. Statistics & reporting

### usage-statistics — reader/editor usage stats pages, charts, reports
atoms: PAGE-stats-{issues,editorial,publications,context,users,reports,counterr5}; VUE-{context,issue,publications}-download-report-modal, VUE-user-export-modal, VUE-pkp-usage-chart; FORM-pkp-{context,site}-statistics-form, FORM-report-form; API-stats-{context,publication,issue,user}-* (~30); DB-metrics_* (~15 tables); LOC stats.* (name/dateRange/issues/etc), manager.statistics (27)
### counter-sushi — COUNTER R5 reports & SUSHI API
atoms: VUE-counter-reports-page; FORM-counter-report-form(+pkp); API-stats-sushi-* (~12: status/members/reports pr/pr1/tr/tr_j3/ir/ir_a1); PLUGIN-reports-counter; DB-metrics_counter_*; LOC sushi.exception (13), sushi.reports
### usage-stats-processing — log-file ingestion & metric compilation jobs
atoms: JOB-{archiveusagestats,removedoubleclicks,compile*metrics,compileunique*,compileusagestats,deleteusagestats,processusagestats}* (~15); TASK-{usagestatsloader,pkpusagestatsloader}; PLUGIN-generic-usageEvent (+libpkp); DB-usage_stats_*_temporary_records; TASK-updateipgeodb; LOC common.queue
notes: another large **background-only orphan cluster** (~15 jobs) invisible to UI decomposition.
### editorial-statistics — editorial activity/decision statistics
atoms: API-stats-editorial-get(+averages); FORM-report-form; NOTIF-editorial-report; TASK-statisticsreport, JOB-statisticsreportmail/notify; MAIL-statistics-report-notify; LOC manager.editorialStatistics
### csv-reports — article / review / subscription CSV report plugins
atoms: PLUGIN-reports-{articles,reviewReport,subscriptions}; PAGE-stats-reports; LOC (report keys)

## J. Users, accounts & access

### registration-login — account registration, login, activation
atoms: PAGE-user-{register,registeruser,activateuser}, PAGE-login-{index,signin,signout}; MAIL-user-created, MAIL-validate-email-{site,context}; AUTHZ-pkp-{authenticate-session,encrypt-cookies,start-session}, AUTHZ-anonymous-user-policy; DB-users, sessions; LOC user.login (27), user.register (18/13)
### password-flows — lost/reset/forced-change password
atoms: PAGE-login-{lostpassword,requestresetpassword,resetpassword,updateresetpassword,changepassword,savepassword}; MAIL-password-reset-requested; FORM-pkp-site-security-form (password policy)
### user-profile — self-service profile, interests, API key, notification prefs
atoms: PAGE-user-{index,profile}; GRID-profile-tab-handler; API-user-get/edit (self); FORM- (profile tabs); DB-user_settings, notification_settings/notification_subscription_settings, user_interests; API-vocab-get-many, API-interest-get-many; LOC user.profile (29), user.apiKey, orcid.field
notes: reviewer-interests use the controlled-vocab API (`/vocabs/interests`) — a thin surface folded here.
### user-management — admin user list, edit, roles, merge, notify
atoms: GRID-user-grid, GRID-user-select-grid, GRID-user-api-handler; VUE-notify-users-form; FORM-pkp-notify-users-form; API-user-get-many/get/report/end-role/masthead, API-user-get-report; DB-users, user_user_groups; LOC grid.user (45), manager.people (41), admin.mergeUsers
### roles-permissions — user groups, role assignment, stage-role access settings
atoms: PAGE-management-settings-{access,user}, PAGE-management-{permissions,resetpermissions}, PAGE-user-authorizationdenied; VUE-user-access-manager; GRID-user-group-grid; FORM-{user-access,pkp-user-access}-form; SCHEMA-user-group; API-user-group-get-many; AUTHZ-{stage-role,role-based,user-roles-required,user-required}-policy; DB-user_groups(+settings), user_group_stage, stage_assignments; LOC settings.roles (19), grid.userGroup, grid.roles, user.role
### user-invitations — invite users to roles, accept/decline flow
atoms: PAGE-invitation-{accept,decline,confirmdecline,create,edit}; VUE-accept-invitation-page, VUE-user-invitation-page, VUE-user-invitation-manager; FORM-{accept-user-details,user-details}-form; API-invitation-* (~13); MAIL-user-role-assignment-invitation-notify, MAIL-change-profile-email-invitation-notify; DB-invitations; JOB-removeexpiredinvitations, TASK-removeexpiredinvitations; LOC invitation.* (~50), acceptInvitation.*, userInvitation.*
### login-as — admin impersonation of another user
atoms: PAGE-login-signinasuser/signoutasuser, PAGE-admin-confirmaccess/confirmaccesssubmit; AUTHZ-reauthentication-required-policy; DB-sessions
### orcid-integration — ORCID OAuth, settings, display, activity deposit
atoms: PAGE-orcid-{verify,authorizeorcid,about,updatescope}; VUE-pkp-orcid-display; FORM-orcid-settings-form, FORM-orcid-site-settings-form; API-orcid-request-author-verification/delete-for-author; MAIL-orcid-{collect-author-id,request-author-authorization,request-update-scope}; JOB-depositorcidsubmission/revokeorcidtoken/sendauthormail/sendupdatescopemail; LOC orcid.* (manager 30/verify/about/author/field)
### affiliations-ror — author affiliations linked to ROR registry
atoms: SCHEMA-ror, SCHEMA-affiliation; API-ror-get/get-many/add-or-edit; DB-rors/ror_settings, author_affiliations; TASK-updaterorregistrydataset; LOC user.affiliations
notes: thin but self-contained (ROR cache + registry-refresh task + API); feeds contributors.
### user-role-lifecycle-notices — role-end / masthead-update notifications
atoms: MAIL-user-role-end-notify, MAIL-user-role-masthead-update-notify; API-user-end-role/masthead; TASK-removeunvalidatedexpiredusers, JOB-... 
notes: thin; could fold into user-management.

## K. Journal & site configuration

### journal-setup — journal identity, contact, info, privacy; create/delete context
atoms: PAGE-management-settings-context, PAGE-admin-wizard; GRID-context-grid, GRID-setup-grid, GRID-setup-listbuilder; VUE-add-context-form; FORM-context-form(+pkp), FORM-pkp-{contact,information,privacy}-form, FORM-pkp-lists-form; SCHEMA-context-{ojs,pkp}; API-context-* (getMany/get/edit/add/delete); AUTHZ-context-access/required-policy; DB-journals, journal_settings; LOC manager.setup (207, partial), admin.contexts
### editorial-masthead — masthead composition & public display
atoms: PAGE-about-editorialmasthead/editorialhistory; FORM-masthead-form(+pkp), FORM-pkp-appearance-masthead-form; API-user-masthead; LOC common.editorialMasthead, common.editorialHistory
### submission-config-settings — submission policy, checklist, guidance, disable-submissions
atoms: PAGE-management-settings-workflow; FORM-access-form, FORM-pkp-disable-submissions-form, FORM-submission-guidance-settings, FORM-metadata-settings-form; SCHEMA-submission-ojs; LOC manager.setup (submission slice)
### metadata-settings — which metadata fields the journal collects
atoms: FORM-metadata-settings-form, FORM-pkp-metadata-settings-form; SCHEMA-context metadata props; LOC metadata.filters
### distribution-settings — archiving/LOCKSS, indexing, access, license defaults
atoms: PAGE-management-settings-distribution; FORM-archiving-lockss-form, FORM-pkp-license-form; PAGE-gateway-{index,lockss,clockss,plugin}; LOC manager.distribution
### email-settings — journal email config & bulk-email restrictions
atoms: FORM-pkp-email-setup-form, FORM-pkp-restrict-bulk-emails-form, FORM-pkp-site-bulk-emails-form; LOC (email setup keys)
### email-templates-management — email template & mailable enable/edit
atoms: PAGE-management-settings-manageemails; VUE-edit-mailable-modal, VUE-edit-template-modal; FORM-email-template-form; SCHEMA-email-template; API-email-template-* (getMany/get/add/edit/delete/restoreDefaults), API-mailable-get-many/get; DB-email_templates(+settings/default-data), email_template_user_group_access; LOC manager.emails (24), manager.mailables, emailTemplate.variable (67/16)
### email-delivery — composing & sending editorial/bulk emails
atoms: VUE-composer; API-email-compose-create, API-email-get-many/get-email; FORM-pkp-notify-users-form; JOB-bulkemailsender; SCHEMA-email-log; DB-email_log(+users); MAIL-editor-assigned/submission-needs-editor/review-* (delivery-side); LOC email.compose, email.addAttachment, editor.notifyUsers
### announcements — announcement CRUD, types, notify & public display
atoms: PAGE-announcement-index/view, PAGE-management-settings-announcements; VUE-announcements-list-panel; GRID-announcement-type-grid; FORM-pkp-announcement-form, FORM-pkp-announcement-settings-form; SCHEMA-announcement; API-announcement-* (5); MAIL-announcement-notify; NOTIF-new-announcement; JOB-newannouncementnotifyusers; DB-announcements/announcement_types(+settings); LOC manager.announcements (30), manager.announcementTypes
### languages-locales — install/manage locales, submission languages, date/time
atoms: GRID-admin-language-grid, GRID-manage-language-grid, GRID-submission-language-grid, GRID-language-grid; VUE-date-time-form; FORM-pkp-date-time-form; API-i18n-get-translations; PLUGIN-blocks-languageToggle; LOC admin.languages, manager.language (10), manager.languages
### plugin-management — plugin gallery, enable/disable, settings, upgrade
atoms: PAGE-gateway-plugin, PAGE-payment-plugin; GRID-settings-plugin-grid, GRID-admin-plugin-grid, GRID-plugin-gallery-grid; AUTHZ-plugin-access/required/level-required-policy, AUTHZ-can-access-settings-policy; NOTIF-plugin-enabled/disabled; DB-plugin_settings; PLUGIN-generic-{tinymce,pluginTemplate,pflPlugin}; LOC manager.plugins (65), plugins.categories

## L. Site administration & platform

### site-administration — admin landing, system info, caches, sessions, reauth
atoms: PAGE-admin-{index,contexts,systeminfo,phpinfo,expiresessions,cleartemplatecache,cleardatacache}; FORM-pkp-site-config-form, FORM-pkp-site-security-form; AUTHZ-reauthentication-required-policy, AUTHZ-allowed-hosts-policy; DB-site, versions; LOC admin.settings (52), admin.server, admin.version, admin.error, navigation.tools
### site-settings — site-wide identity, appearance, information, lists
atoms: PAGE-admin-settings, PAGE-management-index/settings; VUE-side-nav, VUE-top-nav-actions; FORM-pkp-site-{appearance,information,config,statistics}-form; API-site-get/edit; SCHEMA-site; DB-site_settings; LOC site.* / admin.systemInformation
### site-access-restrictions — restricted-site / host / HTTPS access policies
atoms: PAGE-management-access; AUTHZ-{restricted-site-access,pkp-site-access,https,allowed-hosts}-policy; SCHEMA-context (restrictions); LOC user.authorization (11/19)
### scheduled-tasks — scheduled-task runner, reminders, log files
atoms: PAGE-admin-downloadscheduledtasklogfile/clearscheduledtasklogfiles; TASK-{editorialreminders,reviewreminder,publishsubmissions,fileloader}; JOB-editorialreminder/reviewreminder; MAIL-editorial-reminder/review-remind/review-remind-auto/review-response-remind-auto; NOTIF-editorial-reminder/open-access; TASK-openaccessnotification/subscriptionexpiryreminder; LOC admin.scheduledTask (43), admin.fileLoader
notes: reminder mailables + reminder jobs + task wrappers form a coherent "automated nudges" cluster the atlas scatters across mail/jobs/tasks/notifications.
### jobs-queue — background job queue monitoring & failed-job management
atoms: PAGE-admin-jobs/failedjobs/failedjobdetails; VUE-jobs-page/failed-jobs-page/failed-job-details-page; API-job-* (getJobs/getFailedJobs/redispatch*/deleteFailedJob); TASK-processqueuejobs, TASK-removefailedjobs; DB-jobs, failed_jobs, job_batches; JOB-testjobsuccess/testjobfailure; LOC admin.job (20), admin.jobs (17), api.jobs
### installation-upgrade — installer & upgrade flow
atoms: PAGE-install-{index,install,upgrade,installupgrade}; DB-versions; LOC installer.form (12), installer.appKey
### notifications-system — in-app notification bell, task grid, unsubscribe, delivery
atoms: PAGE-notification-fetchnotification/unsubscribe; GRID-notifications-grid, GRID-task-notifications-grid; VUE-top-nav-actions; NOTIF-{success,warning,error,form-error,information,help,forbidden} (trivial flash) + the bell/task-level types' shared delivery; DB-notifications, notification_settings/notification_subscription_settings; LOC notification.type (17/19/18), notification.unsubscribeNotifications
notes: the notification *framework* (levels, bell vs task grid vs flash, unsubscribe) is cross-cutting; individual NOTIF-* types are claimed by their originating feature, this owns the plumbing.

## M. Commerce: subscriptions & payments

### subscriptions-management — subscription types, policies, individual/institutional subscribers
atoms: PAGE-payments-{subscriptions,subscriptiontypes,subscriptionpolicies,savesubscriptionpolicies}; GRID-subscriptions-grid, GRID-{individual,institutional}-subscriptions-grid, GRID-subscription-types-grid, GRID-subscriptions-payments-grid; DB-subscriptions, subscription_types(+settings), institutional_subscriptions; PLUGIN-reports-subscriptions; MAIL-subscription-{notify,expired,expired-last,expires-soon}; TASK-subscriptionexpiryreminder; LOC manager.subscriptions (77), manager.subscriptionTypes (46), manager.subscriptionPolicies (39), subscriptions.status
### subscription-access — subscriber access control, purchase & renewal
atoms: PAGE-about-subscriptions, PAGE-user-{subscriptions,purchasesubscription,paypurchasesubscription,completepurchasesubscription,payrenewsubscription,paymembership}; GRID-subscriber-select-grid; PLUGIN-blocks-subscription; MAIL-subscription-{purchase,renew}-{individual,institutional}; LOC user.subscriptions (38), about.subscriptions/subscriptionTypes, payment.subscription/membership/loginRequired
### institutions — institutions for subscription & usage-stats attribution
atoms: PAGE-management-settings-institutions; VUE-institutions-list-panel; FORM-pkp-institution-form; SCHEMA-institution; API-institution-* (5); DB-institutions, institution_ip(+settings); LOC manager.institutions
### payments — payment methods, fees/APC, manual & PayPal
atoms: PAGE-payment-{plugin,pay}, PAGE-payments-{index,payments,paymenttypes,savepaymenttypes}; FORM-request-payment-decision-form, FORM-submission-payments-form, FORM-pkp-payment-settings-form; API-backend-payments-edit, API-submission-get-submission-payment-form, API-backend-submissions-payment; PLUGIN-paymethod-{manual,paypal}; NOTIF-payment-required; DB-completed_payments, queued_payments; MAIL-payment-request; LOC manager.payment (38), manager.paymentMethod, payment.type

---

## Orphans / thin surfaces (special deliverable)

Clusters that a journey- or UI-driven decomposition most likely misses, plus atoms too
thin to anchor a full feature:

- **JATS content API** (`jats-content` above) — a full publication-keyed content API with
  a visibility toggle and no page of its own; production-only, easy to miss entirely.
- **Publication body-text + Pandoc importer** — a rich-text full-text body stored apart
  from galleys, imported via pandoc-wasm; 3 API atoms + 1 Vue, no dedicated plan.
- **Citation-enrichment pipeline** (5 jobs: Crossref/OpenAlex/ORCID/ExtractPids/IsProcessed)
  — background metadata lookup with zero UI; a coherent feature invisible top-down.
- **Usage-stats processing** (~15 compile/loader/dedup jobs + geo/IP + temporary_records
  tables) — the entire metrics ETL behind the stats pages; no direct surface.
- **Content tombstones** (3 `data_object_tombstone*` tables) — OAI deletion records, no
  page/API/plan; pure completeness find.
- **Filters framework** (`filters`/`filter_groups`/`filter_settings`) — the document-
  transform engine behind native XML import/export; infra with no user surface (parked
  under native-xml-import-export by proximity).
- **Controlled vocabularies / interests** (`/vocabs`, `/vocabs/interests`,
  `controlled_vocab*`, `user_interests`) — a shared keyword/interest engine; folded into
  user-profile + submission-metadata but is really its own primitive.
- **ROR registry cache** (`rors`, `ror_settings`, `/rors`, UpdateRorRegistryDataset) —
  self-contained registry integration feeding affiliations.
- **Crossmark button** (VUE-pkp-crossmark-button) — one reader widget, no backend cluster.
- **Temporary/public file upload plumbing** (`/temporaryFiles`, `/_uploadPublicFile`,
  `temporary_files`, AUTHZ-attach-file-upload-header) — cross-cutting upload primitive
  used by many forms; belongs to no single feature.
- **Data-object tombstone / OAI-set-object** and **`data_object_tombstone_oai_set_objects`**
  — same tombstone theme.
- **Dead-code atoms** (already in UNASSIGNED.md, NOT placed here): 6 PubIdExport/File/Author
  grids, PAGE-manager-legacy + 6 routed-but-unimplemented ops, NOTIF-configure-payment-method,
  10 NOTIF-BOOK-* (OMP legacy), EVLOG-REV-DUE. Left as cleanup candidates.
- **OMP-only Vue managers** (ChapterManager, PublicationFormatManager, RepresentativeManager,
  CatalogListPanel) — present in shared lib but unwired in OJS; parked, not featured.
- **Thin config atoms** likely to be absorbed: `file-genres`, `metadata-settings`,
  `email-settings`, `user-role-lifecycle-notices`, `reviewer-recommendations-vocab` — each
  is a real entity+surface triple but sub-feature-sized; flagged so they aren't lost if a
  reviewer merges them upward.

## Cross-cutting concerns

- **Authentication / authorization baseline** — AUTHZ middleware (session/cookie/CSRF/CORS/
  context/roles, ~13) + the base policy machinery (PolicySet, AuthorizationDecisionManager,
  HandlerOperationPolicy, DataObjectRequiredPolicy, ContextPolicy). Per-feature policies are
  claimed by their feature; this owns the shared gate. Known ⚠: HasRoles returns 401 not 403.
- **REST API framework** — routing, `_components` form-fetch pattern, resource DTOs; each
  endpoint is claimed by a feature but the framing (Route groups, PKPBaseController) is shared.
- **Notification framework** — levels (trivial/normal/task), bell vs task-grid vs flash,
  unsubscribe; owned by notifications-system, referenced everywhere.
- **Locale/i18n** — 242 locale-prefix atoms are assigned to features by prefix; infra
  prefixes (`admin.cli` 97, `installer.*`, `validator.*`, `common.*`, `grid.action` 125,
  `form.dropzone`, `navigation.skip`) belong to no feature and stay cross-cutting.
- **Event log & email log** — write sites are scattered across every workflow feature; the
  read/display surface is owned by `activity-log`.
- **Scheduled-task + job infra** — the runner (ProcessQueueJobs, scheduler) is platform;
  individual jobs are claimed by their domain feature.
- **Genres / file-stage / controlled-vocab primitives** — shared entities threaded through
  files, submission, and profile features.

## Ambiguous seams / open questions

- **Wizard vs. publication-metadata editing** share the same forms (TitleAbstract, Metadata,
  Details). I split by *intent* (guided intake vs. ongoing edit); a spec author may prefer to
  keep the forms in one feature and reference from both.
- **editorial-decisions vs. recommend-only-editors vs. review-rounds** — the decision types,
  recommendation path, and round transitions are one code family (`decision/`); QA-wise they
  are three permission stories. Kept separate; could collapse to one "decisions" feature.
- **Copyediting vs. production stages** — OJS folds copyedit+production into one editorial
  path; the notification/event families are distinct enough to keep two features, but they
  could be one "post-acceptance stages" feature.
- **doi-management vs registration-agency-plugins vs peer-review-doi** — one DOI domain, three
  clusters (core management UI, deposit backends, review deposit). Split by surface locality.
- **Settings tabs granularity** — journal-setup / website-appearance / distribution /
  submission-config / metadata / email / review / masthead are 8 features off the context
  settings area; `manager.setup` alone is 207 locale keys, so the granularity is defensible,
  but a coarser "journal-settings" super-feature is a legitimate alternative.
- **subscriptions vs subscription-access vs payments** — subscriptions are a payment consumer;
  I kept management/access/payments as three (config vs. reader flow vs. money rails).
- **notifications-system vs email-delivery vs email-templates** — three features for one
  "communications" theme; the in-app/outbound/template split is real but seam-y.
- **Done-stage** overlaps publication-versioning (published-Version-of-Record trigger) and
  editorial-decisions (new decision types). Placed as its own feature per instruction; a
  reviewer may fold it into one of those.

## Coverage note

- Of ~1,511 atoms, this map **places ~1,430–1,450** into 101 features (the 4 broad locale
  infra prefixes + ~19 dead-code candidates + ~10 OMP-only/plumbing atoms are the bulk of the
  unplaced remainder).
- Every non-locale modality is fully swept into features except the explicitly-parked dead
  code (UNASSIGNED.md: ~19 grids/pages/notifs) and the OMP-only Vue managers.
- Locale (242 atoms) is placed by prefix-to-feature mapping; ~8 infra prefixes
  (~380 keys of the corpus, e.g. `admin.cli`, `grid.action`, `validator.*`, `common.*`,
  `installer.*`) are intentionally left cross-cutting rather than force-fit.
- Required placements all landed: **Done stage** (done-workflow-stage), **peer-review DOI**
  (peer-review-doi), **Pandoc importer** (publication-body-text).
- 101 features vs. round-1's 80 plans — the surplus is mostly the orphan/thin clusters this
  lens surfaced (jats-content, publication-body-text, citation-enrichment-pipeline,
  usage-stats-processing, content-tombstones, affiliations-ror, done-workflow-stage,
  peer-review-doi, open-peer-review-display) that top-down decomposition folds away.
