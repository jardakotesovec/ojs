# Existing e2e spec inventory (working doc)

Snapshot of pre-revamp coverage, used for the **Absorbs** mapping in `docs/e2e/plans/*.md`
and for the final Cypress cross-check. Delete this file once round 1 absorption is complete.

## 1. OJS Playwright specs (`playwright/tests/`)

| File | Covers | ~tests |
|------|--------|--------|
| admin-add-journal.spec.js | Site admin creates journal with multilingual names & URL validation | 1 |
| article-dc-metadata.spec.js | Reader-side DC metadata tags on article page | 2 |
| article-statistics.spec.js | Editor views article statistics dashboard & landmarks | 1 |
| discussions/discussion-manager.spec.js | Discussions & tasks CRUD; role-based edit/delete restrictions | 2 |
| doi-assignment.spec.js | Auto-assign DOIs to published articles; versioned DOI re-assignment; settings UI | 3 |
| doi-crossref.spec.js | Crossref plugin configuration & DOI status marking as registered | 2 |
| galleys.spec.js | Editor adds PDF galley; reader download link; delete round-trip | 2 |
| issue-assignment.spec.js | Editor reassigns published article between issues; reader TOCs update | 1 |
| issues.spec.js | Create/edit/publish/unpublish issues; set current; reader archive page | 4 |
| journal-homepage.spec.js | Journal index renders current-issue section; archive page landmarks | 2 |
| multiple-contexts.spec.js | User with different roles across two journals reaches both dashboards | 1 |
| native-xml-issue.spec.js | Export issue as Native XML; round-trip volume/number/year/articles | 2 |
| native-xml-submission.spec.js | Export submission as Native XML; reimport with metadata assertion | 1 |
| publication-language-change.spec.js | Language change blocked on published; unpublish→change→republish persists | 1 |
| pubmed-metadata.spec.js | Manager exports submission as PubMed XML; anonymous access rejected | 2 |
| scenarios/submission-stage.spec.js | Seeded submissions land at correct workflow stages | 2 |
| scenarios/submission-in-round-2.spec.js | Multi-round review seeding (round 1 closed, round 2 invited) | 1 |
| sections.spec.js | Create/edit/delete sections; editor-restricted flag; hierarchy | 5 |
| submission.spec.js | [fixme stub] Author submission via UI (not implemented) | 0 |
| subscription-access.spec.js | Anonymous blocked; subscriber reads; editor bypasses; subscription types | 2 |
| subscription-config.spec.js | Subscription types CRUD; policies; payments tab; access publishingMode | 5 |
| wizard-config-reset.spec.js | Require/disable metadata fields (keywords, subjects); required-field errors | 4 |

## 2. Shared Playwright specs (`lib/pkp/playwright/tests/`)

| File | Covers | ~tests |
|------|--------|--------|
| announcements.spec.js | CRUD; enable toggle & nav item; reader page & sitemap | 4 |
| api-smoke.spec.js | CSRF token; anonymous rejected; authenticated listing; author self-listing | 4 |
| author-edit-published.spec.js | Author canChangeMetadata restriction vs unrestricted permission | 2 |
| categories.spec.js | Categories field hidden by default; enabling exposes field; selections persist | 3 |
| data-availability.spec.js | Enable metadata field; published article renders the section | 2 |
| decision-accept.spec.js | Accept stage-1 (skip review); accept after external review | 2 |
| decision-decline.spec.js | Decline stage-1 submission; decline after review | 2 |
| decision-request-revisions.spec.js | Request revisions; author sees upload affordance | 1 |
| decision-send-to-production.spec.js | Send copyediting-stage submission to production | 1 |
| decision-send-to-review.spec.js | Send stage-1 submission to external review | 1 |
| editorial-masthead.spec.js | Masthead page renders for anonymous readers | 1 |
| email-templates.spec.js | Restrict default template; custom restricted/unrestricted templates | 4 |
| filenames.spec.js | Non-ASCII + punctuation filenames round-trip in file list | 1 |
| jobs-queue.spec.js | Site admin views queued jobs page; failed jobs page | 2 |
| journal-scenario.spec.js | Scratch journal at derived URL; assigned manager can access settings | 2 |
| login-as.spec.js | Site admin impersonates user; logout returns to admin session | 1 |
| login.spec.js | Admin visits site root without /login redirect (smoke) | 1 |
| mailpit.spec.js | clearAll; password-reset lands in Mailpit; scenario seeding stays mail-faked | 3 |
| multilingual.spec.js | Locale UI-active toggle; disabled-locale form entry; FR title round-trip | 3 |
| navigation-menus.spec.js | Manager configures navigation menus | 2 |
| oai-dc.spec.js | ListRecords returns DC records; GetRecord returns specific record | 2 |
| orcid.spec.js | Config persists/clears; Connect button; registration prefill; verified badge; editor requests verification | 5 |
| public-comments.spec.js | Enable comments; reader posts; moderator approves; anonymous visibility/gating | 2 |
| publication-metadata-editing.spec.js | Update title/abstract/keywords; add contributor round-trip | 2 |
| publish-unpublish.spec.js | Publish→verify public→unpublish→404→republish | 1 |
| recommend-only-editor.spec.js | Section editor with recommendOnly sees recommendation buttons | 1 |
| reduced-motion.spec.js | matchMedia + CSS rule respond; manual context inherits options | 3 |
| review-round.spec.js | External review flow | 1 |
| reviewer-assignment.spec.js | Assign reviewer via modal; anonymity + due dates; appears in list | 1 |
| reviewer-completes-review.spec.js | Reviewer accepts, fills form with recommendation, submits | 1 |
| reviewer-recommendations.spec.js | Reviewer recommendation flows across scenarios | 5 |
| scenario-decision-comments.spec.js | Decision comments seeding/verification | 2 |
| scenario-default-file.spec.js | Seeded submissions have default PDF; comments create stage-1 discussion | 2 |
| section-editor-metadata.spec.js | Section editor views/edits publication metadata | 2 |
| section-editor-recommendation.spec.js | Section editor makes recommendation | 1 |
| stage-participants.spec.js | Stage participants workflows | 2 |
| task-templates.spec.js | Default task template toggle; custom task template CRUD | 4 |
| user-comments-moderation.spec.js | Moderator approves/rejects comments | 2 |
| user-invitation.spec.js | Invite new user to role via wizard | 1 |
| user-registration.spec.js | User registration flow | 1 |
| user-role-assignment.spec.js | Manager adds role to existing user; invitation pending | 1 |
| versioning.spec.js | Publication versioning (major/minor; version state) | 2 |
| wizard-comments-become-discussion.spec.js | Submission comments converted to discussions | 2 |
| wizard-copyright-notice.spec.js | Copyright notice in submission wizard | 2 |
| wizard-language.spec.js | Submission wizard language selection | 2 |
| wizard-section-rules.spec.js | Editor-restricted / inactive section rules in wizard | 2 |
| wizard-validation.spec.js | Submission wizard field validation | 1 |

## 3. Legacy OJS Cypress (`cypress/tests/`)

| File | Covers |
|------|--------|
| data/10-ApplicationSetup/*.cy.js (6 files) | Install, create context, users, categories, issues, sections |
| data/60-content/*.cy.js (21 files) | One submission each, progressed through editorial stages (reviews, decisions, discussions, metadata, DOI/PubMed touches) |
| integration/API.cy.js | API authentication & listing endpoints |
| integration/ChangeSubmissionLanguage.cy.js | Change publication primary language when unpublished |
| integration/Discussions.cy.js | Discussion manager CRUD; private/reply workflows |
| integration/Doi.cy.js | DOI configuration; auto/manual assignment |
| integration/DoiCrossref.cy.js | Crossref plugin config; DOI XML export |
| integration/emailTemplates/EmailTemplates.cy.js | Email template configuration; default/custom variants |
| integration/MultipleContexts.cy.js | Enable/disable journal access |
| integration/orcid/Orcid.cy.js | ORCID contributor integration (OJS-specific UI) |
| integration/Pubmed.cy.js | PubMed metadata export |
| integration/ReviewerRecommendation.cy.js | Reviewer recommendation flows |
| integration/Statistics.cy.js | Statistics page rendering & filtering |
| integration/SubmissionWizard.cy.js | Wizard field validation & config |
| integration/Subscriptions.cy.js | Subscription config; open/restricted access control |
| integration/TaskTemplates.cy.js | Task template configuration |
| integration/Y_NativeXmlImportExportIssue.cy.js | Native XML issue export/import |
| integration/Z_ArticleViewDCMetadata.cy.js | DC metadata tags on published article |

## 4. Legacy shared Cypress (`lib/pkp/cypress/tests/integration/`)

| File | Covers |
|------|--------|
| Announcements.cy.js | CRUD; enable toggle; reader view; sitemap |
| API.cy.js | API auth & submissions endpoint |
| Categories.cy.js | Categories enable + wizard selections |
| DataAvailabilityStatements.cy.js | Metadata field enable; reader rendering |
| EditorialMasthead.cy.js | Masthead page rendering |
| emailTemplates/EmailTemplates.cy.js | Template restriction & custom variants |
| Filenames.cy.js | Non-ASCII filename preservation |
| Jobs.cy.js | Queued/failed jobs pages |
| Multilingual.cy.js | Locale toggles; multilingual form entry; persistence |
| NativeXmlImportExportSubmission.cy.js | Native XML submission round-trip |
| NavigationMenus.cy.js | Navigation menu configuration |
| oai/DC.cy.js | OAI-PMH ListRecords/GetRecord with DC |
| orcid/Orcid.cy.js | ORCID settings; Connect; registration prefill; article display |
| publicComents/PublicComments.cy.js | Comments enable; post/moderate/approve; reader visibility |
