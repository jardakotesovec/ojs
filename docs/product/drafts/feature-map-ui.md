# Feature map — strategy: UI navigation / IA
- Feature count: 84

Lens: features are the screens, panels, and settings tabs a PO/QA actually clicks
through. Areas mirror OJS 3.6's navigation zones (Dashboard, Submission Workflow page,
Publication tab-set, Settings menu, Tools, reader front end, account, Administration).
Atoms are cited by modality prefix (PAGE-/GRID-/VUE-/FORM-/SCHEMA-/DB-/API-/PLUGIN-/JOB-/
NOTIF-/MAIL-/EVLOG-/AUTHZ-) with representative IDs.

## 1. Dashboard & submission lists
### editorial-dashboard — editor/manager triage of all submissions (active, needs-editor, archived), with filters, search, stage/status columns
atoms: PAGE-dashboard-index/editorial, PAGE-submissions-index, VUE-dashboard-page, VUE-dashboard-table, VUE-submissions-list-panel, FORM-submission-filters (+PKP), API-submissions-get-many
notes: round-1 rolled every role's dashboard view into one `editorial-dashboards`; my lens keeps the editor surface here and splits the author/reviewer views out (below) because they are physically different landing screens.

### author-submission-dashboard — author's "My Submissions" list plus the read-mostly view of their own submission's progress
atoms: PAGE-dashboard-mysubmissions, PAGE-authordashboard-submission/readsubmissionemail, VUE-submissions-list-panel (author variant), GRID-lib-pkp-grid-files-submission-author-submission-details-files
notes: the author's submission page reuses workflow grids read-only; the editorial edit affordances live in Area 3/4.

### reviewer-assignments-dashboard — reviewer's list of review invitations/assignments and their statuses
atoms: PAGE-dashboard-reviewassignments, SCHEMA-review-assignment (list projection), API-reviews/review-assignments-get-many

## 2. Author submission
### submission-wizard-start-files-details — begin a submission (section/locale), upload manuscript files by genre, enter title & abstract
atoms: PAGE-submission-index/saved/wizard/cancelled, VUE-start-submission-form, FORM-start-submission-ojs/-pkp, FORM-details, FORM-title-abstract-form, FORM-pkp-submission-file-form, GRID-lib-pkp-wizard-file-upload-file-upload-wizard-handler, DB-genres
### submission-wizard-contributors-metadata — add contributors and the "For the Editors" metadata (keywords/subjects/agencies/coverage/type/data-availability/categories) and suggest reviewers
atoms: FORM-for-the-editors, FORM-pkp-metadata-form, FORM-pkp-data-availability-form, FORM-contributor-form, FORM-reviewer-suggestions-form, VUE-reviewer-suggestions-list-panel, SCHEMA-reviewer-suggestion, DB-reviewer_suggestions
notes: round-1 gave reviewer-suggestions its own feature; the UI shows it as one optional wizard step, so it lives inside the wizard step-group.
### submission-wizard-confirm-and-consent — review step, checklist/copyright/privacy consent, comments for the editors, submit, acknowledgement
atoms: FORM-confirm-submission, FORM-comments-for-the-editors, FORM-submission-guidance-settings (surfaced), MAIL-submission-ack (mailables), PAGE-submission-saved
### submission-drafts-and-reconfigure — save-for-later, resume/delete incomplete submissions, and mid-wizard reconfigure (change section/locale, multilingual entry)
atoms: DB-submissions (incomplete), VUE-reconfigure-submission-modal, FORM-reconfigure-submission-ojs/-pkp, FORM-change-submission-language-metadata-form

## 3. Editorial workflow (submission workflow page & its stage panels)
### workflow-stages-and-decisions — the workflow page shell: stage tabs/bubbles, per-stage navigation, and the editorial-decision action bar (send-to-review, accept, decline, request-revisions, resubmit, send-to-production/-copyediting) incl. the new **Done** stage
atoms: PAGE-workflow-access/index/submission, VUE-workflow-page, VUE-workflow-page-ojs, PAGE-decision-record, SCHEMA-decision, DB-edit_decisions, FORM-select-revision-decision-form, GRID-lib-pkp-modals-publish (handoff); Done-stage: decision types MoveToDone/ReturnToWorkflow/ReturnToDone, listener ApplyDoneWorkflowStage, WORKFLOW_STAGE_ID_DONE
notes: **bold call** — round-1 folded editorial decisions into each per-stage feature; my UI lens hoists stage-navigation chrome + the decision action bar into one persistent feature, which is also the natural home for the Done stage (a stage value with no table, auto-recorded on first publish).
### submission-stage — stage-1 panel: assign participating editor, incoming submission files, accept-and-skip-review, desk-decline/withdraw, send to review
atoms: PAGE-workflow-submission, GRID-lib-pkp-grid-files-submission-*, SCHEMA-submission-ojs, EVLOG-SUBM-SUBMIT
### review-rounds-and-revisions — external-review stage: rounds, request-revisions, author revision uploads, resubmit-for-review, round status/history
atoms: PAGE-workflow-externalreview, DB-review_rounds/review_round_files/review_files, SCHEMA-review-round, GRID-lib-pkp-grid-files-review-* (editor/limit/manage/reviewer/workflow-revisions), GRID-lib-pkp-grid-files-attachment-author-review-attachments
### reviewer-assignment — assign/select a reviewer (search picker, due dates, anonymity mode, reviewer type), unassign/cancel, resend request, thank
atoms: VUE-reviewer-manager, VUE-select-reviewer-list-panel, GRID-grid-users-reviewer-reviewer-grid-handler, GRID-lib-pkp-grid-users-reviewer-author-reviewer, SCHEMA-review-assignment, DB-review_assignments, FORM-log-reviewer-response-form
notes: absorbs round-1's standalone `review-anonymity` as a mode setting on this panel; the reader-facing open-review display moves to article-landing (Area 10).
### reviewer-review-workspace — the reviewer's own review page: accept/decline invitation, review steps, recommendation, comments, attachments, one-click access
atoms: PAGE-reviewer-submission/step/savestep/showdeclinereview/savedeclinereview, VUE-reviewer-submission-page, GRID-lib-pkp-grid-files-review-reviewer-review-files, GRID-lib-pkp-grid-files-attachment-reviewer-review-attachments, DB-review_form_responses
### review-recommendations-and-author-responses — recommend-only editors record a recommendation; editor requests an author's response to a review round; author responds
atoms: VUE-reviewer-recommendation-manager, DB-reviewer_recommendations, VUE-request-review-round-author-response, VUE-author-response-manager, VUE-author-response-request-manager, PAGE-reviewresponse-requestauthorresponse, DB-review_round_author_responses
### copyediting-stage — copyeditor assignment, copyedited-files exchange, author check, send-to-production
atoms: PAGE-workflow-editorial, GRID-lib-pkp-grid-files-copyedit-copyedit-files, GRID-lib-pkp-grid-files-copyedit-manage-copyedit-files, MAIL-decision-back-from-copyediting
### production-stage — layout-editor assignment, production-ready files, proof files, schedule-for-publication handoff
atoms: PAGE-workflow-production, GRID-lib-pkp-grid-files-production-ready-*, GRID-lib-pkp-grid-files-final-*, GRID-lib-pkp-grid-files-proof-manage-proof-files
### stage-participants — add/remove stage participants, role-based access effects, notify a participant
atoms: VUE-participant-manager, GRID-lib-pkp-grid-users-stage-participant, GRID-lib-pkp-grid-users-user-select, DB-stage_assignments, DB-subeditor_submission_group, EVLOG-SUBM-ADD-PART/REM-PART
### editorial-discussions — internal per-stage discussion threads (create/reply/close, participant scoping)
atoms: VUE-discussion-manager, DB-submission_comments, DB-notes (shared), API-submissions/*/discussions
notes: this is the sibling of the reference spec `tasks-discussions.md`.
### editorial-tasks — editorial task create/assign/complete/due-dates, and task-template management applied in workflow
atoms: VUE-task-template-manager, PAGE-submissions-tasks, GRID-lib-pkp-grid-notifications-task-notifications, DB-edit_tasks/edit_task_participants/edit_task_templates/edit_task_template_user_groups/edit_task_settings
### submission-files — the per-stage file manager: upload, revisions, dependent files, non-ASCII names, downloads, attach-from-library
atoms: VUE-file-manager, VUE-submission-files-list-panel, VUE-listing-files-list-panel, VUE-file-attacher, GRID-lib-pkp-grid-files-dependent/-submission-files, SCHEMA-submission-file, DB-submission_files/submission_file_revisions/files/temporary_files, API-submission-files-*
### activity-and-history-log — submission event log + email log + information-center notes/history modal
atoms: GRID-lib-pkp-grid-event-log-submission-event-log, GRID-lib-pkp-grid-event-log-submission-file-event-log, GRID-lib-pkp-information-center-* (submission/file), SCHEMA-event-log, DB-event_log, EVLOG-* (36 submission/file event types)

## 4. Publication record (the article-record tab-set)
### publication-title-abstract-body — Title/Abstract tab (per-locale) and the full-text body editor, including the **Pandoc importer** that converts an uploaded Word/rich-text doc to HTML
atoms: FORM-title-abstract-form, VUE-pandoc-converter (WorkflowPublicationBodyText), SCHEMA-publication-pkp/-ojs, EVLOG-SUBM-META-UPD
notes: **Pandoc importer placed here.** In the UI this is a distinct tabbed sub-app inside the workflow page, so the whole Publication tab-set is its own area (round-1 scattered these across Publishing and Editorial).
### publication-contributors — Contributors tab: contributor CRUD, ordering, primary contact, affiliations (ROR), CRediT roles
atoms: VUE-contributor-manager, VUE-contributors-list-panel, VUE-contributor-role-manager, GRID-lib-pkp-grid-users-author-author, FORM-contributor-form, SCHEMA-author/affiliation/contributor-role, DB-authors/author_affiliations/contributor_roles/credit_contributor_roles/credit_roles
### publication-metadata-references — Metadata tab (keywords/subjects/disciplines/agencies/coverage/type/data-availability) and the References/Citations editor
atoms: FORM-pkp-metadata-form, FORM-pkp-data-availability-form, FORM-pkp-citations-form, VUE-citation-manager, VUE-data-citation-manager, FORM-citation-raw-edit-form, FORM-citation-structured-edit-form, FORM-data-citation-edit-form, SCHEMA-citation/data-citation, DB-citations/data_citations/controlled_vocabs
### publication-galleys — Galleys tab: create/edit/delete a galley, file vs remote URL, labels, ordering, galley DOI, HTML/PDF/JATS rendering plugins
atoms: VUE-galley-manager, GRID-grid-article-galleys-article-galley-grid, SCHEMA-galley, DB-publication_galleys/publication_galley_settings, PAGE-article-download, PLUGIN-generic-{htmlArticleGalley,pdfJsViewer,lensGalley,jatsTemplate}
### publication-media-files — media/supplementary files panel: batch upload, web/high-res variant linking, sharing across galleys, author read-only
atoms: VUE-media-file-manager, GRID-lib-pkp-grid-settings-library-library-file-admin, GRID-lib-pkp-grid-files-library-file, GRID-lib-pkp-modals-document-library, DB-library_files/variant_groups, PAGE-libraryfiles-download*
### publication-identifiers — Identifiers tab: DOI/URN assignment, pages, article number, pubId clearing
atoms: FORM-pkp-publication-identifiers-form, GRID-api-file-manage-file-api-handler (identifiers ops), SCHEMA-doi, DB-dois/doi_settings, PLUGIN-pubIds-urn
### publication-license-permissions — Permissions & Disclosure tab: license URL, copyright holder/year, permission overrides
atoms: FORM-pkp-publication-license-form, FORM-license-form, FORM-pkp-license-form, SCHEMA-publication (license props)
### publication-issue-assignment — Issue tab: assign article to issue/section/categories and schedule into a future issue
atoms: FORM-issue-entry-form, SCHEMA-submission-ojs (issueToBePublished), DB-publication_categories, API-submissions/publications issue assignment
### publication-versioning — create/edit a new version, version history & dropdown, cross-version language-change rules
atoms: SCHEMA-publication-pkp/-ojs (version props), GRID-lib-pkp-modals-publish, VUE-insert-summary-of-changes-modal, EVLOG-SUBM-META-PUB/UNPUB
### publication-publish-flow — publish/unpublish/schedule preconditions, the publish confirmation modal, republish, front-end visibility flip
atoms: GRID-lib-pkp-modals-publish-publish-handler, FORM-publish-form, PAGE-decision-record (publish handoff), DB-publications (status), API-publications-publish/unpublish
### publication-amendments — Summary of Changes + update type: author submits an amendment with revisions, editor inserts it into the published version
atoms: GRID-lib-pkp-modals-submission-view-submission-metadata, VUE-insert-summary-of-changes-modal, DB-review_round_author_responses (amendment path)

## 5. Settings — Journal & Website
### journal-details-settings — Journal tab: masthead/context details, contact, privacy statement, information forms
atoms: PAGE-management-settings-context, FORM-context-form/-pkp-context-form, FORM-pkp-contact-form, FORM-pkp-privacy-form, FORM-pkp-information-form, FORM-masthead-form/-pkp-masthead-form, SCHEMA-context-ojs/-pkp, DB-journal_settings/journals, GRID-lib-pkp-grid-settings-setup
### editorial-masthead — configure the editorial board/masthead ordering that renders on the public masthead page
atoms: FORM-pkp-appearance-masthead-form, PAGE-about-editorialmasthead/editorialhistory, SCHEMA-user-group (masthead prop)
### sections — Journal Sections CRUD: ordering, editor restrictions, inactivation, review-form default, word count
atoms: GRID-grid-settings-sections-section-grid, SCHEMA-section-ojs/-pkp, DB-sections/section_settings/custom_section_orders
### categories — content Categories CRUD incl. nesting, assigned editors, wizard exposure, front-end browse hook
atoms: VUE-category-manager, FORM-category-form, SCHEMA-category, DB-categories/category_settings/publication_categories
### website-appearance — Website > Appearance: theme selection & options, logo/homepage image uploads, custom CSS
atoms: PAGE-management-settings-website, VUE-theme-form, FORM-pkp-theme-form, FORM-appearance-setup-form/-advanced-form (+PKP), PLUGIN-themes-default, VUE-highlights-list-panel, FORM-highlight-form
notes: homepage highlights carousel config lives here; its reader render is in journal-homepage.
### website-info-and-lists — Website > Setup: reader/author/librarian info pages, list pagination, date/time display
atoms: FORM-pkp-information-form, FORM-pkp-lists-form, FORM-pkp-date-time-form, VUE-date-time-form, PAGE-information-*
### navigation-menus — Navigation menu & menu-item CRUD, custom items, area assignment, front-end rendering
atoms: VUE-navigation-menu-editor, VUE-navigation-menu-manager-field, GRID-lib-pkp-grid-navigation-menus-*, PAGE-navigationmenu-index/view/preview, SCHEMA-navigation-menu/-item, DB-navigation_menus/navigation_menu_items/navigation_menu_item_assignments
### announcements — announcement CRUD, types, expiry, enable toggle; the reader listing/detail page and announcement feed
atoms: VUE-announcements-list-panel, FORM-pkp-announcement-form, FORM-pkp-announcement-settings-form, GRID-lib-pkp-grid-announcements-announcement-type, PAGE-announcement-index/view, SCHEMA-announcement, DB-announcements/announcement_types, PLUGIN-generic-announcementFeed, JOB-newannouncementnotifyusers, MAIL-announcement-notify
notes: one feature spans the manager CRUD and the reader page (same job, two ends) — a deliberate cross-surface merge.
### static-content-and-blocks — static custom pages plus custom/standard sidebar blocks
atoms: PLUGIN-generic-staticPages, PLUGIN-generic-customBlockManager, PLUGIN-blocks-{browse,information,makeSubmission,developedBy,languageToggle,subscription}
### languages-and-locales — enable locales for UI/forms/submissions, set primary locale, multilingual form entry
atoms: GRID-lib-pkp-grid-settings-languages-{manage,submission}, GRID-lib-pkp-grid-admin-languages-admin-language, GRID-lib-pkp-grid-languages-language, PLUGIN-blocks-languageToggle, DB-controlled_vocab (locale-scoped)

## 6. Settings — Workflow
### submission-settings — Workflow > Submission: checklist, author guidelines, components/genres, metadata toggles, disable-submissions
atoms: PAGE-management-settings-workflow, FORM-access-form, FORM-metadata-settings-form, FORM-pkp-metadata-settings-form, FORM-pkp-disable-submissions-form, FORM-submission-guidance-settings, GRID-lib-pkp-grid-settings-genre-genre, DB-genres/genre_settings
### review-settings — Workflow > Review: default review mode, response/review deadlines, reminder config, reviewer guidance, reviewer-recommendation definitions
atoms: FORM-pkp-review-setup-form, FORM-review-guidance-form/-pkp-review-guidance-form, FORM-reviewer-recommendation-form, DB-reviewer_recommendations/reviewer_recommendation_settings, DB-review_assignment_settings
### review-forms — build a review form and its elements; reviewer fills it; editor reads responses
atoms: GRID-lib-pkp-grid-settings-review-forms-review-form, GRID-lib-pkp-grid-settings-review-forms-review-form-elements, GRID-lib-pkp-listbuilder-...-review-form-element-response-item, DB-review_forms/review_form_elements/review_form_responses
notes: **bold call** — moved from round-1's Editorial-workflow area to Settings > Workflow, matching where a manager actually creates it; the reviewer-fill path is cross-referenced from reviewer-review-workspace.
### email-setup-and-templates — Workflow > Emails setup (signature, bounce, bulk restrictions) plus the Manage Emails UI (edit/add/reset templates, role access)
atoms: PAGE-management-settings-manageemails, VUE-edit-mailable-modal, VUE-edit-template-modal, FORM-email-template-form, FORM-pkp-email-setup-form, FORM-pkp-restrict-bulk-emails-form, SCHEMA-email-template, DB-email_templates/email_template_user_group_access

## 7. Settings — Distribution, Access & commerce
### distribution-indexing-archiving — Distribution tab: default license/copyright, search indexing metadata, LOCKSS/CLOCKSS archiving, publishing mode (open vs subscription)
atoms: PAGE-management-settings-distribution, FORM-archiving-lockss-form, FORM-pkp-search-indexing-form, FORM-pkp-license-form, PAGE-gateway-lockss/clockss, PLUGIN-generic-{driver,dublinCoreMeta,googleScholar}
### doi-configuration — Distribution > DOIs: enable DOIs, prefix/suffix pattern, auto-assign, registration agency choice
atoms: VUE-doi-setup-settings-form, VUE-doi-registration-settings-form, FORM-doi-setup-settings-form, FORM-pkp-doi-setup-settings-form, FORM-pkp-doi-registration-settings-form, DB-doi_settings
### doi-assignment-and-deposit — DOI management page (statuses/filters, assign-on-publish, versioned DOI) and export/deposit to registration agencies incl. **peer-review DOI**
atoms: PAGE-dois-index, VUE-doi-list-panel, VUE-doi-list-panel-ojs, GRID-grid-pub-ids-* (export lists), PLUGIN-generic-{crossref,datacite,doaj}, JOB-depositcontext/depositsubmission/depositissue, JOB-depositpeerreview (DepositPeerReview), TASK-depositdois
notes: **peer-review DOI placed here** (new DepositPeerReview job deposits review activity DOIs to the agency).
### subscription-management — subscription types CRUD, individual/institutional subscriptions CRUD, subscription policies
atoms: PAGE-payments-subscriptions/subscriptiontypes/subscriptionpolicies, GRID-grid-subscriptions-* (subscriptions, types, individual, institutional, payments), DB-subscriptions/subscription_types/institutional_subscriptions, PLUGIN-reports-subscriptions
### subscription-access — access enforcement: anonymous vs subscriber vs editor bypass, delayed open access, the reader purchase/renew flow
atoms: PAGE-about-subscriptions, PAGE-user-subscriptions/purchasesubscription/paypurchasesubscription/completepurchasesubscription/payrenewsubscription/paymembership, GRID-grid-users-subscriber-select, PLUGIN-blocks-subscription, TASK-subscriptionexpiryreminder, JOB-openaccessmailusers
### payments — enable payments, manual/PayPal method config, payments grid, APC/submission fees on decision
atoms: PAGE-payments-index/paymenttypes/payments, FORM-pkp-payment-settings-form, FORM-request-payment-decision-form, FORM-submission-payments-form, PLUGIN-paymethod-{manual,paypal}, DB-completed_payments/queued_payments
### institutions — institution CRUD (IP ranges, ROR) supporting subscriptions and usage stats
atoms: VUE-institutions-list-panel, PAGE-management-settings-institutions, FORM-pkp-institution-form, API-institution-*, SCHEMA-institution, DB-institutions/institution_ip/institution_settings

## 8. Settings — Users, Roles & Invitations
### user-management — Users list: user CRUD, search/filter, disable/enable, remove role, email a user, merge users, bulk user import/export
atoms: GRID-lib-pkp-grid-settings-user-user-grid, GRID-lib-pkp-api-user-user-api, GRID-lib-pkp-grid-users-user-select, GRID-lib-pkp-grid-users-exportable-users, FORM-pkp-notify-users-form, VUE-notify-users-form, SCHEMA-user, DB-users/user_settings/user_user_groups, PLUGIN-importexport-users
### roles-and-permissions — Users & Roles > Roles: user-group/role grid, stage assignments, custom roles, permission gates, reset-permissions tool
atoms: PAGE-management-settings-access, PAGE-management-permissions/resetpermissions, VUE-user-access-manager, GRID-lib-pkp-grid-settings-roles-user-group, FORM-user-access-form/-pkp-user-access-form, SCHEMA-user-group, DB-user_groups/user_group_stage/user_group_settings, AUTHZ-* (role/stage policies)
### user-invitations — invite a new or existing user to a role; the multi-step accept-invitation wizard
atoms: VUE-user-invitation-page, VUE-user-invitation-manager, VUE-accept-invitation-page, PAGE-invitation-accept/decline/confirmdecline/create/edit, FORM-user-details-form, FORM-accept-user-details-form, DB-invitations, JOB-removeexpiredinvitationsjob

## 9. Tools — Import/Export & Statistics
### native-xml-import-export — Tools > Import/Export: native OJS XML round-trip of submissions and issues
atoms: PAGE-management-importexport, PLUGIN-importexport-native, PLUGIN-libpkp-importexport-native, GRID-grid-issues-exportable-issues-list, GRID-grid-submissions/publications-export-published-*
### pubmed-and-metadata-export — PubMed/MEDLINE XML export and metadata-format mapping plugins
atoms: PLUGIN-importexport-pubmed, PLUGIN-metadata-dc11, PLUGIN-libpkp-metadata-dc11
### user-import-export — bulk XML import/export of user accounts
atoms: PLUGIN-importexport-users, PLUGIN-libpkp-importexport-users, GRID-lib-pkp-grid-users-exportable-users
### usage-statistics — Statistics pages (editorial activity, publications, issues, context, users) with date filters, CSV/COUNTER R5 export, and reader usage charts
atoms: PAGE-stats-editorial/publications/issues/context/users/reports/counterr5, VUE-counter-reports-page, VUE-*-download-report-modal, VUE-pkp-usage-chart, FORM-pkp-context-statistics-form, FORM-report-form, DB-metrics_* , JOB-compile*metrics, TASK-usagestatstloader, PLUGIN-generic-usageEvent, PLUGIN-reports-counter
### content-and-review-reports — CSV report plugins for article metadata and peer-review activity
atoms: PLUGIN-reports-articles, PLUGIN-reports-reviewReport, PLUGIN-reports-subscriptions

## 10. Reader-facing site
### journal-homepage — journal home: current-issue display, sidebar blocks, announcements block, highlights carousel
atoms: PAGE-index-index, DB-journals, VUE-highlights-list-panel (render), PLUGIN-blocks-*, SCHEMA-highlight, DB-highlights
### article-landing — article abstract page: metadata display, galley view/download, license, DC/Scholar meta tags, how-to-cite, Crossmark, open-review display, "recommend by" blocks
atoms: PAGE-article-view/download/viewfile/downloadsuppfile, VUE-pkp-open-review, VUE-pkp-crossmark-button, VUE-pkp-orcid-display, PLUGIN-generic-{recommendByAuthor,recommendBySimilarity,pflPlugin}
notes: absorbs round-1 `review-anonymity`'s public open-review view here.
### issue-toc-and-archive — current issue, single-issue TOC, back-issue archive, section grouping, issue-galley download, TOC ordering/access
atoms: PAGE-issue-index/current/archive/view/download, GRID-grid-toc-toc-grid, GRID-grid-issues-back-issue/future-issue, GRID-grid-issue-galleys-issue-galley-grid, SCHEMA-issue, DB-issues/issue_galleys/issue_files/custom_issue_orders, PLUGIN-catalog (PKPCatalogHandler)
notes: also covers manager-side issue CRUD/publish (ManageIssuesHandler) — the same issue object edited in one place and read in another.
### site-search — front-end search, filters, no-result behavior, search index maintenance
atoms: PAGE-search-index/search, FORM-pkp-search-indexing-form, DB-submissions_fulltext, JOB-updatesubmissionsearchjob
### browse-category-section — category/section browse landing pages and the browse sidebar block
atoms: PAGE-catalog-category/fullsize/thumbnail, PLUGIN-blocks-browse, DB-categories (browse), DB-sections (browse)
### about-and-information-pages — About the journal, editorial masthead/history public pages, contact, submissions guidelines, privacy, "about this publishing system"
atoms: PAGE-about-index/editorialmasthead/editorialhistory/submissions/contact/privacy/aboutthispublishingsystem, PAGE-information-readers/authors/librarians/competinginterestguidelines/samplecopyrightwording, PLUGIN-blocks-information
### public-comments — reader comments: post, report, and the manager moderation queue (approve/anonymous gating)
atoms: VUE-pkp-comments, VUE-user-comments-page/-table/-report-table, PAGE-management-settings-usercomments, FORM-content-comments-form, DB-user_comments/user_comment_reports/user_comment_settings
### citation-formats-csl — Citation Style Language: how-to-cite block, styles offered/primary setting, BibTeX/RIS downloads
atoms: VUE-pkp-cite, PLUGIN-generic-citationStyleLanguage
### oai-sitemap-and-feeds — OAI-PMH endpoint & metadata formats, sitemap.xml, web/announcement RSS/Atom feeds, preservation gateways
atoms: PAGE-oai-index, PAGE-sitemap-index, PAGE-gateway-index/lockss/clockss/plugin, PLUGIN-oaiMetadataFormats-{dc,marc,marcxml,oaiJats,rfc1807}, PLUGIN-generic-webFeed, DB-oai_resumption_tokens, DB-data_object_tombstones*

## 11. User account & identity
### registration-and-login — public registration (roles, consent), login/logout, account activation
atoms: PAGE-user-register/registeruser/activateuser, PAGE-login-index/signin/signout, DB-users/sessions
### password-management — lost-password request, reset via email, forced change, change-in-profile
atoms: PAGE-login-lostpassword/requestresetpassword/resetpassword/updateresetpassword/changepassword/savepassword
### user-profile — identity/contact/public profile, notification preferences, API key, reviewer interests
atoms: PAGE-user-index/profile, GRID-lib-pkp-tab-user-profile-tab, DB-user_settings/user_interests, SCHEMA-user
### orcid-integration — ORCID settings, author authorization request/email, verified/unverified badge, registration prefill, OAuth callback
atoms: PAGE-orcid-verify/authorizeorcid/about/updatescope, FORM-orcid-settings-form, FORM-orcid-site-settings-form, VUE-pkp-orcid-display, JOB-deposit orcid*/revokeorcidtoken/sendauthormail/sendupdatescopemail, JOB-depositorcidreview/reconcileorcidreviewputcode
### notifications-inbox-and-preferences — in-app bell/inbox, mark-read, per-type opt-outs, emailed unsubscribe links
atoms: VUE-top-nav-actions, PAGE-notification-fetchnotification/unsubscribe, GRID-lib-pkp-grid-notifications-notifications, NOTIF-* (65 types), DB-notifications/notification_settings/notification_subscription_settings
notes: cross-cutting surface, but it has its own inbox screen + preference UI, so it earns a feature (see Cross-cutting).

## 12. Administration & system (site level)
### hosted-journals — site admin: hosted-journal list, create-context wizard, edit/delete, multi-context navigation
atoms: PAGE-admin-index/contexts/wizard, VUE-add-context-form, GRID-lib-pkp-grid-admin-context-context-grid, FORM-pkp-context-form, SCHEMA-context-pkp, DB-journals
### site-settings — site setup/info, site languages, site appearance, security/password policy, site statistics
atoms: PAGE-admin-settings, FORM-pkp-site-config-form/-information-form/-appearance-form/-security-form/-statistics-form/-lists-form, SCHEMA-site, DB-site/site_settings
### site-maintenance — system information, phpinfo, clear template/data caches, expire sessions
atoms: PAGE-admin-systeminfo/phpinfo/cleartemplatecache/cleardatacache/expiresessions, PAGE-management-tools
### login-as-user — admin impersonation of another user and return to own session
atoms: PAGE-login-signinasuser/signoutasuser, PAGE-admin-confirmaccess/confirmaccesssubmit, DB-sessions
### site-access-restrictions — login-wall site access, registration disabled, disabled-journal visibility
atoms: PAGE-management-access, FORM-pkp-site-security-form, FORM-pkp-disable-submissions-form, SCHEMA-context (restrict* props)
### plugin-management — installed-plugins grid enable/disable + settings modal, plugin gallery install/upgrade, site vs journal scope
atoms: GRID-grid-settings-plugins-settings-plugin-grid, GRID-lib-pkp-grid-admin-plugins-admin-plugin, GRID-lib-pkp-grid-plugins-plugin-gallery, PAGE-gateway-plugin, PAGE-payment-plugin, DB-plugin_settings, PLUGIN-generic-pluginTemplate
### jobs-queue — queued jobs page, failed jobs list/details, requeue
atoms: PAGE-admin-jobs/failedjobs/failedjobdetails, VUE-jobs-page, VUE-failed-jobs-page, VUE-failed-job-details-page, DB-jobs/failed_jobs/job_batches, TASK-processqueuejobs, TASK-removefailedjobs
### scheduled-tasks — review/editorial reminders, deposit-DOIs, auto-publish scheduled submissions, cleanup tasks, task-log files
atoms: PAGE-admin-downloadscheduledtasklogfile/clearscheduledtasklogfiles, TASK-{editorialreminders,reviewreminder,publishsubmissions,removeunvalidatedexpiredusers,updateipgeodb,updaterorregistrydataset,openaccessnotification}, JOB-editorialreminder/reviewreminder

## 13. Cross-cutting platform
### email-delivery-and-composer — the rich email composer and template-variable rendering used across editorial actions, notify-users bulk send, and the per-submission email log
atoms: VUE-composer, VUE-notify-users-form, MAIL-* (69 mailables), SCHEMA-email-log, DB-email_log/email_log_users, JOB-bulkemailsender, EVLOG email event types (30)
notes: the *management* of templates is a Settings feature (email-setup-and-templates); this feature is the *sending* machinery and log.
### rest-api-access — REST API token auth, key endpoints, and permission rejections
atoms: API-* (285 endpoints), AUTHZ-* middleware (has-roles/has-user/has-context/decode-api-token), SCHEMA-user (apiKey), API-temporary-files-upload-file

## Cross-cutting concerns
- **Notifications** — distributed *and* homed. The in-app inbox/bell + per-type preferences are their own feature (`notifications-inbox-and-preferences`); the ~65 NOTIF types and MAIL triggers are otherwise cited by the feature that raises them (e.g. announcement-notify under announcements, issue-published under issue-toc). Not force-fitted into every consumer.
- **Email/mailables** — same split: `email-setup-and-templates` (configure), `email-delivery-and-composer` (send + log), and individual MAIL-* atoms referenced from the acting feature.
- **Permissions/authorization** — the 90 AUTHZ policies/middleware are cited primarily under `roles-and-permissions` (role/stage grants) and `rest-api-access` (API middleware); per-feature access rules stay described inside each feature rather than centralized, since the UI expresses them as "what buttons this role sees."
- **File storage & attachments** — the `files`/`temporary_files`/`variant_groups` machinery and `FileAttacher` live under `submission-files`; media/library files under `publication-media-files`. No separate "file engine" feature — it surfaces only through those two panels plus galleys.
- **Event/activity log** — homed in `activity-and-history-log`; EVLOG-* atoms otherwise ride along the action that emits them.
- **Workflow-stage engine** — the stage model (5 editorial stages + the new **Done** stage), decision types, and the ApplyDoneWorkflowStage listener are all owned by `workflow-stages-and-decisions`; individual stage panels (submission/review/copyediting/production) are separate features but defer stage-transition and Done logic to that one.
- **Controlled vocabularies / ROR cache** — support machinery behind keywords, interests, and affiliations; referenced from the metadata/contributors/interests features, not a feature of its own.

## Ambiguous seams / open questions
- **review-forms placement** — I put it in Settings > Workflow (where a manager builds it); round-1 had it in Editorial workflow (where a reviewer fills it). It genuinely spans both; a maintainer may prefer it beside reviewer-review-workspace.
- **Publication tab-set vs Workflow page** — I treat the Publication record (11 tab-features) as its own area, but in the live UI it is a tab *inside* the workflow page. If specs prefer the physical nesting, these could be sub-features of workflow.
- **Cross-surface merges** (announcements, categories, public-comments, sections, issues) — each is one feature spanning a manager CRUD screen and a reader page. If QA tests the two ends separately, several of these should split into `*-management` + `*-reader` pairs.
- **Media files vs galleys vs submission-files** — three adjacent file panels with overlapping grid handlers (LibraryFile*, SubmissionFile*, Galley). Boundaries drawn by UI panel, but the backing grids blur.
- **DOI split** — I split `doi-configuration` (settings) from `doi-assignment-and-deposit` (management page + agencies + peer-review DOI). Could be one feature; round-1 kept `doi-management` + `crossref-deposit` separate too.
- **Institutions** — placed under commerce (subscriptions) but equally serves usage statistics; either area is defensible.
- **Reviewer-facing surfaces** — kept inside the Editorial-workflow area, though the reviewer's logged-in experience is arguably its own navigation zone (a separate mini-app). Could be lifted into its own area.
- **Highlights** — homepage carousel: configured under `website-appearance`, rendered under `journal-homepage`; the CRUD/render seam is thin.

## Coverage note (the pile)
- **OMP/monograph-only Vue surfaces** — ChapterManager, PublicationFormatManager, RepresentativeManager, CatalogListPanel, WorkflowPageOMP/OPS, DoiListPanelOMP/OPS: present in the shared lib but not wired into OJS's WorkflowPageOJS map. Not placed (out of OJS scope).
- **Suspected-dead legacy grids** — the 8 grids the atlas liveness audit flagged (PubIdExport* lists, ProductionReadyFiles/WorkflowReviewRevisions/SelectableLibraryFile/EditorSubmissionDetailsFiles, AuthorGridHandler) are superseded by Vue managers; recorded as dead-code candidates, not features.
- **Internal-state tables** — tombstones, filters/filter_groups, controlled_vocab*, versions, review_round_settings, ~15 metrics/usage_stats temporary tables: background machinery with no dedicated screen; not their own features (referenced from stats, search, metadata where relevant).
- **Citation-enrichment jobs** — Crossref/OpenAlex/ORCID/ExtractPids citation-lookup jobs back the References editor's metadata-lookup button; noted under `publication-metadata-references` but their pipeline is otherwise unsurfaced.
- **Locale key-space (242 prefixes)** — i18n of already-mapped features, not features themselves.
- **PFL (Publication Facts Label) & pluginTemplate** — non-stock/bundled plugins; PFL noted under article-landing, pluginTemplate under plugin-management.
