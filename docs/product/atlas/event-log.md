# Atlas sweep: event-log types
- Scope: classes/log constants (both repos) + eventLog.json
- Method: grep SUBMISSION_LOG_ + SubmissionEmailLogEventType enum + message key extraction
- Date: 2026-07-02
- Atom count: 36 submission/file events + 30 email event types = 66 event types total

| ID | Surface | Pointer | What it is | Hint | Claimed by |
|----|---------|---------|------------|------|------------|
| EVLOG-SUBM-SUBMIT | SUBMISSION_LOG_SUBMISSION_SUBMIT | lib/pkp/classes/observers/listeners/LogSubmissionSubmitted.php:42 | Author submits manuscript | submission.event.submissionSubmitted; activity-log | submission-wizard |
| EVLOG-SUBM-META-UPD | SUBMISSION_LOG_METADATA_UPDATE | lib/pkp/classes/publication/Repository.php | Publication metadata changed | submission.event.metadataUpdated | |
| EVLOG-SUBM-ADD-PART | SUBMISSION_LOG_ADD_PARTICIPANT | lib/pkp/controllers/grid/users/stageParticipant/StageParticipantGridHandler.php | Stage participant added | submission.event.participantAdded; stage-participants | stage-participants |
| EVLOG-SUBM-REM-PART | SUBMISSION_LOG_REMOVE_PARTICIPANT | lib/pkp/controllers/grid/users/stageParticipant/StageParticipantGridHandler.php | Stage participant removed | submission.event.participantRemoved; stage-participants | stage-participants |
| EVLOG-SUBM-META-PUB | SUBMISSION_LOG_METADATA_PUBLISH | lib/pkp/classes/publication/Repository.php | Metadata published | submission.event.metadataPublished | publication-versioning |
| EVLOG-SUBM-META-UNPUB | SUBMISSION_LOG_METADATA_UNPUBLISH | lib/pkp/classes/publication/Repository.php | Metadata unpublished | submission.event.metadataUnpublished | publication-versioning |
| EVLOG-SUBM-VER-CRT | SUBMISSION_LOG_CREATE_VERSION | lib/pkp/classes/publication/Repository.php | Publication version created | submission.event.versionCreated; publication-versioning | publication-versioning |
| EVLOG-SUBM-COPY-AGR | SUBMISSION_LOG_COPYRIGHT_AGREED | lib/pkp/api/v1/submissions/PKPSubmissionController.php:267 | Author agrees to copyright notice | submission.event.copyrightNoticeAgreed | submission-wizard |
| EVLOG-SUBM-ED-DEC | SUBMISSION_LOG_EDITOR_DECISION | lib/pkp/classes/decision/Repository.php | Editorial decision recorded | submission.event.editorDecision; review-decisions | editorial-decisions |
| EVLOG-SUBM-ED-REC | SUBMISSION_LOG_EDITOR_RECOMMENDATION | lib/pkp/classes/decision/Repository.php | Editor recommendation made | submission.event.editorRecommendation | editorial-decisions |
| EVLOG-SUBM-ED-EMAIL | SUBMISSION_LOG_DECISION_EMAIL_SENT | lib/pkp/classes/decision/types/traits/NotifyReviewers.php | Decision notification email sent | submission.event.decisionEmailSent; email-delivery | editorial-decisions |
| EVLOG-REV-ASSIGN | SUBMISSION_LOG_REVIEW_ASSIGN | lib/pkp/classes/submission/action/EditorAction.php | Reviewer assigned to review | submission.event.reviewerAssigned; reviewer-assignment | assign-and-manage-reviewers |
| EVLOG-REV-REIN | SUBMISSION_LOG_REVIEW_REINSTATED | lib/pkp/controllers/grid/users/reviewer/form/ReinstateReviewerForm.php | Review assignment reinstated | submission.event.reviewerReinstated | assign-and-manage-reviewers |
| EVLOG-REV-ACCP | SUBMISSION_LOG_REVIEW_ACCEPT | lib/pkp/classes/submission/reviewer/ReviewerAction.php | Reviewer accepts review | submission.event.reviewerAccepted; reviewer-response | reviewer-response |
| EVLOG-REV-DECL | SUBMISSION_LOG_REVIEW_DECLINE | lib/pkp/classes/submission/reviewer/ReviewerAction.php | Reviewer declines review | submission.event.reviewerDeclined; reviewer-response | reviewer-response |
| EVLOG-REV-UNCON | SUBMISSION_LOG_REVIEW_UNCONSIDERED | lib/pkp/classes/controllers/grid/users/reviewer/PKPReviewerGridHandler.php | Review marked unconsidered | submission.event.reviewNotConsidered | assign-and-manage-reviewers |
| EVLOG-REV-DUE | SUBMISSION_LOG_REVIEW_SET_DUE_DATE | ? | Review due date set/modified | submission.event.reviewDueDateSet | |
| EVLOG-REV-CLR | SUBMISSION_LOG_REVIEW_CLEAR | lib/pkp/controllers/grid/users/reviewer/form/UnassignReviewerForm.php | Review unassigned | submission.event.reviewUnassigned | assign-and-manage-reviewers |
| EVLOG-REV-RDY | SUBMISSION_LOG_REVIEW_READY | lib/pkp/classes/submission/reviewer/form/PKPReviewerReviewStep3Form.php | Review completed by reviewer | submission.event.reviewCompleted; reviewer-response | reviewer-response |
| EVLOG-REV-CONF | SUBMISSION_LOG_REVIEW_CONFIRMED | lib/pkp/classes/controllers/grid/users/reviewer/PKPReviewerGridHandler.php | Review confirmed by editor | submission.event.reviewConfirmed | assign-and-manage-reviewers |
| EVLOG-REV-REM | SUBMISSION_LOG_REVIEW_REMIND | lib/pkp/controllers/grid/users/reviewer/form/ReviewReminderForm.php | Manual review reminder sent | submission.event.reviewReminderSent; email-delivery | |
| EVLOG-REV-REM-AUTO | SUBMISSION_LOG_REVIEW_REMIND_AUTO | lib/pkp/jobs/email/ReviewReminder.php | Automatic review reminder sent | submission.event.reviewAutoReminderSent; scheduled-tasks | |
| EVLOG-REV-PROXY-REC | SUBMISSION_LOG_REVIEW_RECOMMENDATION_BY_PROXY | classes/log/event/SubmissionEventLogEntry.php:73; controllers/grid/users/reviewer/ReviewerGridHandler.php | Editor sets a REVIEWER's recommendation by proxy in the reviewer grid (ReviewerGridHandler::reviewRead sets review_assignments.reviewer_recommendation_id) — reviewer-management, NOT the recommend-only editor role; belongs with assign-and-manage-reviewers (parked in UNASSIGNED.md 2026-07-03 by the recommend-only-editors verifier — adopt at grooming) | log.review.reviewRecommendationSetByProxy | |
| EVLOG-TASK-CRT | SUBMISSION_LOG_TASK_CREATED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Editorial task created | submission.event.taskCreated; editorial-tasks | tasks-discussions |
| EVLOG-TASK-STRT | SUBMISSION_LOG_TASK_STARTED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Task marked started | submission.event.taskStarted; editorial-tasks | tasks-discussions |
| EVLOG-TASK-CLOSE | SUBMISSION_LOG_TASK_CLOSED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Task closed | submission.event.taskClosed; editorial-tasks | tasks-discussions |
| EVLOG-TASK-OVRDUE | SUBMISSION_LOG_TASK_OVERDUE | lib/pkp/api/v1/submissions/tasks/resources/TaskResource.php | Task overdue (computed, not written) | submission.event.taskOverdue | tasks-discussions |
| EVLOG-TASK-NOTE | SUBMISSION_LOG_TASK_NOTE_POSTED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Note posted on task | submission.event.taskNotePosted; editorial-tasks | tasks-discussions |
| EVLOG-TASK-OPEN | SUBMISSION_LOG_TASK_OPENED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Task opened | submission.event.taskOpened; editorial-tasks | tasks-discussions |
| EVLOG-TASK-FILE-UP | SUBMISSION_LOG_TASK_FILE_UPLOADED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | File uploaded to task | submission.event.taskFileUploaded; editorial-tasks | tasks-discussions |
| EVLOG-TASK-DUE-MOD | SUBMISSION_LOG_TASK_DATEDUE_MODIFIED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Task due date modified | submission.event.taskDateDueModified; editorial-tasks | tasks-discussions |
| EVLOG-TASK-REASS | SUBMISSION_LOG_TASK_REASSIGNED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Task reassigned to new owner | submission.event.taskReassigned; editorial-tasks | tasks-discussions |
| EVLOG-TASK-ASGN | SUBMISSION_LOG_TASK_ASSIGNED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Task assigned | submission.event.taskAssigned; editorial-tasks | tasks-discussions |
| EVLOG-TASK-FILE-RM | SUBMISSION_LOG_TASK_FILE_REMOVED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | File removed from task | submission.event.taskFileRemoved; editorial-tasks | tasks-discussions |
| EVLOG-TASK-PART-ADD | SUBMISSION_LOG_TASK_PARTICIPANTS_ADDED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Participants added to task | submission.event.taskParticipantsAdded; editorial-tasks | tasks-discussions |
| EVLOG-TASK-PART-REM | SUBMISSION_LOG_TASK_PARTICIPANTS_REMOVED | lib/pkp/api/v1/submissions/tasks/EditorialTaskController.php | Participants removed from task | submission.event.taskParticipantsRemoved; editorial-tasks | tasks-discussions |
| EVLOG-FILE-UPLOAD | SUBMISSION_LOG_FILE_UPLOAD | lib/pkp/classes/submissionFile/Repository.php:line 435 | Submission file uploaded | submission.event.fileUploaded; submission-files | |
| EVLOG-FILE-REV-UP | SUBMISSION_LOG_FILE_REVISION_UPLOAD | lib/pkp/classes/submissionFile/Repository.php:line 440 | File revision uploaded | submission.event.fileRevisionUploaded; submission-files | |
| EVLOG-FILE-EDIT | SUBMISSION_LOG_FILE_EDIT | lib/pkp/classes/submissionFile/Repository.php | File metadata edited | submission.event.fileEdited; submission-files | |
| EVLOG-FILE-DELETE | SUBMISSION_LOG_FILE_DELETE | lib/pkp/classes/submissionFile/Repository.php | Submission file deleted | submission.event.fileDeleted; submission-files | |
| EVLOG-EMAIL-AUTH-REV | AUTHOR_NOTIFY_REVISED_VERSION | lib/pkp/classes/log/SubmissionEmailLogEventType.php:24 | Author notified of revision request | lib.pkp.submission.event.authorNotifyRevisedVersion | email-delivery |
| EVLOG-EMAIL-AUTH-ACK | AUTHOR_SUBMISSION_ACK | lib/pkp/classes/log/SubmissionEmailLogEventType.php:25 | Submission acknowledgement to author | lib.pkp.submission.event.authorSubmissionAck | email-delivery |
| EVLOG-EMAIL-ED-AUTH-NOT | EDITOR_NOTIFY_AUTHOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:28 | Editor notifies author | lib.pkp.submission.event.editorNotifyAuthor | email-delivery |
| EVLOG-EMAIL-ED-ASGN | EDITOR_ASSIGN | lib/pkp/classes/log/SubmissionEmailLogEventType.php:29 | Editor assigned (email sent) | lib.pkp.submission.event.editorAssign | email-delivery |
| EVLOG-EMAIL-ED-UNSUIT | EDITOR_NOTIFY_AUTHOR_UNSUITABLE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:30 | Editor notifies author submission unsuitable | lib.pkp.submission.event.editorNotifyAuthorUnsuitable | email-delivery |
| EVLOG-EMAIL-ED-REC-NOT | EDITOR_RECOMMEND_NOTIFY | lib/pkp/classes/log/SubmissionEmailLogEventType.php:31 | Editor recommendation notification | lib.pkp.submission.event.editorRecommendNotify | email-delivery |
| EVLOG-EMAIL-NEED-ED | NEEDS_EDITOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:32 | Editor needed notification | lib.pkp.submission.event.needsEditor | email-delivery |
| EVLOG-EMAIL-REV-NOTIFY | REVIEW_NOTIFY_REVIEWER | lib/pkp/classes/log/SubmissionEmailLogEventType.php:35 | Reviewer assignment notification | lib.pkp.submission.event.reviewNotifyReviewer | email-delivery |
| EVLOG-EMAIL-REV-THANK | REVIEW_THANK_REVIEWER | lib/pkp/classes/log/SubmissionEmailLogEventType.php:36 | Thank you email to reviewer | lib.pkp.submission.event.reviewThankReviewer | email-delivery |
| EVLOG-EMAIL-REV-CANCEL | REVIEW_CANCEL | lib/pkp/classes/log/SubmissionEmailLogEventType.php:37 | Review cancellation notification | lib.pkp.submission.event.reviewCancel | email-delivery |
| EVLOG-EMAIL-REV-REMIND | REVIEW_REMIND | lib/pkp/classes/log/SubmissionEmailLogEventType.php:38 | Review reminder email | lib.pkp.submission.event.reviewRemind | email-delivery |
| EVLOG-EMAIL-REV-CONF | REVIEW_CONFIRM | lib/pkp/classes/log/SubmissionEmailLogEventType.php:39 | Review confirmation email | lib.pkp.submission.event.reviewConfirm | email-delivery |
| EVLOG-EMAIL-REV-DECL | REVIEW_DECLINE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:40 | Review decline email | lib.pkp.submission.event.reviewDecline | email-delivery |
| EVLOG-EMAIL-REV-CONF-ACK | REVIEW_CONFIRM_ACK | lib/pkp/classes/log/SubmissionEmailLogEventType.php:41 | Confirmation acknowledgement | lib.pkp.submission.event.reviewConfirmAck | email-delivery |
| EVLOG-EMAIL-REV-REQ | REVIEW_REQUEST | lib/pkp/classes/log/SubmissionEmailLogEventType.php:42 | Review request email | lib.pkp.submission.event.reviewRequest | email-delivery |
| EVLOG-EMAIL-REV-REQ-SUB | REVIEW_REQUEST_SUBSEQUENT | lib/pkp/classes/log/SubmissionEmailLogEventType.php:43 | Subsequent review request | lib.pkp.submission.event.reviewRequestSubsequent | email-delivery |
| EVLOG-EMAIL-REV-REM-AUTO | REVIEW_REMIND_AUTO | lib/pkp/classes/log/SubmissionEmailLogEventType.php:44 | Automatic review reminder email | lib.pkp.submission.event.reviewRemindAuto | scheduled-tasks |
| EVLOG-EMAIL-REV-COMPL | REVIEW_COMPLETE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:45 | Review complete notification | lib.pkp.submission.event.reviewComplete | email-delivery |
| EVLOG-EMAIL-REV-REIN | REVIEW_REINSTATED | lib/pkp/classes/log/SubmissionEmailLogEventType.php:46 | Review reinstated notification | lib.pkp.submission.event.reviewReinstated | email-delivery |
| EVLOG-EMAIL-REV-RESEND | REVIEW_RESEND | lib/pkp/classes/log/SubmissionEmailLogEventType.php:47 | Review assignment resent | lib.pkp.submission.event.reviewResend | email-delivery |
| EVLOG-EMAIL-REV-EDIT | REVIEW_EDIT_NOTIFY_REVIEWER | lib/pkp/classes/log/SubmissionEmailLogEventType.php:48 | Reviewer notified of review edit | lib.pkp.submission.event.reviewEditNotifyReviewer | email-delivery |
| EVLOG-EMAIL-COPY-NOTIFY | COPYEDIT_NOTIFY_COPYEDITOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:51 | Copyeditor assignment notification | lib.pkp.submission.event.copyeditNotifyCopyeditor | production-stage |
| EVLOG-EMAIL-COPY-AUTH-NOT | COPYEDIT_NOTIFY_AUTHOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:52 | Author copyediting notification | lib.pkp.submission.event.copyeditNotifyAuthor | production-stage |
| EVLOG-EMAIL-COPY-FINAL | COPYEDIT_NOTIFY_FINAL | lib/pkp/classes/log/SubmissionEmailLogEventType.php:53 | Final copyediting notification | lib.pkp.submission.event.copyeditNotifyFinal | production-stage |
| EVLOG-EMAIL-COPY-COMPL | COPYEDIT_NOTIFY_COMPLETE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:54 | Copyediting complete notification | lib.pkp.submission.event.copyeditNotifyComplete | production-stage |
| EVLOG-EMAIL-COPY-AUTH-COMPL | COPYEDIT_NOTIFY_AUTHOR_COMPLETE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:55 | Author copyediting complete | lib.pkp.submission.event.copyeditNotifyAuthorComplete | production-stage |
| EVLOG-EMAIL-COPY-FINAL-COMPL | COPYEDIT_NOTIFY_FINAL_COMPLETE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:56 | Final copyediting complete | lib.pkp.submission.event.copyeditNotifyFinalComplete | production-stage |
| EVLOG-EMAIL-COPY-ACK | COPYEDIT_NOTIFY_ACKNOWLEDGE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:57 | Copyediting acknowledgement | lib.pkp.submission.event.copyeditNotifyAcknowledge | production-stage |
| EVLOG-EMAIL-COPY-AUTH-ACK | COPYEDIT_NOTIFY_AUTHOR_ACKNOWLEDGE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:58 | Author acknowledgement | lib.pkp.submission.event.copyeditNotifyAuthorAcknowledge | production-stage |
| EVLOG-EMAIL-COPY-FINAL-ACK | COPYEDIT_NOTIFY_FINAL_ACKNOWLEDGE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:59 | Final acknowledgement | lib.pkp.submission.event.copyeditNotifyFinalAcknowledge | production-stage |
| EVLOG-EMAIL-PROOF-AUTH-NOT | PROOFREAD_NOTIFY_AUTHOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:62 | Author proofing notification | lib.pkp.submission.event.proofreadNotifyAuthor | production-stage |
| EVLOG-EMAIL-PROOF-AUTH-COMPL | PROOFREAD_NOTIFY_AUTHOR_COMPLETE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:63 | Author proofing complete | lib.pkp.submission.event.proofreadNotifyAuthorComplete | production-stage |
| EVLOG-EMAIL-PROOF-AUTH-THANK | PROOFREAD_THANK_AUTHOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:64 | Thank you to author for proofing | lib.pkp.submission.event.proofreadThankAuthor | production-stage |
| EVLOG-EMAIL-PROOF-PROOF-NOT | PROOFREAD_NOTIFY_PROOFREADER | lib/pkp/classes/log/SubmissionEmailLogEventType.php:65 | Proofreader assignment | lib.pkp.submission.event.proofreadNotifyProofreader | production-stage |
| EVLOG-EMAIL-PROOF-PROOF-COMPL | PROOFREAD_NOTIFY_PROOFREADER_COMPLETE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:66 | Proofreader complete | lib.pkp.submission.event.proofreadNotifyProofreaderComplete | production-stage |
| EVLOG-EMAIL-PROOF-PROOF-THANK | PROOFREAD_THANK_PROOFREADER | lib/pkp/classes/log/SubmissionEmailLogEventType.php:67 | Thank you to proofreader | lib.pkp.submission.event.proofreadThankProofreader | production-stage |
| EVLOG-EMAIL-PROOF-LAYOUT-NOT | PROOFREAD_NOTIFY_LAYOUTEDITOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:68 | Layout editor proofing notification | lib.pkp.submission.event.proofreadNotifyLayouteditor | production-stage |
| EVLOG-EMAIL-PROOF-LAYOUT-COMPL | PROOFREAD_NOTIFY_LAYOUTEDITOR_COMPLETE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:69 | Layout editor proofing complete | lib.pkp.submission.event.proofreadNotifyLayouteditorComplete | production-stage |
| EVLOG-EMAIL-PROOF-LAYOUT-THANK | PROOFREAD_THANK_LAYOUTEDITOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:70 | Thank you to layout editor | lib.pkp.submission.event.proofreadThankLayouteditor | production-stage |
| EVLOG-EMAIL-LAYOUT-ED-NOT | LAYOUT_NOTIFY_EDITOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:73 | Layout stage editor notification | lib.pkp.submission.event.layoutNotifyEditor | production-stage |
| EVLOG-EMAIL-LAYOUT-ED-THANK | LAYOUT_THANK_EDITOR | lib/pkp/classes/log/SubmissionEmailLogEventType.php:74 | Thank you for layout | lib.pkp.submission.event.layoutThankEditor | production-stage |
| EVLOG-EMAIL-LAYOUT-COMPL | LAYOUT_NOTIFY_COMPLETE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:75 | Layout complete notification | lib.pkp.submission.event.layoutNotifyComplete | production-stage |
| EVLOG-EMAIL-INDEX-NOT | INDEX_NOTIFY_INDEXER | lib/pkp/classes/log/SubmissionEmailLogEventType.php:78 | Indexer notification | lib.pkp.submission.event.indexNotifyIndexer | ? |
| EVLOG-EMAIL-INDEX-COMPL | INDEX_NOTIFY_COMPLETE | lib/pkp/classes/log/SubmissionEmailLogEventType.php:79 | Indexing complete | lib.pkp.submission.event.indexNotifyComplete | ? |
| EVLOG-EMAIL-DISC-NOT | DISCUSSION_NOTIFY | lib/pkp/classes/log/SubmissionEmailLogEventType.php:82 | Discussion notification | lib.pkp.submission.event.discussionNotify | tasks-discussions |

## Gaps
- SUBMISSION_LOG_REVIEW_SET_DUE_DATE (0x40000011): Writer unknown; migrated but not traced to caller code
- SUBMISSION_LOG_TASK_OVERDUE: Computed on-the-fly in TaskResource, not persisted to database
- Email types INDEX_NOTIFY_* (0x80000001-2): Enum defined but no e2e plan; indexing workflow unclear
