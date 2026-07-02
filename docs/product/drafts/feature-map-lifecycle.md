# Feature map — strategy: editorial lifecycle / actor workflow
- Feature count: 98

<!--
Lens: follow one submission from author intake to publication and beyond, and give
each actor's recurring job its own feature. Phases below are ordered along that spine;
the actor whose job it is is named in each scope line. Cross-cutting machinery
(decision engine, notifications, files, event log, the stage state machine) is factored
into shared features that the phase features lean on — see "Cross-cutting concerns".
Atom coverage is expressed as atlas prefixes / hint-column names / rough counts, not an
exhaustive claim list (that is the spec-wave job); a "~" count is an estimate.
-->

## Phase 0 — Actor onboarding & identity
*(any person before they touch a submission: reader, author, reviewer, editor)*

### public-registration-and-login — a visitor creates an account, signs in, signs out
atoms: PAGE-user-register/registeruser/activateuser, PAGE-login-index/signin/signout; DB-users, DB-sessions; MAIL account-registration/validation; LOC-user.*, LOC-common.login
notes: role self-selection + consent at registration; failed-login handling; account activation email.

### password-recovery-and-change — a user resets a forgotten password or is forced to change it
atoms: PAGE-login-lostpassword/requestresetpassword/resetpassword/updateresetpassword/changepassword/savepassword; MAIL password-reset/-notify
notes: lost-password email loop, forced change on first login, self-service change lives in profile.

### user-profile-and-preferences — a user edits identity, contact, public bio, reviewing interests, API key
atoms: PAGE-user-profile, PAGE-user-index; GRID-*-user-profile-tab-handler; API-user-*, API-interest-*, API-vocab-*; DB-user_settings, DB-user_interests, DB-controlled_vocabs*; per-user notification opt-outs (see notifications feature)
notes: reviewer expertise keywords and per-journal notification toggles are set here; API-key generation for REST.

### user-invitations-and-role-acceptance — a manager invites someone to a role; the invitee accepts or declines
atoms: PAGE-invitation-accept/decline/confirmdecline/create/edit; API-invitation-* (11); DB-invitations; VUE AcceptInvitationPage
notes: invite brand-new users or existing users; tokenized accept links; role granted on acceptance.

## Phase 1 — Author intake (the submission wizard)
*(author job: get a manuscript into the system)*

### submission-wizard-start-and-files — author starts a submission and uploads manuscript files with genres
atoms: PAGE-submission-index/saved/wizard/cancelled; API-submission (subset: create, files); DB-submissions, DB-submission_files, DB-genres, DB-temporary_files; LOC-submission.*
notes: section pick + start; per-file genre assignment; drives the rest of the wizard.

### submission-wizard-metadata — author fills For-the-Editors metadata (keywords, subjects, disciplines, coverage, citations, data availability, type)
atoms: API-submission publication-metadata; DB-submission_settings, DB-citations, DB-controlled_vocab*; forms-schemas submission/publication metadata; LOC-manager.setup.metadata
notes: request-vs-require modes per field, configured in submission-settings.

### submission-wizard-contributors — author adds co-authors, ordering, primary contact, affiliations during intake
atoms: API-contributor-* (6); DB-authors, DB-author_affiliations, DB-author_settings, DB-contributor_roles, DB-credit_roles; VUE ContributorManager
notes: CRediT roles + ROR affiliations captured here; same manager reused on the publication tab later.

### submission-wizard-confirm-and-submit — author consents, adds comments for the editor, and completes the submission
atoms: submission-wizard-validation hints; checklist/copyright/privacy consent forms; MAIL submission-acknowledgement; auto cover-note discussion trigger (owned by tasks-and-discussions)
notes: per-step validation, section rules (inactive/editor-restricted), acknowledgement email, first stage_id write.

### multilingual-submission-and-locale — author submits in multiple languages and can change section/locale mid-wizard
atoms: submission-wizard-language hints; locale picker; reconfigure modal; LOC-locale, DB-*_settings locale rows
notes: which locales are offered comes from languages-and-locales; per-field multilingual entry.

### submission-drafts-and-incomplete-list — author saves a partial submission, resumes, or deletes it
atoms: submission-drafts hints; DB-submissions (incomplete state); dashboard incomplete list
notes: save-for-later and resume; incomplete submissions surfaced on the author dashboard.

### author-reviewer-suggestions — author proposes reviewers the editor may consider
atoms: DB-reviewer_suggestions, DB-reviewer_suggestion_settings; SubmissionBuilder reviewerSuggestions passthrough; VUE ReviewerSuggestionManager
notes: suggestions surfaced to the editor at reviewer-assignment time.

### author-dashboard-and-tracking — author watches their own submissions' status and stage across the lifecycle
atoms: PAGE-authordashboard-submission/readsubmissionemail; PAGE-dashboard-mysubmissions; PAGE-submissions-index
notes: read-only stage/status view; notification-email read marking; entry point back into any stage the author participates in.

## Phase 2 — Editorial triage & assignment
*(editor/manager job: route an incoming submission)*

### editorial-dashboards-and-search — editors/managers browse, filter and search submissions by stage and assignment
atoms: PAGE-dashboard-index/editorial/reviewassignments; PAGE-submissions-index; API-submission getMany/filters; VUE WorkflowPage/Dashboard
notes: active / needs-editor / archived / my-assigned views per role; reviewer's-assignments view for reviewers.

### manage-stage-participants-and-editors — an editor assigns/removes editors, section editors and assistants on a submission stage
atoms: GRID-*-stage-participant-grid-handler; DB-stage_assignments, DB-subeditor_submission_group; AUTHZ stage-access policies; API-submission participants
notes: assign-editor and add/remove participants are the same job; role-based access effects and assistant scoping; assignment removal prunes tasks/discussions participants.

## Phase 3 — Peer review
*(reviewer + editor jobs across one or more review rounds)*

### send-submission-to-review — an editor moves a submission from intake into a review round (or skips review)
atoms: decision types SendExternalReview, SkipExternalReview, (InternalReview/OMP N/A); PAGE-workflow-externalreview; DB-review_rounds (first round)
notes: uses record-editorial-decision engine; creates review round 1; skip-review shortcuts to copyediting.

### assign-and-manage-reviewers — an editor invites reviewers, sets due dates/anonymity/type, and later unassigns, resends, reinstates or thanks them
atoms: API-reviewer-* (11), API-review-* (10); GRID-*-reviewer-grid; DB-review_assignments, DB-review_assignment_settings; MAIL reviewer-request/reinstate/thank/unassign
notes: reviewer search picks up author suggestions; per-assignment anonymity mode and reviewer type (blind/open); cancel/resend/reinstate lifecycle.

### reviewer-invitation-response — a reviewer accepts or declines a review request and gets one-click access
atoms: PAGE-reviewer-showdeclinereview/savedeclinereview; PAGE-reviewer-submission; MAIL reviewer-response; one-click access token
notes: accept opens the review; decline records reason and frees the slot.

### reviewer-completes-review — a reviewer reads files, records a recommendation, writes comments and uploads attachments
atoms: PAGE-reviewer-step/savestep/submission; DB-review_files; review recommendation enum; GRID review-files grids
notes: multi-step review wizard; competing-interests statement; recommendation feeds the editor's decision.

### review-forms — a manager builds a structured review form; a reviewer fills it; the editor reads responses
atoms: GRID-*-review-forms-review-form-grid/element grids; DB-review_forms, DB-review_form_elements, DB-review_form_responses, DB-review_form_settings; LOC-manager.reviewForms
notes: form CRUD in settings + per-round form assignment + reviewer completion; e2e reviewForms processor.

### review-anonymity-modes — the double-anonymous / anonymous / open modes govern what reviewer and author can see
atoms: review-anonymity hints; SUBMISSION_REVIEW_METHOD constants; participant blinding rules (shared with tasks-and-discussions anonymity)
notes: cross-cuts reviewer assignment, discussions, and author-facing views; per-assignment override of journal default.

### manage-review-rounds — an editor opens a new review round or cancels the current one, and reviews round history
atoms: decision types NewExternalReviewRound, CancelReviewRound; DB-review_rounds, DB-review_round_settings, DB-review_round_files; round-history modal
notes: round status indicators; cancel returns the round; history modal shares the event-log feature.

### request-revisions-and-resubmit — an editor requests author revisions; the author uploads them and responds; the editor decides again
atoms: decision types RequestRevisions (PENDING_REVISIONS), Resubmit; DB-review_round_files, DB-review_round_author_responses/*_authors/*_settings; MAIL revisions-request
notes: revisions-in-same-round vs resubmit-for-new-round; author response text captured; loops back into the review round.

### recommend-only-recommendations — a recommend-only section editor records a recommendation the deciding editor then acts on
atoms: decision types RecommendAccept/RecommendDecline/RecommendResubmit/RecommendRevisions; recommend-only-editors hints; MAIL recommendation-notify
notes: recommendation is advisory — it records but does not transition the stage.

## Phase 4 — Editorial decisions (shared decision machinery + the Done stage)
*(the decision engine every phase above leans on, plus stage transitions and the terminal stage)*

### record-editorial-decision — the engine that records any decision: comments, notify-author email, attached files, event-log entry, side effects
atoms: PAGE-decision-record; DecisionType framework + Steps/steps; DB-edit_decisions; EVLOG decision events; MAIL editor-decision family; decision/maps
notes: **boldest call** — one shared feature owns the record-decision UI, the email/files/comments steps and the side-effect runner; every specific decision type (below and in phases 3–5) is a variant that plugs into it. Keeps the ~35 Decision constants from fragmenting.

### accept-or-decline-submission — accept, decline (initial or post-review), and revert those decisions
atoms: decision types Accept, Decline, InitialDecline, RevertDecline, RevertInitialDecline; DB-edit_decisions
notes: initial-decline (stage 1, no review) vs post-review decline; revert restores prior state; delete/archive at stage 1.

### advance-through-workflow-stages — send-to-production and back-from-copyediting/production stage transitions
atoms: decision types SendToProduction, BackFromCopyediting, BackFromProduction; PAGE-workflow-* stage routing; submissions.stage_id
notes: the forward/backward moves between copyediting and production; hands off to those stage features.

### move-submission-to-done — a submission enters (or leaves) the terminal Done stage on first/last publication
atoms: decision types MoveToDone(33)/ReturnToDone(35)/ReturnToWorkflow(34); WORKFLOW_STAGE_ID_DONE=6; observer ApplyDoneWorkflowStage; upgrade I12799_MovePublishedSubmissionsToDone
notes: **new 3.6 feature, no atlas modality** — auto-recorded on PublicationPublished/Unpublished; RETURN_TO_WORKFLOW pulls a submission back into the active workflow; backfill migration moved already-published submissions to Done.

## Phase 5 — Copyediting
*(copyeditor + editor job)*

### copyediting-stage — assign a copyeditor, exchange copyedited files, get author sign-off, send to production
atoms: PAGE-workflow-editorial; GRID copyediting file grids; copyediting-stage hints; MAIL copyedit-request/author-review
notes: copyediting status notices (assign copyeditor / awaiting copyedits) shared with the notification recompute path.

## Phase 6 — Production, galleys & files
*(layout editor + production job; plus the file substrate used everywhere)*

### production-stage — assign production/layout staff, manage production-ready files, hand off to scheduling
atoms: PAGE-workflow-production; production-stage hints; GRID production file grids; MAIL layout-request
notes: production status notices (assign production user / awaiting representations).

### galley-management — create, edit, order and delete article galleys (uploaded file or remote URL)
atoms: API-submission galleys; DB-publication_galleys, DB-publication_galley_settings; galleys hints; VUE galley managers; galley viewer plugins (pdfJsViewer/htmlArticleGalley/lensGalley) at render
notes: labels, ordering, file-vs-remote; e2e galleys processor.

### jats-and-body-text-fulltext — editors maintain a JATS XML full text and an inline HTML body, importing from Word via Pandoc
atoms: API-jats-* (5), API-body-* (3); VUE-pandoc-converter, WorkflowPublicationBodyText; jatsTemplate plugin
notes: **Pandoc importer placed here** — pandoc-wasm converts Word/rich-text into the body-text editor; JATS visibility/public-download; galley-less full text.

### submission-files-management — per-stage file upload, revisions, downloads across the whole workflow
atoms: GRID-*-files-* (many); DB-submission_files, DB-submission_file_revisions, DB-submission_file_settings, DB-files; API-submission files; PAGE-article-download
notes: file substrate for review/copyedit/production; non-ASCII filenames, revisions, per-stage visibility.

### media-and-dependent-files — media section (batch upload, web/high-res variants) and dependent files bound to galleys
atoms: API-media-* (6); DB-variant_groups; PAGE-libraryfiles-downloadpublic/downloadlibraryfile; media-files hints; VUE MediaFileManager
notes: variant-group linking; author read-only view; dependent (e.g. image) files attached to a galley.

## Phase 7 — Publication metadata & versioning
*(editor job: prepare the version of record)*

### publish-and-schedule-publication — publish, unpublish, schedule and republish a publication with precondition checks
atoms: publication-publish-flow hints; GRID-*-modals-publish-publish-handler; API-submission publish; DB-publications (status); front-end visibility flip
notes: preconditions gate publish; scheduling into a future issue; triggers Done stage + DOI assignment side effects.

### publication-versioning — create a new version of a published article, edit it, and view version history
atoms: publication-versioning spec; DB-publications (version columns); API-submission publications; language-change rules across versions
notes: section-editor-can-publish-via-API deviation lives here; version history modal.

### contributors-and-affiliations — manage contributors, ordering, primary contact and affiliations on the publication
atoms: API-contributor-* (shared with wizard); DB-authors, DB-author_affiliations, DB-credit_contributor_roles, DB-rors, DB-ror_settings; credit plugin
notes: same ContributorManager as intake, now on the publication tabs; ROR org lookup.

### publication-identifiers-and-license — set DOIs/URN, license, copyright, permissions and references on a publication
atoms: publication-identifiers-license hints; DB-dois, DB-doi_settings; DB-publication_settings (license/copyright); URN pubId plugin; DB-citations references tab
notes: identifiers tab + license/permissions overrides + references list; per-locale title/abstract.

### publication-metadata-and-categories — an editor edits publication metadata and assigns categories before publishing
atoms: editor-metadata-editing hints; DB-publication_categories, DB-categories; API-category-* (5); author-edit-published permission gate
notes: keywords/subjects/disciplines editable post-intake; category assignment; edit-published gate for authors.

### publication-amendments-and-summary-of-changes — author submits post-publication revisions; editor inserts them as a versioned update with a change summary
atoms: publication-amendments hints; DB-review_round_author_responses (reuse); update-type + Summary-of-Changes; versioned update types (new 3.6)
notes: bridges post-publication back into versioning; author revision + editor insertion.

## Phase 8 — Issues & scheduling
*(editor/manager job: assemble and release issues)*

### issue-management — create, edit, order, cover, publish/unpublish and delete issues
atoms: PAGE-manageissues-index; API-issue-* (4); DB-issues, DB-issue_settings, DB-custom_issue_orders, DB-issue_files; issue-management hints
notes: TOC ordering, cover upload, current-issue flag, back/future lists, publish-issue reader notification.

### issue-scheduling-and-assignment — assign an article to an issue and schedule it to publish with that issue
atoms: issue-assignment-scheduling hints; publication↔issue link; schedule-into-future-issue
notes: bridges publish-flow and issue-management; publishes with the issue.

### issue-galleys-and-cover — manage issue-level galley files and cover images
atoms: DB-issue_galleys, DB-issue_galley_settings; PAGE-issue-download; PAGE-catalog-fullsize/thumbnail
notes: whole-issue PDF/galley; cover thumbnails on catalog pages.

## Phase 9 — Distribution, indexing & identifiers
*(post-publication reach: registries, harvesters, indexers)*

### doi-assignment-and-management — configure DOI prefix/pattern/auto-assign and manage DOI status across publications
atoms: PAGE-dois-index; API-doi-* (19), API-backend-doi-*; DB-dois, DB-doi_settings; doi-management hints
notes: assignment on publish, versioned DOIs, management page statuses/filters/bulk actions.

### crossref-datacite-deposit — export/deposit article metadata and DOIs to Crossref or DataCite
atoms: PLUGIN-generic-crossref/datacite/doaj; export XML; deposit-status marking
notes: registration-agency plugins now driven by core DOI settings; no live API in tests.

### peer-review-doi-and-open-reviews — expose open peer reviews as citable objects with their own DOIs
atoms: API-peer-review-* (6, PeerReviewController open-reviews summaries); API-backend-doi-edit-peer-review (PUT /_dois/peerReviews/{reviewId})
notes: **placed here per prompt** — open-review summaries per publication/submission + a DOI assignable to a peer review; newer surface, no e2e plan yet.

### oai-pmh-metadata-formats — serve OAI-PMH harvesting in DC/MARC/MARCXML/JATS formats, with tombstones for withdrawn records
atoms: PAGE-oai-index; PLUGIN-oaiMetadataFormats-dc/marc/marcxml/oaiJats/rfc1807; DB-oai_resumption_tokens, DB-data_object_tombstones*
notes: ListRecords/GetRecord; tombstone records for deleted/withdrawn content; rfc1807 being retired (I12948).

### sitemap-and-web-feeds — publish sitemap.xml and RSS/Atom feeds of recent content and announcements
atoms: PAGE-sitemap-index; PLUGIN-generic-webFeed, PLUGIN-generic-announcementFeed; oai-sitemap-feeds hints
notes: web-feed block + announcement feed; sitemap for crawlers.

### indexing-meta-tags — inject Dublin Core, Google Scholar and DRIVER meta tags into public pages for indexers
atoms: PLUGIN-generic-dublinCoreMeta/googleScholar/driver; PLUGIN-metadata-dc11; PLUGIN-generic-googleAnalytics (tracking)
notes: head meta tags on article/issue pages; Google Analytics tracking code folded in as a page-injection plugin.

### orcid-integration — connect and verify author ORCID iDs and prefill from ORCID
atoms: PAGE-orcid-verify/authorizeorcid/about/updatescope; API-orcid-* (2); orcid hints; MAIL orcid-request
notes: OAuth verify callback, verified/unverified badge, registration prefill, request email.

## Phase 10 — Reader front end
*(reader job: find, read, cite and discuss published content)*

### journal-homepage-and-blocks — the journal home page with current issue, sidebar blocks and announcements
atoms: PAGE-index-index; PLUGIN-blocks-browse/information/makeSubmission/developedBy/languageToggle; DB-journals; journal-homepage hints
notes: sidebar block set + current-issue display + announcements block.

### article-landing-and-galley-view — the article abstract page with metadata, galley view/download, license and meta tags
atoms: PAGE-article-view/download/viewfile/downloadsuppfile; article-landing hints; DC meta tags; multilingual rendering
notes: galley viewer smoke (pdf.js); license display; how-to-cite and recommendations blocks attach here.

### issue-archive-and-toc — reader browses the back-issue archive and an issue's table of contents
atoms: PAGE-issue-index/current/archive/view; issue-archive-toc hints
notes: section grouping in TOC; archive listing.

### site-search — reader searches articles with filters and sees no-result handling
atoms: PAGE-search-index/search; DB-submissions_fulltext; site-search hints
notes: full-text index; filters; front-end query.

### browse-by-category-and-section — reader browses catalog pages by category or section
atoms: PAGE-catalog-category; browse-category-section hints; section/category policies display; PLUGIN-blocks-browse
notes: category browse pages; section policy display.

### reader-comments — readers post comments on articles; managers moderate/approve/report them
atoms: API-comment-* (11); DB-user_comments, DB-user_comment_settings, DB-user_comment_reports; PAGE-management-settings-usercomments; public-comments hints
notes: post/approve/moderate; anonymous-comment gating; abuse reports.

### how-to-cite-and-citation-export — reader sees a formatted citation and downloads it (BibTeX/RIS/etc.)
atoms: PLUGIN-generic-citationStyleLanguage; API-citation-* (5); citation-style-language hints
notes: CSL styles offered + primary style; how-to-cite block; downloadable formats.

### article-recommendations — reader sees related articles (same author / similar keywords)
atoms: PLUGIN-generic-recommendByAuthor/recommendBySimilarity
notes: recommendation blocks on the article page; round-2 backlog plugins.

### public-information-pages — the static/about/contact/masthead/privacy and custom static pages readers browse
atoms: PAGE-about-index/contact/submissions/privacy/aboutthispublishingsystem; PAGE-information-*; PAGE-about-editorialmasthead/editorialhistory; PLUGIN-generic-staticPages; public-pages hints
notes: masthead public page fed by editorial-masthead-configuration; static-pages plugin for custom pages.

### announcements — managers publish announcements; readers view them on a listing and detail page
atoms: PAGE-announcement-index/view; PAGE-management-settings-announcements; API-announcement-* (5); DB-announcements, DB-announcement_types, DB-announcement_settings
notes: CRUD + expiry + enable toggle; reader page + sitemap + feed.

## Phase 11 — Access model (subscriptions & payments)
*(reader/subscriber access + manager billing config; OJS-specific)*

### subscription-types-and-policies — a manager defines subscription types and journal subscription policies
atoms: PAGE-payments-subscriptiontypes/subscriptionpolicies/savesubscriptionpolicies; DB-subscription_types, DB-subscription_type_settings; subscriptions-management hints
notes: type CRUD + policy text + publishing mode (open vs subscription).

### subscriptions-management — a manager/subscription-manager creates and tracks individual and institutional subscriptions
atoms: PAGE-payments-subscriptions; DB-subscriptions, DB-institutional_subscriptions; PLUGIN-reports-subscriptions
notes: individual + institutional subscription records; subscription CSV report.

### subscription-access-enforcement — the gate deciding who can read restricted content (subscriber, editor bypass, delayed open access)
atoms: PAGE-about-subscriptions, PAGE-user-subscriptions; subscription-access hints; PLUGIN-blocks-subscription; delayed-open-access rule
notes: anonymous vs subscriber vs editor bypass; embargo/delayed-OA flip.

### payments-and-fees — enable payments, record manual payments, configure PayPal/manual methods, track the payments grid
atoms: PAGE-payment-plugin/pay, PAGE-payments-index/paymenttypes/savepaymenttypes/payments; PLUGIN-paymethod-manual/paypal; DB-completed_payments, DB-queued_payments; PAGE-user-purchase*/pay*/complete* subscription-purchase flow
notes: manual payment record flow + subscription purchase/renew/membership payment paths.

### institutions-management — a manager maintains institutions (IP ranges) backing institutional subscriptions and stats
atoms: PAGE-management-settings-institutions; API-institution-* (5); DB-institutions, DB-institution_ip, DB-institution_settings
notes: institution CRUD + IP ranges; feeds institutional subscriptions and geo/institution stats.

## Phase 12 — Cross-cutting collaboration on a submission
*(shared machinery any stage uses; each gets its own home)*

### tasks-and-discussions — per-stage tasks (owner + due date) and threaded discussions, seeded from templates
atoms: full tasks-discussions.md spec claim-set (API-editorial-task-*, API-edit-task-template-*, DB-edit_task*, DB-notes, VUE discussion/task-template managers, MAIL-discussion-*, NOTIF-new-query)
notes: the reference-sized feature; also owns the auto cover-note discussion and task-template settings.

### submission-activity-and-event-log — the per-submission history of every editorial action and round
atoms: DB-event_log, DB-event_log_settings; EVLOG-* (36 submission/file events); activity-log hints; GRID information-center handlers
notes: event log rendered in activity view + item History modals + round history; a substrate, not a screen.

### notifications-inbox-and-preferences — in-app notification bell/inbox, mark read, and per-user opt-outs
atoms: PAGE-notification-fetchnotification/unsubscribe; NOTIF-* (65 types); DB-notifications, DB-notification_settings, DB-notification_subscription_settings; GRID notifications grids
notes: the shared notification framework each feature fires into; tokenized email unsubscribe.

### email-communication-and-log — real email sends with variable rendering and the per-submission email log
atoms: API-email-* (9), API-mailable-* (2); DB-email_log, DB-email_log_users; MAIL-* (69 mailables); notify-composer with attachments
notes: template-variable rendering at send; per-submission email log; notify-composer UI.

### email-templates-management — a manager edits, adds, resets and scopes email templates
atoms: PAGE-management-settings-manageemails; DB-email_templates, DB-email_templates_default_data, DB-email_templates_settings, DB-email_template_user_group_access; email-templates-management hints
notes: edited template text is used by email-communication sends; per-role template access.

## Phase 13 — Journal configuration (manager setup)
*(manager job: configure the journal — not lifecycle, but essential coverage)*

### journal-masthead-and-contact-setup — masthead, contact and core context settings that surface publicly
atoms: PAGE-management-settings-context; DB-journal_settings, DB-journals; journal-setup hints; forms-schemas context
notes: name/contact/about persist and appear on public pages.

### website-appearance-and-theme — theme options, logo, homepage image, date/time formats, custom sidebar blocks
atoms: PAGE-management-settings-website; PLUGIN-themes-default; PLUGIN-generic-customBlockManager; website-appearance hints
notes: theme option form + logo/image uploads + custom block manager.

### navigation-menus — CRUD navigation menus and custom items, assign to areas, render on the front end
atoms: PAGE-navigationmenu-index/view/preview; API-navigation-* (5); DB-navigation_menus, DB-navigation_menu_items*, DB-navigation_menu_item_assignments*; GRID navigation-menus grids
notes: primary/user menus + custom menu-item pages.

### sections-configuration — journal sections: CRUD, ordering, editor restrictions, inactivation
atoms: API-section-* (2); DB-sections, DB-section_settings, DB-custom_section_orders; sections hints
notes: wizard + front-end effects (inactive/editor-restricted sections).

### categories-configuration — journal categories incl. nesting and front-end browse hook
atoms: API-category-* (5, shared w/ publication metadata); DB-categories, DB-category_settings; categories hints
notes: nested categories; wizard exposure; browse page hook.

### submission-settings-and-genres — checklist, author guidelines, file components/genres, metadata request/require toggles
atoms: PAGE-management-settings-workflow; GRID-*-genre-grid; DB-genres, DB-genre_settings; API-genre-* (2); submission-settings hints
notes: configures the intake wizard's rules; metadata toggles drive submission-wizard-metadata.

### review-settings-and-reminders — default review mode, deadlines, reviewer guidance and reminder configuration
atoms: review-settings hints; forms-schemas review settings; reminder thresholds (scheduled-tasks link)
notes: journal defaults inherited by each reviewer assignment; reminder cadence.

### distribution-and-indexing-settings — license defaults, indexing metadata, archiving display, payments/publishing-mode toggles
atoms: PAGE-management-settings-distribution; distribution-settings hints; forms-schemas distribution
notes: license/copyright defaults, LOCKSS/CLOCKSS display, open-vs-subscription switch, enable-payments.

### languages-and-locales — enable locales for UI, forms and submissions and manage multilingual entry
atoms: GRID-*-languages-* / manage-language / submission-language grids; API-context locales; languages-locales hints; PLUGIN-blocks-languageToggle
notes: which locales the wizard and forms offer; language toggle block.

### editorial-masthead-configuration — configure the editorial team shown on the public masthead, with reviewer display opt-in
atoms: editorial-masthead hints; masthead role ordering; PAGE-about-editorialmasthead (render side)
notes: manager arranges masthead roles; reviewers opt in to be listed.

### highlights-featured-content — a manager curates featured highlights shown on the journal/site homepage
atoms: API-highlight-* (6); DB-highlights, DB-highlight_settings
notes: ordered featured-content items; no e2e plan yet (orphaned in atlas).

## Phase 14 — Users, roles & site access
*(manager/admin job: govern who can do what)*

### user-account-management — a manager searches, creates, edits, disables, merges users and emails them
atoms: PAGE-management-settings-user; API-user-* ; DB-users, DB-user_user_groups; user-management hints; merge-users
notes: CRUD + role add/remove + disable/enable + merge + email user.

### roles-and-permissions — the role/user-group grid, custom role creation, stage assignment effects and settings-URL gates
atoms: PAGE-management-settings-access, PAGE-management-permissions/resetpermissions; GRID-*-roles-user-group-grid; DB-user_groups, DB-user_group_stage; AUTHZ policies (90); roles-permissions hints
notes: custom roles; which stages a group touches; the settings-access gates enforced everywhere.

### login-as-impersonation — an admin logs in as another user and returns to their own session
atoms: PAGE-login-signinasuser/signoutasuser; PAGE-admin-confirmaccess/confirmaccesssubmit; login-as hints; DB-sessions
notes: confirm step + return-to-self.

### site-access-restrictions — site-level login wall, disabled registration, and disabled-journal visibility
atoms: site-access-restrictions hints; restrictSiteAccess/disableUserReg/restrictArticleAccess toggles; PAGE-management-access
notes: config toggles that gate the whole reader/registration surface.

## Phase 15 — Site administration & platform
*(admin/system job: run the installation)*

### site-administration-and-hosted-journals — the admin creates/edits hosted journals and navigates multiple contexts
atoms: PAGE-admin-index/contexts/wizard/systeminfo/phpinfo; API-context-* (8); site-administration hints; forms-schemas context
notes: hosted-journal CRUD + create-context wizard + multi-context user nav + system info.

### site-settings — site-wide setup, languages and site-level appearance
atoms: PAGE-admin-settings, PAGE-management-index/settings; PAGE-management-settings-context (site); DB-site, DB-site_settings; site-settings hints
notes: the site tier above journal configuration.

### system-maintenance-and-caches — the admin clears caches, expires sessions and reads diagnostics
atoms: PAGE-admin-expiresessions/cleartemplatecache/cleardatacache; PAGE-management-tools; PAGE-install-* smoke
notes: maintenance ops; installer/upgrade smoke (test-infrastructure).

### jobs-queue — the admin monitors the background job queue and requeues failed jobs
atoms: PAGE-admin-jobs/failedjobs/failedjobdetails; API-job-* (5); DB-jobs, DB-job_batches, DB-failed_jobs; jobs-queue hints
notes: jobs page + failed-jobs + requeue; 42 job classes behind it.

### scheduled-tasks-and-reminders — scheduled tasks run review/editorial reminders and housekeeping; admin reads task logs
atoms: PAGE-admin-downloadscheduledtasklogfile/clearscheduledtasklogfiles; jobs-tasks (16 tasks); MAIL review-reminder/editorial-reminder; scheduled-tasks hints
notes: reminder emails + task-log files; reminder thresholds set in review-settings.

### plugin-management — the plugins grid: enable/disable and configure plugins at site or journal scope
atoms: PAGE-gateway-plugin; GRID-*-plugins-plugin-gallery-grid; DB-plugin_settings; PLUGIN-generic-pluginTemplate; plugin-management hints
notes: the shared surface all plugin features are toggled from; gallery install.

### native-xml-import-export — round-trip submissions and issues through native OJS XML
atoms: PAGE-management-importexport; PLUGIN-importexport-native (+ lib base); native-xml-import-export hints
notes: submission + issue export/import round-trips.

### user-import-export — bulk import/export user accounts via XML
atoms: PLUGIN-importexport-users (+ lib base); user-management hints
notes: bulk user XML round-trip.

### pubmed-export — export article metadata as PubMed/MEDLINE XML
atoms: PLUGIN-importexport-pubmed; native-xml-import-export hints
notes: **placed here per prompt** — PubMed/MEDLINE metadata export with its own settings form.

### rest-api-and-authentication — token/session auth and the public REST surface with permission rejections
atoms: API-backend-* (14), API-site-* (4), API-temporary/upload; AUTHZ middleware; api-smoke hints; DB-user_settings api_key
notes: cross-cutting API layer that all the API-* atoms ride on; token auth + rejection behavior.

## Phase 16 — Statistics & reporting
*(manager/admin job: measure usage)*

### usage-statistics-dashboards — publication, editorial, user and context usage stats pages with date filters and CSV
atoms: PAGE-stats-issues/editorial/publications/context/users/reports; API-stats-* (28); DB-metrics_* (~15); PLUGIN-generic-usageEvent; usage-statistics hints
notes: render + date filter + CSV; minimal metrics seed; usage-event generation plugin behind it.

### counter-r5-and-sushi — COUNTER R5 reports and the counter report plugin
atoms: PAGE-stats-counterr5; PLUGIN-reports-counter; DB-metrics_counter_* tables
notes: COUNTER usage reporting; round-2 backlog for SUSHI.

### csv-reports — pluggable CSV reports (articles, review activity, subscriptions)
atoms: PLUGIN-reports-articles/reviewReport/subscriptions; DB-event_log (review report source)
notes: article metadata, peer-review activity, and subscription CSV exports.

### publisher-library-documents — a manager stores reusable journal-level documents (marketing, permissions, etc.)
atoms: GRID-*-library-library-file-admin-grid / document-library-handler; DB-library_files, DB-library_file_settings; API-library
notes: the journal document library, distinct from per-submission media; small feature.

## Cross-cutting concerns

- **Editorial-decision engine** — factored as `record-editorial-decision` (Phase 4): one feature owns the record-decision UI, comment/email/attached-file steps, event-log write and side-effect runner; each specific Decision constant (~35) is documented as a variant inside the phase feature where the actor triggers it (send-to-review, accept/decline, revisions, stage transitions, recommend-only, Done). This prevents ~35 near-identical decision atoms from becoming 35 features and keeps the OMP-only `*_INTERNAL` constants parked (out of OJS scope).
- **Workflow-stage state machine** — the `submissions.stage_id` progression and `WORKFLOW_STAGE_ID_DONE` are surfaced through the decision features (they *are* the transitions); the terminal Done stage and its auto-recording observer get their own feature (`move-submission-to-done`) because they're a genuinely new job, not just a transition.
- **Notifications / email / event log / files** — each is a distinct cross-cutting feature in Phase 12 (notifications-inbox, email-communication, submission-activity-log, submission-files-management). Phase features reference them rather than re-owning them; e.g. every decision fires notifications and logs an event, but those mechanics live once in Phase 12.
- **Permissions / authorization** — the 90 AUTHZ atoms are owned by `roles-and-permissions` as the policy framework; individual features cite the specific policy that gates them (as tasks-discussions does) without re-owning the framework. The recurring site-admin-scope carve-out bug is a single canonical note there.
- **Contributor & category managers** — reused by both intake (Phase 1) and publication (Phase 7); the CRUD feature is documented once (contributors-and-affiliations, categories-configuration) and referenced from the wizard features.
- **Plugin substrate** — `plugin-management` owns the enable/disable/settings grid; each substantive plugin that is a user-facing job (CSL, ORCID, Crossref/DataCite, viewers, feeds, importers) is its own feature, while thin meta-tag/tracking plugins are grouped into `indexing-meta-tags`.

## Ambiguous seams / open questions

- **Decision granularity**: I split decisions by *lifecycle phase where the actor meets them* rather than one-decision-per-feature or one giant "decisions" feature. The seam between `advance-through-workflow-stages` (SendToProduction/BackFrom*) and the copyediting/production stage features is soft — the transition could live in either. I put the *transition* with decisions and the *stage work* with the stage.
- **Revisions vs amendments**: `request-revisions-and-resubmit` (pre-publication review loop) and `publication-amendments-and-summary-of-changes` (post-publication) both use `review_round_author_responses`; they could merge into one "author revisions" feature, but the actor context (in-review vs published) differs enough to keep them apart.
- **Reviewer anonymity** as its own feature vs an attribute of assignment/discussions: kept separate because it cross-cuts three features, but a case exists for folding it into `assign-and-manage-reviewers`.
- **JATS/body-text vs galleys**: JATS XML can be both a galley and a metadata artifact; I gave full-text (JATS + Pandoc body) its own feature and left file-based galleys in `galley-management` — the boundary between "a JATS galley" and "the JATS full text" is genuinely fuzzy in 3.6.
- **peer-review-doi-and-open-reviews**: unclear whether "open reviews" is a distribution feature (my placement) or an extension of the review phase; the DOI angle drove Phase 9 placement.
- **Google Analytics** folded into `indexing-meta-tags` (both inject head markup) though it's tracking, not indexing — could instead sit with usage-statistics.
- **subscription-purchase payment paths** (`PAGE-user-purchase*`) straddle `payments-and-fees` and `subscription-access-enforcement`; I put the payment flow with payments and the gate with access.

## Coverage note

- **Fully placed**: all PAGE atoms (incl. dead-op oddities noted in the atlas — not features), all DB entities incl. the Done-stage gap, the ~285 API atoms by prefix, all 51+ plugin atoms, and the called-out specials (Done stage → move-submission-to-done; peer-review DOI → peer-review-doi-and-open-reviews; Pandoc importer → jats-and-body-text-fulltext).
- **Deliberately parked / not features**:
  - OMP/OPS-only decision constants (`*_INTERNAL`, RECOMMEND_EXTERNAL_REVIEW, SKIP_INTERNAL_REVIEW, NEW_INTERNAL_ROUND, CANCEL_INTERNAL_REVIEW_ROUND) — out of OJS scope.
  - Dead/unreachable page ops (authorDashboard::reviewRoundInfo, search::similarDocuments, manageIssues::issuesTabs, dois::management, reviewer::downloadFile, management::statistics, pages/manager legacy router) — dead-code candidates, not features.
  - `plugins/gateways/` (empty), `pflPlugin` (non-stock third-party), `pluginTemplate` (starter template) — folded into plugin-management as substrate, not user features.
- **Thinly covered clusters that may deserve promotion in spec waves**:
  - Metrics/stats temporary-record + geo tables (`usage_stats_*_temporary_records`, `metrics_submission_geo_*`) — the aggregation *pipeline* (log processing → compilation) has no clean feature home; I attach it to `usage-statistics-dashboards` but it's really a background job worth its own feature if the pipeline is in scope.
  - Filters/filter-groups (`DB-filters`, `DB-filter_groups`) — the document-processing/import filter machinery is infrastructure under import/export and OAI; not given its own feature.
  - Tombstones (`DB-data_object_tombstones*`) — attached to `oai-pmh-metadata-formats`; could be a small "withdrawn-content records" feature.
  - `highlights` and `institutions` are lightly-tested orphans in the atlas but are genuine manager features, so each got a feature.
- **Confidence**: the lifecycle spine (Phases 1–8) maps cleanly to atoms; the tail (settings/admin/plugins/stats, Phases 13–16) is where a code-module lens and this actor lens converge, so those features mirror the round-1 inventory more closely by design.
