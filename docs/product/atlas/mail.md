# Atlas sweep: mailables
- Scope: classes/mail/mailables (both repos)
- Method: glob + grep emailTemplateKey; coarse triggers from class name patterns
- Date: 2026-07-02
- Atom count: 69

| ID | Surface | Pointer | What it is | Hint | Claimed by |
|----|---------|---------|------------|------|------------|
| MAIL-announcement-notify | AnnouncementNotify | lib/pkp/classes/mail/mailables/AnnouncementNotify.php | template key: ANNOUNCEMENT | notifications | |
| MAIL-change-profile-email-invitation-notify | ChangeProfileEmailInvitationNotify | lib/pkp/classes/mail/mailables/ChangeProfileEmailInvitationNotify.php | template key: CHANGE_EMAIL | notifications | |
| MAIL-decision-accept-notify-author | DecisionAcceptNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionAcceptNotifyAuthor.php | template key: EDITOR_DECISION_ACCEPT | notifications | editorial-decisions |
| MAIL-decision-back-from-copyediting-notify-author | DecisionBackFromCopyeditingNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionBackFromCopyeditingNotifyAuthor.php | template key: EDITOR_DECISION_BACK_FROM_COPYEDITING | notifications | editorial-decisions |
| MAIL-decision-back-from-production-notify-author | DecisionBackFromProductionNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionBackFromProductionNotifyAuthor.php | template key: EDITOR_DECISION_BACK_FROM_PRODUCTION | notifications | editorial-decisions |
| MAIL-decision-cancel-review-round-notify-author | DecisionCancelReviewRoundNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionCancelReviewRoundNotifyAuthor.php | template key: EDITOR_DECISION_CANCEL_REVIEW_ROUND | notifications | editorial-decisions |
| MAIL-decision-decline-notify-author | DecisionDeclineNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionDeclineNotifyAuthor.php | template key: EDITOR_DECISION_DECLINE | notifications | editorial-decisions |
| MAIL-decision-initial-decline-notify-author | DecisionInitialDeclineNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionInitialDeclineNotifyAuthor.php | template key: EDITOR_DECISION_INITIAL_DECLINE | notifications | editorial-decisions |
| MAIL-decision-new-review-round-notify-author | DecisionNewReviewRoundNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionNewReviewRoundNotifyAuthor.php | template key: EDITOR_DECISION_NEW_ROUND | notifications | editorial-decisions |
| MAIL-decision-notify-other-authors | DecisionNotifyOtherAuthors | lib/pkp/classes/mail/mailables/DecisionNotifyOtherAuthors.php | template key: EDITOR_DECISION_NOTIFY_OTHER_AUTHORS | notifications | editorial-decisions |
| MAIL-decision-notify-reviewer | DecisionNotifyReviewer | lib/pkp/classes/mail/mailables/DecisionNotifyReviewer.php | template key: EDITOR_DECISION_NOTIFY_REVIEWERS | notifications | editorial-decisions |
| MAIL-decision-request-revisions-notify-author | DecisionRequestRevisionsNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionRequestRevisionsNotifyAuthor.php | template key: EDITOR_DECISION_REVISIONS | notifications | editorial-decisions |
| MAIL-decision-resubmit-notify-author | DecisionResubmitNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionResubmitNotifyAuthor.php | template key: EDITOR_DECISION_RESUBMIT | notifications | editorial-decisions |
| MAIL-decision-revert-decline-notify-author | DecisionRevertDeclineNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionRevertDeclineNotifyAuthor.php | template key: EDITOR_DECISION_REVERT_DECLINE | notifications | editorial-decisions |
| MAIL-decision-revert-initial-decline-notify-author | DecisionRevertInitialDeclineNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionRevertInitialDeclineNotifyAuthor.php | template key: EDITOR_DECISION_REVERT_INITIAL_DECLINE | notifications | editorial-decisions |
| MAIL-decision-send-external-review-notify-author | DecisionSendExternalReviewNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionSendExternalReviewNotifyAuthor.php | template key: EDITOR_DECISION_SEND_TO_EXTERNAL | notifications | editorial-decisions |
| MAIL-decision-send-to-production-notify-author | DecisionSendToProductionNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionSendToProductionNotifyAuthor.php | template key: EDITOR_DECISION_SEND_TO_PRODUCTION | notifications | editorial-decisions |
| MAIL-decision-skip-external-review-notify-author | DecisionSkipExternalReviewNotifyAuthor | lib/pkp/classes/mail/mailables/DecisionSkipExternalReviewNotifyAuthor.php | template key: EDITOR_DECISION_SKIP_REVIEW | notifications | editorial-decisions |
| MAIL-discussion-copyediting | DiscussionCopyediting | lib/pkp/classes/mail/mailables/DiscussionCopyediting.php | template key: DISCUSSION_NOTIFICATION_COPYEDITING | email-delivery | tasks-discussions |
| MAIL-discussion-production | DiscussionProduction | lib/pkp/classes/mail/mailables/DiscussionProduction.php | template key: DISCUSSION_NOTIFICATION_PRODUCTION | email-delivery | tasks-discussions |
| MAIL-discussion-review | DiscussionReview | lib/pkp/classes/mail/mailables/DiscussionReview.php | template key: DISCUSSION_NOTIFICATION_REVIEW | email-delivery | tasks-discussions |
| MAIL-discussion-submission | DiscussionSubmission | lib/pkp/classes/mail/mailables/DiscussionSubmission.php | template key: DISCUSSION_NOTIFICATION_SUBMISSION | email-delivery | tasks-discussions |
| MAIL-edit-review-notify | EditReviewNotify | lib/pkp/classes/mail/mailables/EditReviewNotify.php | template key: REVIEW_EDIT | notifications | |
| MAIL-editor-assigned | EditorAssigned | lib/pkp/classes/mail/mailables/EditorAssigned.php | template key: EDITOR_ASSIGN | email-delivery | |
| MAIL-editorial-reminder | EditorialReminder | lib/pkp/classes/mail/mailables/EditorialReminder.php | template key: EDITORIAL_REMINDER | scheduled-tasks | |
| MAIL-issue-published-notify | IssuePublishedNotify | classes/mail/mailables/IssuePublishedNotify.php | template key: ISSUE_PUBLISH_NOTIFY | notifications | |
| MAIL-open-access-notify | OpenAccessNotify | classes/mail/mailables/OpenAccessNotify.php | template key: OPEN_ACCESS_NOTIFY | notifications | |
| MAIL-orcid-collect-author-id | OrcidCollectAuthorId | lib/pkp/classes/mail/mailables/OrcidCollectAuthorId.php | template key: ORCID_COLLECT_AUTHOR_ID | | |
| MAIL-orcid-request-author-authorization | OrcidRequestAuthorAuthorization | lib/pkp/classes/mail/mailables/OrcidRequestAuthorAuthorization.php | template key: ORCID_REQUEST_AUTHOR_AUTHORIZATION | | |
| MAIL-orcid-request-update-scope | OrcidRequestUpdateScope | lib/pkp/classes/mail/mailables/OrcidRequestUpdateScope.php | template key: ORCID_REQUEST_UPDATE_SCOPE | | |
| MAIL-password-reset-requested | PasswordResetRequested | lib/pkp/classes/mail/mailables/PasswordResetRequested.php | template key: PASSWORD_RESET_CONFIRM | | |
| MAIL-payment-request | PaymentRequest | classes/mail/mailables/PaymentRequest.php | template key: PAYMENT_REQUEST_NOTIFICATION | | |
| MAIL-publication-version-notify | PublicationVersionNotify | lib/pkp/classes/mail/mailables/PublicationVersionNotify.php | template key: VERSION_CREATED | notifications | publication-versioning |
| MAIL-recommendation-notify-editors | RecommendationNotifyEditors | lib/pkp/classes/mail/mailables/RecommendationNotifyEditors.php | template key: EDITOR_RECOMMENDATION | notifications | editorial-decisions |
| MAIL-request-review-round-author-response | RequestReviewRoundAuthorResponse | lib/pkp/classes/mail/mailables/RequestReviewRoundAuthorResponse.php | template key: REQUEST_REVIEW_ROUND_AUTHOR_RESPONSE | email-delivery | |
| MAIL-review-acknowledgement | ReviewAcknowledgement | lib/pkp/classes/mail/mailables/ReviewAcknowledgement.php | template key: REVIEW_ACK | email-delivery | reviewer-response |
| MAIL-review-complete-notify-editors | ReviewCompleteNotifyEditors | lib/pkp/classes/mail/mailables/ReviewCompleteNotifyEditors.php | template key: REVIEW_COMPLETE | notifications | reviewer-response |
| MAIL-review-confirm | ReviewConfirm | lib/pkp/classes/mail/mailables/ReviewConfirm.php | template key: REVIEW_CONFIRM | email-delivery | reviewer-response |
| MAIL-review-decline | ReviewDecline | lib/pkp/classes/mail/mailables/ReviewDecline.php | template key: REVIEW_DECLINE | email-delivery | reviewer-response |
| MAIL-review-remind | ReviewRemind | lib/pkp/classes/mail/mailables/ReviewRemind.php | template key: REVIEW_REMIND | scheduled-tasks | |
| MAIL-review-remind-auto | ReviewRemindAuto | lib/pkp/classes/mail/mailables/ReviewRemindAuto.php | template key: REVIEW_REMIND_AUTO | scheduled-tasks | |
| MAIL-review-request | ReviewRequest | lib/pkp/classes/mail/mailables/ReviewRequest.php | template key: REVIEW_REQUEST | email-delivery | assign-and-manage-reviewers |
| MAIL-review-request-subsequent | ReviewRequestSubsequent | lib/pkp/classes/mail/mailables/ReviewRequestSubsequent.php | template key: REVIEW_REQUEST_SUBSEQUENT | email-delivery | assign-and-manage-reviewers |
| MAIL-review-response-remind-auto | ReviewResponseRemindAuto | lib/pkp/classes/mail/mailables/ReviewResponseRemindAuto.php | template key: REVIEW_RESPONSE_OVERDUE_AUTO | scheduled-tasks | |
| MAIL-reviewer-register | ReviewerRegister | lib/pkp/classes/mail/mailables/ReviewerRegister.php | template key: REVIEWER_REGISTER | email-delivery | |
| MAIL-reviewer-reinstate | ReviewerReinstate | lib/pkp/classes/mail/mailables/ReviewerReinstate.php | template key: REVIEW_REINSTATE | email-delivery | assign-and-manage-reviewers |
| MAIL-reviewer-resend-request | ReviewerResendRequest | lib/pkp/classes/mail/mailables/ReviewerResendRequest.php | template key: REVIEW_RESEND_REQUEST | email-delivery | assign-and-manage-reviewers |
| MAIL-reviewer-unassign | ReviewerUnassign | lib/pkp/classes/mail/mailables/ReviewerUnassign.php | template key: REVIEW_CANCEL | email-delivery | assign-and-manage-reviewers |
| MAIL-revised-version-notify | RevisedVersionNotify | lib/pkp/classes/mail/mailables/RevisedVersionNotify.php | template key: REVISED_VERSION_NOTIFY | notifications | |
| MAIL-statistics-report-notify | StatisticsReportNotify | lib/pkp/classes/mail/mailables/StatisticsReportNotify.php | template key: STATISTICS_REPORT_NOTIFICATION | scheduled-tasks | |
| MAIL-submission-acknowledgement | SubmissionAcknowledgement | lib/pkp/classes/mail/mailables/SubmissionAcknowledgement.php | template key: SUBMISSION_ACK | | submission-wizard |
| MAIL-submission-acknowledgement-not-author | SubmissionAcknowledgementNotAuthor | lib/pkp/classes/mail/mailables/SubmissionAcknowledgementNotAuthor.php | template key: SUBMISSION_ACK_NOT_USER | | submission-wizard |
| MAIL-submission-acknowledgement-other-authors | SubmissionAcknowledgementOtherAuthors | lib/pkp/classes/mail/mailables/SubmissionAcknowledgementOtherAuthors.php | template key: SUBMISSION_ACK_NOT_USER | | submission-wizard |
| MAIL-submission-needs-editor | SubmissionNeedsEditor | lib/pkp/classes/mail/mailables/SubmissionNeedsEditor.php | template key: SUBMISSION_NEEDS_EDITOR | email-delivery | |
| MAIL-submission-saved-for-later | SubmissionSavedForLater | lib/pkp/classes/mail/mailables/SubmissionSavedForLater.php | template key: SUBMISSION_SAVED_FOR_LATER | | submission-drafts |
| MAIL-subscription-expired | SubscriptionExpired | classes/mail/mailables/SubscriptionExpired.php | template key: SUBSCRIPTION_AFTER_EXPIRY | | |
| MAIL-subscription-expired-last | SubscriptionExpiredLast | classes/mail/mailables/SubscriptionExpiredLast.php | template key: SUBSCRIPTION_AFTER_EXPIRY_LAST | | |
| MAIL-subscription-expires-soon | SubscriptionExpiresSoon | classes/mail/mailables/SubscriptionExpiresSoon.php | template key: SUBSCRIPTION_BEFORE_EXPIRY | | |
| MAIL-subscription-notify | SubscriptionNotify | classes/mail/mailables/SubscriptionNotify.php | template key: SUBSCRIPTION_NOTIFY | notifications | |
| MAIL-subscription-purchase-individual | SubscriptionPurchaseIndividual | classes/mail/mailables/SubscriptionPurchaseIndividual.php | template key: SUBSCRIPTION_PURCHASE_INDL | | |
| MAIL-subscription-purchase-institutional | SubscriptionPurchaseInstitutional | classes/mail/mailables/SubscriptionPurchaseInstitutional.php | template key: SUBSCRIPTION_PURCHASE_INSTL | | |
| MAIL-subscription-renew-individual | SubscriptionRenewIndividual | classes/mail/mailables/SubscriptionRenewIndividual.php | template key: SUBSCRIPTION_RENEW_INDL | | |
| MAIL-subscription-renew-institutional | SubscriptionRenewInstitutional | classes/mail/mailables/SubscriptionRenewInstitutional.php | template key: SUBSCRIPTION_RENEW_INSTL | | |
| MAIL-user-created | UserCreated | lib/pkp/classes/mail/mailables/UserCreated.php | template key: USER_REGISTER | | |
| MAIL-user-role-assignment-invitation-notify | UserRoleAssignmentInvitationNotify | lib/pkp/classes/mail/mailables/UserRoleAssignmentInvitationNotify.php | template key: USER_ROLE_ASSIGNMENT_INVITATION | notifications | |
| MAIL-user-role-end-notify | UserRoleEndNotify | lib/pkp/classes/mail/mailables/UserRoleEndNotify.php | template key: USER_ROLE_END | notifications | |
| MAIL-user-role-masthead-update-notify | UserRoleMastheadUpdateNotify | lib/pkp/classes/mail/mailables/UserRoleMastheadUpdateNotify.php | template key: USER_ROLE_MASTHEAD_UPDATE | notifications | |
| MAIL-validate-email-context | ValidateEmailContext | lib/pkp/classes/mail/mailables/ValidateEmailContext.php | template key: USER_VALIDATE_CONTEXT | | |
| MAIL-validate-email-site | ValidateEmailSite | lib/pkp/classes/mail/mailables/ValidateEmailSite.php | template key: USER_VALIDATE_SITE | | |

## Gaps
- No class-by-class usage location capture (file/line where instantiated)
- SubmissionAcknowledgementOtherAuthors and SubmissionAcknowledgementNotAuthor share template key SUBMISSION_ACK_NOT_USER
- Email validation mailables (ValidateEmailContext/Site) only indicate site vs context scope; actual workflow unclear from class names alone
