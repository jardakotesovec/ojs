// @ts-check

/**
 * OJS app context — the capability map shared specs gate on.
 *
 * Contract (MULTIAPP-PLAN §3, APP-GLOSSARY §2–§3):
 *   - Shared specs in lib/pkp/playwright/tests/ gate on CAPABILITIES, never
 *     app names: `test.skip(!appContext.hasReviewStage, …)`, never
 *     `if (app === 'ops')`.
 *   - The `hasX` names below are CANONICAL — copied verbatim from
 *     docs/product/APP-GLOSSARY.md §2. Adding a capability means adding a
 *     row there first, then the same key in all three app.context.js files.
 *   - Vocabulary and seed nouns never gate anything; they come from
 *     `vocab` / `seed` so one shared test renders the right labels
 *     wherever the capability holds.
 *
 * Consumed through the shared `appContext` fixture
 * (lib/pkp/playwright/support/base-test.js), which resolves this file from
 * `process.cwd()` and cross-checks `app` against the Playwright project
 * name.
 */

module.exports = {
	app: 'ojs',

	// ---- Capabilities (canonical names — APP-GLOSSARY.md §2) ----------

	/** Review stage exists → the whole review cluster applies. */
	hasReviewStage: true,
	/** OMP-unique Internal Review stage. */
	hasInternalReview: false,
	/** Copyediting stage + its participants/files. */
	hasCopyediting: true,
	/** Production stage (all apps; kept for completeness). */
	hasProduction: true,
	/** Issues, issue assignment, back-issue archive/TOC. */
	hasIssues: true,
	/** Galley representation model. */
	hasGalleys: true,
	/** Subscriptions management + subscription access. */
	hasSubscriptions: true,
	/** Sections as the content grouping. */
	hasSections: true,
	/** Reviewer user groups exist / can be seeded. */
	hasReviewerRoles: true,

	// ---- Workflow topology --------------------------------------------

	/**
	 * WORKFLOW_STAGE_ID_* values this app actually instantiates, in
	 * workflow order. The constants are PKP-wide, so the NUMBERS are
	 * comparable across apps — it is the membership of this list that
	 * differs (OJS 1,3,4,5 / OMP 1,2,3,4,5 / OPS 5).
	 */
	stages: [1, 3, 4, 5],
	/** Stage a freshly-seeded submission lands on (`Application::getApplicationStages()[0]`). */
	initialStageId: 1,
	/** The review stage shared review specs drive. Null when !hasReviewStage. */
	reviewStageId: 3,
	/** OMP only; null elsewhere. */
	internalReviewStageId: null,

	// ---- Scenario-spec vocabulary --------------------------------------

	/** Key the submission scenario spec uses for its content container. */
	submissionContainerKey: 'section',

	// ---- Reader-facing vocabulary (APP-GLOSSARY §1) ---------------------

	vocab: {
		context: 'journal',
		contextPlural: 'journals',
		submission: 'article',
		container: 'section',
		representation: 'galley',
		managerRole: 'Journal Manager',
		subEditorRole: 'Section Editor',
	},

	// ---- Baseline seed (playwright/fixtures/bootstrap.js) ---------------

	seed: {
		/** Same URL path in all three apps — POMs can hard-default it. */
		contextPath: 'publicknowledge',
		contextName: 'Journal of Public Knowledge',
		/** Handles of the seeded containers, in bootstrap order. */
		containers: ['ART', 'REV'],
		/**
		 * Role archetype → seeded username, or null where the app has no
		 * such user group. `seniorEditor` is the highest editorial actor
		 * with full workflow access; on OPS (which ships no editor group)
		 * that is the manager, so shared specs resolve the actor here
		 * instead of hard-coding `editor.diana`.
		 */
		actors: {
			siteAdmin: 'admin',
			manager: 'manager.maya',
			seniorEditor: 'editor.diana',
			sectionEditor: 'sectioneditor.ana',
			reviewer: 'reviewer.julia',
			internalReviewer: null,
			copyeditor: 'copyeditor.carla',
			author: 'author.alex',
			reader: 'reader.rosa',
		},
	},
};
