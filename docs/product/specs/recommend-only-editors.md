---
name: recommend-only-editors
scope: The recommend-only editorial role — what the recommend_only flag on a stage assignment DOES: a section editor who can advise (record a Recommend-Accept/Decline/Revisions recommendation the deciding editor then acts on) but cannot finalize a decision, while still managing reviewers and participants
shared: pkp-lib          # the role's behaviour lives entirely in lib/pkp: the submission map (getPropertyStages/getPropertyStageAssignments/checkDecisionPermissions), the recommend-only workflow controls (lib/ui-library), the IsRecommendation decision trait; OJS adds only the recommending-user decision-set override
status: verified
e2e-plans: [review-decisions.md, stage-participants.md]
atlas-claims: []
# This spec owns NO atlas atoms — every surface a recommend-only editor touches is
# claimed by another feature, and the seam matters (see Cross-feature interactions):
#   • the recommendation ACT (Recommend-* decision types, the RecommendationNotifyEditors
#     email MAIL-recommendation-notify-editors, the EVLOG-SUBM-ED-REC event log) →
#     editorial-decisions (claimed, verified).
#   • the recommend_only FLAG on the assignment (DB-stage_assignments) → stage-participants.
#   • the CONFIGURABLE REVIEWER-RECOMMENDATION OPTIONS cluster (DB-reviewer_recommendations
#     (+settings), VUE-reviewer-recommendation-manager, FORM-reviewer-recommendation-form,
#     API-reviewer-recommendation-*, AUTHZ-recommendation-access-policy) is a DIFFERENT
#     concept (the vocabulary a REVIEWER picks at review completion, configured in
#     Settings → Workflow) → workflow-settings. Re-hinted there; NOT this feature.
#   • the editor setting a REVIEWER's recommendation by proxy (EVLOG-REV-PROXY-REC) →
#     assign-and-manage-reviewers.
# The recommend-only editor's own workflow UI (WorkflowRecommendOnlyControls,
# WorkflowRecommendOnlyListingRecommendations) is below the vue-sweep's "major component"
# granularity — it rolls up under the workflow page shell (workflow-stage-navigation).
---

# Recommend-only editors (the advise-don't-decide role)

## Purpose

A journal can assign a section editor to a submission in an **advisory** capacity: they see
the whole review stage and manage its reviewers, but instead of the buttons that *finalize*
a decision (Accept, Decline, Request Revisions) they get **Recommend** buttons — they record
a *recommendation* that the submission's real (deciding) editor then acts on. This is the
**recommend-only** role, set by ticking **Recommend only** on the editor's stage assignment.
This spec owns what that flag DOES to the editor's experience: how the review-stage action
pane swaps decision buttons for recommendation buttons, the requirement that a deciding editor
be present, where a recorded recommendation surfaces to the decider, and the abilities the
recommend-only editor keeps (managing reviewers and participants). The recommendation itself
is one of OJS's editorial **decisions** — its transition (none), its email to the deciding
editors and its event-log entry are owned by `editorial-decisions`; this spec references that
act rather than re-narrating it. **Not to be confused** with the configurable *reviewer*
recommendation options (the "Accept / Revisions Required / Decline …" vocabulary a **reviewer**
picks at review completion) — that is a journal *setting* owned by `workflow-settings`; see
Cross-feature interactions.

## Actors & permissions

Everything here is inside the editorial workflow shell (login + journal context). A
**recommend-only editor** is a user holding a **manager or section-editor** stage assignment
on the submission whose assignment carries the **Recommend only** flag (or whose user *group*
is configured recommend-only, for the unassigned-manager fallback); setting that flag is owned
by `stage-participants`. A **deciding editor** is a manager/section-editor assigned to the
submission's current stage **without** that flag. The recommend-only condition is a *review-stage*
phenomenon in OJS: the recommend-only controls render only in the External Review stage; at the
Submission stage a recommend-only editor still finalizes the one decision a recommending user may
make (Send for Review). A user who holds **both** a recommend-only and a plain editorial assignment
on the stage is treated as a deciding editor (the plain assignment wins). Live-probed 2026-07-03 on
`publicknowledge` seed 718 (review stage): `minoue` = recommend-only section editor, `dbarnes` =
deciding editor. <sup>a</sup>

| Action | Who may — and when |
|--------|--------------------|
| **Hold the recommend-only role** | • Any **manager or section-editor** assignment may carry the Recommend-only flag; it is meaningless (hidden) on author/assistant/reviewer roles<br>• An unassigned manager whose **user group** is flagged recommend-only is treated as recommend-only via the manager-scope fallback<br>• Setting the flag is owned by `stage-participants` (an assigned section editor — even a recommend-only one — can set it when adding a participant) <sup>b</sup> |
| **Record a recommendation** (Recommend Accept / Recommend Decline / Recommend Revisions → *revisions or resubmit*) | • Recommend-only editors — in a review round, **only if the submission has at least one deciding editor** to act on it (else the buttons are withheld and the record is refused)<br>• A plain deciding editor never sees the Recommend buttons (they see the finalizing buttons) <sup>c</sup> |
| **Record a final decision** (Accept, Decline, Request Revisions, Send To Production, …) | • Recommend-only editors — **never** at the review stage (only the *recommendation* is offered them there); the sole exception is **Send for Review** at the Submission stage, the one decision a recommending user may finalize<br>• Deciding editors and manager scope — as owned by `editorial-decisions` <sup>d</sup> |
| **See recorded recommendations** | • **Deciding editors** — the review pane lists **each recommending editor's latest recommendation**, phrased as the recommended decision ("Accept Submission")<br>• The recommending editor — sees **their own** latest recommendation echoed back, with a **Change decision** link (the literal button label) to record a new one<br>• A "recommendations are in" signal marks the round when the recommending editors have weighed in <sup>e</sup> |
| **Manage reviewers** (assign / unassign / thank / reinstate …) | • Recommend-only editors — **yes, normally**; the reviewer grid does not gate on the flag (owned by `assign-and-manage-reviewers`, verified there) <sup>f</sup> |
| **Add / remove / notify participants** | • Recommend-only editors — **yes**; the Participants panel treats any section-editor assignment as an administrator (owned by `stage-participants`, verified there) <sup>g</sup> |
| **Configure the reviewer-recommendation *options*** (the vocabulary a reviewer picks) | • Managers, in **Settings → Workflow → Review** — a **different feature** owned by `workflow-settings`; not the recommend-only editor's job and unrelated to the recommend_only flag <sup>h</sup> |

<sup>a</sup> maps/Schema.php getPropertyStages() (per-stage `currentUserCanRecommendOnly`, `isDecidingEditorAssigned`, `isCurrentUserDecidingEditor`); getPropertyStageAssignments() (top-level `editorAssigned` = a non-recommend-only editor exists); checkDecisionPermissions() (both-assignments → decision wins); live probe 2026-07-03 (sub 718) ·
<sup>b</sup> stage_assignments.recommend_only; user_groups.recommend_only (group default); checkDecisionPermissions() (unassigned-manager group fallback); stage-participants rule 5 / Known deviations (add-mode flag guard) ·
<sup>c</sup> WorkflowRecommendOnlyControls.vue (`isDecidingEditorAssigned` gates the buttons); DecisionHandler::record()/Repository::validate() (`requiredDecidingEditor`, owned by editorial-decisions); live probe (minoue: buttons present with dbarnes assigned; withheld + `editorAssigned=false` after dbarnes removed) ·
<sup>d</sup> DecisionAllowedPolicy::effect() (recommend-only assignment permits only recommendations + `getDecisionTypesMadeByRecommendingUsers`); Repository::getDecisionTypesMadeByRecommendingUsers() (OJS: SendExternalReview at Submission stage); editorial-decisions rule 3 (finalize → 401 `disallowedDecision`) ·
<sup>e</sup> getPropertyStages() (deciding editor → `stages[].recommendations` = latest per editorId via getRecommendationLabel(); recommending editor → `currentUserRecommendation`); WorkflowRecommendOnlyListingRecommendations.vue; areRecommendationsIn() (`recommendationsIn`); live probe (dbarnes saw `[{decision:9,label:'Accept Submission'}]`; minoue saw own `currentUserRecommendation`) ·
<sup>f</sup> assign-and-manage-reviewers (recommend-only SE manages reviewers, verified there) ·
<sup>g</sup> stage-participants rule/scenario 10 (recommend-only SE administers the panel, verified there) ·
<sup>h</sup> ReviewerRecommendationsListPanel / SettingsPage.vue ReviewerRecommendationManager (Settings → Workflow); owned by `workflow-settings`

## Fields & validation

A recommend-only editor records a recommendation through the **same Record-Decision wizard** a
deciding editor uses (owned by `editorial-decisions`), reached from the review-stage action pane.
The only field choices particular to the recommend-only editor:

| Field (UI label) | Required? | Rules | Anchor |
|------------------|-----------|-------|--------|
| **Recommendation** (which button) | Yes | Three buttons at the review stage: **Recommend Revisions**, **Recommend Accept**, **Recommend Decline**. Recommend Revisions first opens a small modal (revisions handled in the current round vs *Resubmit for Review* / new round), exactly like the decision variant | WorkflowRecommendOnlyControls.vue getRecommendationActions() (`editor.submission.recommend.{revisions,accept,decline}`); SelectRevisionRecommendationForm (owned by editorial-decisions) |
| **Notify editors** (the email step) | Yes — **cannot be skipped** | The recommendation's email to the deciding editors is pre-filled and editable but, unlike a decision's notify-author step, may not be skipped | IsRecommendation::getSteps() (`canSkip(false)`); mailable owned by editorial-decisions |

All other wizard mechanics (subject/body, CC/BCC, attach files, template swap) are identical to a
decision and owned by `editorial-decisions`. The recommendation entity is a `decision` row like any
other (constants RecommendAccept=9, RecommendRevisions=10, RecommendResubmit=11, RecommendDecline=12).

## Rules & state

1. **The flag swaps the review-stage action pane from *decide* to *recommend*.** In the External
   Review stage, when the current user's stage data carries `currentUserCanRecommendOnly`, the OJS
   workflow config renders the **recommend-only controls** (the Recommend buttons) **instead of** the
   decision action buttons; a deciding editor (flag absent) gets the decision buttons. This is a
   per-stage, per-user computation, so the same submission shows different action panes to the
   recommend-only editor and the deciding editor. Live-verified: as `minoue` stage-3
   `currentUserCanRecommendOnly=true`; as `dbarnes` it is unset. <sup>a</sup>
2. **The recommendation options are Recommend Revisions / Accept / Decline** (three buttons); Recommend
   Revisions branches to *recommend revisions* vs *recommend resubmit* via the same revision modal a
   decision uses. There is no separate Recommend-Resubmit button — it is the second option inside
   Recommend Revisions. (The internal-review recommend variants exist in shared code but OJS has no
   internal-review stage — out of scope.) <sup>b</sup>
3. **A recommendation requires a deciding editor, enforced in the UI *and* the backend.** The
   recommend-only controls show the Recommend buttons only when a deciding editor is assigned;
   otherwise they show a **no-deciding-editor** message (verbatim: *"You can not make a recommendation
   until an editor is assigned with permission to record a decision."*) and offer nothing. This is driven by the
   submission's top-level `editorAssigned`, which is true only when a **non-recommend-only**
   editor is assigned — so a recommend-only editor being the *only* editor reads as *not* assigned.
   The backend independently refuses a recommendation with `requiredDecidingEditor` in the same case
   (owned by `editorial-decisions`). Live-verified: with `dbarnes` present `editorAssigned=true` (buttons);
   after removing `dbarnes`, `editorAssigned` flipped to **false** for `minoue` (message, no buttons),
   matching the backend guard. <sup>c</sup>
4. **Recording a recommendation changes no submission state.** The recommendation is an editorial
   decision whose transition is a no-op — no stage, status or review-round change — but it emails the
   deciding editors (`RecommendationNotifyEditors`), opens an editor discussion seeded with the
   recommendation, and writes an **Editor recommendation** event-log entry. All of that (the act, the
   email, the discussion, the log) is owned and live-verified by `editorial-decisions`. Live-reconfirmed
   here: `minoue` recording *Recommend Accept* left submission 718 at stage 3 / status Queued unchanged.
   <sup>d</sup>
5. **Where the recommendation surfaces.** After a recommendation is recorded, the **deciding editor's**
   review pane lists **each recommending editor's latest recommendation**, labelled as the *recommended
   decision* (a Recommend-Accept shows as **"Accept Submission"**) — telling the decider what action is
   advised. The **recommending editor** instead sees **their own** latest recommendation echoed with a
   **Change decision** link (recording a new one supersedes it; the link's label is the reused
   `editor.submission.workflowDecision.changeDecision` string = "Change decision", *not* "Change
   recommendation"). Recommendations are grouped by
   editor and only the latest per editor is kept, so a re-recommendation replaces the earlier one and
   multiple recommending editors each contribute one line. A round-level `recommendationsIn` flag tells
   the decider the recommending editors have weighed in. Live-verified: after `minoue`'s Recommend Accept,
   `dbarnes` saw `recommendations=[{decision:9, label:'Accept Submission'}]` while `minoue` saw
   `currentUserRecommendation={decision:9, label:'Accept Submission'}` and no listing. <sup>e</sup>
6. **The deciding editor still records the real decision.** The recommendation is advisory; the deciding
   editor (or an unassigned manager) records the finalizing decision through the normal action bar, which
   drives the actual transition. A recommend-only editor attempting to finalize is refused
   (`disallowedDecision`, owned by `editorial-decisions`). <sup>f</sup>
7. **A recommend-only editor keeps their non-decision powers.** The flag narrows only *decision* authority.
   The same editor manages reviewers (assign/unassign/thank/reinstate — owned by `assign-and-manage-reviewers`)
   and administers the Participants panel (add/remove/notify — owned by `stage-participants`); both are
   verified live in those specs (`minoue`). The flag does not restrict viewing files, discussions, or the
   review roster. <sup>g</sup>
8. **Dual assignment resolves to *decide*.** If a user holds two editorial assignments on the stage — one
   recommend-only and one plain — they can make decisions; `checkDecisionPermissions` sets `canMakeDecision`
   from any non-recommend-only assignment. Only a user whose *every* editorial assignment on the stage is
   recommend-only is confined to recommendations (`isOnlyRecommending`), and even then the stage's
   recommending-user decisions (Send for Review at Submission) are still offered. <sup>h</sup>
9. **Recommend-only ≠ reviewer recommendation.** The recommend-only editor's recommendation is an editorial
   **decision** (a `decision` row, one of RecommendAccept/Decline/Revisions/Resubmit). It is unrelated to
   the configurable **reviewer** recommendation options in `reviewer_recommendations` — a journal-level
   vocabulary a *reviewer* selects at review completion (stored on `review_assignments.reviewer_recommendation_id`),
   which an editor may also set by proxy. That whole cluster is `workflow-settings` config; see
   Cross-feature interactions and Open questions. <sup>i</sup>

<sup>a</sup> WorkflowConfig / workflowConfigEditorialOJS.js (`selectedStage.currentUserCanRecommendOnly` → `WorkflowRecommendOnlyControls` else decision buttons); maps/Schema.php getPropertyStages() (`currentUserCanRecommendOnly`); live probe (sub 718) ·
<sup>b</sup> WorkflowRecommendOnlyControls.vue getRecommendationActions() (EXTERNAL_REVIEW branch: revisions/accept/decline; INTERNAL_REVIEW branch OMP-only); DecisionActions.DECISION_RECOMMEND_* ·
<sup>c</sup> WorkflowRecommendOnlyControls.vue (`isDecidingEditorAssigned = submission.editorAssigned`; `showRecommendationActions` false when not; `editor.submission.recommendation.noDecidingEditors`); maps/Schema.php getPropertyStageAssignments() (top-level `editorAssigned` excludes recommendOnly); DecisionHandler::record() (`requiredDecidingEditor`, editorial-decisions); live probe (editorAssigned true→false on removing dbarnes) ·
<sup>d</sup> IsRecommendation trait (getNew* null, addRecommendationQuery, RecommendationNotifyEditors, `canSkip(false)`); editorial-decisions rule 11 (act/email/discussion/log, verified); live reconfirm (POST decision 9 on 718 → 200, stage 3 / status 1 unchanged) ·
<sup>e</sup> maps/Schema.php getPropertyStages() (recommendations grouped by editorId, latest kept, `getRecommendationLabel()`; set on `stages[].recommendations` only when `isCurrentUserDecidingEditor`, on `currentUserRecommendation` for the author of the recommendation); WorkflowRecommendOnlyListingRecommendations.vue (`selectedStage.recommendations`, heading `editor.submission.recommendation` = "Recommendation"); WorkflowRecommendOnlyControls.vue (recommending editor's echo + change-link `editor.submission.workflowDecision.changeDecision` = "Change decision", which sets `explicitelyShowRecommendationActions` to re-show the Recommend buttons — *not* the unused `editor.submission.changeRecommendation` = "Change Recommendation" string); areRecommendationsIn() (`recommendationsIn` = round status RECOMMENDATIONS_READY); RecommendAccept::getRecommendationLabel(); browser-driven live 2026-07-03 as each actor (retained `recommend-only-editors.spec.js`, green) ·
<sup>f</sup> editorial-decisions rule 3 / rule 11 (deciding editor finalizes; recommend-only finalize → 401 `disallowedDecision`) ·
<sup>g</sup> assign-and-manage-reviewers (reviewer grid ungated on recommend_only); stage-participants rule/scenario 10 ·
<sup>h</sup> maps/Schema.php checkDecisionPermissions() (`canMakeDecision`/`canMakeRecommendation`/`isOnlyRecommending`; getDecisionTypesMadeByRecommendingUsers fallback) ·
<sup>i</sup> ReviewerRecommendationsMigration (table comment "selected by reviewer at the completion of review assignment"); ReviewRoundProcessor::resolveRecommendationId() (reviewer recommendation string → reviewer_recommendations row); DecisionProcessor.php:41 ("editor-to-editor recommendations are a distinct flow")

## Side effects

All side effects of *recording* a recommendation are owned by `editorial-decisions` (the decision engine):
the **RecommendationNotifyEditors** email to the deciding editors (`EDITOR_RECOMMENDATION`, the un-skippable
notify step), the **editor discussion** seeded with the recommendation and its attachments (owned by
`tasks-discussions`), and the **Editor recommendation** event-log entry (`SUBMISSION_LOG_EDITOR_RECOMMENDATION`).
A recommendation raises **no** submission-state change and **no** author-facing editor-decision notification.
This feature adds no side effects of its own beyond swapping which controls the review pane renders.

## Settings that modify behavior

- **Recommend-only flag on an assignment** (`stage_assignments.recommend_only`) — the switch this whole spec
  is about; set per-participant in the Assign/Edit modal (owned by `stage-participants`).
- **Recommend-only default on a user group** (`user_groups.recommend_only`, Settings → Users & Roles) — a role
  configured recommend-only pre-checks the Assign modal's box and makes an unassigned manager of that group
  advisory-only via the manager-scope fallback (roles config owned by `roles-permissions`; the pre-check is
  described in `stage-participants`).
- **Configurable *reviewer* recommendation options** (Settings → Workflow → Review; `reviewer_recommendations`
  table) — a **separate** feature (`workflow-settings`) that sets the vocabulary a *reviewer* picks at review
  completion. It does **not** change anything about the recommend-only editor role; listed only to disambiguate.
- No setting changes the recommend-only transition (there is none) or the deciding-editor requirement; both are
  fixed in the decision-type classes and the submission map.

## Cross-feature interactions

- **editorial-decisions** — owns the recommendation **act**: the Recommend-* decision types, the no-op
  transition, the **RecommendationNotifyEditors** email, the deciding-editor requirement guard, and the
  `SUBMISSION_LOG_EDITOR_RECOMMENDATION` event log. This spec owns the **role** that produces the act and how
  the review pane presents it; it references editorial-decisions for the mechanics.
- **stage-participants** — owns setting the `recommend_only` flag on an assignment (and the ⚠ add-mode guard
  gap where a recommend-only editor can stamp the flag on someone they add). This spec owns what the flag *does*.
- **assign-and-manage-reviewers** — a recommend-only editor manages reviewers normally (verified there). Also
  owns the distinct act of an editor setting a **reviewer's** recommendation **by proxy** in the reviewer grid
  (`EVLOG-REV-PROXY-REC`, `SUBMISSION_LOG_REVIEW_RECOMMENDATION_BY_PROXY`) — a *reviewer* recommendation, not
  this role's.
- **reviewer-response** — owns the reviewer's own recommendation selected at review completion (from the
  configurable options), which is a different thing from an editor's recommend-only recommendation.
- **workflow-settings** — owns the configurable **reviewer-recommendation options** cluster
  (`reviewer_recommendations` (+settings), the `ReviewerRecommendationManager` Settings surface, the
  reviewer-recommendation form, the `/reviewers/recommendations` CRUD API, and its access policy). Re-hinted
  there (previously mis-hinted to this feature). Also owns the workflow-config that wires the recommend-only
  controls into the action bar.
- **workflow-stage-navigation** — owns the workflow shell/action-bar container that hosts the recommend-only
  controls (sub-components of the workflow page, below atlas granularity).
- **tasks-discussions** — owns the editor discussion a recommendation opens.

## Canonical scenarios

1. **Recommend, then the deciding editor acts** — a recommend-only section editor opens a review-stage
   submission, clicks **Recommend Accept**, and composes the (un-skippable) note to the editors; the submission
   does not move, an **editor discussion** opens and the deciding editors get the **RecommendationNotifyEditors**
   email. The deciding editor sees the recommendation and records the real **Accept** (recommendation flow
   verified end-to-end across this spec + `editorial-decisions`).
2. **The action pane shows Recommend, not Decide** — on the same review stage the recommend-only editor sees
   **Recommend Revisions / Accept / Decline** and **not** the finalizing Accept/Decline/Request-Revisions buttons,
   while a deciding editor on the identical submission sees the decision buttons (verified live: `minoue`
   `currentUserCanRecommendOnly=true`, `dbarnes` unset).
3. **No deciding editor → no recommendation** — when the only editor on a submission is recommend-only, the
   recommendation pane shows a **"no deciding editors"** message and offers no buttons, and the backend refuses
   to record one; assigning a deciding editor lights the buttons back up (verified live: removing the deciding
   editor flipped `editorAssigned` to false; backend `requiredDecidingEditor` owned by `editorial-decisions`).
4. **The recommendation surfaces to the decider** — after the recommendation is recorded, the deciding editor's
   review pane lists it as the advised decision (**"Accept Submission"**), and the recommending editor sees their
   own recommendation with a **Change decision** link (verified live in the browser: `dbarnes` saw the listing,
   `minoue` saw the echo and the "Change decision" link, which re-opens the Recommend buttons).
5. **Latest recommendation per editor** — a recommend-only editor who re-recommends supersedes their prior
   recommendation (only the latest shows to the decider), and if several recommending editors advise, each
   contributes one line; a round-level "recommendations are in" signal marks completion (map logic:
   group-by-editor, latest kept, `recommendationsIn`).
6. **A recommend-only editor still runs the review** — the same editor assigns and manages reviewers and adds,
   removes and notifies participants exactly like a full editor; only *finalizing* a decision is withheld
   (verified in `assign-and-manage-reviewers` and `stage-participants` with `minoue`).

## Known deviations (as-built ≠ intent)

- The recommend-only editor's **inability to finalize** and the **un-skippable notify-editors** step are
  strict-by-design, not deviations.
- The one add-mode flag-guard oddity in this area — a recommend-only editor being able to stamp the
  recommend-only flag on a participant they *add* (but not *edit*) — is a `stage-participants` ⚠ (its Known
  deviations); referenced here, not restated.
- Naming smell, not a user-facing bug: in `areRecommendationsIn()` the local `$hasDecidingEditors` is set from
  `recommendOnly` (it actually detects a *recommending* editor). Behaviour is correct (the `recommendationsIn`
  flag is non-null only when a recommend-only editor exists); no ledger row.
- Cosmetic copy reuse, not a bug: the recommending editor's link to record a *new* recommendation renders
  **"Change decision"** — `WorkflowRecommendOnlyControls.vue` reuses `editor.submission.workflowDecision.changeDecision`
  even though a purpose-built `editor.submission.changeRecommendation` = "Change Recommendation" string exists and
  goes unused. Slightly off (the action changes a recommendation, not a decision), but harmless; browser-verified
  as the literal label. No ⚠, no ledger row.

## Open questions

1. **Ownership of the reviewer-recommendation *options* cluster.** Established as-built that
   `reviewer_recommendations` (+settings), the `ReviewerRecommendationManager` Settings surface, the
   reviewer-recommendation form, the `/reviewers/recommendations` API and `RecommendationAccessPolicy` are the
   configurable **reviewer** vocabulary (Settings → Workflow), unrelated to the recommend_only flag. This spec
   re-hints them from `recommend-only-editors` to `workflow-settings`. **Verifier-confirmed 2026-07-03:** the
   atlas is internally consistent — every atom of the cluster (DB-reviewer_recommendations(+settings),
   VUE-reviewer-recommendation-manager, FORM-reviewer-recommendation-form, the six API-reviewer-recommendation-*,
   AUTHZ-recommendation-{access,context,required}-policy) carries the `workflow-settings` hint with an empty
   `Claimed by`, and **no** atom still hints `recommend-only-editors`. Ownership is a hint pending the
   `workflow-settings` spec (which merges the former `review-settings`); confirm at that spec's authoring.
2. **EVLOG-REV-PROXY-REC home — confirmed reviewer-management, parked.** The
   editor-sets-a-reviewer's-recommendation-by-proxy event log (`SUBMISSION_LOG_REVIEW_RECOMMENDATION_BY_PROXY`,
   fired from OJS `ReviewerGridHandler::reviewRead` when reading a review sets
   `review_assignments.reviewer_recommendation_id`) is a **reviewer** recommendation, not the recommend-only
   editor's editor-to-editor recommendation, so correctly **not** owned here. It is genuinely orphaned in the
   atlas today (empty `Claimed by`; `reviewer-response`'s verifier noted the same), its natural home being
   `assign-and-manage-reviewers` (which fires the sibling `SUBMISSION_LOG_REVIEW_CONFIRMED` from the same
   `reviewRead` handler but is verified without it). Parked in `UNASSIGNED.md` with that reason for adoption at
   grooming — resolving the orphan without reopening a verified sibling.
3. **Un-atomized recommend-only UI — confirmed.** `WorkflowRecommendOnlyControls` and
   `WorkflowRecommendOnlyListingRecommendations` are the genuine recommend-only surfaces but sit below the
   vue-sweep's "major component" line: **verifier-confirmed 2026-07-03** that `atlas/vue.md` carries **no** atom
   for either (its only recommend row is VUE-reviewer-recommendation-manager, a different concept), so they roll
   up under the workflow page shell (`workflow-stage-navigation`) rather than being atomized — as intended.
4. **Submission-stage recommend-only affordance — as-built confirmed live; intent still open.** At the
   Submission stage a recommend-only editor sees exactly **one finalizing button, Send for Review** (the one
   recommending-user decision from `getDecisionTypesMadeByRecommendingUsers()`) and **no** Recommend buttons,
   **no** Accept-and-Skip-Review, **no** Decline — the recommend-only controls render only at the review stage.
   Browser-verified 2026-07-03 as `minoue` (retained `recommend-only-editors.spec.js` test 6/OQ4:
   `availableEditorialDecisions` = `[Send for Review]`; only the Send-for-Review button visible). What remains a
   product question is whether offering a *finalizing* (rather than advisory) button to a recommend-only editor
   at that stage is *intended* (rule owned by `editorial-decisions`).

---

## Reference — entry points & surfaces

| Entry | Path | Atom |
|-------|------|------|
| Recommend-only action pane (review stage) | Workflow → External Review stage → action pane; renders `WorkflowRecommendOnlyControls` when `currentUserCanRecommendOnly` | *(workflow-page sub-component; not atomized — see Open question 3)* |
| Recorded-recommendation listing (deciding editor) | Same pane, secondary column; `WorkflowRecommendOnlyListingRecommendations` from `stages[].recommendations` | *(as above)* |
| Record a recommendation (API) | `POST api/v1/submissions/{id}/decisions` (decision 9/10/11/12) | API-submission-add-decision *(owned by editorial-decisions)* |
| Recommendation email | `RecommendationNotifyEditors` (`EDITOR_RECOMMENDATION`) | MAIL-recommendation-notify-editors *(editorial-decisions)* |
| Recommendation event log | `SUBMISSION_LOG_EDITOR_RECOMMENDATION` | EVLOG-SUBM-ED-REC *(editorial-decisions)* |
| The recommend_only flag | `stage_assignments.recommend_only` | DB-stage_assignments *(stage-participants)* |
| Reviewer-recommendation OPTIONS (different concept) | Settings → Workflow → Review; `reviewer_recommendations` table + `ReviewerRecommendationManager` | DB-reviewer_recommendations, VUE-reviewer-recommendation-manager, … *(workflow-settings)* |

## Reference — code anchors

- **Role computation**: `lib/pkp/classes/submission/maps/Schema.php` — `getPropertyStages()`
  (`currentUserCanRecommendOnly`, `isDecidingEditorAssigned`, `isCurrentUserDecidingEditor`, `recommendations`,
  `currentUserRecommendation`), `getPropertyStageAssignments()` (top-level `editorAssigned`),
  `checkDecisionPermissions()` (`canMakeDecision`/`canMakeRecommendation`/`isOnlyRecommending`),
  `areRecommendationsIn()` (`recommendationsIn`).
- **Recommend-only UI**: `lib/ui-library/src/pages/workflow/components/action/WorkflowRecommendOnlyControls.vue`
  (buttons + no-deciding-editor message + change link),
  `lib/ui-library/src/pages/workflow/components/secondary/WorkflowRecommendOnlyListingRecommendations.vue`
  (deciding-editor listing); wired by
  `lib/ui-library/src/pages/workflow/composables/useWorkflowConfig/workflowConfigEditorialOJS.js`
  (`currentUserCanRecommendOnly` branch).
- **The recommendation act (owned by editorial-decisions)**: `lib/pkp/classes/decision/types/{RecommendAccept,
  RecommendDecline,RecommendRevisions,RecommendResubmit}.php` + `traits/IsRecommendation.php`
  (`getRecommendationLabel`, `getSteps` `canSkip(false)`, `addRecommendationQuery`, `RecommendationNotifyEditors`);
  `classes/decision/Repository.php` (`getDecisionTypesMadeByRecommendingUsers` — OJS: SendExternalReview at
  Submission).
- **The reviewer-recommendation OPTIONS (owned by workflow-settings, referenced for the seam)**:
  `classes/migration/install/ReviewerRecommendationsMigration.php`,
  `lib/pkp/classes/submission/reviewer/recommendation/ReviewerRecommendation.php`,
  `classes/components/listPanels/ReviewerRecommendationsListPanel.php` (via `pages/management/SettingsHandler.php`),
  `api/v1/reviewers/recommendations/ReviewerRecommendationController.php`.
