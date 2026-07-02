# Feature map — strategy: round-1 refinement
- Feature count: 77 (round-1 was 80)

Method: started from the reviewed round-1 e2e inventory (80 features / 8 areas), then
(a) merged test-convenience splits, (b) split overloaded features that bundle two user
jobs, (c) renamed test-shaped names to user-intent names, (d) added atlas-confirmed
gaps (Done stage, editorial-decisions framework, publication-metadata, and folded-in
peer-review DOI deposit / Pandoc importer). Every row is annotated. Sizing calibrated to
`specs/tasks-discussions.md` (~57 atoms, one bounded job). Two area names are re-argued
below; the other six are kept verbatim.

Net change: 5 merges, 2 splits, 8 renames, 2 adds (+3 folded gap-coverages), 1 drop.

---

## 1. Author submission  (round-1: "Submission intake (author experience)", 7 → 5)

### submission-wizard — author fills and submits a manuscript end-to-end (steps, files+genres, details, contributors, consent, multilingual entry, reconfigure modal)
atoms: PAGE-submission-*, VUE-start-submission-form, VUE-reconfigure-submission-modal, FORM-{title-abstract,details,for-the-editors,change-submission-language-metadata}, MAIL-submission-acknowledgement(+not-author/other-authors), NOTIF-submission-submitted (~30)
change: MERGED from submission-wizard-core + submission-wizard-validation + submission-wizard-language — validation/consent and multilingual entry are facets of one "submit a manuscript" job, not separate user jobs (they were split for test budget). Reconfigure modal + locale picker ride along.

### submission-metadata — the "For the Editors" metadata surface: keywords/subjects/disciplines/agencies/coverage/type/citations/data-availability, request-vs-require modes, categories in the wizard
atoms: FORM-{pkp-metadata-settings,metadata-settings,pkp-metadata,pkp-data-availability}, LOC-submission metadata keys (~13)
change: RENAMED from submission-wizard-metadata — kept as its own feature (large, config-driven surface with its own enable/request/require settings) but renamed to user intent; it is not part of the wizard "flow" spec.

### submission-drafts — save-for-later, resume, delete a draft; incomplete-submissions list
atoms: DB-submissions (incomplete), MAIL-submission-saved-for-later, PAGE-submission-saved/cancelled (~6)
change: KEPT — a genuinely distinct "save & resume" job, well-scoped.

### reviewer-suggestions — author suggests reviewers in the wizard; editor sees suggestions at assignment
atoms: VUE-reviewer-suggestion-manager, VUE-reviewer-suggestions-list-panel, DB-reviewer_suggestions(+settings), API-reviewer-suggestion (~5)
change: KEPT — well-scoped 3.6 feature.

### author-dashboard — author's my-submissions list, status/stage display, activity view of own submission
atoms: PAGE-authordashboard-*, VUE-submissions-list-panel, PAGE-dashboard-mysubmissions (~6)
change: KEPT — the author-side view of a submission; distinct from the editor dashboards.

## 2. Editorial workflow  (17 → 16)

### editorial-dashboards — dashboard views/filters/search per role (active, needs-editor, archived, my-assigned, review-assignments)
atoms: PAGE-dashboard-*, PAGE-submissions-index, VUE-dashboard-page, VUE-dashboard-table, NOTIF-{approve-submission,visit-catalog,editorial-report} (~12)
change: KEPT — well-scoped.

### submission-stage — the pre-review (submission) stage workspace: assign editor, participant intro, delete/archive; decisions taken here are recorded by editorial-decisions
atoms: PAGE-workflow-{access,index,submission}, VUE-workflow-page(+ojs) (~8)
change: RENAMED from submission-stage-actions — reframed as the stage-1 workspace (parallel to copyediting-stage / production-stage); its "send to review / accept-and-skip / decline" affordances are the editorial-decisions framework surfaced here, not a separate machinery.

### reviewer-assignment — editor assigns a reviewer (search/picker, due dates, anonymity mode, reviewer type), unassign/cancel, resend request
atoms: VUE-reviewer-manager, VUE-select-reviewer-list-panel, DB-review_assignments(+settings), MAIL-review-{request,request-subsequent,reinstate,resend-request,unassign}, NOTIF-review-assignment(+updated) (~14)
change: KEPT — well-scoped editor-side job.

### reviewer-response — reviewer accepts/declines invitation, completes review (recommendation, comments, attachments), one-click access, author response to a review round, thank reviewer
atoms: PAGE-reviewer-*, VUE-reviewer-submission-page, VUE-author-response-manager(+request), PAGE-reviewresponse-requestauthorresponse, review_round_author_responses, MAIL-review-{confirm,decline,acknowledgement,complete-notify-editors} (~14)
change: KEPT — reviewer-side job; absorbs the 3.6 author-response-to-round surfaces (already hinted here).

### review-rounds — new round, round-status indicators, request-revisions → author uploads → resubmit-for-review cycle, round history
atoms: DB-review_rounds(+settings,files), NOTIF-{review-round-status,pending-internal/external-revisions}, VUE-request-review-round-author-response (~12)
change: RENAMED from review-rounds-revisions — drop the test-shaped "-revisions" suffix.

### review-forms — manager builds a review form with elements; reviewer fills it; editor reads responses
atoms: DB-review_forms(+settings,elements,element_settings,form_responses), FORM review-form (~6)
change: KEPT — distinct config+use job.

### review-anonymity — double-anonymous vs anonymous vs open: what each party can see; public open-review display
atoms: VUE-pkp-open-review, review-assignment anonymity flags (~5)
change: KEPT — a mode with distinct enough visibility rules to spec once; QA would test these together.

### editorial-decisions — the decision framework: which decisions each stage offers, recording a decision, notify-author emails (with attachments), decline/revert, new round, recommend-only recommendations
atoms: PAGE-decision-record, API-submission-{get,add}-decision, SCHEMA-decision, AUTHZ-decision-{write,allowed,stage-valid,type-required}-policy, FORM-select-revision-{decision,recommendation}, FORM-log-reviewer-response, the ~17 Decision*NotifyAuthor mailables, MAIL-recommendation-notify-editors, EVLOG-SUBM-ED-{DEC,REC,EMAIL}, NOTIF-editor-decision-* (~40)
change: RENAMED+EXPANDED from review-decisions — decisions are not an atlas modality but a cross-stage first-class capability. This owns the whole decision engine (stage-1 triage decisions, post-review decisions, recommend-only recommendations, and the Done-stage decisions from done-stage). recommend-only-editors is kept separate (below) as the distinct *role behaviour*, but the recommendation *mechanism* lives here.

### recommend-only-editors — a recommend-only section editor records a recommendation; the deciding editor sees it and decides
atoms: VUE-reviewer-recommendation-manager, DB-reviewer_recommendations(+settings), EVLOG-SUBM-ED-REC (~4)
change: KEPT — a distinct role capability (can recommend, cannot decide); its recording rides on editorial-decisions but the user-facing scenario is its own.

### tasks-discussions — per-stage tasks (owner + due date) and threaded discussions, optionally seeded from journal templates; in-app + email notification
atoms: 57 claimed (see specs/tasks-discussions.md): edit_tasks/notes tables, EditorialTaskController API, MAIL-discussion-*, NOTIF-new-query, VUE-discussion-manager, VUE-task-template-manager
change: MERGED from discussions + editorial-tasks — the 3.6 code unified both into one "Tasks & Discussions" panel; already the verified pilot spec. This is the canonical merge and the sizing yardstick.

### copyediting-stage — copyeditor assignment, copyedited files, author check, send-to-production handoff
atoms: PAGE-workflow-editorial, NOTIF-{copyedit-assignment,assign-copyeditor,awaiting-copyedits}, MAIL-decision-back-from-copyediting (~8)
change: KEPT — distinct stage job.

### production-stage — layout-editor assignment, production-ready files, galley approval, schedule-for-publication handoff
atoms: PAGE-workflow-production, NOTIF-{layout-assignment,index-assignment,awaiting-representations,assign-productionuser,format-needs-approved-submission}, MAIL-decision-back-from-production (~8)
change: KEPT — distinct stage job.

### done-stage — the 6th workflow stage (WORKFLOW_STAGE_ID_DONE): auto-recorded MoveToDone on first Version-of-Record publish, ReturnToWorkflow on unpublish, manual ReturnToDone
atoms: API-submission-return-to-done, decision types MoveToDone/ReturnToDone/ReturnToWorkflow (Decision 33/34/35), ApplyDoneWorkflowStage listener, I12799 backfill migration (see db-entities.md Gaps) (~5)
change: NEW (gap) — the rebase added a full workflow stage that round-1 predates; no new table (writes submissions.stage_id) so it hid from a schema-only sweep. Its decisions are recorded through editorial-decisions but the stage itself is its own bounded feature.

### stage-participants — add/remove stage participants, role-based access effects, assistant permissions; assignment removal prunes discussion/task participants
atoms: VUE-participant-manager, DB-stage_assignments, DB-subeditor_submission_group, NOTIF-editor-assign, MAIL-editor-assigned (~7)
change: KEPT — well-scoped.

### submission-files — per-stage file upload, revisions, dependent files, non-ASCII filenames, downloads, file attachers
atoms: VUE-file-manager, VUE-{submission-files,listing-files}-list-panel, VUE-file-attacher, DB-submission_files(+revisions,settings), SCHEMA-submission-file, DB-genres (~10)
change: KEPT — well-scoped.

### editorial-activity-log — event-log entries for key actions; per-item and per-submission history modal
atoms: DB-event_log(+settings), the EVLOG-* corpus (57 event types), activity history modal (~10)
change: RENAMED from activity-log — clarify it is the editorial event log (distinct from usage stats). Note: individual EVLOG-* atoms are also claimed by the feature that fires them; this feature owns the log *surface* and rendering.

## 3. Publishing & issues  (9 → 9)

### publication-scheduling — publish/unpublish/schedule preconditions and actions, assign article to an issue, schedule into a future issue, republish, front-end visibility flip
atoms: FORM-publish-form, FORM-issue-entry-form, SCHEMA-publication-ojs (issueId/accessStatus/pages), TASK-publishsubmissions, PAGE-workflow → publish (~13)
change: MERGED from publication-publish-flow + issue-assignment-scheduling — "get this article published in an issue" is one job; assigning-to-issue and pressing publish are sequential steps of it, split in round-1 for budget.

### publication-versioning — create a new version, edit a version, version history, cross-version language rules, reader display of versions
atoms: 18 claimed (see specs/publication-versioning.md): SCHEMA-publication-pkp, NOTIF-submission-new-version, MAIL-{publication-version,revised-version}-notify, PKPSubmissionController versions
change: KEPT — the second verified pilot spec; well-scoped.

### publication-metadata — editing the publication's bibliographic metadata: title/abstract/keywords/subjects per-locale, references/citations (+ metadata lookup & enrichment), data-availability, body text; who may edit pre/post-publication; the Word→HTML import
atoms: FORM-{title-abstract,pkp-metadata,pkp-citations,citation-structured-edit,citation-raw-edit,pkp-data-availability,data-citation-edit}, VUE-{citation-manager,data-citation-manager,pandoc-converter}, SCHEMA-{citation,data-citation}, JOB-{crossrefjob,extractpids,isprocessed,openalex,orcidcitation} (citation enrichment), author-edit-published gate (~25)
change: NEW (restructure) — MERGES round-1 editor-metadata-editing (from area 2, the edit-permission gate + InsertSummaryOfChanges) with the metadata-tab half SPLIT out of publication-identifiers-license, and claims previously-unhinted VUE-citation-manager / VUE-data-citation-manager plus the Pandoc importer (VUE-pandoc-converter, a named gap) and the citation-enrichment jobs. One coherent "edit the article's metadata" job. ⚠ seam with publication-amendments (shares InsertSummaryOfChanges) and with citation-style-language (CSL renders these citations) — noted in Ambiguous seams.

### publication-identifiers-license — the identifiers tab (DOI/URN/pubId display) and license/copyright/permissions overrides on a publication
atoms: FORM-{pkp-publication-identifiers,pkp-publication-license,license}, SCHEMA-doi, DB-dois(+settings) as displayed on the publication, PLUGIN-pubIds-urn (~8)
change: SPLIT from round-1 publication-identifiers-license — the "references + per-locale title/abstract" portion moved to publication-metadata; this keeps only identifiers + licensing, which are a distinct compliance-shaped job.

### contributors — contributor CRUD, ordering, primary contact, affiliations, CRediT roles on a publication
atoms: VUE-contributor-manager, VUE-contributor-role-manager, VUE-contributors-list-panel, FORM-contributor-form, DB-authors(+settings,affiliations), DB-credit_*/contributor_role*, SCHEMA-author, PLUGIN-generic-credit (~12)
change: KEPT — well-scoped; folds in the CRediT vocabulary plugin.

### galleys — galley create/edit/delete, file vs remote URL, labels, ordering; HTML/PDF/JATS/Lens render plugins
atoms: VUE-galley-manager, DB-publication_galleys(+settings), PAGE-article-download, PLUGIN-generic-{htmlArticleGalley,pdfJsViewer,jatsTemplate,lensGalley} (~10)
change: KEPT — well-scoped; the galley-render plugins belong to the galley job.

### issue-management — issue CRUD, TOC ordering, cover image, publish issue + reader notification, current issue, unpublish/delete, issue galleys, back/future lists
atoms: PAGE-manageissues-index, DB-issues(+settings,files,galleys), DB-custom_issue_orders, DB-issue_galleys(+settings), NOTIF-published-issue, JOB-issuepublishednotifyusers, MAIL-issue-published-notify (~13)
change: KEPT — large but one editor job (running issues). Flagged in Ambiguous seams as a split candidate (issue-galleys / issue-publishing).

### media-files — the Media section: batch upload, web/high-res variant linking, metadata sync, sharing across galleys, author read-only
atoms: VUE-media-file-manager, DB-variant_groups, DB-submission_files (SUBMISSION_FILE_MEDIA), MediaFilesController, PAGE-libraryfiles-download* (~8)
change: KEPT — re-checked the named "media-files-type" gap: the variant-group linking and SUBMISSION_FILE_MEDIA rows are all inside this feature's scope; no separate file-type feature is hiding.

### publication-amendments — Summary-of-Changes + update type: author submits revisions to a published article, editor inserts them into the publication, versioned update types
atoms: VUE-insert-summary-of-changes-modal, review_round_author_response* on published versions, update-type props (~6)
change: KEPT — distinct 3.6 post-publication flow. Shares the Insert-Summary-of-Changes modal with publication-metadata (seam noted).

## 4. Reader front end  (8 → 9)

### journal-homepage — current-issue display, sidebar blocks, announcements block, homepage highlights carousel
atoms: PAGE-index-index, DB-journals, VUE-highlights-list-panel, DB-highlights(+settings), PLUGIN-blocks-* (~7)
change: KEPT — claims the previously-unhinted highlights carousel here.

### article-landing — article metadata display, galley view/download (incl. pdf.js smoke), license display, DC/Scholar meta tags, "recommend by" blocks, multilingual rendering
atoms: PAGE-article-view, VUE-pkp-cite, VUE-pkp-crossmark-button, PLUGIN-generic-{recommendByAuthor,recommendBySimilarity,dublinCoreMeta,googleScholar} (~10)
change: KEPT — claims previously-unhinted PkpCite / PkpCrossmarkButton here.

### issue-archive-toc — public archive listing, issue TOC page, section grouping
atoms: PAGE-issue-{index,current,archive,view,download} (~5)
change: KEPT.

### site-search — front-end search, filters, no-result behaviour, indexing
atoms: PAGE-search-{index,search}, DB-submissions_fulltext, JOB-updatesubmissionsearchjob (~6)
change: KEPT.

### browse-category-section — category browse pages, section-policy display
atoms: PAGE-catalog-category, DB-categories → browse (~4)
change: KEPT.

### oai-pmh — OAI-PMH protocol (Identify/ListRecords/GetRecord/resumption tokens) and its metadata-format plugins (DC/MARC/MARCXML/JATS/RFC1807), tombstones/deleted-record sets
atoms: PAGE-oai-index, DB-oai_resumption_tokens, DB-data_object_tombstone*, PLUGIN-oaiMetadataFormats-{dc,marc,marcxml,oaiJats,rfc1807}, PLUGIN-generic-driver (~10)
change: SPLIT from oai-sitemap-feeds — OAI-PMH with five metadata-format plugins and tombstone sets is a substantial harvesting feature, distinct in machinery and audience from RSS/sitemap.

### web-feeds-syndication — sitemap.xml, RSS/Atom web feed of recent content, announcement feed
atoms: PAGE-sitemap-index, PLUGIN-generic-{webFeed,announcementFeed}, PLUGIN-blocks-browse (feed links) (~5)
change: SPLIT from oai-sitemap-feeds — the reader-facing syndication half.

### about-pages — public About/Contact/Submissions-guidelines, privacy statement, editorial masthead public page, static pages
atoms: PAGE-about-{index,contact,submissions,privacy,editorialmasthead,editorialhistory,aboutthispublishingsystem}, PAGE-information-*, PLUGIN-generic-staticPages (~10)
change: RENAMED from public-pages — user-intent name; note the masthead *public display* here vs masthead *config* in editorial-masthead (area 5) — seam noted.

### public-comments — reader comments: post, moderate, approve, report, anonymous gating
atoms: VUE-pkp-comments, VUE-user-comments-page/table, VUE-user-comment-reports-table, DB-user_comments(+settings,reports), NOTIF-user-comment-{posted,reported}, PAGE-management-settings-usercomments (~10)
change: KEPT — well-scoped 3.6 feature.

## 5. Users, roles & access  (9 → 9)

### registration-login — public registration (roles, consent, email validation), login, logout, failed login
atoms: PAGE-user-{register,registeruser,activateuser}, PAGE-login-{index,signin,signout}, MAIL-{user-created,validate-email-context,validate-email-site} (~8)
change: KEPT — "get into the system" is one job; registration+login split would be test-shaped.

### password-flows — reset via email, forced change, change in profile
atoms: PAGE-login-{lostpassword,requestresetpassword,resetpassword,updateresetpassword,changepassword,savepassword}, MAIL-password-reset-requested (~5)
change: KEPT.

### user-profile — identity/contact/public profile, notification prefs, API key, reviewer interests
atoms: PAGE-user-profile, DB-user_settings, DB-user_interests, PKPNotificationSettingsForm (~6)
change: KEPT. Note the notification-prefs slice is shared machinery co-owned with notifications (cross-cutting).

### user-management — manager user CRUD, search/filter, disable/enable, remove role, email user, merge users, bulk user XML import/export
atoms: PAGE-management-settings-user, DB-users, DB-user_user_groups, PLUGIN-importexport-users, MAIL-user-role-end-notify (~10)
change: KEPT — folds in the user XML import/export tool (same admin job).

### user-invitations — invite new/existing user to a role, accept/decline invitation flows
atoms: PAGE-invitation-*, VUE-{user-invitation-page,accept-invitation-page,user-invitation-manager}, DB-invitations, MAIL-user-role-assignment-invitation-notify, JOB-removeexpiredinvitationsjob (~8)
change: KEPT.

### roles-permissions — role settings grid, custom role creation, stage-assignment effects, settings-URL access gates, reset-permissions tool
atoms: VUE-user-access-manager, DB-user_groups(+settings,stage), SCHEMA-user-group, PAGE-management-{settings-access,permissions,resetpermissions} (~10)
change: KEPT.

### login-as — admin impersonation and return to own session
atoms: PAGE-login-{signinasuser,signoutasuser}, PAGE-admin-{confirmaccess,confirmaccesssubmit}, DB-sessions (~4)
change: KEPT — tiny; a distinct admin capability. Mergeable into site-administration (noted) but left standalone.

### site-access-restrictions — login-wall site access, registration disabled, disabled-journal visibility, delayed-open-access gating hooks
atoms: PAGE-management-access, restrictSiteAccess/disableUserReg toggles (~4)
change: KEPT.

### editorial-masthead — masthead configuration (role order, reviewer display opt-in) that drives the public masthead page
atoms: FORM-{masthead,pkp-masthead,pkp-appearance-masthead}, MAIL-user-role-masthead-update-notify (~4)
change: KEPT — config side; public display is in about-pages (seam noted).

## 6. Settings & administration  (14 → 14)

### site-administration — hosted-journals CRUD + create-context wizard, multi-context navigation, admin maintenance (systeminfo/phpinfo/cache clears/expire sessions)
atoms: PAGE-admin-*, VUE-add-context-form, DB-site (~8)
change: KEPT.

### site-settings — site setup, site languages, site-level appearance
atoms: PAGE-admin-settings, DB-site_settings (~3)
change: KEPT.

### journal-setup — journal masthead/contact context settings that persist and surface publicly
atoms: PAGE-management-settings-context, PAGE-admin-wizard, DB-journal_settings (~4)
change: KEPT.

### website-appearance — theme options, logo upload, homepage image, date/time formats, custom sidebar blocks
atoms: VUE-theme-form, VUE-date-time-form, PLUGIN-themes-default, PLUGIN-generic-customBlockManager, PLUGIN-blocks-* (~8)
change: KEPT — claims the previously-unhinted DateTimeForm here.

### navigation-menus — menu CRUD, custom items, area assignment, front-end rendering
atoms: VUE-navigation-menu-{editor,manager-field}, DB-navigation_menus(+items,settings,assignments), PAGE-navigationmenu-* (~6)
change: KEPT.

### sections — section CRUD, ordering, editor restrictions, inactivation, wizard/front-end effects
atoms: DB-sections(+settings), DB-custom_section_orders (~6)
change: KEPT.

### categories — category CRUD incl. nesting, wizard exposure, front-end browse hook
atoms: VUE-category-manager, DB-categories(+settings), DB-publication_categories (~5)
change: KEPT.

### submission-settings — Workflow › Submission settings: checklist, author guidelines, components/genres
atoms: PAGE-management-settings-workflow, DB-genres(+settings), SCHEMA-submission-pkp (~4)
change: KEPT — the metadata-toggle rows it used to share are owned by submission-metadata (area 1).

### review-settings — review-mode default, deadlines, reminder config, reviewer guidance, custom reviewer-recommendation options
atoms: FORM review settings, DB-review_assignment_settings, DB-reviewer_recommendation_settings, ReviewGuidanceForm (~6)
change: KEPT — folds in the new-in-3.6 custom reviewer-recommendation *options* config (distinct from recommend-only-editors, which uses them). Seam noted.

### email-templates-management — Manage Emails UI: enable/disable mailables, edit/add/reset templates, role-based template access; edited text used in sent mail
atoms: PAGE-management-settings-manageemails, VUE-edit-mailable-modal, VUE-edit-template-modal, DB-email_templates(+settings,default_data,user_group_access) (~8)
change: KEPT.

### announcements — announcement CRUD, types, expiry, enable toggle, reader page + notification + feed
atoms: VUE-announcements-list-panel, DB-announcements(+settings,types), NOTIF-new-announcement, JOB-newannouncementnotifyusers, MAIL-announcement-notify, PAGE-announcement-* (~8)
change: KEPT.

### languages-locales — enable locales for UI/forms/submissions, multilingual form entry, persistence
atoms: PLUGIN-blocks-languageToggle, locale enable settings, MultilingualProgress usage (~6)
change: KEPT — the cross-cutting multilingual *machinery*; per-feature multilingual entry lives in each feature's spec.

### distribution-settings — license defaults, indexing metadata, archiving display (LOCKSS/CLOCKSS), payments enable, publishing mode (open vs subscription)
atoms: PAGE-management-settings-distribution, PAGE-gateway-{lockss,clockss}, publishing-mode config (~6)
change: KEPT.

### institutions — institution CRUD (IP ranges) for stats/subscription support
atoms: VUE-institutions-list-panel, DB-institutions(+ip,settings) (~4)
change: KEPT — tiny; mergeable into subscriptions-management (noted) but a distinct settings entity.

## 7. Integrations, identifiers & monetization  (round-1: "Plugins (key set)", 9 → 9)

### plugin-management — installed-plugins grid enable/disable + settings modal, site vs journal scope
atoms: DB-plugin_settings, PAGE-gateway-plugin, NOTIF-plugin-{enabled,disabled}, PluginGridHandler (~5)
change: KEPT.

### doi-management — DOI settings (prefix/pattern/auto-assign), assignment on publish, versioned DOI, management page statuses/filters, DataCite/DOAJ agencies, deposit-DOI scheduled task
atoms: PAGE-dois-index, VUE-doi-{setup,registration}-settings-form, VUE-doi-list-panel(+ojs), DB-dois(+settings), JOB-{depositcontext,depositsubmission,depositissue}, TASK-depositdois, PLUGIN-generic-{datacite,doaj} (~12)
change: KEPT.

### crossref-deposit — Crossref settings, export XML, deposit status marking, and peer-review DOI deposit to Crossref
atoms: PLUGIN-generic-crossref, VUE-pkp-crossmark-button (Crossmark), JOB-depositpeerreview (~6)
change: KEPT + folded gap — JOB-depositpeerreview (peer-review DOI deposit, a named round-1 gap) added here as Crossref deposits reviews; noted as new coverage.

### orcid — ORCID settings, author-authorization request email, verified/unverified badge, registration prefill, review/submission deposit to ORCID
atoms: PAGE-orcid-*, VUE-pkp-orcid-display, MAIL-orcid-*, JOB-{depositorcidsubmission,depositorcidreview,reconcileorcidreviewputcode,revokeorcidtoken,sendauthormail,sendupdatescopemail} (~10)
change: KEPT — folds in the ORCID deposit jobs (same integration).

### citation-style-language — CSL settings (styles offered, primary), how-to-cite render, downloads (BibTeX/RIS)
atoms: PLUGIN-generic-citationStyleLanguage, VUE-pkp-cite (render/download) (~6)
change: KEPT — the *rendering/export* of citations; the citation-data editing lives in publication-metadata (seam noted).

### subscriptions-management — subscription types CRUD, policies, individual/institutional subscriptions CRUD, subscription report
atoms: PAGE-payments-{subscriptions,subscriptiontypes,subscriptionpolicies,savesubscriptionpolicies}, DB-subscription_types(+settings), DB-institutional_subscriptions, MAIL-subscription-{purchase,renew}-*, PLUGIN-reports-subscriptions (~12)
change: KEPT.

### subscription-access — access enforcement: anonymous vs subscriber vs editor bypass; delayed open access; subscriber purchase/renew flows
atoms: PAGE-user-{subscriptions,purchasesubscription,payrenewsubscription,paymembership,...}, DB-subscriptions, PLUGIN-blocks-subscription, TASK-{subscriptionexpiryreminder,openaccessnotification} (~10)
change: KEPT.

### payments — enable payments, manual payment record flow, payments grid, PayPal config surface, submission/APC fees
atoms: PAGE-payment(s)-*, DB-{queued,completed}_payments, PLUGIN-paymethod-{manual,paypal}, FORM-{submission-payments,request-payment-decision}, NOTIF-payment-required, MAIL-payment-request (~10)
change: KEPT.

### usage-statistics — stats pages (publications, editorial activity, issues, users, context), COUNTER R5, date filter, CSV/report download, metrics compilation pipeline
atoms: PAGE-stats-*, VUE-*-download-report-modal, VUE-pkp-usage-chart, VUE-counter-reports-page, DB-metrics_*, the JOB-compile*/JOB-*usagestats* pipeline, PLUGIN-reports-{articles,counter}, TASK-statisticsreport (~20)
change: KEPT — large but one "how is my journal being used" job; the compile jobs are its background half.

## 8. System & communications  (7 → 6)

### email-delivery — template-variable rendering in real sends, per-submission email log, notify-composer with attachments, bulk notify-users tool
atoms: VUE-composer, VUE-notify-users-form, VUE-file-attacher (email use), DB-email_log(+users), SCHEMA-email-log, JOB-bulkemailsender (~10)
change: KEPT — shared machinery with a real UI surface (log + composer). Per-feature email content lives in each feature's spec (see Cross-cutting).

### notifications — in-app bell/inbox, tasks grid, mark read, per-user + per-journal opt-outs, unsubscribe link
atoms: VUE-top-nav-actions, PAGE-notification-{fetchnotification,unsubscribe}, DB-notifications(+settings,subscription_settings), the trivial NOTIF-{success,warning,error,...} + level/surface machinery (~15)
change: KEPT — shared machinery with a real UI surface (bell/grid/prefs). Per-feature notification *types* are co-claimed by their firing feature.

### jobs-queue — jobs page, failed jobs, requeue, drain-queue task
atoms: PAGE-admin-{jobs,failedjobs,failedjobdetails}, VUE-{jobs,failed-jobs,failed-job-details}-page, DB-jobs(+batches,failed_jobs), TASK-processqueuejobs, JOB-testjob* (~10)
change: KEPT.

### scheduled-tasks — review reminders + editorial reminders + open-access notification: trigger task, assert reminder email/notification
atoms: TASK-{editorialreminders,reviewreminder,removeexpiredinvitations,removefailedjobs,removeunvalidatedexpiredusers}, JOB-{editorialreminder,reviewreminder}, MAIL-review-remind*, NOTIF-editorial-reminder (~10)
change: KEPT.

### rest-api — token/API-key authentication and the public REST surface (submissions, issues, users, contexts), permission rejections
atoms: DB-user_settings (api key), broad API-* corpus as a product surface, api_key auth middleware (~8)
change: RENAMED from api-smoke — reframed from a test-shaped "smoke" row to the product surface it exercises (the REST API is a real integration feature). Still thin; QA-facing.

### native-xml-import-export — submission and issue XML export/import round-trips; PubMed export
atoms: PLUGIN-importexport-{native,pubmed}, PAGE-management-importexport, PLUGIN-libpkp-importexport-native (~5)
change: KEPT — user XML import/export moved to user-management (that admin job); this is content XML.

### ~~test-infrastructure~~ — (removed)
change: DROPPED — scenario seeding / Mailpit harness / reduced-motion are the e2e *test harness*, not a user-facing product feature. Belongs to `docs/e2e/`, not a product feature map. Its atoms (InstallHandler, etc.) are installer/ops, re-homed to site-administration where reader-facing.

## Cross-cutting concerns

Round-1 modelled **notifications** and **email-delivery** as their own plans, and this
refinement keeps them as features — but *only* for the shared machinery and its UI:
the notification bell/grid/prefs/unsubscribe, and the email log/composer/variable
rendering. This mirrors how `specs/tasks-discussions.md` treats them ("this spec only
owns their *new discussion* behavior"). The pattern for the whole map:

- **Notification types** (NOTIF-*) and **mailables** (MAIL-*) are co-claimed: the type
  itself is documented by the feature that *fires* it (e.g. NOTIF-review-assignment →
  reviewer-assignment; the 17 Decision*NotifyAuthor mailables → editorial-decisions),
  while notifications/email-delivery own the delivery framework, opt-out gates and
  surfaces. State the shared gate once (per charter "brief but comprehensive").
- **event-log types** (EVLOG-*): fired by their feature, but the log *surface/rendering*
  is owned by editorial-activity-log.
- **Multilingual entry**: the enable/persist machinery is languages-locales; per-form
  multilingual behaviour rides along in each feature (submission-wizard, publication-metadata, ...).
- **Editorial decisions** are cross-stage machinery surfaced inside each stage feature
  (submission-stage / copyediting-stage / production-stage / done-stage) but owned once
  by editorial-decisions — otherwise the decision rules would be re-narrated per stage.
- **Authorization policies** (AUTHZ-*) are infrastructure; each is claimed by the feature
  whose access it guards (decision policies → editorial-decisions; query policies →
  tasks-discussions), not a feature of their own.

## Ambiguous seams / open questions

1. **editor-metadata-editing ↔ publication-identifiers-license ↔ publication-metadata.**
   Round-1 had two overlapping metadata features (one in workflow for the edit-permission
   gate, one in publishing for the tabs). I collapsed both plus the citation managers into
   one **publication-metadata** feature and left **publication-identifiers-license** as
   identifiers+license only. Risk: the edit-*permission* concern (author-edit-published
   gate) is workflow-flavoured while the *fields* are publishing-flavoured — a reviewer
   could argue for keeping the permission gate in area 2. I judged "editing the article's
   metadata" to be one QA-testable job.
2. **Citation data (publication-metadata) ↔ citation rendering (citation-style-language).**
   The citation *entities* (references, structured/raw edit, enrichment jobs) are edited in
   publication-metadata; CSL *renders/exports* them. Two features touch DB-citations. Kept
   split by user intent (edit vs display); flag for the maintainer.
3. **issue-management** bundles issue CRUD + issue-galleys + issue-publishing+notify (13
   atoms, the largest single feature besides usage-statistics). Kept as one "run the
   issues" job but it is the strongest remaining split candidate (issue-publishing could
   pair with publication-scheduling).
4. **editorial-masthead config (area 5) ↔ about-pages public display (area 4).** Config and
   its public rendering are separated by area. Defensible (settings vs reader surface) but
   a reviewer may want them together.
5. **recommend-only-editors ↔ editorial-decisions ↔ review-settings.** The role behaviour,
   the recommendation *mechanism*, and the configurable recommendation *options* landed in
   three different features. Kept separate deliberately; watch for over-fragmentation.
6. **Area 7 rename.** "Plugins (key set)" was a test-implementation grouping; subscriptions,
   payments and usage-statistics are core OJS, not plugins, while doi/crossref/orcid/csl are
   integrations. Renamed to "Integrations, identifiers & monetization." If the maintainer
   prefers code-module grouping, revert.
7. **login-as / institutions / rest-api** are all thin (2–4 atoms). Left standalone for a
   clean 1:1 with a distinct capability, but each is a merge candidate (into
   site-administration / subscriptions-management / — respectively).

## Coverage note

Atoms still unplaced (parked, not force-fit — consistent with UNASSIGNED.md):

- **OMP-only Vue managers** present in the shared lib but not wired into WorkflowPageOJS:
  VUE-{chapter-manager, publication-format-manager, representative-manager}, VUE-catalog-list-panel
  — out of OJS scope (monograph surfaces); leave unplaced.
- **Dead-code candidates** already recorded in UNASSIGNED.md (superseded grids, the
  PAGE-*-legacy/unimplemented ops, NOTIF-book-* ×10, NOTIF-configure-payment-method,
  NOTIF-query-activity dead toggle, EVLOG-REV-DUE) — not features; leave as dead-code.
- **~15 metrics/stats internal tables** and the geo/institution temporary-record tables
  fold under usage-statistics' compilation pipeline but are background-only; no dedicated
  user surface.
- **ROR / highlight_settings / filter / controlled_vocab** infrastructure tables: attach to
  their host feature (rors→contributors affiliations; highlights→journal-homepage;
  controlled_vocab→submission-metadata keywords) as internal storage, no own feature.
- **PLUGIN-generic-{pflPlugin, pluginTemplate, tinymce, usageEvent}, PLUGIN-metadata-dc11,
  PLUGIN-libpkp-* base classes**: pflPlugin is a third-party bundle (out of stock roster);
  pluginTemplate is a scaffold; tinymce is the editor primitive (rides along wherever
  rich-text is used); usageEvent → usage-statistics; dc11/base classes pair 1:1 with their
  OJS-side plugin. None warrant a feature.
- **Reviewer-recommendation-options** (DB-reviewer_recommendation_settings, new in 3.6):
  placed under review-settings; if it grows, promote to its own settings feature.

Everything else in the 1,511-atom atlas maps to exactly one of the 77 features above or to
the cross-cutting framework owners (notifications / email-delivery / editorial-activity-log /
languages-locales / editorial-decisions).
