# Atlas sweep: DB entities
- Scope: classes/migration/install (both repos)
- Method: grep Schema::create + migration filenames
- Date: 2026-07-02
- Atom count: 149

| ID | Surface | Pointer | What it is | Hint | Claimed by |
|----|---------|---------|------------|------|------------|
| DB-author_affiliation_settings | author_affiliation_settings | lib/pkp/classes/migration/install/AffiliationsMigration.php | Settings for author affiliations | | |
| DB-author_affiliations | author_affiliations | lib/pkp/classes/migration/install/AffiliationsMigration.php | Author institutional affiliations | contributors | |
| DB-announcement_settings | announcement_settings | lib/pkp/classes/migration/install/AnnouncementsMigration.php | Settings for announcements | | |
| DB-announcement_type_settings | announcement_type_settings | lib/pkp/classes/migration/install/AnnouncementsMigration.php | Settings for announcement types | | |
| DB-announcement_types | announcement_types | lib/pkp/classes/migration/install/AnnouncementsMigration.php | Announcement type definitions | | |
| DB-announcements | announcements | lib/pkp/classes/migration/install/AnnouncementsMigration.php | Announcements displayed to users | announcements | |
| DB-categories | categories | lib/pkp/classes/migration/install/CategoriesMigration.php | Publication categories/research areas | browse-category-section | |
| DB-category_settings | category_settings | lib/pkp/classes/migration/install/CategoriesMigration.php | Settings for categories | | |
| DB-publication_categories | publication_categories | lib/pkp/classes/migration/install/CategoriesMigration.php | Publication-category mappings | | |
| DB-citation_settings | citation_settings | lib/pkp/classes/migration/install/MetadataMigration.php | Settings for citations | | |
| DB-citations | citations | lib/pkp/classes/migration/install/MetadataMigration.php | Extracted and formatted citations | | |
| DB-data_citation_settings | data_citation_settings | lib/pkp/classes/migration/install/MetadataMigration.php | Settings for data citations | | |
| DB-data_citations | data_citations | lib/pkp/classes/migration/install/MetadataMigration.php | Data set citations | | |
| DB-filter_groups | filter_groups | lib/pkp/classes/migration/install/MetadataMigration.php | Filter processing groups | | |
| DB-filter_settings | filter_settings | lib/pkp/classes/migration/install/MetadataMigration.php | Settings for filters | | |
| DB-filters | filters | lib/pkp/classes/migration/install/MetadataMigration.php | Document processing filters | | |
| DB-email_templates | email_templates | lib/pkp/classes/migration/install/CommonMigration.php | Email message templates | email-templates-management | |
| DB-email_templates_default_data | email_templates_default_data | lib/pkp/classes/migration/install/CommonMigration.php | Default template content | | |
| DB-email_templates_settings | email_templates_settings | lib/pkp/classes/migration/install/CommonMigration.php | Settings for templates | | |
| DB-notification_settings | notification_settings | lib/pkp/classes/migration/install/CommonMigration.php | User notification preferences | | |
| DB-notification_subscription_settings | notification_subscription_settings | lib/pkp/classes/migration/install/CommonMigration.php | Notification subscriptions | notifications | |
| DB-notifications | notifications | lib/pkp/classes/migration/install/CommonMigration.php | User notification records | notifications | |
| DB-oai_resumption_tokens | oai_resumption_tokens | lib/pkp/classes/migration/install/CommonMigration.php | OAI-PMH resumption tokens | oai-sitemap-feeds | |
| DB-plugin_settings | plugin_settings | lib/pkp/classes/migration/install/CommonMigration.php | Plugin configuration settings | plugin-management | |
| DB-site | site | lib/pkp/classes/migration/install/CommonMigration.php | Site configuration | site-administration | |
| DB-site_settings | site_settings | lib/pkp/classes/migration/install/CommonMigration.php | Site-level settings | site-settings | |
| DB-user_settings | user_settings | lib/pkp/classes/migration/install/CommonMigration.php | User preferences and settings | user-profile | |
| DB-users | users | lib/pkp/classes/migration/install/CommonMigration.php | User accounts | user-management | |
| DB-versions | versions | lib/pkp/classes/migration/install/CommonMigration.php | System version history | | |
| DB-controlled_vocab_entries | controlled_vocab_entries | lib/pkp/classes/migration/install/ControlledVocabMigration.php | Controlled vocabulary entries | | |
| DB-controlled_vocab_entry_settings | controlled_vocab_entry_settings | lib/pkp/classes/migration/install/ControlledVocabMigration.php | Vocabulary entry settings | | |
| DB-controlled_vocabs | controlled_vocabs | lib/pkp/classes/migration/install/ControlledVocabMigration.php | Vocabulary lists | | |
| DB-user_interests | user_interests | lib/pkp/classes/migration/install/ControlledVocabMigration.php | User interest keywords | | |
| DB-doi_settings | doi_settings | lib/pkp/classes/migration/install/DoiMigration.php | DOI configuration settings | publication-identifiers-license | |
| DB-dois | dois | lib/pkp/classes/migration/install/DoiMigration.php | Digital object identifiers | publication-identifiers-license | |
| DB-email_template_user_group_access | email_template_user_group_access | lib/pkp/classes/migration/install/EmailTemplateUserGroupAccessMigration.php | Template access by role | | |
| DB-failed_jobs | failed_jobs | lib/pkp/classes/migration/install/FailedJobsMigration.php | Failed background job records | jobs-queue | |
| DB-files | files | lib/pkp/classes/migration/install/FilesMigration.php | File storage metadata | | |
| DB-genre_settings | genre_settings | lib/pkp/classes/migration/install/GenresMigration.php | Settings for submission genres | | |
| DB-genres | genres | lib/pkp/classes/migration/install/GenresMigration.php | File type genres | submission-files | |
| DB-highlight_settings | highlight_settings | lib/pkp/classes/migration/install/HighlightsMigration.php | Settings for highlights | | |
| DB-highlights | highlights | lib/pkp/classes/migration/install/HighlightsMigration.php | Featured content highlights | | |
| DB-institution_ip | institution_ip | lib/pkp/classes/migration/install/InstitutionsMigration.php | Institution IP ranges | institutions | |
| DB-institution_settings | institution_settings | lib/pkp/classes/migration/install/InstitutionsMigration.php | Institution configuration | | |
| DB-institutions | institutions | lib/pkp/classes/migration/install/InstitutionsMigration.php | Institutional records | institutions | |
| DB-invitations | invitations | lib/pkp/classes/migration/install/InvitationsMigration.php | User invitation tokens | user-invitations | |
| DB-job_batches | job_batches | lib/pkp/classes/migration/install/JobsMigration.php | Job batch groupings | jobs-queue | |
| DB-jobs | jobs | lib/pkp/classes/migration/install/JobsMigration.php | Background job queue | jobs-queue | |
| DB-library_file_settings | library_file_settings | lib/pkp/classes/migration/install/LibraryFilesMigration.php | Library file settings | | |
| DB-library_files | library_files | lib/pkp/classes/migration/install/LibraryFilesMigration.php | Library document collections | | |
| DB-email_log | email_log | lib/pkp/classes/migration/install/LogMigration.php | Email transmission log | email-delivery | |
| DB-email_log_users | email_log_users | lib/pkp/classes/migration/install/LogMigration.php | Email log user recipients | | |
| DB-event_log | event_log | lib/pkp/classes/migration/install/LogMigration.php | Editorial activity log | activity-log | |
| DB-event_log_settings | event_log_settings | lib/pkp/classes/migration/install/LogMigration.php | Activity log settings | | |
| DB-navigation_menu_item_assignment_settings | navigation_menu_item_assignment_settings | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Menu item assignment settings | | |
| DB-navigation_menu_item_assignments | navigation_menu_item_assignments | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Menu item context assignments | | |
| DB-navigation_menu_item_settings | navigation_menu_item_settings | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Navigation menu item settings | navigation-menus | |
| DB-navigation_menu_items | navigation_menu_items | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Menu item definitions | navigation-menus | |
| DB-navigation_menus | navigation_menus | lib/pkp/classes/migration/install/NavigationMenusMigration.php | Navigation menu structures | navigation-menus | |
| DB-notes | notes | lib/pkp/classes/migration/install/NotesMigration.php | Editor/reviewer notes | | tasks-discussions |
| DB-review_assignment_settings | review_assignment_settings | lib/pkp/classes/migration/install/ReviewAssignmentSettingsMigration.php | Review assignment settings | | |
| DB-reviewer_recommendation_settings | reviewer_recommendation_settings | classes/migration/install/ReviewerRecommendationsMigration.php | Reviewer recommendation settings | | |
| DB-reviewer_recommendations | reviewer_recommendations | classes/migration/install/ReviewerRecommendationsMigration.php | Recommended reviewers | reviewer-suggestions | |
| DB-reviewer_suggestion_settings | reviewer_suggestion_settings | lib/pkp/classes/migration/install/ReviewerSuggestionsMigration.php | Reviewer suggestion settings | | |
| DB-reviewer_suggestions | reviewer_suggestions | lib/pkp/classes/migration/install/ReviewerSuggestionsMigration.php | Suggested reviewers | reviewer-suggestions | |
| DB-review_form_element_settings | review_form_element_settings | lib/pkp/classes/migration/install/ReviewFormsMigration.php | Review form element settings | | |
| DB-review_form_elements | review_form_elements | lib/pkp/classes/migration/install/ReviewFormsMigration.php | Review form fields | review-forms | |
| DB-review_form_settings | review_form_settings | lib/pkp/classes/migration/install/ReviewFormsMigration.php | Review form configuration | | |
| DB-review_forms | review_forms | lib/pkp/classes/migration/install/ReviewFormsMigration.php | Review evaluation forms | review-forms | |
| DB-review_round_author_response_authors | review_round_author_response_authors | lib/pkp/classes/migration/install/ReviewRoundAuthorResponse.php | Response author mappings | | |
| DB-review_round_author_response_settings | review_round_author_response_settings | lib/pkp/classes/migration/install/ReviewRoundAuthorResponse.php | Author response settings | | |
| DB-review_round_author_responses | review_round_author_responses | lib/pkp/classes/migration/install/ReviewRoundAuthorResponse.php | Author revision responses | reviewer-response | |
| DB-review_round_settings | review_round_settings | lib/pkp/classes/migration/install/ReviewRoundAuthorResponse.php | Review round configuration | | |
| DB-review_assignments | review_assignments | lib/pkp/classes/migration/install/ReviewsMigration.php | Review assignments | reviewer-assignment | |
| DB-review_files | review_files | lib/pkp/classes/migration/install/ReviewsMigration.php | Review attachments | | |
| DB-review_form_responses | review_form_responses | lib/pkp/classes/migration/install/ReviewsMigration.php | Reviewer form responses | | |
| DB-review_round_files | review_round_files | lib/pkp/classes/migration/install/ReviewsMigration.php | Review round attachments | | |
| DB-review_rounds | review_rounds | lib/pkp/classes/migration/install/ReviewsMigration.php | Review workflow rounds | review-rounds-revisions | |
| DB-stage_assignments | stage_assignments | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | User stage role assignments | stage-participants | |
| DB-user_group_settings | user_group_settings | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | User group settings | | |
| DB-user_group_stage | user_group_stage | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | Group stage assignments | | |
| DB-user_groups | user_groups | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | Role definitions | roles-permissions | |
| DB-user_user_groups | user_user_groups | lib/pkp/classes/migration/install/RolesAndUserGroupsMigration.php | User role memberships | user-management | |
| DB-ror_settings | ror_settings | lib/pkp/classes/migration/install/RorsMigration.php | ROR identifier settings | | |
| DB-rors | rors | lib/pkp/classes/migration/install/RorsMigration.php | Research organization ROR records | | |
| DB-sessions | sessions | lib/pkp/classes/migration/install/SessionsMigration.php | User session data | login-as | |
| DB-submission_file_revisions | submission_file_revisions | lib/pkp/classes/migration/install/SubmissionFilesMigration.php | Submission file versions | | |
| DB-submission_file_settings | submission_file_settings | lib/pkp/classes/migration/install/SubmissionFilesMigration.php | Submission file settings | | |
| DB-submission_files | submission_files | lib/pkp/classes/migration/install/SubmissionFilesMigration.php | Submitted document files | submission-files | |
| DB-variant_groups | variant_groups | lib/pkp/classes/migration/install/SubmissionFilesMigration.php | File variant groupings | | |
| DB-submissions_fulltext | submissions_fulltext | lib/pkp/classes/migration/install/SubmissionSearchMigration.php | Full-text search index | site-search | |
| DB-author_settings | author_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Author metadata settings | | |
| DB-authors | authors | lib/pkp/classes/migration/install/SubmissionsMigration.php | Publication authors | contributors | |
| DB-contributor_role_settings | contributor_role_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Contributor role settings | | |
| DB-contributor_roles | contributor_roles | lib/pkp/classes/migration/install/SubmissionsMigration.php | Contributor role definitions | contributors | |
| DB-credit_contributor_roles | credit_contributor_roles | lib/pkp/classes/migration/install/SubmissionsMigration.php | CRediT contribution types | contributors | |
| DB-credit_roles | credit_roles | lib/pkp/classes/migration/install/SubmissionsMigration.php | CRediT taxonomy | contributors | |
| DB-edit_decisions | edit_decisions | lib/pkp/classes/migration/install/SubmissionsMigration.php | Editorial decisions | review-decisions | |
| DB-edit_task_participants | edit_task_participants | lib/pkp/classes/migration/install/SubmissionsMigration.php | Editorial task participants | editorial-tasks | tasks-discussions |
| DB-edit_task_settings | edit_task_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Editorial task settings | | tasks-discussions |
| DB-edit_task_template_settings | edit_task_template_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Template task settings | | tasks-discussions |
| DB-edit_task_template_user_groups | edit_task_template_user_groups | lib/pkp/classes/migration/install/SubmissionsMigration.php | Template task role assignments | | tasks-discussions |
| DB-edit_task_templates | edit_task_templates | lib/pkp/classes/migration/install/SubmissionsMigration.php | Editorial task templates | editorial-tasks | tasks-discussions |
| DB-edit_tasks | edit_tasks | lib/pkp/classes/migration/install/SubmissionsMigration.php | Individual editorial tasks | editorial-tasks | tasks-discussions |
| DB-publication_settings | publication_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Publication metadata settings | | |
| DB-subeditor_submission_group | subeditor_submission_group | lib/pkp/classes/migration/install/SubmissionsMigration.php | Subeditor assignment groups | | |
| DB-submission_comments | submission_comments | lib/pkp/classes/migration/install/SubmissionsMigration.php | Comments on submissions | discussions | |
| DB-submission_settings | submission_settings | lib/pkp/classes/migration/install/SubmissionsMigration.php | Submission metadata settings | | |
| DB-submissions | submissions | lib/pkp/classes/migration/install/SubmissionsMigration.php | Submission records | submission-drafts | |
| DB-temporary_files | temporary_files | lib/pkp/classes/migration/install/TemporaryFilesMigration.php | Temporary file uploads | | |
| DB-data_object_tombstone_oai_set_objects | data_object_tombstone_oai_set_objects | lib/pkp/classes/migration/install/TombstoneMigration.php | OAI set tombstone mappings | | |
| DB-data_object_tombstone_settings | data_object_tombstone_settings | lib/pkp/classes/migration/install/TombstoneMigration.php | Tombstone metadata | | |
| DB-data_object_tombstones | data_object_tombstones | lib/pkp/classes/migration/install/TombstoneMigration.php | Deleted content record | | |
| DB-user_comment_reports | user_comment_reports | lib/pkp/classes/migration/install/UserCommentsMigration.php | Comment moderation reports | public-comments | |
| DB-user_comment_settings | user_comment_settings | lib/pkp/classes/migration/install/UserCommentsMigration.php | Comment settings | | |
| DB-user_comments | user_comments | lib/pkp/classes/migration/install/UserCommentsMigration.php | Public user comments | public-comments | |
| DB-completed_payments | completed_payments | classes/migration/install/OJSMigration.php | Completed payment records | payments | |
| DB-custom_issue_orders | custom_issue_orders | classes/migration/install/OJSMigration.php | Custom issue ordering | issue-management | |
| DB-custom_section_orders | custom_section_orders | classes/migration/install/OJSMigration.php | Custom section ordering | sections | |
| DB-institutional_subscriptions | institutional_subscriptions | classes/migration/install/OJSMigration.php | Institutional subscriptions | subscriptions-management | |
| DB-issue_files | issue_files | classes/migration/install/OJSMigration.php | Issue supplementary files | issue-management | |
| DB-issue_galley_settings | issue_galley_settings | classes/migration/install/OJSMigration.php | Issue galley settings | | |
| DB-issue_galleys | issue_galleys | classes/migration/install/OJSMigration.php | Issue presentation formats | galleys | |
| DB-issue_settings | issue_settings | classes/migration/install/OJSMigration.php | Issue metadata settings | issue-management | |
| DB-issues | issues | classes/migration/install/OJSMigration.php | Journal issues | issue-archive-toc | |
| DB-publication_galley_settings | publication_galley_settings | classes/migration/install/OJSMigration.php | Publication format settings | | |
| DB-publication_galleys | publication_galleys | classes/migration/install/OJSMigration.php | Article publication formats | galleys | |
| DB-publications | publications | classes/migration/install/OJSMigration.php | Article publication records | publication-publish-flow | publication-versioning |
| DB-queued_payments | queued_payments | classes/migration/install/OJSMigration.php | Pending payment records | payments | |
| DB-section_settings | section_settings | classes/migration/install/OJSMigration.php | Section configuration | sections | |
| DB-sections | sections | classes/migration/install/OJSMigration.php | Journal sections/categories | sections | |
| DB-subscription_type_settings | subscription_type_settings | classes/migration/install/OJSMigration.php | Subscription type settings | | |
| DB-subscription_types | subscription_types | classes/migration/install/OJSMigration.php | Subscription type definitions | subscriptions-management | |
| DB-subscriptions | subscriptions | classes/migration/install/OJSMigration.php | User subscriptions | subscription-access | |
| DB-journal_settings | journal_settings | classes/migration/install/JournalsMigration.php | Journal configuration | journal-setup | |
| DB-journals | journals | classes/migration/install/JournalsMigration.php | Journal/publication instances | journal-homepage | |
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
- **New feature, no clean atom home (Done workflow stage)**: rebase onto upstream/main adds a 6th workflow stage, `WORKFLOW_STAGE_ID_DONE = 6` (`lib/pkp/classes/core/PKPApplication.php:739`), reached when a submission's first Version of Record is published. No new table — the stage value is written into the existing `submissions.stage_id` column. Supporting pieces: new decision types `lib/pkp/classes/decision/types/{MoveToDone,ReturnToDone,ReturnToWorkflow}.php` (Decision consts `MOVE_TO_DONE=33`/`RETURN_TO_WORKFLOW=34`/`RETURN_TO_DONE=35` in `lib/pkp/classes/decision/Decision.php`); event listener `lib/pkp/classes/observers/listeners/ApplyDoneWorkflowStage.php` (subscribes to `PublicationPublished`/`PublicationUnpublished`, auto-records a MOVE_TO_DONE or RETURN_TO_WORKFLOW decision); one-time data-backfill migration `lib/pkp/classes/migration/upgrade/v3_6_0/I12799_MovePublishedSubmissionsToDone.php` (moves already-published submissions' `stage_id` into Done, no schema change). Flagged as a new feature for the feature map.
- Delta-refresh 2026-07-02: +0 atoms — 6 new files landed under `classes/migration/upgrade/` (5 in lib/pkp, 1 in root: `I12948_RemoveRFC1807Plugin.php`, a data-only cleanup of the `versions` table, no table added/dropped) but none are `install/` migrations and none call `Schema::create`; the only structurally new DB concept (Done workflow stage) has no table of its own — see note above.
