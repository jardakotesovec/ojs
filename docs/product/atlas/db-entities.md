# Atlas sweep: DB entities
- Scope: classes/migration/install (both repos)
- Method: grep Schema::create + migration filenames
- Date: 2026-07-02
- Atom count: 149

| ID | Surface | Pointer | What it is | Hint | Claimed by |
|----|---------|---------|------------|------|------------|
| DB-author_affiliation_settings | author_affiliation_settings | lib/pkp/classes/migration/install/AffiliationsMigration.php | Settings for author affiliations | affiliations-ror | contributor affiliation FIELD is in contributors.md; storage owned by affiliations-ror |
| DB-author_affiliations | author_affiliations | lib/pkp/classes/migration/install/AffiliationsMigration.php | Author institutional affiliations | affiliations-ror | contributor affiliation FIELD is in contributors.md; storage owned by affiliations-ror |
| DB-announcement_settings | announcement_settings | lib/pkp/classes/migration/install/AnnouncementsMigration.php | Settings for announcements | | announcements (claimed 2026-07-06) |
| DB-announcement_type_settings | announcement_type_settings | lib/pkp/classes/migration/install/AnnouncementsMigration.php | Settings for announcement types | | announcements (claimed 2026-07-06) |
| DB-announcement_types | announcement_types | lib/pkp/classes/migration/install/AnnouncementsMigration.php | Announcement type definitions | | announcements (claimed 2026-07-06) |
| DB-announcements | announcements | lib/pkp/classes/migration/install/AnnouncementsMigration.php | Announcements displayed to users | announcements | announcements (claimed 2026-07-06) |
| DB-categories | categories | lib/pkp/classes/migration/install/CategoriesMigration.php | Publication categories/research areas | browse-category-section | categories (transferred from browse-category-section interim claim 2026-07-06; reader browse references, management owns) |
| DB-category_settings | category_settings | lib/pkp/classes/migration/install/CategoriesMigration.php | Settings for categories | | categories (claimed 2026-07-06) |
| DB-publication_categories | publication_categories | lib/pkp/classes/migration/install/CategoriesMigration.php | Publication-category mappings | | publication-issue-assignment |
| DB-citation_settings | citation_settings | lib/pkp/classes/migration/install/MetadataMigration.php | Settings for citations | | publication-metadata-references |
| DB-citations | citations | lib/pkp/classes/migration/install/MetadataMigration.php | Extracted and formatted citations | | publication-metadata-references |
| DB-data_citation_settings | data_citation_settings | lib/pkp/classes/migration/install/MetadataMigration.php | Settings for data citations | | data-availability-citations |
| DB-data_citations | data_citations | lib/pkp/classes/migration/install/MetadataMigration.php | Data set citations | | data-availability-citations |
| DB-filter_groups | filter_groups | lib/pkp/classes/migration/install/MetadataMigration.php | Filter processing groups | | |
| DB-filter_settings | filter_settings | lib/pkp/classes/migration/install/MetadataMigration.php | Settings for filters | | |
| DB-filters | filters | lib/pkp/classes/migration/install/MetadataMigration.php | Document processing filters | | |
| DB-email_templates | email_templates | lib/pkp/classes/migration/install/CommonMigration.php | Email message templates | email-templates-management | email-templates-management (claimed 2026-07-06) |
| DB-email_templates_default_data | email_templates_default_data | lib/pkp/classes/migration/install/CommonMigration.php | Default template content | | email-templates-management (claimed 2026-07-06) |
| DB-email_templates_settings | email_templates_settings | lib/pkp/classes/migration/install/CommonMigration.php | Settings for templates | | email-templates-management (claimed 2026-07-06) |
| DB-notification_settings | notification_settings | lib/pkp/classes/migration/install/CommonMigration.php | Per-notification-object settings (keyed by notification_id) — delivery-side, NOT the user prefs | | notifications feature (delivery); the profile prefs live in notification_subscription_settings |
| DB-notification_subscription_settings | notification_subscription_settings | lib/pkp/classes/migration/install/CommonMigration.php | Per-user notification preferences: blocked_notification / blocked_emailed_notification (keyed by user_id + context_id) | user-profile | edited by the profile Notifications tab; registration seeds email-consent; notifications feature reads it for delivery |
| DB-notifications | notifications | lib/pkp/classes/migration/install/CommonMigration.php | User notification records | notifications | |
| DB-oai_resumption_tokens | oai_resumption_tokens | lib/pkp/classes/migration/install/CommonMigration.php | OAI-PMH resumption tokens | oai-sitemap-feeds | oai-pmh |
| DB-plugin_settings | plugin_settings | lib/pkp/classes/migration/install/CommonMigration.php | Plugin configuration settings | plugin-management | plugin-management (claimed 2026-07-06 — context row per journal, NULL context = site scope) |
| DB-site | site | lib/pkp/classes/migration/install/CommonMigration.php | Site configuration | site-administration | site-settings (claimed 2026-07-06) — hint said site-administration, but FEATURE-MAP f66 lists DB-site/site_settings; f67 keeps DB-journals |
| DB-site_settings | site_settings | lib/pkp/classes/migration/install/CommonMigration.php | Site-level settings | site-settings | site-settings (claimed 2026-07-06) |
| DB-user_settings | user_settings | lib/pkp/classes/migration/install/CommonMigration.php | User preferences and settings | user-profile | |
| DB-users | users | lib/pkp/classes/migration/install/CommonMigration.php | User accounts (created at self-registration; CRUD/disable/merge in user-management) | registration-login | user-management references it (disable/merge/report mutations); user-profile owns SCHEMA-user — single-owner resolved to the creation point 2026-07-05 |
| DB-versions | versions | lib/pkp/classes/migration/install/CommonMigration.php | System version history | | |
| DB-controlled_vocab_entries | controlled_vocab_entries | lib/pkp/classes/migration/install/ControlledVocabMigration.php | Controlled vocabulary entries | | submission-wizard-metadata |
| DB-controlled_vocab_entry_settings | controlled_vocab_entry_settings | lib/pkp/classes/migration/install/ControlledVocabMigration.php | Vocabulary entry settings | | submission-wizard-metadata |
| DB-controlled_vocabs | controlled_vocabs | lib/pkp/classes/migration/install/ControlledVocabMigration.php | Vocabulary lists | | submission-wizard-metadata |
| DB-user_interests | user_interests | lib/pkp/classes/migration/install/ControlledVocabMigration.php | User interest keywords | user-profile | reviewer-interests field on the profile Roles tab |
| DB-doi_settings | doi_settings | lib/pkp/classes/migration/install/DoiMigration.php | DOI configuration settings | doi-management | |
| DB-dois | dois | lib/pkp/classes/migration/install/DoiMigration.php | Digital object identifiers | doi-management (DOI entity; publication-identifiers references it for read-only display) | |
| DB-email_template_user_group_access | email_template_user_group_access | lib/pkp/classes/migration/install/EmailTemplateUserGroupAccessMigration.php | Template access by role | | email-templates-management (claimed 2026-07-06) |
| DB-failed_jobs | failed_jobs | lib/pkp/classes/migration/install/FailedJobsMigration.php | Failed background job records | jobs-queue | |
| DB-files | files | lib/pkp/classes/migration/install/FilesMigration.php | File storage metadata | | submission-files |
| DB-genre_settings | genre_settings | lib/pkp/classes/migration/install/GenresMigration.php | Settings for submission genres | | workflow-settings |
| DB-genres | genres | lib/pkp/classes/migration/install/GenresMigration.php | File type genres | submission-files | workflow-settings |
| DB-highlight_settings | highlight_settings | lib/pkp/classes/migration/install/HighlightsMigration.php | Settings for highlights | | highlights-featured-content |
| DB-highlights | highlights | lib/pkp/classes/migration/install/HighlightsMigration.php | Featured content highlights | | highlights-featured-content |
| DB-institution_ip | institution_ip | lib/pkp/classes/migration/install/InstitutionsMigration.php | Institution IP ranges | institutions | |
| DB-institution_settings | institution_settings | lib/pkp/classes/migration/install/InstitutionsMigration.php | Institution configuration | | |
| DB-institutions | institutions | lib/pkp/classes/migration/install/InstitutionsMigration.php | Institutional records | institutions | |
| DB-invitations | invitations | lib/pkp/classes/migration/install/InvitationsMigration.php | User invitation tokens | user-invitations | |
| DB-job_batches | job_batches | lib/pkp/classes/migration/install/JobsMigration.php | Job batch groupings | jobs-queue | |
| DB-jobs | jobs | lib/pkp/classes/migration/install/JobsMigration.php | Background job queue | jobs-queue | |
| DB-library_file_settings | library_file_settings | lib/pkp/classes/migration/install/LibraryFilesMigration.php | Library file settings | | document-library |
| DB-library_files | library_files | lib/pkp/classes/migration/install/LibraryFilesMigration.php | Library document collections | | document-library |
| DB-email_log | email_log | lib/pkp/classes/migration/install/LogMigration.php | Email transmission log | email-delivery | |
| DB-email_log_users | email_log_users | lib/pkp/classes/migration/install/LogMigration.php | Email log user recipients | | |
| DB-event_log | event_log | lib/pkp/classes/migration/install/LogMigration.php | Editorial activity log | activity-log | editorial-activity-log |
| DB-event_log_settings | event_log_settings | lib/pkp/classes/migration/install/LogMigration.php | Activity log settings | activity-log | editorial-activity-log |
| DB-navigation_menu_item_assignment_settings | navigation_menu_item_assignment_settings | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Menu item assignment settings | | navigation-menus (claimed 2026-07-06) — per-placement title overrides; read by renderer/editor, no 3.6 writer (spec OQ1) |
| DB-navigation_menu_item_assignments | navigation_menu_item_assignments | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Menu item context assignments | | navigation-menus (claimed 2026-07-06) |
| DB-navigation_menu_item_settings | navigation_menu_item_settings | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Navigation menu item settings | navigation-menus | navigation-menus (claimed 2026-07-06) |
| DB-navigation_menu_items | navigation_menu_items | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Menu item definitions | navigation-menus | navigation-menus (claimed 2026-07-06) |
| DB-navigation_menus | navigation_menus | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Navigation menu structures | navigation-menus | navigation-menus (claimed 2026-07-06) |
| DB-notes | notes | lib/pkp/classes/migration/install/NotesMigration.php | Editor/reviewer notes | | tasks-discussions |
| DB-review_assignment_settings | review_assignment_settings | lib/pkp/classes/migration/install/ReviewAssignmentSettingsMigration.php | Review assignment settings | | assign-and-manage-reviewers |
| DB-reviewer_recommendation_settings | reviewer_recommendation_settings | classes/migration/install/ReviewerRecommendationsMigration.php | Reviewer recommendation settings (multilingual labels of the options) | workflow-settings | workflow-settings |
| DB-reviewer_recommendations | reviewer_recommendations | classes/migration/install/ReviewerRecommendationsMigration.php | Configurable REVIEWER-recommendation options — the vocabulary a reviewer picks at review completion (table comment "selected by reviewer"), stored on review_assignments.reviewer_recommendation_id; a Settings→Workflow config, NOT the recommend-only editor's recommendation and NOT reviewer suggestions | workflow-settings | workflow-settings |
| DB-reviewer_suggestion_settings | reviewer_suggestion_settings | lib/pkp/classes/migration/install/ReviewerSuggestionsMigration.php | Reviewer suggestion settings | | reviewer-suggestions |
| DB-reviewer_suggestions | reviewer_suggestions | lib/pkp/classes/migration/install/ReviewerSuggestionsMigration.php | Suggested reviewers | reviewer-suggestions | reviewer-suggestions |
| DB-review_form_element_settings | review_form_element_settings | lib/pkp/classes/migration/install/ReviewFormsMigration.php | Review form element settings | | review-forms |
| DB-review_form_elements | review_form_elements | lib/pkp/classes/migration/install/ReviewFormsMigration.php | Review form fields | review-forms | review-forms |
| DB-review_form_settings | review_form_settings | lib/pkp/classes/migration/install/ReviewFormsMigration.php | Review form configuration | | review-forms |
| DB-review_forms | review_forms | lib/pkp/classes/migration/install/ReviewFormsMigration.php | Review evaluation forms | review-forms | review-forms |
| DB-review_round_author_response_authors | review_round_author_response_authors | lib/pkp/classes/migration/install/ReviewRoundAuthorResponse.php | Response author mappings | | review-rounds-and-revisions |
| DB-review_round_author_response_settings | review_round_author_response_settings | lib/pkp/classes/migration/install/ReviewRoundAuthorResponse.php | Author response settings | | review-rounds-and-revisions |
| DB-review_round_author_responses | review_round_author_responses | lib/pkp/classes/migration/install/ReviewRoundAuthorResponse.php | Author revision responses | reviewer-response | review-rounds-and-revisions |
| DB-review_round_settings | review_round_settings | lib/pkp/classes/migration/install/ReviewRoundAuthorResponse.php | Review round configuration | | review-rounds-and-revisions |
| DB-review_assignments | review_assignments | lib/pkp/classes/migration/install/ReviewsMigration.php | Review assignments | reviewer-assignment | assign-and-manage-reviewers |
| DB-review_files | review_files | lib/pkp/classes/migration/install/ReviewsMigration.php | Review attachments | | |
| DB-review_form_responses | review_form_responses | lib/pkp/classes/migration/install/ReviewsMigration.php | Reviewer form responses | | |
| DB-review_round_files | review_round_files | lib/pkp/classes/migration/install/ReviewsMigration.php | Review round attachments | | review-rounds-and-revisions |
| DB-review_rounds | review_rounds | lib/pkp/classes/migration/install/ReviewsMigration.php | Review workflow rounds | review-rounds-revisions | review-rounds-and-revisions |
| DB-stage_assignments | stage_assignments | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | User stage role assignments | stage-participants | stage-participants |
| DB-user_group_settings | user_group_settings | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | User group settings | roles-permissions | localized name/abbrev of a user group (claimed with DB-user_groups 2026-07-05) |
| DB-user_group_stage | user_group_stage | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | Group stage assignments | roles-permissions | which workflow stages a group works in (claimed with DB-user_groups 2026-07-05) |
| DB-user_groups | user_groups | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | Role definitions | roles-permissions | |
| DB-user_user_groups | user_user_groups | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | User role memberships | user-management | |
| DB-ror_settings | ror_settings | lib/pkp/classes/migration/install/RorsMigration.php | ROR identifier settings | | |
| DB-rors | rors | lib/pkp/classes/migration/install/RorsMigration.php | Research organization ROR records | | |
| DB-sessions | sessions | lib/pkp/classes/migration/install/SessionsMigration.php | User session data (created at login; migrated by login-as impersonation) | registration-login | Owned by registration-login as the base session (created at login). login-as REFERENCES it for the impersonation stash (the `signedInAs` session var) + the session-id migration on sign-in-as/sign-out-as — referenced, not claimed. |
| DB-submission_file_revisions | submission_file_revisions | lib/pkp/classes/migration/install/SubmissionFilesMigration.php | Submission file versions | | submission-files |
| DB-submission_file_settings | submission_file_settings | lib/pkp/classes/migration/install/SubmissionFilesMigration.php | Submission file settings | | submission-files |
| DB-submission_files | submission_files | lib/pkp/classes/migration/install/SubmissionFilesMigration.php | Submitted document files | submission-files | submission-files |
| DB-variant_groups | variant_groups | lib/pkp/classes/migration/install/SubmissionFilesMigration.php | File variant groupings (web ↔ high-res media pairs; the `submission_files.variant_group_id`/`variant_type` columns ride along) | media-files | media-files |
| DB-submissions_fulltext | submissions_fulltext | lib/pkp/classes/migration/install/SubmissionSearchMigration.php | Full-text search index (single table, one row per submission/publication/locale; title/abstract/body/authors) | site-search | site-search |
| DB-author_settings | author_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Author metadata settings | contributors | |
| DB-authors | authors | lib/pkp/classes/migration/install/SubmissionsMigration.php | Publication authors | contributors | |
| DB-contributor_role_settings | contributor_role_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Contributor role settings | contributors | |
| DB-contributor_roles | contributor_roles | lib/pkp/classes/migration/install/SubmissionsMigration.php | Contributor role definitions | contributors | |
| DB-credit_contributor_roles | credit_contributor_roles | lib/pkp/classes/migration/install/SubmissionsMigration.php | CRediT contribution types | contributors | |
| DB-credit_roles | credit_roles | lib/pkp/classes/migration/install/SubmissionsMigration.php | CRediT taxonomy | contributors | |
| DB-edit_decisions | edit_decisions | lib/pkp/classes/migration/install/SubmissionsMigration.php | Editorial decisions | review-decisions | editorial-decisions |
| DB-edit_task_participants | edit_task_participants | lib/pkp/classes/migration/install/SubmissionsMigration.php | Editorial task participants | editorial-tasks | tasks-discussions |
| DB-edit_task_settings | edit_task_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Editorial task settings | | tasks-discussions |
| DB-edit_task_template_settings | edit_task_template_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Template task settings | | tasks-discussions |
| DB-edit_task_template_user_groups | edit_task_template_user_groups | lib/pkp/classes/migration/install/SubmissionsMigration.php | Template task role assignments | | tasks-discussions |
| DB-edit_task_templates | edit_task_templates | lib/pkp/classes/migration/install/SubmissionsMigration.php | Editorial task templates | editorial-tasks | tasks-discussions |
| DB-edit_tasks | edit_tasks | lib/pkp/classes/migration/install/SubmissionsMigration.php | Individual editorial tasks | editorial-tasks | tasks-discussions |
| DB-publication_settings | publication_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Publication metadata settings | | publication-metadata-references |
| DB-subeditor_submission_group | subeditor_submission_group | lib/pkp/classes/migration/install/SubmissionsMigration.php | Subeditor assignment groups (section/category → sub-editor map; auto-assign source) | | stage-participants |
| DB-submission_comments | submission_comments | lib/pkp/classes/migration/install/SubmissionsMigration.php | Comments on submissions | discussions | |
| DB-submission_settings | submission_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Submission metadata settings | | |
| DB-submissions | submissions | lib/pkp/classes/migration/install/SubmissionsMigration.php | Submission records | submission-drafts | submission-wizard |
| DB-temporary_files | temporary_files | lib/pkp/classes/migration/install/TemporaryFilesMigration.php | Temporary file uploads | | submission-files |
| DB-data_object_tombstone_oai_set_objects | data_object_tombstone_oai_set_objects | lib/pkp/classes/migration/install/TombstoneMigration.php | OAI set tombstone mappings | | |
| DB-data_object_tombstone_settings | data_object_tombstone_settings | lib/pkp/classes/migration/install/TombstoneMigration.php | Tombstone metadata | | |
| DB-data_object_tombstones | data_object_tombstones | lib/pkp/classes/migration/install/TombstoneMigration.php | Deleted content record | | |
| DB-user_comment_reports | user_comment_reports | lib/pkp/classes/migration/install/UserCommentsMigration.php | Comment moderation reports | public-comments | public-comments |
| DB-user_comment_settings | user_comment_settings | lib/pkp/classes/migration/install/UserCommentsMigration.php | Comment settings | public-comments | public-comments |
| DB-user_comments | user_comments | lib/pkp/classes/migration/install/UserCommentsMigration.php | Public user comments | public-comments | public-comments |
| DB-completed_payments | completed_payments | classes/migration/install/OJSMigration.php | Completed payment records | payments | |
| DB-custom_issue_orders | custom_issue_orders | classes/migration/install/OJSMigration.php | Custom issue ordering | issue-management | |
| DB-custom_section_orders | custom_section_orders | classes/migration/install/OJSMigration.php | Custom section ordering | sections | sections (claimed 2026-07-06 — per-ISSUE section order override; written by issue-management's TocGridHandler, seam noted in spec) |
| DB-institutional_subscriptions | institutional_subscriptions | classes/migration/install/OJSMigration.php | Institutional subscriptions | subscriptions-management | |
| DB-issue_files | issue_files | classes/migration/install/OJSMigration.php | Issue supplementary files | issue-management | |
| DB-issue_galley_settings | issue_galley_settings | classes/migration/install/OJSMigration.php | Issue galley settings | issue-management | |
| DB-issue_galleys | issue_galleys | classes/migration/install/OJSMigration.php | Issue presentation formats | issue-management | issue-level galleys (galleys spec defers here) |
| DB-issue_settings | issue_settings | classes/migration/install/OJSMigration.php | Issue metadata settings | issue-management | |
| DB-issues | issues | classes/migration/install/OJSMigration.php | Journal issues | issue-management | issue entity (reader pages = issue-archive-toc) |
| DB-publication_galley_settings | publication_galley_settings | classes/migration/install/OJSMigration.php | Publication format settings | galleys | galleys |
| DB-publication_galleys | publication_galleys | classes/migration/install/OJSMigration.php | Article publication formats | galleys | galleys |
| DB-publications | publications | classes/migration/install/OJSMigration.php | Article publication records | publication-publish-flow | publication-versioning |
| DB-queued_payments | queued_payments | classes/migration/install/OJSMigration.php | Pending payment records | payments | |
| DB-section_settings | section_settings | classes/migration/install/OJSMigration.php | Section configuration | sections | sections (claimed 2026-07-06) |
| DB-sections | sections | classes/migration/install/OJSMigration.php | Journal sections/categories | sections | sections (claimed 2026-07-06) |
| DB-subscription_type_settings | subscription_type_settings | classes/migration/install/OJSMigration.php | Subscription type settings | | |
| DB-subscription_types | subscription_types | classes/migration/install/OJSMigration.php | Subscription type definitions | subscriptions-management | |
| DB-subscriptions | subscriptions | classes/migration/install/OJSMigration.php | User subscriptions | subscription-access | |
| DB-journal_settings | journal_settings | classes/migration/install/JournalsMigration.php | Journal configuration | journal-setup | journal-masthead-settings (settings storage for every context setting; other settings specs reference) |
| DB-journals | journals | classes/migration/install/JournalsMigration.php | Journal/publication instances | journal-homepage | site-administration (reassigned 2026-07-06 — the entity create/delete/enable/seq lifecycle lives there; journal-homepage reads it for display, journal-masthead-settings owns journal_settings) |
| DB-metrics_context | metrics_context | classes/migration/install/MetricsMigration.php | Metrics context data | | |
| DB-metrics_counter_submission_daily | metrics_counter_submission_daily | classes/migration/install/MetricsMigration.php | Daily submission metrics | usage-statistics | |
| DB-metrics_counter_submission_institution_daily | metrics_counter_submission_institution_daily | classes/migration/install/MetricsMigration.php | Daily institution metrics | | |
| DB-metrics_counter_submission_institution_monthly | metrics_counter_submission_institution_monthly | classes/migration/install/MetricsMigration.php | Monthly institution metrics | | |
| DB-metrics_counter_submission_monthly | metrics_counter_submission_monthly | classes/migration/install/MetricsMigration.php | Monthly submission metrics | usage-statistics | |
| DB-metrics_issue | metrics_issue | classes/migration/install/MetricsMigration.php | Issue usage metrics | usage-statistics | |
| DB-metrics_submission | metrics_submission | classes/migration/install/MetricsMigration.php | Submission usage metrics | usage-statistics | |
| DB-metrics_submission_geo_daily | metrics_submission_geo_daily | classes/migration/install/MetricsMigration.php | Daily geographic metrics | | |
| DB-metrics_submission_geo_monthly | metrics_submission_geo_monthly | classes/migration/install/MetricsMigration.php | Monthly geographic metrics | usage-statistics | |
| DB-usage_stats_institution_temporary_records | usage_stats_institution_temporary_records | classes/migration/install/MetricsMigration.php | Temporary institution stats | | |
| DB-usage_stats_total_temporary_records | usage_stats_total_temporary_records | classes/migration/install/MetricsMigration.php | Temporary usage stats | | |
| DB-usage_stats_unique_item_investigations_temporary_records | usage_stats_unique_item_investigations_temporary_records | classes/migration/install/MetricsMigration.php | Temporary investigation stats | | |
| DB-usage_stats_unique_item_requests_temporary_records | usage_stats_unique_item_requests_temporary_records | classes/migration/install/MetricsMigration.php | Temporary request stats | | |

## Gaps
- ~45% of tables unmapped to e2e plans (mostly settings & internal state)
- 15 metrics/stats tables: background reporting, no direct e2e tests
- Tombstone/OAI tables not yet claimed by reader-facing e2e coverage
- 4 ROR/highlight tables: orphaned (institutional features not yet tested)
- **New feature, no clean atom home (Done workflow stage)**: rebase onto upstream/main adds a 6th workflow stage, `WORKFLOW_STAGE_ID_DONE = 6` (`lib/pkp/classes/core/PKPApplication.php:739`), reached when a submission's first Version of Record is published. No new table — the stage value is written into the existing `submissions.stage_id` column. Supporting pieces: new decision types `lib/pkp/classes/decision/types/{MoveToDone,ReturnToDone,ReturnToWorkflow}.php` (Decision consts `MOVE_TO_DONE=33`/`RETURN_TO_WORKFLOW=34`/`RETURN_TO_DONE=35` in `lib/pkp/classes/decision/Decision.php`); event listener `lib/pkp/classes/observers/listeners/ApplyDoneWorkflowStage.php` (subscribes to `PublicationPublished`/`PublicationUnpublished`, auto-records a MOVE_TO_DONE or RETURN_TO_WORKFLOW decision); one-time data-backfill migration `lib/pkp/classes/migration/upgrade/v3_6_0/I12799_MovePublishedSubmissionsToDone.php` (moves already-published submissions' `stage_id` into Done, no schema change). Flagged as a new feature for the feature map. **Claimed by `editorial-decisions`** (2026-07-03): the Done-stage transition machine (MOVE_TO_DONE / RETURN_TO_WORKFLOW / RETURN_TO_DONE), `WORKFLOW_STAGE_ID_DONE`, the `ApplyDoneWorkflowStage` listener, the `I12799` backfill migration, and the full `Decision::*` constant set (incl. the OMP-only `*_INTERNAL` ones, documented there as OJS-inert) are all owned by `specs/editorial-decisions.md` — these have no formal atom-row of their own but are covered by that spec's variant table.
- Delta-refresh 2026-07-02: +0 atoms — 6 new files landed under `classes/migration/upgrade/` (5 in lib/pkp, 1 in root: `I12948_RemoveRFC1807Plugin.php`, a data-only cleanup of the `versions` table, no table added/dropped) but none are `install/` migrations and none call `Schema::create`; the only structurally new DB concept (Done workflow stage) has no table of its own — see note above.
