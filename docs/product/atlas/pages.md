# Atlas sweep: page handlers
- Scope: pages/, lib/pkp/pages/
- Method: `find` for `*Handler.php` in both trees; read each `index.php` router's `switch ($op)` case list; cross-checked against `addRoleAssignment()` arrays and `public function` op methods; one atom per URL-reachable op (OJS class wins when it extends/absorbs a lib/pkp base with no independent `index.php`); hint from one `ls docs/e2e/plans/`
- Date: 2026-07-02
- Atom count: 164

| ID | Surface | Pointer | What it is | Hint | Claimed by |
|----|---------|---------|------------|------|------------|
| PAGE-about-subscriptions | AboutHandler::subscriptions | pages/about/AboutHandler.php | Journal subscriptions info page (OJS override) | subscription-access.md | |
| PAGE-about-index | AboutContextHandler::index | lib/pkp/pages/about/AboutContextHandler.php | About-journal landing page, via pages/about fallback | | about-pages |
| PAGE-about-editorialmasthead | AboutContextHandler::editorialMasthead | lib/pkp/pages/about/AboutContextHandler.php | Editorial masthead/team listing page | editorial-masthead.md | about-pages (public page; config → editorial-masthead) |
| PAGE-about-editorialhistory | AboutContextHandler::editorialHistory | lib/pkp/pages/about/AboutContextHandler.php | Editorial history page | editorial-masthead.md | about-pages |
| PAGE-about-submissions | AboutContextHandler::submissions | lib/pkp/pages/about/AboutContextHandler.php | Author submission guidelines info page | | about-pages |
| PAGE-about-contact | AboutContextHandler::contact | lib/pkp/pages/about/AboutContextHandler.php | Journal contact info page | | about-pages |
| PAGE-about-privacy | AboutSiteHandler::privacy | lib/pkp/pages/about/AboutSiteHandler.php | Privacy statement page | | about-pages |
| PAGE-about-aboutthispublishingsystem | AboutSiteHandler::aboutThisPublishingSystem | lib/pkp/pages/about/AboutSiteHandler.php | "About this publishing system" info page | | about-pages |
| PAGE-article-view | ArticleHandler::view | pages/article/ArticleHandler.php | Article landing/abstract view page | article-landing.md | article-landing |
| PAGE-article-viewfile | ArticleHandler::viewFile | pages/article/ArticleHandler.php | Legacy article file view URL (301 → download) | | article-landing |
| PAGE-article-downloadsuppfile | ArticleHandler::downloadSuppFile | pages/article/ArticleHandler.php | Legacy supplementary file download URL | galleys | galleys |
| PAGE-article-download | ArticleHandler::download | pages/article/ArticleHandler.php | Article galley/file download | galleys.md | galleys |
| PAGE-authordashboard-submission | AuthorDashboardHandler::submission (inherited) | pages/authorDashboard/AuthorDashboardHandler.php | Legacy author-dashboard URL; live as a 302 to dashboard/mySubmissions?workflowSubmissionId=N (verified 2026-07-03) | author-dashboard.md | author-dashboard |
| PAGE-authordashboard-readsubmissionemail | AuthorDashboardHandler::readSubmissionEmail (inherited) | pages/authorDashboard/AuthorDashboardHandler.php | Renders a notify-author email as JSON for the author's Notifications listing (nothing is marked read; verified 2026-07-03) | author-dashboard.md | author-dashboard |
| PAGE-authordashboard-reviewroundinfo | AuthorDashboardHandler::reviewRoundInfo | pages/authorDashboard/index.php | Op routed in switch; no matching handler method found (dead) | | |
| PAGE-catalog-category | PKPCatalogHandler::category | lib/pkp/pages/catalog/PKPCatalogHandler.php | Reader category landing page `/catalog/category/{path}` — LIVE in OJS: lists a category's published+indexed articles, subcategory nav, breadcrumb (live-verified 2026-07-05) | browse-category-section | browse-category-section |
| PAGE-catalog-fullsize | PKPCatalogHandler::fullSize | lib/pkp/pages/catalog/PKPCatalogHandler.php | Category cover full-size image (`type=category` only in OJS; monograph type → 500) | browse-category-section | browse-category-section |
| PAGE-catalog-thumbnail | PKPCatalogHandler::thumbnail | lib/pkp/pages/catalog/PKPCatalogHandler.php | Category cover thumbnail (`type=category` only in OJS) | browse-category-section | browse-category-section |
| PAGE-dashboard-index | DashboardHandler::index (inherited) | pages/dashboard/DashboardHandler.php | `/dashboard` with no variant; live as a 302 to the role-priority dashboard (verified 2026-07-03) | editorial-dashboards.md | editorial-dashboards |
| PAGE-dashboard-editorial | DashboardHandler::editorial (inherited) | pages/dashboard/DashboardHandler.php | Editorial-role dashboard view | editorial-dashboards.md | editorial-dashboards |
| PAGE-dashboard-mysubmissions | DashboardHandler::mySubmissions (inherited) | pages/dashboard/DashboardHandler.php | Author's "my submissions" dashboard view | author-dashboard.md | author-dashboard |
| PAGE-dashboard-reviewassignments | DashboardHandler::reviewAssignments (inherited) | pages/dashboard/DashboardHandler.php | Reviewer's assignments dashboard view (reviewer-only; no editor variant — verified 2026-07-03) | editorial-dashboards.md | editorial-dashboards |
| PAGE-decision-record | DecisionHandler::record | lib/pkp/pages/decision/DecisionHandler.php | Record an editorial decision, reached via pages/decision | review-decisions.md | editorial-decisions |
| PAGE-dois-index | DoisHandler::index (inherited) | pages/dois/DoisHandler.php | DOI management listing page | doi-management.md | |
| PAGE-dois-management | DoisHandler::management | pages/dois/index.php | In role list but not routed/implemented (dead) | | |
| PAGE-gateway-index | GatewayHandler::index | pages/gateway/GatewayHandler.php | Gateway plugin interaction entry page (bare /gateway → redirect to journal home, live-verified) | | plugin-management (claimed 2026-07-06) |
| PAGE-gateway-lockss | GatewayHandler::lockss | pages/gateway/GatewayHandler.php | LOCKSS preservation gateway manifest | | distribution-settings (claimed 2026-07-06 — the public archiving-display surface; flag-gated, off → 302 to journal home) |
| PAGE-gateway-clockss | GatewayHandler::clockss | pages/gateway/GatewayHandler.php | CLOCKSS preservation gateway manifest | | distribution-settings (claimed 2026-07-06) |
| PAGE-gateway-plugin | GatewayHandler::plugin | pages/gateway/GatewayHandler.php | Dispatch gateway request to a named plugin | plugin-management.md | plugin-management (claimed 2026-07-06) |
| PAGE-index-index | IndexHandler::index (inherited) | pages/index/IndexHandler.php | Site/journal home page | journal-homepage.md | journal-homepage (site-index branch → site-settings) |
| PAGE-information-index | InformationHandler::index | pages/information/InformationHandler.php | Information landing page (unknown/no sub-page → redirect home) | | about-pages |
| PAGE-information-readers | InformationHandler::readers | pages/information/InformationHandler.php | "For readers" info page | | about-pages |
| PAGE-information-authors | InformationHandler::authors | pages/information/InformationHandler.php | "For authors" info page | | about-pages |
| PAGE-information-librarians | InformationHandler::librarians | pages/information/InformationHandler.php | "For librarians" info page | | about-pages |
| PAGE-information-competinginterestguidelines | InformationHandler::competingInterestGuidelines | pages/information/InformationHandler.php | Competing interest guidelines page | | about-pages |
| PAGE-information-samplecopyrightwording | InformationHandler::sampleCopyrightWording | pages/information/InformationHandler.php | Sample copyright wording page | | about-pages |
| PAGE-issue-index | IssueHandler::index | pages/issue/IssueHandler.php | Issue archive/table-of-contents landing | issue-archive-toc.md | |
| PAGE-issue-current | IssueHandler::current | pages/issue/IssueHandler.php | Current issue table of contents | issue-archive-toc.md | |
| PAGE-issue-archive | IssueHandler::archive | pages/issue/IssueHandler.php | Back-issue archive listing | issue-archive-toc.md | |
| PAGE-issue-view | IssueHandler::view | pages/issue/IssueHandler.php | View a specific issue's table of contents | issue-archive-toc.md | |
| PAGE-issue-download | IssueHandler::download | pages/issue/IssueHandler.php | Download an issue galley file | issue-archive-toc.md | |
| PAGE-manageissues-index | ManageIssuesHandler::index | pages/manageIssues/ManageIssuesHandler.php | Issue management listing page | issue-management.md | |
| PAGE-manageissues-issuestabs | ManageIssuesHandler::issuesTabs | pages/manageIssues/index.php | Op routed in switch; no matching handler method found (dead) | | |
| PAGE-manager-legacy | (no-op) | pages/manager/index.php | Legacy router with empty switch-case bodies for subscription ops (dead) | | |
| PAGE-management-index | SettingsHandler::index (via settings()) | pages/management/SettingsHandler.php | Management settings entry op | site-settings.md | |
| PAGE-management-settings | ManagementHandler::settings | lib/pkp/pages/management/ManagementHandler.php | Sub-router dispatching settings/{path} args | site-settings.md | |
| PAGE-management-settings-context | ManagementHandler::context | lib/pkp/pages/management/ManagementHandler.php | Journal context settings sub-page | journal-setup.md | journal-masthead-settings (page owner; the page also hosts the Sections + Categories tabs → sections/categories specs) |
| PAGE-management-settings-website | ManagementHandler::website | lib/pkp/pages/management/ManagementHandler.php | Website appearance settings sub-page | website-appearance.md | website-appearance-settings (claimed 2026-07-06) — owns the page; Privacy/Information forms on it → journal-masthead-settings, Editorial Masthead tab → editorial-masthead, Highlights → highlights-featured-content, Languages → languages-locales, Navigation → navigation-menus, Announcements → announcements, Plugins tab → plugin-management, Comments → public-comments |
| PAGE-management-settings-workflow | SettingsHandler::workflow (override) | pages/management/SettingsHandler.php | Workflow settings sub-page | submission-settings.md | workflow-settings |
| PAGE-management-settings-manageemails | ManagementHandler::manageEmails | lib/pkp/pages/management/ManagementHandler.php | Email templates management sub-page | email-templates-management.md | email-templates-management (claimed 2026-07-06) |
| PAGE-management-settings-distribution | ManagementHandler::distribution | lib/pkp/pages/management/ManagementHandler.php | Distribution settings sub-page | distribution-settings.md | distribution-settings (claimed 2026-07-06 — page owner; DOIs + Statistics tabs hosted for doi-management / usage-statistics) |
| PAGE-management-settings-access | ManagementHandler::access | lib/pkp/pages/management/ManagementHandler.php | Roles/access settings sub-page | roles-permissions.md | |
| PAGE-management-settings-announcements | ManagementHandler::announcements | lib/pkp/pages/management/ManagementHandler.php | Announcements settings sub-page | announcements.md | announcements (claimed 2026-07-06) |
| PAGE-management-settings-institutions | ManagementHandler::institutions | lib/pkp/pages/management/ManagementHandler.php | Institutions settings sub-page | institutions.md | |
| PAGE-management-settings-user | ManagementHandler::editUser | lib/pkp/pages/management/ManagementHandler.php | Edit-user sub-page under settings | user-management.md | |
| PAGE-management-settings-usercomments | ManagementHandler::userComments | lib/pkp/pages/management/ManagementHandler.php | Public comments moderation sub-page | public-comments.md | public-comments |
| PAGE-management-access | SettingsHandler::access (site-admin op) | pages/management/SettingsHandler.php | Site-admin-only direct access op | site-access-restrictions.md | site-access-restrictions (URL-only alias of settings/access — no UI link; see spec Open question 4) |
| PAGE-management-tools | PKPToolsHandler::tools | lib/pkp/pages/management/PKPToolsHandler.php | Admin tools landing page | | |
| PAGE-management-importexport | PKPToolsHandler::importexport | lib/pkp/pages/management/PKPToolsHandler.php | Import/export tools page | native-xml-import-export.md | |
| PAGE-management-permissions | PKPToolsHandler::permissions | lib/pkp/pages/management/PKPToolsHandler.php | Permissions tool page | roles-permissions.md | |
| PAGE-management-statistics | (unresolved) | pages/management/index.php | Op routed in switch; no matching handler method found (dead) | | |
| PAGE-management-resetpermissions | PKPToolsHandler::resetPermissions | lib/pkp/pages/management/PKPToolsHandler.php | Reset default submission permissions | roles-permissions.md | |
| PAGE-oai-index | OAIHandler::index | pages/oai/OAIHandler.php | OAI-PMH protocol request entry point | oai-sitemap-feeds.md | oai-pmh |
| PAGE-payment-plugin | PaymentHandler::plugin | pages/payment/PaymentHandler.php | Dispatch payment request to a named plugin | payments.md | |
| PAGE-payment-pay | PaymentHandler::pay | pages/payment/PaymentHandler.php | Generic payment initiation page | payments.md | |
| PAGE-payments-index | PaymentsHandler::index | pages/payments/PaymentsHandler.php | Payment management landing page | payments.md | |
| PAGE-payments-subscriptions | PaymentsHandler::subscriptions | pages/payments/PaymentsHandler.php | Subscriber management page | subscriptions-management.md | |
| PAGE-payments-subscriptiontypes | PaymentsHandler::subscriptionTypes | pages/payments/PaymentsHandler.php | Subscription types management page | subscriptions-management.md | |
| PAGE-payments-subscriptionpolicies | PaymentsHandler::subscriptionPolicies | pages/payments/PaymentsHandler.php | Subscription policies settings page | subscriptions-management.md | |
| PAGE-payments-savesubscriptionpolicies | PaymentsHandler::saveSubscriptionPolicies | pages/payments/PaymentsHandler.php | Save subscription policies form | subscriptions-management.md | |
| PAGE-payments-paymenttypes | PaymentsHandler::paymentTypes (op) | pages/payments/PaymentsHandler.php | Payment types settings page | payments.md | |
| PAGE-payments-savepaymenttypes | PaymentsHandler::savePaymentTypes (op) | pages/payments/PaymentsHandler.php | Save payment types form | payments.md | |
| PAGE-payments-payments | PaymentsHandler::payments (op) | pages/payments/PaymentsHandler.php | Payments listing page | payments.md | |
| PAGE-reviewer-submission | ReviewerHandler::submission | pages/reviewer/ReviewerHandler.php | Reviewer's submission review page | reviewer-assignment.md | reviewer-response |
| PAGE-reviewer-step | ReviewerHandler::step | pages/reviewer/ReviewerHandler.php | Review wizard step page | reviewer-assignment.md | reviewer-response |
| PAGE-reviewer-savestep | ReviewerHandler::saveStep | pages/reviewer/ReviewerHandler.php | Save review wizard step | reviewer-assignment.md | reviewer-response |
| PAGE-reviewer-showdeclinereview | ReviewerHandler::showDeclineReview | pages/reviewer/ReviewerHandler.php | Show decline-review confirmation form | reviewer-response.md | reviewer-response |
| PAGE-reviewer-savedeclinereview | ReviewerHandler::saveDeclineReview | pages/reviewer/ReviewerHandler.php | Submit decline-review form | reviewer-response.md | reviewer-response |
| PAGE-reviewer-downloadfile | ReviewerHandler::downloadFile | pages/reviewer/ReviewerHandler.php | In role list but not routed/implemented (dead) | | |
| PAGE-search-index | SearchHandler::index (inherited) | pages/search/SearchHandler.php | Site/journal search landing page | site-search.md | site-search |
| PAGE-search-search | SearchHandler::search (inherited) | pages/search/SearchHandler.php | Search results page | site-search.md | site-search |
| PAGE-search-similardocuments | SearchHandler::similarDocuments | pages/search/index.php | Op routed in switch; no matching handler method found (dead) | | |
| PAGE-sitemap-index | SitemapHandler::index (inherited) | pages/sitemap/SitemapHandler.php | XML sitemap generation endpoint; always-on core (no enable toggle). `/{journal}/sitemap` → urlset of pages/issues/published-articles/galleys; `/index/sitemap` → sitemapindex. Live-verified 2026-07-05 | oai-sitemap-feeds.md | web-feeds-syndication |
| PAGE-stats-issues | StatsHandler::issues | pages/stats/StatsHandler.php | Issue-level usage statistics page | usage-statistics.md | |
| PAGE-stats-editorial | StatsHandler::editorial (inherited) | pages/stats/StatsHandler.php | Editorial statistics dashboard | usage-statistics.md | |
| PAGE-stats-publications | StatsHandler::publications (inherited) | pages/stats/StatsHandler.php | Publication-level usage statistics page | usage-statistics.md | |
| PAGE-stats-context | StatsHandler::context (inherited) | pages/stats/StatsHandler.php | Context/journal-level usage statistics page | usage-statistics.md | |
| PAGE-stats-users | StatsHandler::users (inherited) | pages/stats/StatsHandler.php | User statistics page | usage-statistics.md | |
| PAGE-stats-reports | StatsHandler::reports (inherited) | pages/stats/StatsHandler.php | Statistics report generation page | usage-statistics.md | |
| PAGE-stats-counterr5 | StatsHandler::counterR5 (inherited) | pages/stats/StatsHandler.php | COUNTER R5 report page | usage-statistics.md | |
| PAGE-submission-index | SubmissionHandler::index (inherited) | pages/submission/SubmissionHandler.php | Submission wizard landing/start page | submission-wizard-core.md | submission-wizard |
| PAGE-submission-saved | SubmissionHandler::saved (inherited) | pages/submission/SubmissionHandler.php | Submission-saved confirmation page | submission-wizard-core.md | submission-wizard |
| PAGE-submission-wizard | SubmissionHandler::wizard (inherited, @deprecated 3.4) | pages/submission/SubmissionHandler.php | Deprecated submission wizard URL | submission-wizard-core.md | submission-wizard |
| PAGE-submission-cancelled | SubmissionHandler::cancelled (inherited) | pages/submission/SubmissionHandler.php | Submission-cancelled confirmation page | submission-wizard-core.md | submission-wizard |
| PAGE-user-index | UserHandler::index | pages/user/UserHandler.php | User account landing page | user-profile.md | |
| PAGE-user-subscriptions | UserHandler::subscriptions | pages/user/UserHandler.php | User's own subscriptions page | subscription-access.md | |
| PAGE-user-authorizationdenied | UserHandler::authorizationDenied | pages/user/UserHandler.php | Access-denied notice page | roles-permissions.md | |
| PAGE-user-purchasesubscription | UserHandler::purchaseSubscription | pages/user/UserHandler.php | Start subscription purchase flow | subscription-access.md | |
| PAGE-user-paypurchasesubscription | UserHandler::payPurchaseSubscription | pages/user/UserHandler.php | Pay for a new subscription | subscription-access.md | |
| PAGE-user-completepurchasesubscription | UserHandler::completePurchaseSubscription | pages/user/UserHandler.php | Complete subscription purchase after payment | subscription-access.md | |
| PAGE-user-payrenewsubscription | UserHandler::payRenewSubscription | pages/user/UserHandler.php | Pay to renew an existing subscription | subscription-access.md | |
| PAGE-user-paymembership | UserHandler::payMembership | pages/user/UserHandler.php | Pay membership dues | subscription-access.md | |
| PAGE-user-profile | ProfileHandler::profile | lib/pkp/pages/user/ProfileHandler.php | User profile edit page, via pages/user fallback | user-profile.md | |
| PAGE-user-register | RegistrationHandler::register | lib/pkp/pages/user/RegistrationHandler.php | User registration form page | registration-login.md | registration-login |
| PAGE-user-registeruser | RegistrationHandler::registerUser | lib/pkp/pages/user/RegistrationHandler.php | Submit user registration form (backward-compat alias for register) | registration-login.md | registration-login |
| PAGE-user-activateuser | RegistrationHandler::activateUser | lib/pkp/pages/user/RegistrationHandler.php | Activate a newly registered account (invitation-based; live only when require_validation on) | registration-login.md | registration-login |
| PAGE-workflow-access | WorkflowHandler::access (inherited) | pages/workflow/WorkflowHandler.php | Workflow entry access-check redirect | submission-stage-actions.md | workflow-stage-navigation |
| PAGE-workflow-index | WorkflowHandler::index (inherited) | pages/workflow/WorkflowHandler.php | Workflow stage landing redirect | submission-stage-actions.md | workflow-stage-navigation |
| PAGE-workflow-submission | WorkflowHandler::submission (inherited) | pages/workflow/WorkflowHandler.php | Submission stage workflow page | submission-stage-actions.md | workflow-stage-navigation |
| PAGE-workflow-externalreview | WorkflowHandler::externalReview (inherited) | pages/workflow/WorkflowHandler.php | External review stage workflow page | review-rounds-revisions.md | workflow-stage-navigation |
| PAGE-workflow-editorial | WorkflowHandler::editorial (inherited) | pages/workflow/WorkflowHandler.php | Copyediting stage workflow page | copyediting-stage.md | workflow-stage-navigation |
| PAGE-workflow-production | WorkflowHandler::production (inherited) | pages/workflow/WorkflowHandler.php | Production stage workflow page | production-stage.md | workflow-stage-navigation |
| PAGE-admin-index | AdminHandler::index | lib/pkp/pages/admin/AdminHandler.php | Site administration landing page | site-administration.md | site-administration (claimed 2026-07-06) — index page owned here; its system panels' behavior → site-maintenance, Site Settings link → site-settings |
| PAGE-admin-contexts | AdminHandler::contexts | lib/pkp/pages/admin/AdminHandler.php | Journal/context list for site admin | site-administration.md | site-administration (claimed 2026-07-06) |
| PAGE-admin-settings | AdminHandler::settings | lib/pkp/pages/admin/AdminHandler.php | Site-wide settings page | site-settings.md | site-settings (claimed 2026-07-06) — page shell owned here; mounted tabs owned by their features (Languages→languages-locales, Navigation→navigation-menus, Highlights→highlights-featured-content, Bulk Emails→email-templates-management, ORCID→orcid, Announcements→announcements, Plugins→plugin-management) |
| PAGE-admin-wizard | AdminHandler::wizard | lib/pkp/pages/admin/AdminHandler.php | Create-context wizard page | journal-setup.md | site-administration (claimed 2026-07-06) — NOT a create wizard: the per-journal Settings Wizard for an EXISTING context (`admin/wizard/{id}`; creation happens in the grid modal); tab contents owned by their features |
| PAGE-admin-systeminfo | AdminHandler::systemInfo | lib/pkp/pages/admin/AdminHandler.php | System information page | site-administration.md | |
| PAGE-admin-phpinfo | AdminHandler::phpinfo | lib/pkp/pages/admin/AdminHandler.php | PHP info diagnostic page | site-administration.md | |
| PAGE-admin-expiresessions | AdminHandler::expireSessions | lib/pkp/pages/admin/AdminHandler.php | Force-expire all user sessions | site-administration.md | |
| PAGE-admin-cleartemplatecache | AdminHandler::clearTemplateCache | lib/pkp/pages/admin/AdminHandler.php | Clear Smarty template cache | site-administration.md | |
| PAGE-admin-cleardatacache | AdminHandler::clearDataCache | lib/pkp/pages/admin/AdminHandler.php | Clear application data cache | site-administration.md | |
| PAGE-admin-downloadscheduledtasklogfile | AdminHandler::downloadScheduledTaskLogFile | lib/pkp/pages/admin/AdminHandler.php | Download a scheduled task log file | scheduled-tasks.md | |
| PAGE-admin-clearscheduledtasklogfiles | AdminHandler::clearScheduledTaskLogFiles | lib/pkp/pages/admin/AdminHandler.php | Clear all scheduled task log files | scheduled-tasks.md | |
| PAGE-admin-jobs | AdminHandler::jobs | lib/pkp/pages/admin/AdminHandler.php | Job queue monitoring page | jobs-queue.md | |
| PAGE-admin-failedjobs | AdminHandler::failedJobs | lib/pkp/pages/admin/AdminHandler.php | Failed job queue listing page | jobs-queue.md | |
| PAGE-admin-failedjobdetails | AdminHandler::failedJobDetails | lib/pkp/pages/admin/AdminHandler.php | Failed job detail view | jobs-queue.md | |
| PAGE-admin-confirmaccesssubmit | AdminHandler::confirmAccessSubmit | lib/pkp/pages/admin/AdminHandler.php | Submit the Administration-area re-authentication (password re-confirm); starts the elevated session. NOT a login-as confirmation — impersonation has no reauth (see login-as.md) | login-as.md | |
| PAGE-admin-confirmaccess | AdminHandler::confirmAccess | lib/pkp/pages/admin/AdminHandler.php | Administration-area re-authentication page (re-enter your own password before the admin area). NOT a login-as confirmation — impersonation has no reauth (see login-as.md) | login-as.md | |
| PAGE-announcement-index | AnnouncementHandler::index | lib/pkp/pages/announcement/AnnouncementHandler.php | Public announcements listing page | announcements.md | announcements (claimed 2026-07-06) |
| PAGE-announcement-view | AnnouncementHandler::view | lib/pkp/pages/announcement/AnnouncementHandler.php | Single announcement detail page | announcements.md | announcements (claimed 2026-07-06) |
| PAGE-install-index | InstallHandler::index | lib/pkp/pages/install/InstallHandler.php | Installer landing page | test-infrastructure.md | |
| PAGE-install-install | InstallHandler::install | lib/pkp/pages/install/InstallHandler.php | Run the installation process | test-infrastructure.md | |
| PAGE-install-upgrade | InstallHandler::upgrade | lib/pkp/pages/install/InstallHandler.php | Upgrade confirmation page | test-infrastructure.md | |
| PAGE-install-installupgrade | InstallHandler::installUpgrade | lib/pkp/pages/install/InstallHandler.php | Run the upgrade process | test-infrastructure.md | |
| PAGE-invitation-accept | InvitationHandler::accept | lib/pkp/pages/invitation/InvitationHandler.php | Accept an invitation link | user-invitations.md | |
| PAGE-invitation-decline | InvitationHandler::decline | lib/pkp/pages/invitation/InvitationHandler.php | Decline an invitation link | user-invitations.md | |
| PAGE-invitation-confirmdecline | InvitationHandler::confirmDecline | lib/pkp/pages/invitation/InvitationHandler.php | Confirm invitation decline page | user-invitations.md | |
| PAGE-invitation-create | InitializeInvitationUIHandler::create | lib/pkp/pages/invitation/InitializeInvitationUIHandler.php | Initialize invitation-creation UI | user-invitations.md | |
| PAGE-invitation-edit | InitializeInvitationUIHandler::edit | lib/pkp/pages/invitation/InitializeInvitationUIHandler.php | Initialize invitation-edit UI | user-invitations.md | |
| PAGE-libraryfiles-downloadpublic | LibraryFileHandler::downloadPublic | lib/pkp/pages/libraryFiles/LibraryFileHandler.php | Download a public library file | media-files.md | document-library |
| PAGE-libraryfiles-downloadlibraryfile | LibraryFileHandler::downloadLibraryFile | lib/pkp/pages/libraryFiles/LibraryFileHandler.php | Download a restricted library file | media-files.md | document-library |
| PAGE-login-index | LoginHandler::index | lib/pkp/pages/login/LoginHandler.php | Login form page | registration-login.md | registration-login |
| PAGE-login-signin | LoginHandler::signIn | lib/pkp/pages/login/LoginHandler.php | Process login form submission | registration-login.md | registration-login |
| PAGE-login-signout | LoginHandler::signOut | lib/pkp/pages/login/LoginHandler.php | Log the current user out | registration-login.md | registration-login |
| PAGE-login-lostpassword | LoginHandler::lostPassword | lib/pkp/pages/login/LoginHandler.php | Lost-password request form | password-flows.md | password-flows |
| PAGE-login-requestresetpassword | LoginHandler::requestResetPassword | lib/pkp/pages/login/LoginHandler.php | Submit password-reset request | password-flows.md | password-flows |
| PAGE-login-resetpassword | LoginHandler::resetPassword | lib/pkp/pages/login/LoginHandler.php | Password reset form page | password-flows.md | password-flows |
| PAGE-login-updateresetpassword | LoginHandler::updateResetPassword | lib/pkp/pages/login/LoginHandler.php | Submit new password after reset | password-flows.md | password-flows |
| PAGE-login-changepassword | LoginHandler::changePassword | lib/pkp/pages/login/LoginHandler.php | Forced password-change form | password-flows.md | password-flows |
| PAGE-login-savepassword | LoginHandler::savePassword | lib/pkp/pages/login/LoginHandler.php | Submit forced password change | password-flows.md | password-flows |
| PAGE-login-signinasuser | LoginHandler::signInAsUser | lib/pkp/pages/login/LoginHandler.php | Admin "login as" another user | login-as.md | |
| PAGE-login-signoutasuser | LoginHandler::signOutAsUser | lib/pkp/pages/login/LoginHandler.php | Return from "login as" impersonation | login-as.md | |
| PAGE-navigationmenu-index | NavigationMenuItemHandler::index | lib/pkp/pages/navigationMenu/NavigationMenuItemHandler.php | Custom navigation menu item content page | navigation-menus.md | navigation-menus (claimed 2026-07-06) |
| PAGE-navigationmenu-view | NavigationMenuItemHandler::view | lib/pkp/pages/navigationMenu/NavigationMenuItemHandler.php | View a custom navigation menu page | navigation-menus.md | navigation-menus (claimed 2026-07-06) — reached via LoadHandler path interception at {journalUrl}/{path}, not a literal /navigationMenu/view URL |
| PAGE-navigationmenu-preview | NavigationMenuItemHandler::preview | lib/pkp/pages/navigationMenu/NavigationMenuItemHandler.php | Preview a custom navigation menu page | navigation-menus.md | navigation-menus (claimed 2026-07-06) |
| PAGE-notification-fetchnotification | NotificationHandler::fetchNotification | lib/pkp/pages/notification/NotificationHandler.php | Fetch a notification's rendered content | notifications.md | |
| PAGE-notification-unsubscribe | NotificationHandler::unsubscribe | lib/pkp/pages/notification/NotificationHandler.php | Unsubscribe from a notification type via emailed link | notifications.md | |
| PAGE-orcid-verify | OrcidHandler::verify | lib/pkp/pages/orcid/OrcidHandler.php | ORCID OAuth verification callback | orcid.md | |
| PAGE-orcid-authorizeorcid | OrcidHandler::authorizeOrcid | lib/pkp/pages/orcid/OrcidHandler.php | Begin ORCID OAuth authorization redirect | orcid.md | |
| PAGE-orcid-about | OrcidHandler::about | lib/pkp/pages/orcid/OrcidHandler.php | ORCID integration info page | orcid.md | |
| PAGE-orcid-updatescope | OrcidHandler::updateScope | lib/pkp/pages/orcid/OrcidHandler.php | Update granted ORCID API scope | orcid.md | |
| PAGE-reviewresponse-requestauthorresponse | ReviewResponseHandler::requestAuthorResponse | lib/pkp/pages/reviewResponse/ReviewResponseHandler.php | Editor requests author's response to a review | reviewer-response.md | review-rounds-and-revisions |
| PAGE-submissions-index | DashboardHandler::index | lib/pkp/pages/dashboard/DashboardHandler.php | Legacy `/submissions`; live as a 302 to the role-priority dashboard (verified 2026-07-03) | editorial-dashboards.md | editorial-dashboards |
| PAGE-submissions-tasks | DashboardHandler::tasks | lib/pkp/pages/dashboard/DashboardHandler.php | Legacy tasks popup; routed but 500s — template dashboard/tasks.tpl no longer exists (verified 2026-07-03; ledger row proposed) | editorial-dashboards.md | editorial-dashboards |

## Gaps
- Ops referenced only as helper/private methods (prefixed `_`, e.g. `_createContextSitemap`, `_retrieveStep`) were excluded as non-routable.
- `lib/pkp/pages/user/PKPUserHandler.php` (`index`, `authorizationDenied`) is fully superseded by OJS's own `pages/user/UserHandler.php` and has no reachable route in OJS — not enumerated separately.
- `lib/pkp/pages/management/ManagementHandler.php`'s own `index`/`saveSettings`-style variants were not separately probed beyond the `settings`/`access` sub-route dispatch already listed.
- Gateway/payment plugin sub-dispatch (`plugin` op forwarding into plugin-defined handlers) was treated as one atom each; individual plugin ops are out of scope for this modality (belongs to the plugins sweep).
- Did not trace OMP/OPS-only reachability; atoms assume OJS routing only, per scope.

Oddities observed (not scored as atoms beyond what's listed above):
- `pages/manager/index.php` is a legacy router with entirely empty switch-case bodies (falls through, returns nothing) — appears fully dead; live subscription-management logic actually lives in `pages/payments/PaymentsHandler.php`.
- Three routed ops have no implementing method anywhere in the tree (silently 404/error if hit): `authorDashboard::reviewRoundInfo`, `search::similarDocuments`, `manageIssues::issuesTabs`, plus `dois::management` and `reviewer::downloadFile` (declared in `addRoleAssignment` but never routed/implemented) and `management::statistics` (routed, unimplemented).
- `lib/pkp/pages/dashboard/DashboardHandler.php` and `lib/pkp/pages/dashboard/PKPDashboardHandler.php` are two different classes both named around "dashboard" but serve different URL paths (`pages/submissions` vs `pages/dashboard`) — easy to conflate when grepping.
- Delta-refresh 2026-07-02: +0 atoms from 1cad5eabf9..upstream/main (lib/pkp) / 85ff016d1f..upstream/main (root). Changed page handlers (`pages/dashboard/PKPDashboardHandler.php`, `pages/login/LoginHandler.php`, `pages/reviewer/PKPReviewerHandler.php`) only touched template-variable exposure (new Done-stage decision constants, a competing-interests fix, dropped `showRemember` var) — no new ops/routes.
