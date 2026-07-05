# Atlas sweep: jobs & scheduled tasks
- Scope: jobs/, classes/task(s)/, scheduled-task registry (both repos)
- Method: Find all .php files in jobs & task dirs; extract @class headers; hint from e2e plans
- Date: 2026-07-02
- Atom count: 58 (42 jobs + 16 tasks)

| ID | Surface | Pointer | What it is | Hint | Claimed by |
|----|---------|---------|------------|------|------------|
| JOB-bulkemailsender | lib/pkp/jobs/bulk | BulkEmailSender.php | Dispatch bulk emails to users | email-delivery e2e |  |
| JOB-crossrefjob | lib/pkp/jobs/citation | CrossrefJob.php | Query Crossref for citation metadata | ? |  |
| JOB-extractpidsjob | lib/pkp/jobs/citation | ExtractPidsJob.php | Extract PID data for citation processing | ? |  |
| JOB-isprocessedjob | lib/pkp/jobs/citation | IsProcessedJob.php | Check citation processing status upstream | ? |  |
| JOB-openalexjob | lib/pkp/jobs/citation | OpenAlexJob.php | Query OpenAlex for citation data | ? |  |
| JOB-orcidcitationjob | lib/pkp/jobs/citation | OrcidJob.php | Enrich citations via ORCID | ? |  |
| JOB-depositcontext | lib/pkp/jobs/doi | DepositContext.php | Deposit journal metadata to registry | ? |  |
| JOB-depositsubmission | lib/pkp/jobs/doi | DepositSubmission.php | Deposit article DOI metadata | ? |  |
| JOB-depositpeerreview | lib/pkp/jobs/doi | DepositPeerReview.php | Deposit peer review DOI metadata to registration agency | doi-management |  |
| JOB-editorialreminder | lib/pkp/jobs/email | EditorialReminder.php | Queue editorial reminder emails | scheduled-tasks e2e |  |
| JOB-reviewreminder | lib/pkp/jobs/email | ReviewReminder.php | Queue peer review reminder emails | scheduled-tasks e2e |  |
| JOB-removeexpiredinvitationsjob | lib/pkp/jobs/invitations | RemoveExpiredInvitationsJob.php | Clean up expired review invitations | user-invitations | claimed 2026-07-05; deletes rows via InvitationModel::expired(). Dispatched by TASK-removeexpiredinvitations, which IS wired daily in PKPScheduler (scheduled-tasks owns the scheduler entry). |
| JOB-newannouncementnotifyusers | lib/pkp/jobs/notifications | NewAnnouncementNotifyUsers.php | Notify users of new announcements | ? |  |
| JOB-statisticsreportmail | lib/pkp/jobs/notifications | StatisticsReportMail.php | Queue statistics report email delivery | ? |  |
| JOB-statisticsreportnotify | lib/pkp/jobs/notifications | StatisticsReportNotify.php | Notify admins of ready statistics reports | ? |  |
| JOB-depositorcidsubmission | lib/pkp/jobs/orcid | DepositOrcidSubmission.php | Deposit submission activity to ORCID | ? |  |
| JOB-revokeorcidtoken | lib/pkp/jobs/orcid | RevokeOrcidToken.php | Revoke ORCID authorization token | ? |  |
| JOB-sendauthormail | lib/pkp/jobs/orcid | SendAuthorMail.php | Send ORCID sync notification to author | ? |  |
| JOB-sendupdatescopemail | lib/pkp/jobs/orcid | SendUpdateScopeMail.php | Send scope update notification to author | ? |  |
| JOB-archiveusagestatstlogfile | lib/pkp/jobs/statistics | ArchiveUsageStatsLogFile.php | Archive processed usage stats logs | ? |  |
| JOB-compilecontextmetrics | lib/pkp/jobs/statistics | CompileContextMetrics.php | Aggregate metrics at journal level | ? |  |
| JOB-compilemonthlymetrics | lib/pkp/jobs/statistics | CompileMonthlyMetrics.php | Aggregate monthly usage statistics | ? |  |
| JOB-compilesubmissionmetrics | lib/pkp/jobs/statistics | CompileSubmissionMetrics.php | Aggregate metrics per article | ? |  |
| JOB-pkpprocessusagestattslogfile | lib/pkp/jobs/statistics | PKPProcessUsageStatsLogFile.php | Parse usage event logs (PKP core) | ? |  |
| JOB-removedoubleclicks | lib/pkp/jobs/statistics | RemoveDoubleClicks.php | Filter duplicate usage events | ? |  |
| JOB-updatesubmissionsearchjob | lib/pkp/jobs/submissions | UpdateSubmissionSearchJob.php | Re-index article for search | site-search | site-search |
| JOB-testjobfailure | lib/pkp/jobs/testJobs | TestJobFailure.php | Test job that fails (e2e harness) | jobs-queue e2e |  |
| JOB-testjobsuccess | lib/pkp/jobs/testJobs | TestJobSuccess.php | Test job that succeeds (e2e harness) | jobs-queue e2e |  |
| JOB-depositissue | jobs/doi | DepositIssue.php | Deposit issue DOI metadata to registry | ? |  |
| JOB-issuepublishednotifyusers | jobs/notifications | IssuePublishedNotifyUsers.php | Notify subscribers when issue published | issue-management |  |
| JOB-openaccessmailusers | jobs/notifications | OpenAccessMailUsers.php | Notify users when article is open access | notifications e2e |  |
| JOB-depositorcidreview | jobs/orcid | DepositOrcidReview.php | Deposit peer review activity to ORCID | ? |  |
| JOB-reconcileorcidreviewputcode | jobs/orcid | ReconcileOrcidReviewPutCode.php | Sync review put-codes with ORCID | ? |  |
| JOB-compilecountersubmissiondailymetrics | jobs/statistics | CompileCounterSubmissionDailyMetrics.php | Daily COUNTER-compliant article metrics | ? |  |
| JOB-compilecountersubmissioninstitutionmetrics | jobs/statistics | CompileCounterSubmissionInstitutionDailyMetrics.php | Daily institutional usage metrics | ? |  |
| JOB-compileissuemetrics | jobs/statistics | CompileIssueMetrics.php | Aggregate metrics at issue level | ? |  |
| JOB-compilesubmissiongeodailymetrics | jobs/statistics | CompileSubmissionGeoDailyMetrics.php | Daily geographic usage breakdown | ? |  |
| JOB-compileuniquekinvestigations | jobs/statistics | CompileUniqueInvestigations.php | Deduplicated investigation metric | ? |  |
| JOB-compileuniquerequests | jobs/statistics | CompileUniqueRequests.php | Deduplicated download metric | ? |  |
| JOB-compileusestatsfromtemporaryrecords | jobs/statistics | CompileUsageStatsFromTemporaryRecords.php | Bulk import temporary stat records | ? |  |
| JOB-deleteusagestatsttemporaryrecords | jobs/statistics | DeleteUsageStatsTemporaryRecords.php | Cleanup temporary stat records | ? |  |
| JOB-processusagestatstlogfile | jobs/statistics | ProcessUsageStatsLogFile.php | Parse usage event logs (OJS-specific) | ? |  |
| TASK-depositdois | lib/pkp/classes/task | DepositDois.php | Periodic DOI deposit runner task | scheduled-tasks (out of scope) |  |
| TASK-editorialreminders | lib/pkp/classes/task | EditorialReminders.php | Trigger editorial reminders (wrapper task) | scheduled-tasks e2e |  |
| TASK-fileloader | lib/pkp/classes/task | FileLoader.php | Load static files into storage (setup) | ? |  |
| TASK-pkpusagestatstloader | lib/pkp/classes/task | PKPUsageStatsLoader.php | Load usage stats log files (PKP) | ? |  |
| TASK-processqueuejobs | lib/pkp/classes/task | ProcessQueueJobs.php | Drain job queue (scheduled task runner) | jobs-queue e2e |  |
| TASK-publishsubmissions | lib/pkp/classes/task | PublishSubmissions.php | Auto-publish scheduled submissions | publication-publish-flow | publication-publish-flow |
| TASK-removeexpiredinvitations | lib/pkp/classes/task | RemoveExpiredInvitations.php | Clean up expired review invites | scheduled-tasks (out of scope) |  |
| TASK-removefailedjobs | lib/pkp/classes/task | RemoveFailedJobs.php | Purge old failed job records | scheduled-tasks (out of scope) |  |
| TASK-removeunvalidatedexpiredusers | lib/pkp/classes/task | RemoveUnvalidatedExpiredUsers.php | Delete unverified user accounts | ? |  |
| TASK-reviewreminder | lib/pkp/classes/task | ReviewReminder.php | Trigger review reminders (wrapper task) | scheduled-tasks e2e |  |
| TASK-statisticsreport | lib/pkp/classes/task | StatisticsReport.php | Monthly editorial statistics report | scheduled-tasks (out of scope) |  |
| TASK-updateipgeodb | lib/pkp/classes/task | UpdateIPGeoDB.php | Refresh IP geolocation database | ? |  |
| TASK-updaterorregistrydataset | lib/pkp/classes/task | UpdateRorRegistryDataset.php | Refresh research org registry data | ? |  |
| TASK-openaccessnotification | classes/tasks | OpenAccessNotification.php | Notify when articles go open access | scheduled-tasks (out of scope) |  |
| TASK-subscriptionexpiryreminder | classes/tasks | SubscriptionExpiryReminder.php | Notify subscribers of expiring access | scheduled-tasks (out of scope) |  |
| TASK-usagestatstloader | classes/tasks | UsageStatsLoader.php | Load usage stats log files (OJS) | ? |  |

## Gaps
- **Scheduled task registry (scheduledTasks.xml)**: No registry file found in ojs-main; task frequency/cron timing not extracted (would require registry or Scheduler class inspection).
- **Job dispatch sites**: Specific caller locations not mapped (grep on `::dispatch()` limited; would require full codebase scan).
- **Historical vs. active**: No confirmation whether test jobs (TestJobSuccess, TestJobFailure) are enabled in production.
- Delta-refresh 2026-07-02: +1 atom (`JOB-depositpeerreview`, new peer-review DOI deposit job, dispatched wherever `DepositSubmission`-style DOI deposits are triggered post-review). Also new in this rebase but out of this file's scope: `lib/pkp/classes/observers/listeners/ApplyDoneWorkflowStage.php`, an event listener (not a `jobs/`/`classes/task` file) that auto-records Done-stage decisions on publish/unpublish — see db-entities.md Gaps for the full Done-stage feature writeup. Owned by `specs/editorial-decisions.md` (the decision engine).
