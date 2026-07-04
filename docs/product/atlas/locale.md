# Atlas sweep: locale key prefixes
- Scope: locale/en (both repos), two-segment prefixes, count>=4
- Method: `grep '^msgid' <file> | sed 's/^msgid "\(.*\)"$/\1/' | sed 's/^\([^.]*\)\.\([^.]*\).*/\1.\2/' | sort | uniq -c | sort -rn`
- Date: 2026-07-02
- Atom count: 242

| ID | Surface | Pointer | What it is | Hint | Claimed by |
|---|---|---|---|---|---|
| LOC-admin-admin-cli | `admin.cli.*` | admin.po | 97 keys |  | |
| LOC-admin-admin-settings | `admin.settings.*` | admin.po | 52 keys |  | |
| LOC-admin-admin-scheduledTask | `admin.scheduledTask.*` | admin.po | 43 keys |  | |
| LOC-admin-admin-job | `admin.job.*` | admin.po | 20 keys |  | |
| LOC-admin-admin-jobs | `admin.jobs.*` | admin.po | 17 keys |  | |
| LOC-admin-admin-languages | `admin.languages.*` | admin.po | 14 keys |  | |
| LOC-admin-admin-error | `admin.error.*` | admin.po | 14 keys |  | |
| LOC-admin-admin-journals | `admin.journals.*` | admin.po | 10 keys |  | |
| LOC-admin-admin-version | `admin.version.*` | admin.po | 8 keys |  | |
| LOC-admin-admin-mergeUsers | `admin.mergeUsers.*` | admin.po | 7 keys |  | |
| LOC-admin-admin-contexts | `admin.contexts.*` | admin.po | 7 keys |  | |
| LOC-admin-navigation-tools | `navigation.tools.*` | admin.po | 7 keys |  | |
| LOC-admin-admin-fileLoader | `admin.fileLoader.*` | admin.po | 6 keys |  | |
| LOC-admin-admin-server | `admin.server.*` | admin.po | 5 keys |  | |
| LOC-admin-admin-workflow | `admin.workflow.*` | admin.po | 4 keys |  | |
| LOC-admin-misc | `(misc)` | admin.po | 1 rarer prefixes | admin.systemInformation (3) | |
| LOC-api-api-submissionFiles | `api.submissionFiles.*` | api.po | 20 keys |  | |
| LOC-api-api-dois | `api.dois.*` | api.po | 16 keys |  | |
| LOC-api-api-400 | `api.400.*` | api.po | 11 keys |  | |
| LOC-api-api-submissions | `api.submissions.*` | api.po | 9 keys |  | |
| LOC-api-api-userComments | `api.userComments.*` | api.po | 9 keys |  | |
| LOC-api-api-jobs | `api.jobs.*` | api.po | 8 keys |  | |
| LOC-api-api-contexts | `api.contexts.*` | api.po | 7 keys |  | |
| LOC-api-api-stats | `api.stats.*` | api.po | 7 keys |  | |
| LOC-api-api-submission | `api.submission.*` | api.po | 6 keys |  | |
| LOC-api-api-publicFiles | `api.publicFiles.*` | api.po | 6 keys |  | |
| LOC-api-api-publication | `api.publication.*` | api.po | 5 keys |  | |
| LOC-api-api-orcid | `api.orcid.*` | api.po | 5 keys |  | |
| LOC-api-api-files | `api.files.*` | api.po | 5 keys |  | |
| LOC-api-api-emailTemplates | `api.emailTemplates.*` | api.po | 4 keys |  | |
| LOC-api-api-emails | `api.emails.*` | api.po | 4 keys |  | |
| LOC-api-api-contributorRole | `api.contributorRole.*` | api.po | 4 keys | contributors | |
| LOC-api-misc | `(misc)` | api.po | 4 rarer prefixes | api.publications (3), api.reviewRound (3), api.highlights (3), api.categories (3) | |
| LOC-author-author-submit | `author.submit.*` | author.po | 79 keys |  | |
| LOC-author-author-submissions | `author.submissions.*` | author.po | 9 keys |  | |
| LOC-author-misc | `(misc)` | author.po | 1 rarer prefixes | author.article (3) | |
| LOC-common-notification-type | `notification.type.*` | common.po | 17 keys |  | |
| LOC-common-user-authorization | `user.authorization.*` | common.po | 11 keys |  | |
| LOC-common-form-dropzone | `form.dropzone.*` | common.po | 11 keys |  | |
| LOC-common-email-addAttachment | `email.addAttachment.*` | common.po | 9 keys |  | |
| LOC-common-common-upload | `common.upload.*` | common.po | 8 keys |  | |
| LOC-common-notification-unsubscribeNotifications | `notification.unsubscribeNotifications.*` | common.po | 7 keys |  | |
| LOC-common-reviewer-submission | `reviewer.submission.*` | common.po | 6 keys |  | |
| LOC-common-grid-action | `grid.action.*` | common.po | 6 keys |  | |
| LOC-common-stageParticipants-notify | `stageParticipants.notify.*` | common.po | 5 keys |  | |
| LOC-common-navigation-skip | `navigation.skip.*` | common.po | 5 keys |  | |
| LOC-common-common-pagination | `common.pagination.*` | common.po | 5 keys |  | |
| LOC-common-common-editorialHistory | `common.editorialHistory.*` | common.po | 5 keys |  | |
| LOC-common-about-contact | `about.contact.*` | common.po | 5 keys |  | |
| LOC-common-validator-size | `validator.size.*` | common.po | 4 keys |  | |
| LOC-common-validator-min | `validator.min.*` | common.po | 4 keys |  | |
| LOC-common-validator-max | `validator.max.*` | common.po | 4 keys |  | |
| LOC-common-validator-between | `validator.between.*` | common.po | 4 keys |  | |
| LOC-common-search-cli | `search.cli.*` | common.po | 4 keys |  | |
| LOC-common-email-compose | `email.compose.*` | common.po | 4 keys |  | |
| LOC-common-debug-notes | `debug.notes.*` | common.po | 4 keys |  | |
| LOC-common-common-navigation | `common.navigation.*` | common.po | 4 keys |  | |
| LOC-common-common-error | `common.error.*` | common.po | 4 keys |  | |
| LOC-common-misc | `(misc)` | common.po | 5 rarer prefixes | search.searchResults (3), navigation.tools (3), informationCenter.history (3), common.file (3), common.editorialMasthead (3) | |
| LOC-default-default-groups | `default.groups.*` | default.po | 41 keys |  | |
| LOC-default-default-contextSettings | `default.contextSettings.*` | default.po | 9 keys |  | |
| LOC-default-default-submission | `default.submission.*` | default.po | 7 keys |  | |
| LOC-default-default-genres | `default.genres.*` | default.po | 4 keys |  | |
| LOC-default-misc | `(misc)` | default.po | 1 rarer prefixes | section.default (3) | |
| LOC-editor-editor-issues | `editor.issues.*` | editor.po | 76 keys |  | |
| LOC-editor-editor-review | `editor.review.*` | editor.po | 74 keys |  | |
| LOC-editor-editor-submission | `editor.submission.*` | editor.po | 67 keys |  | |
| LOC-editor-reviewer-list | `reviewer.list.*` | editor.po | 24 keys |  | |
| LOC-editor-editor-submissionReview | `editor.submissionReview.*` | editor.po | 17 keys |  | |
| LOC-editor-grid-action | `grid.action.*` | editor.po | 11 keys |  | |
| LOC-editor-editor-submissions | `editor.submissions.*` | editor.po | 11 keys |  | |
| LOC-editor-editor-notifyUsers | `editor.notifyUsers.*` | editor.po | 9 keys |  | |
| LOC-editor-editor-decision | `editor.decision.*` | editor.po | 8 keys |  | |
| LOC-editor-misc | `(misc)` | editor.po | 3 rarer prefixes | editor.article (3), editor.submissionArchive (3), submission.queries (3) | |
| LOC-emails-emailTemplate-variable | `emailTemplate.variable.*` | emails.po | 16 keys |  | |
| LOC-emails-emails-userRoleAssignmentInvitationNotify | `emails.userRoleAssignmentInvitationNotify.*` | emails.po | 8 keys |  | |
| LOC-emails-emails-decision | `emails.decision.*` | emails.po | 4 keys |  | |
| LOC-emails-misc | `(misc)` | emails.po | 7 rarer prefixes | emails.paymentRequestNotification (3), emails.submissionAck (3), emails.orcidRequestUpdateScope (3), emails.orcidRequestAuthorAuthorization (3), emails.orcidCollectAuthorId (3), emails.footer (3), emails.changeProfileEmailInvitationNotify (3) | |
| LOC-grid-grid-action | `grid.action.*` | grid.po | 125 keys |  | |
| LOC-grid-grid-user | `grid.user.*` | grid.po | 45 keys |  | |
| LOC-grid-grid-userGroup | `grid.userGroup.*` | grid.po | 10 keys |  | |
| LOC-grid-contributor-listPanel | `contributor.listPanel.*` | grid.po | 7 keys | contributors | |
| LOC-grid-grid-libraryFiles | `grid.libraryFiles.*` | grid.po | 6 keys |  | document-library |
| LOC-grid-grid-columns | `grid.columns.*` | grid.po | 6 keys |  | |
| LOC-grid-grid-artworkFile | `grid.artworkFile.*` | grid.po | 6 keys |  | |
| LOC-grid-author-users | `author.users.*` | grid.po | 6 keys |  | |
| LOC-grid-grid-task | `grid.task.*` | grid.po | 5 keys |  | tasks-discussions |
| LOC-grid-misc | `(misc)` | grid.po | 2 rarer prefixes | grid.roles (3), grid.navigationMenus (3) | |
| LOC-installer-installer-form | `installer.form.*` | installer.po | 12 keys |  | |
| LOC-installer-installer-appKey | `installer.appKey.*` | installer.po | 9 keys |  | |
| LOC-invitation-invitation-userRoleAssignment | `invitation.userRoleAssignment.*` | invitation.po | 27 keys |  | |
| LOC-invitation-invitation-role | `invitation.role.*` | invitation.po | 6 keys |  | |
| LOC-invitation-invitation-api | `invitation.api.*` | invitation.po | 6 keys |  | |
| LOC-invitation-acceptInvitation-userDetails | `acceptInvitation.userDetails.*` | invitation.po | 6 keys |  | |
| LOC-invitation-acceptInvitation-userDetailsForm | `acceptInvitation.userDetailsForm.*` | invitation.po | 5 keys |  | |
| LOC-invitation-userInvitation-searchUser | `userInvitation.searchUser.*` | invitation.po | 4 keys |  | |
| LOC-invitation-acceptInvitation-verifyOrcid | `acceptInvitation.verifyOrcid.*` | invitation.po | 4 keys |  | |
| LOC-invitation-misc | `(misc)` | invitation.po | 8 rarer prefixes | acceptInvitation.accountDetails (3), userInvitation.sendMail (3), userInvitation.roleTable (3), userInvitation.enterDetails (3), invitation.validation (3), invitation.decline (3), invitation.cancelInvite (3), acceptInvitation.privacyStatement (3) | |
| LOC-locale-reviewer-article | `reviewer.article.*` | locale.po | 44 keys |  | |
| LOC-locale-user-subscriptions | `user.subscriptions.*` | locale.po | 38 keys |  | |
| LOC-locale-submission-event | `submission.event.*` | locale.po | 30 keys |  | |
| LOC-locale-notification-type | `notification.type.*` | locale.po | 19 keys |  | |
| LOC-locale-user-register | `user.register.*` | locale.po | 18 keys |  | |
| LOC-locale-log-review | `log.review.*` | locale.po | 13 keys |  | |
| LOC-locale-submission-copyedit | `submission.copyedit.*` | locale.po | 12 keys |  | |
| LOC-locale-search-results | `search.results.*` | locale.po | 12 keys |  | |
| LOC-locale-common-queue | `common.queue.*` | locale.po | 12 keys |  | |
| LOC-locale-submission-layout | `submission.layout.*` | locale.po | 10 keys |  | |
| LOC-locale-submission-comments | `submission.comments.*` | locale.po | 10 keys |  | |
| LOC-locale-sectionEditor-regrets | `sectionEditor.regrets.*` | locale.po | 9 keys |  | |
| LOC-locale-payment-type | `payment.type.*` | locale.po | 9 keys |  | |
| LOC-locale-user-role | `user.role.*` | locale.po | 8 keys |  | |
| LOC-locale-subscriptions-status | `subscriptions.status.*` | locale.po | 8 keys |  | |
| LOC-locale-log-editor | `log.editor.*` | locale.po | 8 keys |  | |
| LOC-locale-user-noRoles | `user.noRoles.*` | locale.po | 7 keys |  | |
| LOC-locale-user-authorization | `user.authorization.*` | locale.po | 7 keys |  | |
| LOC-locale-submission-logType | `submission.logType.*` | locale.po | 7 keys |  | |
| LOC-locale-log-copyedit | `log.copyedit.*` | locale.po | 7 keys |  | |
| LOC-locale-about-onlineSubmissions | `about.onlineSubmissions.*` | locale.po | 7 keys |  | |
| LOC-locale-grid-catalogEntry | `grid.catalogEntry.*` | locale.po | 5 keys |  | |
| LOC-locale-subscriptionTypes-format | `subscriptionTypes.format.*` | locale.po | 4 keys |  | |
| LOC-locale-plugins-categories | `plugins.categories.*` | locale.po | 4 keys |  | |
| LOC-locale-payment-loginRequired | `payment.loginRequired.*` | locale.po | 4 keys |  | |
| LOC-locale-article-fontSize | `article.fontSize.*` | locale.po | 4 keys |  | |
| LOC-locale-about-subscriptionTypes | `about.subscriptionTypes.*` | locale.po | 4 keys |  | |
| LOC-locale-misc | `(misc)` | locale.po | 11 rarer prefixes | user.reviewerPrompt (3), user.profile (3), payment.subscription (3), payment.membership (3), manager.setup (3), log.layout (3), layoutEditor.galley (3), doi.issue (3), copyeditor.article (3), article.comments (3), about.subscriptions (3) | |
| LOC-manager-manager-setup | `manager.setup.*` | manager.po | 207 keys |  | |
| LOC-manager-manager-subscriptions | `manager.subscriptions.*` | manager.po | 77 keys |  | |
| LOC-manager-emailTemplate-variable | `emailTemplate.variable.*` | manager.po | 67 keys |  | |
| LOC-manager-manager-plugins | `manager.plugins.*` | manager.po | 65 keys |  | |
| LOC-manager-manager-dois | `manager.dois.*` | manager.po | 58 keys |  | |
| LOC-manager-manager-navigationMenus | `manager.navigationMenus.*` | manager.po | 52 keys |  | |
| LOC-manager-manager-subscriptionTypes | `manager.subscriptionTypes.*` | manager.po | 46 keys |  | |
| LOC-manager-plugins-importexport | `plugins.importexport.*` | manager.po | 46 keys |  | |
| LOC-manager-mailable-decision | `mailable.decision.*` | manager.po | 42 keys |  | |
| LOC-manager-manager-people | `manager.people.*` | manager.po | 41 keys |  | |
| LOC-manager-manager-subscriptionPolicies | `manager.subscriptionPolicies.*` | manager.po | 39 keys |  | |
| LOC-manager-manager-payment | `manager.payment.*` | manager.po | 38 keys |  | |
| LOC-manager-manager-userComment | `manager.userComment.*` | manager.po | 34 keys |  | |
| LOC-manager-doi-manager | `doi.manager.*` | manager.po | 30 keys |  | |
| LOC-manager-manager-announcements | `manager.announcements.*` | manager.po | 30 keys |  | |
| LOC-manager-doi-editor | `doi.editor.*` | manager.po | 28 keys |  | |
| LOC-manager-manager-statistics | `manager.statistics.*` | manager.po | 27 keys |  | |
| LOC-manager-manager-emails | `manager.emails.*` | manager.po | 24 keys |  | |
| LOC-manager-manager-reviewFormElements | `manager.reviewFormElements.*` | manager.po | 23 keys |  | review-forms |
| LOC-manager-stats-dateRange | `stats.dateRange.*` | manager.po | 21 keys |  | |
| LOC-manager-plugins-categories | `plugins.categories.*` | manager.po | 20 keys |  | |
| LOC-manager-settings-roles | `settings.roles.*` | manager.po | 19 keys |  | |
| LOC-manager-manager-reviewForms | `manager.reviewForms.*` | manager.po | 18 keys |  | review-forms |
| LOC-manager-stats-name | `stats.name.*` | manager.po | 16 keys |  | |
| LOC-manager-manager-contributorRoles | `manager.contributorRoles.*` | manager.po | 16 keys | contributors | |
| LOC-manager-manager-settings | `manager.settings.*` | manager.po | 13 keys |  | |
| LOC-manager-manager-category | `manager.category.*` | manager.po | 13 keys |  | |
| LOC-manager-grid-category | `grid.category.*` | manager.po | 13 keys |  | |
| LOC-manager-manager-announcementTypes | `manager.announcementTypes.*` | manager.po | 12 keys |  | |
| LOC-manager-manager-language | `manager.language.*` | manager.po | 10 keys |  | |
| LOC-manager-settings-libraryFiles | `settings.libraryFiles.*` | manager.po | 10 keys |  | document-library |
| LOC-manager-manager-groups | `manager.groups.*` | manager.po | 10 keys |  | |
| LOC-manager-stats-issues | `stats.issues.*` | manager.po | 9 keys |  | |
| LOC-manager-manager-distribution | `manager.distribution.*` | manager.po | 8 keys |  | |
| LOC-manager-manager-mailables | `manager.mailables.*` | manager.po | 8 keys |  | |
| LOC-manager-manager-institutions | `manager.institutions.*` | manager.po | 8 keys |  | |
| LOC-manager-manager-highlights | `manager.highlights.*` | manager.po | 8 keys |  | |
| LOC-manager-manager-publication | `manager.publication.*` | manager.po | 7 keys |  | |
| LOC-manager-manager-files | `manager.files.*` | manager.po | 7 keys |  | |
| LOC-manager-manager-sections | `manager.sections.*` | manager.po | 6 keys |  | |
| LOC-manager-grid-action | `grid.action.*` | manager.po | 6 keys |  | |
| LOC-manager-manager-reviewerRecommendations | `manager.reviewerRecommendations.*` | manager.po | 5 keys |  | |
| LOC-manager-stats-context | `stats.context.*` | manager.po | 5 keys |  | |
| LOC-manager-manager-website | `manager.website.*` | manager.po | 5 keys |  | |
| LOC-manager-manager-reviewerSearch | `manager.reviewerSearch.*` | manager.po | 5 keys |  | |
| LOC-manager-manager-paymentMethod | `manager.paymentMethod.*` | manager.po | 5 keys |  | |
| LOC-manager-stats-publications | `stats.publications.*` | manager.po | 4 keys |  | |
| LOC-manager-manager-submissionAck | `manager.submissionAck.*` | manager.po | 4 keys |  | |
| LOC-manager-manager-navigationMenu | `manager.navigationMenu.*` | manager.po | 4 keys |  | |
| LOC-manager-manager-editorialStatistics | `manager.editorialStatistics.*` | manager.po | 4 keys |  | |
| LOC-manager-misc | `(misc)` | manager.po | 6 rarer prefixes | manager.languages (3), grid.genres (3), api.issue (3), stats.timeline (3), stats.description (3), manager.submitWithCategories (3) | |
| LOC-reviewer-reviewer-submission | `reviewer.submission.*` | reviewer.po | 39 keys |  | |
| LOC-reviewer-submission-comments | `submission.comments.*` | reviewer.po | 4 keys |  | |
| LOC-reviewer-reviewer-reviewSteps | `reviewer.reviewSteps.*` | reviewer.po | 4 keys |  | |
| LOC-reviewer-misc | `(misc)` | reviewer.po | 1 rarer prefixes | reviewer.step1 (3) | |
| LOC-submission-editor-submission | `editor.submission.*` | submission.po | 158 keys |  | |
| LOC-submission-metadata-property | `metadata.property.*` | submission.po | 85 keys |  | submission-wizard-metadata |
| LOC-submission-submission-submit | `submission.submit.*` | submission.po | 69 keys |  | submission-wizard |
| LOC-submission-submission-citations | `submission.citations.*` | submission.po | 66 keys |  | |
| LOC-submission-submission-event | `submission.event.*` | submission.po | 55 keys |  | |
| LOC-submission-submission-wizard | `submission.wizard.*` | submission.po | 34 keys |  | submission-wizard |
| LOC-submission-dashboard-reviewAssignment | `dashboard.reviewAssignment.*` | submission.po | 34 keys (reviewer-dashboard activity/actions strings) |  | editorial-dashboards |
| LOC-submission-submission-list | `submission.list.*` | submission.po | 32 keys |  | |
| LOC-submission-submission-layout | `submission.layout.*` | submission.po | 27 keys |  | |
| LOC-submission-submission-dashboard | `submission.dashboard.*` | submission.po | 27 keys (dashboard view titles) |  | editorial-dashboards |
| LOC-submission-publication-mediaFiles | `publication.mediaFiles.*` | submission.po | 27 keys |  | media-files |
| LOC-submission-submission-upload | `submission.upload.*` | submission.po | 22 keys |  | |
| LOC-submission-submission-dataCitations | `submission.dataCitations.*` | submission.po | 20 keys |  | |
| LOC-submission-submission-query | `submission.query.*` | submission.po | 19 keys |  | tasks-discussions |
| LOC-submission-submission-license | `submission.license.*` | submission.po | 19 keys |  | publication-license |
| LOC-submission-submission-task | `submission.task.*` | submission.po | 18 keys |  | tasks-discussions |
| LOC-submission-notification-type | `notification.type.*` | submission.po | 18 keys |  | |
| LOC-submission-submission-notes | `submission.notes.*` | submission.po | 17 keys |  | |
| LOC-submission-discussion-form | `discussion.form.*` | submission.po | 16 keys |  | tasks-discussions |
| LOC-submission-publication-updateType | `publication.updateType.*` | submission.po | 14 keys |  | |
| LOC-submission-submission-comments | `submission.comments.*` | submission.po | 13 keys |  | |
| LOC-submission-publication-jats | `publication.jats.*` | submission.po | 13 keys |  | |
| LOC-submission-publication-publish | `publication.publish.*` | submission.po | 12 keys |  | |
| LOC-submission-metadata-filters | `metadata.filters.*` | submission.po | 12 keys |  | |
| LOC-submission-submission-reviewRound | `submission.reviewRound.*` | submission.po | 11 keys |  | |
| LOC-submission-submission-review | `submission.review.*` | submission.po | 11 keys |  | |
| LOC-submission-publication-assignToIssue | `publication.assignToIssue.*` | submission.po | 9 keys |  | |
| LOC-submission-submission-history | `submission.history.*` | submission.po | 8 keys |  | |
| LOC-submission-submission-status | `submission.status.*` | submission.po | 7 keys |  | |
| LOC-submission-publication-versionStage | `publication.versionStage.*` | submission.po | 7 keys |  | publication-versioning |
| LOC-submission-log-review | `log.review.*` | submission.po | 7 keys |  | |
| LOC-submission-publication-event | `publication.event.*` | submission.po | 6 keys |  | |
| LOC-submission-submission-files | `submission.files.*` | submission.po | 6 keys |  | |
| LOC-submission-submission-supplementary | `submission.supplementary.*` | submission.po | 5 keys |  | |
| LOC-submission-submission-page | `submission.page.*` | submission.po | 5 keys |  | |
| LOC-submission-submission-informationCenter | `submission.informationCenter.*` | submission.po | 5 keys |  | |
| LOC-submission-submission-howToCite | `submission.howToCite.*` | submission.po | 5 keys |  | |
| LOC-submission-publication-bodyText | `publication.bodyText.*` | submission.po | 5 keys |  | publication-title-abstract-body |
| LOC-submission-grid-action | `grid.action.*` | submission.po | 4 keys |  | |
| LOC-submission-submission-form | `submission.form.*` | submission.po | 4 keys |  | |
| LOC-submission-submission-email | `submission.email.*` | submission.po | 4 keys |  | |
| LOC-submission-publication-urlPath | `publication.urlPath.*` | submission.po | 4 keys |  | publication-identifiers |
| LOC-submission-publication-scheduledForPublication | `publication.scheduledForPublication.*` | submission.po | 4 keys |  | |
| LOC-submission-publication-revisionSignificance | `publication.revisionSignificance.*` | submission.po | 4 keys |  | |
| LOC-submission-dashboard-submissions | `dashboard.submissions.*` | submission.po | 4 keys (all `dashboard.submissions.incomplete.bulkDelete.*`) | | submission-drafts |
| LOC-submission-catalog-sortBy | `catalog.sortBy.*` | submission.po | 4 keys |  | |
| LOC-submission-misc | `(misc)` | submission.po | 13 rarer prefixes | grid.issueEntry (3), doi.submission (3), submission.stage (3), submission.queries (3), submission.publisherId (3), submission.parsedCitations (3), submission.authors (3), stage.review (3), publication.required (3), dashboard.recommendOnly (3), common.queue (3), author.submit (3), author.competingInterests (3) | |
| LOC-sushi-sushi-exception | `sushi.exception.*` | sushi.po | 13 keys |  | |
| LOC-sushi-sushi-reports | `sushi.reports.*` | sushi.po | 6 keys |  | |
| LOC-user-orcid-manager | `orcid.manager.*` | user.po | 30 keys |  | |
| LOC-user-user-profile | `user.profile.*` | user.po | 29 keys |  | |
| LOC-user-user-login | `user.login.*` | user.po | 27 keys |  | |
| LOC-user-user-role | `user.role.*` | user.po | 19 keys |  | |
| LOC-user-user-authorization | `user.authorization.*` | user.po | 19 keys |  | |
| LOC-user-user-affiliations | `user.affiliations.*` | user.po | 19 keys |  | |
| LOC-user-user-register | `user.register.*` | user.po | 13 keys |  | |
| LOC-user-orcid-verify | `orcid.verify.*` | user.po | 11 keys |  | |
| LOC-user-orcid-field | `orcid.field.*` | user.po | 9 keys |  | |
| LOC-user-user-apiKey | `user.apiKey.*` | user.po | 7 keys |  | |
| LOC-user-orcid-about | `orcid.about.*` | user.po | 7 keys |  | |
| LOC-user-orcid-author | `orcid.author.*` | user.po | 6 keys |  | |

## Gaps
- Raised count threshold to ≥4 (from ≥3) to stay within 250-atom hard cap. Threshold ≥4 yields 242 atoms.

Top unclaimed prefixes by key count:
- `manager.setup` (207 keys, manager.po)
- `editor.submission` (158 keys, submission.po)
- `grid.action` (125 keys, grid.po)
- `admin.cli` (97 keys, admin.po)
- `metadata.property` (85 keys, submission.po)
