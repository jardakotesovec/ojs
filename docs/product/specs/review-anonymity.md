---
name: review-anonymity
scope: The three peer-review methods (double-anonymous / anonymous / open) and the single authoritative cross-party visibility matrix — who may see whom (reviewer↔author, reviewer↔reviewer, editor, public reader) under each method, and where that redaction is enforced
shared: pkp-lib
status: verified
e2e-plans: [review-anonymity.md]
atlas-claims:
  - VUE-pkp-open-review
---

# Review anonymity

## Purpose

Peer review carries an anonymity promise, and OJS keeps that promise with **three review
methods** chosen per reviewer at assignment: **double-anonymous** (the default), **anonymous**
(one-way), and **open**. Each method sets who may see whom — does the reviewer learn the
author's identity, does the author learn the reviewer's, do co-reviewers see each other, what
does a public reader see. Those rules cut across many surfaces (the reviewer's submission view,
the author's dashboard, the editor's reviewer grid, decision emails, discussions, the article
landing page), so this spec is their **single home**: the visibility matrix is stated **once**
here and every other feature that touches it (`assign-and-manage-reviewers`, `reviewer-response`,
`reviewer-suggestions`, `review-rounds-and-revisions`, `tasks-discussions`, `open-peer-review-display`)
**references** this matrix instead of restating it. This spec owns the *rule* — what each method
reveals and where the code enforces it; it does **not** own choosing the method (that is the Review
Type selector in `assign-and-manage-reviewers`) nor the public reader page (`open-peer-review-display`
owns the display; this spec owns the anonymity rule that page applies).

## Actors & the visibility matrix

For this feature the "permissions" **are** the visibility rules, so the matrix is the centrepiece.
Two facts drive everything below:

- A **method** belongs to a single reviewer's assignment (`review_assignments.review_method`), not
  to the whole submission — one submission can carry all three methods at once (live-verified: sub 1
  had a double-anonymous, an anonymous and an open reviewer simultaneously).
- The matrix reduces to **two independent axes**, each keyed on *that reviewer's own method*:
  - **Author identity → the reviewer** is hidden **only under double-anonymous**; anonymous and
    open both disclose the author to the reviewer.
  - **A reviewer's identity → the author, co-reviewers, and the public** is hidden under
    double-anonymous **and** anonymous; it is disclosed **only under open**.

Editors, managers, site admins and assistants are the **trusted parties**: their workflow view is
**never** anonymized — they always see every reviewer's real name and the author's identity,
whatever the method. All rows below were driven live as the named party on `publicknowledge`
submission 1 (2026-07-03). <sup>a</sup>

| Who sees whom | Double-anonymous (2, default) | Anonymous (1) | Open (3) |
|---------------|-------------------------------|---------------|----------|
| **Reviewer → the author's identity & metadata** (name, affiliation, funding, data-availability) | Hidden in the UI — author blank in the reviewer's submission view and "View All Submission Details" modal (⚠ but the submission REST API leaks the author's name via `participants` — Known deviations) | **Shown** | **Shown** |
| **Author → this reviewer's identity** (name, initials, ORCID) | Hidden | Hidden | **Shown** — once the review is completed, the reviewer is named in the author's Reviewers panel with a Read-Review link |
| **Reviewer → a co-reviewer's identity** | Hidden | Hidden | **Shown** — a co-reviewer is named iff *their* review is open (independent of the viewer's own method) |
| **Editor / manager / site admin / assistant → everyone** | Full identity (never redacted) | Full | Full |
| **Public reader → this reviewer's identity** (only if the review is marked publicly visible + accepted + editor-confirmed) | Hidden — the review may still appear anonymously | Hidden — may appear anonymously | **Shown** — name, affiliation, ORCID revealed |

<sup>a</sup> ReviewAssignment::SUBMISSION_REVIEW_METHOD_{DOUBLEANONYMOUS,ANONYMOUS,OPEN}; author→reviewer & reviewer→co-reviewer redaction = AnonymizeData::anonymizeReviews() + maps/Schema.php getPropertyReviewAssignments(); reviewer→author redaction = maps/Schema.php mapByProperties() (`$anonymize` when the current user's assignment is double-anonymous) + publication/maps/Schema.php mapByProperties() + ViewSubmissionMetadataHandler::display(); public = PublicationPeerReviewResource::getReviewAssignmentPeerReviews(); editor view never passes an anonymize flag. Live probes 2026-07-03 (sub 1: jjanssen double-anon, phudson anon, amccrae open — see Canonical scenarios).

## Fields & validation

Anonymity has **no form of its own** — it is a consequence of the **Review Type** chosen per
reviewer. Where that field lives and how it is picked is owned by `assign-and-manage-reviewers`;
this spec owns only what each value *means*.

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Review Type** (radio, on Add Reviewer / Edit Review) | Yes (defaulted) | Three options and their internal method: **Anonymous Reviewer/Anonymous Author** = double-anonymous (2), **Anonymous Reviewer/Disclosed Author** = anonymous (1), **Open** (3). Defaults to the journal's `defaultReviewMode`. Editable per reviewer any time before completion; changing it re-shapes every matrix cell for that reviewer | ReviewAssignment::getReviewMethodKey() (`editor.submissionReview.{doubleAnonymous,anonymous,open}`); ReviewerForm::initData() (`defaultReviewMode`); EditReviewForm (`reviewMethod`) |
| **Publicly Show Reviewer Comments** (checkbox) | No | Per-assignment consent (`is_review_publicly_visible`, default off) that lets this review surface on the public open-review page; only takes visible effect together with the method (identity shown there only if open). Journal default from `getDefaultReviewPublicVisibility()` | ReviewsMigration (`is_review_publicly_visible` default false); ReviewerForm::initData() (`getDefaultReviewPublicVisibility`) |

There is **no separate "unanonymized"/consent flag** on the assignment — anonymity is derived
entirely from `review_method` (plus `is_review_publicly_visible` for the public surface). The DB
column default is *anonymous* (1), but the UI always pre-fills from `defaultReviewMode`, so the
column default is only a fallback for rows inserted without a method. <sup>a</sup>

<sup>a</sup> ReviewsMigration.php (`$table->smallInteger('review_method')->default(SUBMISSION_REVIEW_METHOD_ANONYMOUS)`, `is_review_publicly_visible` default false; no other anonymity column); ReviewerForm::initData()

## Rules & state

Anonymity is **stateless** — there is no state machine, only a per-assignment method value that a
family of read paths consult. The rules below name each enforcement point and are anchored to the
symbol that implements it.

1. **Three methods, set per reviewer.** `review_assignments.review_method` holds one of
   double-anonymous (2), anonymous (1), open (3). It is set at assignment from the journal
   `defaultReviewMode` and editable per reviewer (`assign-and-manage-reviewers`). The label a UI
   shows comes from `getReviewMethodKey()`. `publicknowledge`'s default is double-anonymous
   (live: the default-method assignment came through as method 2). <sup>a</sup>
2. **Author identity → reviewer: hidden only under double-anonymous.** When the current user is a
   reviewer on the submission whose *own* assignment is double-anonymous, the submission's
   publication is mapped with an **anonymize** flag that blanks the author list and every author
   string (`authors=[]`, `authorsString=''`, short/browse variants ''). Anonymous and open pass no
   anonymize flag, so the author is disclosed. The reviewer's on-demand **"View All Submission
   Details"** modal applies the same gate (author name, funding statement and data-availability
   assigned only when the method is not double-anonymous). Live-verified: jjanssen (double-anon) saw
   `authorsString=''`; phudson (anonymous) and amccrae (open) both saw `"Author Tester (Author)"`.
   <sup>b</sup>
3. **Reviewer identity → author & co-reviewers: hidden unless that review is open.** For an author
   (or a reviewer) reading the submission, `AnonymizeData::anonymizeReviews()` builds the set of
   review-assignment IDs to redact: **every assignment whose method is not open**, *except* the
   current user's own. The submission map then, for each redacted assignment, blanks `reviewerId`
   (→ null), `reviewerFullName` (→ ''), `reviewerUserName` (→ ''), `reviewerDisplayInitials` (→ '')
   and `reviewerHasOrcid` (→ false); non-redacted rows keep their identity. So a reviewer's name
   reaches the author/co-reviewers **only when that reviewer's own review is open**. Live-verified:
   as the author, review 1 (double-anon) and review 2 (anonymous) came back with `reviewerFullName=''`
   while review 3 (open) showed `"Aisla McCrae"`; a reviewer sees their **own** row un-redacted and
   any co-reviewer only if the co-review is open (jjanssen and phudson each saw only amccrae named).
   <sup>c</sup>
4. **The redaction is at the data/map layer, not merely UI hiding.** The blanking in rules 2–3
   happens inside the submission/publication **schema maps** that back the REST API (`get`/`getMany`
   thread the `anonymizeReviews()` result through `summarizeMany`), so a hand-crafted API read as the
   author or reviewer returns the same blanked fields the UI shows — identity is stripped server-side
   before it leaves the map, not merely hidden by a Vue `v-if`. **One field escapes this gate:** the
   submission map's `participants` array (`getPropertyParticipants()`) is *not* anonymized, so a
   double-anonymous reviewer's `GET /submissions/{id}` read leaks the author's real name and user id
   there even though every author-metadata and reviewer-identity field is blanked — an API-only
   anonymity leak with no UI surface (live-verified 2026-07-03, even for a merely-invited reviewer;
   see Known deviations / ledger row 81). <sup>d</sup>
5. **The author's Reviewers panel lists only *open + completed* reviews.** On the author's own
   review-stage view the `ReviewerManager` mounts in **redacted** mode and its rows come from
   `getOpenAndCompletedReviewAssignmentsForRound()` = open-method assignments filtered to those with
   a completion date. So the author's Reviewers panel shows **only open reviewers who have finished**
   (with their real name + a Read-Review action); double-anonymous and anonymous reviews — even
   completed ones — **never appear as rows** there. The author learns of those reviews' existence
   only via round status and the editor's decision emails. Live-verified: with all three reviews
   completed, the author's panel listed **only Aisla McCrae** (the open reviewer); the dashboard
   avatar column likewise showed only "AM". The legacy `AuthorReviewerGridHandler` agrees — its
   `loadData()` filters to open assignments and its Read-Review op is restricted to open reviews.
   <sup>e</sup>
6. **Editors are never redacted.** No editorial read path passes an anonymize flag; managers, site
   admins, sub-editors (incl. recommend-only) and assistants always see every reviewer's real name
   and the author's identity, under every method. Anonymity protects the author↔reviewer pair, not
   the editor who brokers them. <sup>f</sup>
7. **Participant-blinding labels.** Where a redacted reviewer must still be named, a fixed label
   replaces the name. In the **legacy reviewer grid**, when the viewer is an assigned author — including
   an author who *also* holds an editorial role, which is the only path by which a non-open review is
   listed to an author at all — a non-open review's Reviewer cell renders **"Anonymous Reviewer"** and
   its review-detail ops are refused. In **emails** that weave in reviewer comments, each reviewer is
   labelled **"Reviewer N"** (a running number — the locale key is
   `submission.comments.importPeerReviews.reviewerLetter`, "Reviewer {$reviewerLetter}:", but it is
   passed the reviewer's *ordinal*, so it renders "Reviewer 1", "Reviewer 2"…), and by **full name only
   when the review is open**. Note a *plain* author's live 3.6 Vue panel never lists non-open reviews at
   all (rule 5), so the label a redacted reviewer is actually shown by, in the mainline author UI, is the
   email "Reviewer N" — the grid's "Anonymous Reviewer" is a legacy-grid affordance reachable only in the
   author-also-editor case. <sup>g</sup>
8. **Comments to the author carry the same rule.** A reviewer's comments split into
   **"For author and editor"** (viewable) and **"For editor"** (not viewable), owned by
   `reviewer-response`. Anonymity adds two rules: (a) only *viewable* comments ever reach the author —
   the author's Read-Review modal and the decision-notify emails pull comments with the viewable-only
   filter, so "For editor" comments never surface to the author; and (b) the comment is attributed by
   rule 7 ("Reviewer N", or the reviewer's name if open). The author can open a review's comments at
   all **only for open reviews** (rule 5). <sup>h</sup>
9. **Files and manuscript content are NOT scrubbed — only metadata is.** Anonymity blanks the
   author's *metadata* in the reviewer's view (rules 2), but OJS does **not** anonymize the *contents*
   of the manuscript or supplementary files handed to a reviewer — a double-anonymous reviewer
   downloads the review-round files as-is, so any author-identifying text inside the document is not
   removed by the system. Stripping identity from files is the author's responsibility; the former
   "Ensuring a Blind Review" author guidance (`review.ensuringBlindReview`) has been **removed** from
   the locale. See Known deviations. <sup>i</sup>
10. **Public open-review display rule (the rule `PkpOpenReview` applies).** A review reaches the
    public reader surface only when it is **marked publicly visible** *and* **accepted** *and*
    **confirmed by an editor** (`filterByIsPubliclyVisible(true)` + `filterByIsAccepted(true)` +
    `filterByIsConfirmedByEditor(true)`). For each such review the reviewer's identity (id, full name,
    affiliation, ORCID) is included **only if the method is open**; a publicly-visible non-open review
    can still appear, but anonymously. `open-peer-review-display` owns the reader page and the
    `PkpOpenReview` component; this spec owns the visibility rule it enforces. <sup>j</sup>
11. **A known API leak partially defeats reviewer anonymity to the author.** On a double-anonymous
    journal, an author's post-submit reads of their **reviewer suggestions** still reveal which
    suggested people became reviewers and when (`approvedAt`, `reviewerId`, and — with a query flag —
    the linked reviewer's full editorial summary). This is API-only (no UI surface) and owned by
    `reviewer-suggestions`; it is recorded here as the canonical anonymity-leak cross-reference
    (ledger row 64). See Known deviations. <sup>k</sup>

<sup>a</sup> ReviewAssignment SUBMISSION_REVIEW_METHOD_* + getReviewMethodKey(); ReviewerForm::initData() (`defaultReviewMode`); live sub 1 (review 1 method 2) ·
<sup>b</sup> maps/Schema.php mapByProperties() (`$anonymize = currentUserReviewAssignment->getReviewMethod() === SUBMISSION_REVIEW_METHOD_DOUBLEANONYMOUS`) → publication/maps/Schema.php mapByProperties() (`authors`/`authorsString*` blanked); ViewSubmissionMetadataHandler::display() (`!= SUBMISSION_REVIEW_METHOD_DOUBLEANONYMOUS`); live jjanssen `authorsString=''`, phudson/amccrae `"Author Tester (Author)"` ·
<sup>c</sup> AnonymizeData::anonymizeReviews() (own review excluded; `getReviewMethod() !== SUBMISSION_REVIEW_METHOD_OPEN` collected); maps/Schema.php getPropertyReviewAssignments() (reviewerId/reviewerFullName/reviewerUserName/reviewerDisplayInitials/reviewerHasOrcid blanked when in the anonymize set); live sub 1 (author + each reviewer) ·
<sup>d</sup> PKPSubmissionController::get()/getMany() (`$this->anonymizeReviews(...)` → `summarizeMany(..., $anonymizeReviews)`); live: API read as the author returned blanked reviewer fields ·
<sup>e</sup> useSubmission.js getOpenAndCompletedReviewAssignmentsForRound() (= getOpenReviewAssignmentsForRound → `reviewMethod === SUBMISSION_REVIEW_METHOD_OPEN`, then `dateCompleted`); reviewerManagerStore.js (`redactedForAuthors` branch); workflowConfigAuthorOJS.js (mount when open+completed exist); AuthorReviewerGridHandler::loadData()/authorize() (open-only) ; live sub 1 author panel = Aisla McCrae only ·
<sup>f</sup> maps/Schema.php (editor read path passes no anonymize flag); e2e plan review-anonymity.md test 5 (editor sees all three, never redacted) ·
<sup>g</sup> ReviewerGridCellProvider::getTemplateVarsFromRowColumn() (`editor.review.anonymousReviewer` = "Anonymous Reviewer" when `_isCurrentUserAssignedAuthor` && review anonymous); PKPReviewerGridHandler::authorize() (`_isCurrentUserAssignedAuthor` set when the accessible-stages carry ROLE_ID_AUTHOR; `_getAuthorDeniedAnonymousOps` refuse read-detail on anonymous/double-anon); ReviewerComments trait setupReviewerCommentsVariable() (`SUBMISSION_REVIEW_METHOD_OPEN ? getReviewerFullName() : __('submission.comments.importPeerReviews.reviewerLetter', ['reviewerLetter' => $reviewerNumber])`) ·
<sup>h</sup> AuthorReviewerGridHandler::readReview() (`getReviewerCommentsByReviewerId(..., true)` — viewable only); ReviewerComments trait (`if ($comment->getViewable())`); comment split owned by reviewer-response ·
<sup>i</sup> no file-content anonymization exists; `review.ensuringBlindReview` present only as obsolete (`#~`) locale entries; reviewer downloads round files via `reviewer-response` unchanged ·
<sup>j</sup> PublicationPeerReviewResource (filterByIsPubliclyVisible/isAccepted/isConfirmedByEditor; `$isReviewOpen = getReviewMethod() === SUBMISSION_REVIEW_METHOD_OPEN` gates reviewerId/reviewerFullName/reviewerAffiliation/reviewerOrcid) ·
<sup>k</sup> docs/e2e/app-changes.md §2 row 64; ReviewerSuggestionResource::toArray(); owned by reviewer-suggestions

## Side effects

Anonymity is a **cross-cutting read rule**, not an action — it sends no emails, raises no
notifications, writes no event-log entries and mutates no data of its own. Its only "effect" is on
what *other* features' outputs reveal:

- **Emails** that quote reviewer comments (decision-notify-author, request-author-response) attribute
  each reviewer as "Reviewer N" or, for open reviews, by name, and include only *viewable* comments
  (rules 7–8) — the mailables are owned by `editorial-decisions` / `review-rounds-and-revisions`. The
  reviewer-directed **review-request** email carries **no author identity** by default (verified: the
  stock `emails.reviewRequest.body` template uses no author variable, so a double-anonymous reviewer's
  request email does not name the author). The `{$authors}` email variable *is* available and is **not**
  method-anonymized, so a journal that hand-adds it to a custom reviewer template would leak the author —
  a configuration footgun, not an as-built default (Open question 4).
- **The public open-review display** consumes the visibility rule (rule 10) — the page is owned by
  `open-peer-review-display`.
- Changing a reviewer's **Review Type** (Edit Review, `assign-and-manage-reviewers`) retroactively
  re-shapes every matrix cell for that reviewer on the next read — there is no snapshot.

## Settings that modify behavior

- **Default review method** (`defaultReviewMode`, Settings → Workflow → Review) — the method
  pre-selected for every new assignment; `publicknowledge` = double-anonymous (2). The form that sets
  it is owned by `workflow-settings`.
- **Default review comment visibility** (`getDefaultReviewPublicVisibility`) — the default of the
  per-assignment *Publicly Show Reviewer Comments* checkbox, which (with the method) governs the
  public surface (rule 10).
- No other setting changes the matrix; the three methods and their two axes are fixed in
  `ReviewAssignment` and the schema maps.

## Cross-feature interactions

- **assign-and-manage-reviewers** — owns *choosing* the Review Type at assignment and the editor
  Reviewers grid (never redacted); this spec owns what each type reveals. It also flags
  anonymity-risky candidates in the picker (`warnOnAssignment`).
- **reviewer-response** — owns the reviewer's own journey and the comment split (viewable "For author
  and editor" vs "For editor"); this spec owns whether/how those comments and the reviewer's identity
  reach the author (rules 7–8) and whether the reviewer sees the author (rule 2).
- **reviewer-suggestions** — owns the suggestion feature and the author-API anonymity leak (ledger
  row 64); referenced here as the canonical leak (rule 11).
- **review-rounds-and-revisions** — owns the round panels and the author's read-mostly round view; it
  defers the "redacted Reviewers listing" (rule 5) and the author-response public-visibility derivation
  to this matrix.
- **open-peer-review-display** — owns the public reader page and `PkpOpenReview`; this spec owns the
  visibility rule that page applies (rule 10). This spec **claims the rule atom** `VUE-pkp-open-review`;
  the reader page/API surface stays with `open-peer-review-display`.
- **tasks-discussions** — references this matrix for who is named in a discussion that includes a
  redacted reviewer.
- **editorial-decisions** — owns the decision-notify-author emails whose reviewer attribution follows
  rule 7.

## Canonical scenarios

Each scenario is one matrix cell driven live as the relevant party on `publicknowledge` submission 1
(2026-07-03), which carried a double-anonymous reviewer (jjanssen), an anonymous reviewer (phudson)
and an open reviewer (amccrae), all with completed reviews.

1. **Double-anonymous hides the author from the reviewer** — jjanssen (double-anonymous) opens the
   submission: the author is blank everywhere (`authorsString=''`; the "View All Submission Details"
   modal shows no author, funding or data-availability). Live-verified.
2. **Anonymous discloses the author to the reviewer** — phudson (anonymous) opens the same
   submission and *does* see the author ("Author Tester (Author)"). This is the one difference between
   anonymous and double-anonymous — the reviewer stays hidden from the author in both. Live-verified.
3. **Open discloses the author to the reviewer** — amccrae (open) sees the author too
   ("Author Tester (Author)"), confirming both non-double-anonymous methods disclose the author.
   Live-verified.
4. **Double-anonymous & anonymous hide the reviewer from the author** — atester (author) reads the
   submission: reviews 1 (double-anon) and 2 (anonymous) return blanked reviewer identity
   (`reviewerFullName=''`, `reviewerId=null`, no initials), so the author cannot tell who reviewed.
   Live-verified.
5. **Open reveals the reviewer to the author** — for the same author, review 3 (open) shows
   "Aisla McCrae" with initials "AM"; the author's Reviewers panel lists her (only) with a Read-Review
   link, and the dashboard avatar column shows only "AM". Live-verified.
6. **The author's Reviewers panel lists only open + completed reviews** — although all three reviews
   are completed, the author's redacted `ReviewerManager` shows a single row (the open reviewer);
   the double-anonymous and anonymous completed reviews do not appear as rows at all. Live-verified.
7. **A reviewer sees a co-reviewer only when that co-review is open** — jjanssen (double-anon) and
   phudson (anonymous) each see their own row named and, among the others, only amccrae (open) named;
   the non-open co-review is blanked. A reviewer's own method does not change what co-reviewers they
   can see — only the co-review's method does. Live-verified (both reviewers).
8. **The editor sees everything, always** — an editor/manager on the same submission sees all three
   reviewers' real names and the author's identity regardless of method; no editorial view is ever
   redacted (e2e plan review-anonymity.md test 5).
9. **Only viewable comments, anonymously attributed, reach the author** — when the editor notifies the
   author (or the author opens an open review's Read-Review), only "For author and editor" comments
   appear, attributed "Reviewer 1/2…" for non-open reviews and by name for open ones; "For editor"
   comments never surface to the author (rules 7–8).
10. **Public open-review display reveals a reviewer only when open** — a review shown on the public
    reader page names its reviewer only if the review is open (and publicly-visible + accepted +
    editor-confirmed); a publicly-visible anonymous/double-anonymous review can appear but stays
    anonymous (rule 10; page owned by `open-peer-review-display`).
11. **Editor switches the method and the matrix follows** — an editor changes a reviewer's Review Type
    (Edit Review); on the next read every cell for that reviewer re-shapes (e.g. double-anon → open
    now names the reviewer to the author and discloses the author to the reviewer), with no snapshot
    of the old state (e2e plan review-anonymity.md test 4; selection owned by
    `assign-and-manage-reviewers`). The switch is **symmetric**: the reverse (open → double-anon)
    **re-hides** a previously-revealed identity on the next read, because the redaction is recomputed
    live from `review_method` — `review_assignments` carries no cached-identity/anonymity snapshot
    column (only `review_method` + `is_review_publicly_visible`; verified 2026-07-03), so nothing
    preserves the old disclosure.

## Known deviations (as-built ≠ intent)

- ⚠ **A double-anonymous reviewer can read the author's identity via the submission API's
  `participants` array** ([app-changes](../../e2e/app-changes.md) §2 row 81; found by this spec's
  verifier). `GET /api/v1/submissions/{id}` blanks the author metadata (`authorsString=''`,
  `authors=[]`) and the reviewer-identity fields for a reviewer, **but** the same response's
  `participants` array (`Schema::getPropertyParticipants()`) lists every assigned user — the author
  included — by real `fullName` + user id, with no anonymization. The endpoint is reviewer-authorized
  by design (`ROLE_ID_REVIEWER` in `PKPSubmissionController::get()` route roles) and the controller
  *deliberately* anonymizes the author metadata + review-assignment identity for reviewers, so omitting
  `participants` from that gate is internally inconsistent — the sibling discussion path
  (`EditorialTask::anonymizeAuthors()`) DOES hide the author from reviewer participants. Live-verified
  2026-07-03 as a completed reviewer (`jjanssen`) **and a merely-invited one** (`agallego`): both read
  `authorsString=''` yet `participants` carried `{"id":17,"fullName":"Author Tester"}`. API-only, no UI
  surface (the reviewer dashboard's `reviewerAssignments` list read does not carry `participants`, which
  is a full-map-only prop). Genuine ⚠: it defeats the reviewer→author anonymity of the default
  double-anonymous journal (rule 2). Suspected intent: anonymize/omit the author from `participants` for
  a non-open reviewer, mirroring the metadata + discussion anonymization. (Secondary: the publication
  object also exposes `primaryContactId`, the author-record id, to the reviewer.)
- ⚠ **Reviewer anonymity leaks to the author through the reviewer-suggestions API on
  double-anonymous journals** ([app-changes](../../e2e/app-changes.md) §2 row 64; owned by
  `reviewer-suggestions`, re-stated here as the canonical anonymity-leak). After submit, the author's
  reads of `GET /submissions/{id}/reviewers/suggestions` keep returning `approvedAt` + `reviewerId`
  (and, with `?include_reviewer_data=true`, the linked reviewer's full editorial summary), telling the
  author exactly which suggested people became reviewers — defeating the reviewer anonymity that
  double-anonymous otherwise enforces (rule 3). API-only, no UI surface. Genuine ⚠: it contradicts the
  promised anonymity. Suspected intent: strip approval/reviewer fields from author-context reads.
- **Manuscript file content is never anonymized, and the author guidance for doing it manually has
  been removed** (rule 9; not marked ⚠ — see below). OJS anonymizes author *metadata* in the reviewer's
  view but hands over the actual review files unmodified, so a double-anonymous reviewer may still read
  the author's name inside the document; the former `review.ensuringBlindReview` guidance that told
  authors how to strip identity from their files now exists only as obsolete (`#~`) locale entries in
  two non-English catalogs (`mk`, `nb_NO`) and is absent from `en` and every active template/handler
  (verified 2026-07-03). Neither half meets the ⚠ bar: the *no-scrub* behaviour is a long-standing
  intended limitation (file anonymization has always been the author's job), and the *guidance removal*
  is a plausible locale cleanup with **no live UI affordance still referencing the key** — so there is
  nothing internally inconsistent to assert as as-built ≠ intent. The one genuinely-open part — whether
  dropping the guidance was deliberate — is left as Open question 2; **no ledger row proposed** (the
  code proves no contradiction, only an absence).

## Open questions

1. **Should the DB `review_method` default (anonymous = 1) match the shipped journal default
   (double-anonymous = 2)?** The column default is *anonymous*, while every journal's UI default and
   the seeded `publicknowledge` value is *double-anonymous*. The mismatch is inert (the form always
   supplies a method) but is a latent surprise for any code path that inserts an assignment without one.
2. **Is the removal of `review.ensuringBlindReview` guidance intentional?** With no file-content
   scrubbing (rule 9), authors previously got explicit "how to anonymize your files" guidance; it is
   now gone from the active locale. Intended simplification, or an anonymity-hygiene regression?
3. **Should the reviewer-suggestions author-API reads be restricted post-submit?** (Row 64.) The fix
   belongs to `reviewer-suggestions`, but the *policy* — authors should not learn reviewer identities
   on a double-anonymous journal by any channel — is a review-anonymity concern; flagged here so the
   maintainer weighs it against the matrix, not just the suggestions feature.
4. **Should the `{$authors}` email variable be method-anonymized in reviewer-directed templates?** The
   variable resolves to the real author names regardless of the recipient reviewer's method. No stock
   reviewer template uses it (so the default is safe), but a manager who adds it to a custom
   review-request template would silently break double-anonymity. Not flagged ⚠ (the as-built default is
   correct); noted so the maintainer can weigh a guard on reviewer-context template variables.

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Public open-review display component (rule owned here; page owned by feature 71) | `PkpOpenReview` (article landing) | VUE-pkp-open-review |
| Method value + labels | `review_assignments.review_method`; `ReviewAssignment::getReviewMethodKey()` | *(column on DB-review_assignments — owned by assign-and-manage-reviewers)* |
| Reviewer→author metadata redaction | reviewer submission view + "View All Submission Details" (`ViewSubmissionMetadataHandler`) | *(read path — no dedicated atom)* |
| Author/reviewer→reviewer identity redaction | submission REST map (`AnonymizeData` + `maps/Schema.php`) behind `PKPSubmissionController::get()/getMany()` | *(read path — no dedicated atom)* |
| Author's redacted Reviewers panel | author review-stage `ReviewerManager` (`redactedForAuthors`); legacy `AuthorReviewerGridHandler` | *(surfaces owned by assign-and-manage-reviewers / author-dashboard)* |
| Public open-review API (reader surface) | `GET /peerReviews/open/publications[/{id}]` (`PeerReviewController`) | *(API atoms owned by open-peer-review-display)* |

Conceptual atoms from the FEATURE-MAP (`SUBMISSION_REVIEW_METHOD` constants, the per-assignment
anonymity flag) are **not** separate atlas atoms — they are the `review_method` /
`is_review_publicly_visible` columns on `DB-review_assignments`, whose atom is owned by
`assign-and-manage-reviewers`. This spec owns the *rule* those columns drive; the only claimable
atlas atom is `VUE-pkp-open-review` (the rule the open-review component applies).

## Reference — code anchors

- **Method constants + labels**: `lib/pkp/classes/submission/reviewAssignment/ReviewAssignment.php`
  (`SUBMISSION_REVIEW_METHOD_*`, `getReviewMethodKey()`, `getReviewMethod()`).
- **Author/reviewer→reviewer redaction**: `lib/pkp/api/v1/submissions/AnonymizeData.php`
  (`anonymizeReviews()`); `lib/pkp/classes/submission/maps/Schema.php`
  (`getPropertyReviewAssignments()` — reviewer-field blanking; `mapByProperties()` — publication
  anonymize flag); wired by `lib/pkp/api/v1/submissions/PKPSubmissionController.php`
  (`get()`/`getMany()`) and `lib/pkp/pages/dashboard/PKPDashboardHandler.php`.
- **Reviewer→author metadata redaction**: `lib/pkp/classes/publication/maps/Schema.php`
  (`mapByProperties()` — `authors`/`authorsString*` blanking); `lib/pkp/controllers/modals/submission/ViewSubmissionMetadataHandler.php`.
- **Author's redacted panel**: `lib/ui-library/src/composables/useSubmission.js`
  (`getOpenReviewAssignmentsForRound()`, `getOpenAndCompletedReviewAssignmentsForRound()`);
  `lib/ui-library/src/managers/ReviewerManager/reviewerManagerStore.js` (`redactedForAuthors`);
  `lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/workflowConfigAuthorOJS.js`;
  `lib/pkp/controllers/grid/users/reviewer/AuthorReviewerGridHandler.php` (open-only `loadData()`,
  `readReview()` viewable-only comments).
- **Blinding labels**: `lib/pkp/controllers/grid/users/reviewer/ReviewerGridCellProvider.php` +
  `ReviewerGridRow.php` (`editor.review.anonymousReviewer`); `lib/pkp/classes/mail/traits/ReviewerComments.php`
  (`reviewerLetter` ordinal vs full name for open).
- **Public open-review rule**: `lib/pkp/api/v1/peerReviews/resources/PublicationPeerReviewResource.php`
  (`filterByIsPubliclyVisible`/`isAccepted`/`isConfirmedByEditor`; `$isReviewOpen` gate);
  `lib/ui-library/src/frontend/components/PkpOpenReview/PkpOpenReview.vue`.
- **Per-assignment columns / defaults**: `lib/pkp/classes/migration/install/ReviewsMigration.php`
  (`review_method`, `is_review_publicly_visible`); `lib/pkp/controllers/grid/users/reviewer/form/ReviewerForm.php`
  (`initData()` — `defaultReviewMode`, `getDefaultReviewPublicVisibility`).
