{**
 * templates/workflow/workflow.tpl
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * Display the workflow tab structure.
 *}
{extends file="layouts/backend.tpl"}

{block name="page"}
	<pkp-header :is-one-line="true" class="pkpWorkflow__header">
		<h1 class="pkpWorkflow__identification">
			<badge
				v-if="submission.status === getConstant('STATUS_PUBLISHED')"
				class="pkpWorkflow__identificationStatus"
				:is-success="true"
			>
				{translate key="publication.status.published"}
			</badge>
			<badge
				v-else-if="submission.status === getConstant('STATUS_SCHEDULED')"
				class="pkpWorkflow__identificationStatus"
				:is-primary="true"
			>
				{translate key="publication.status.scheduled"}
			</badge>
			<badge
				v-else-if="submission.status === getConstant('STATUS_DECLINED')"
				class="pkpWorkflow__identificationStatus"
				:is-warnable="true"
			>
				{translate key="common.declined"}
			</badge>
			{include file="workflow/submissionIdentification.tpl"}
		</h1>
		<template slot="actions">
			<pkp-button
				v-if="submission.status === getConstant('STATUS_PUBLISHED')"
				element="a"
				:href="submission.urlPublished"
			>
				{{ __('common.view') }}
			</pkp-button>
			<pkp-button
				v-else-if="submission.status !== getConstant('STATUS_PUBLISHED') && submission.stageId >= getConstant('WORKFLOW_STAGE_ID_EDITING')"
				element="a"
				:href="submission.urlPublished"
			>
				{translate key="common.preview"}
			</pkp-button>
			{if $submissionPaymentsEnabled}
				<dropdown
					class="pkpWorkflow__submissionPayments"
					label="{translate key="common.payments"}"
				>
					<pkp-form class="pkpWorkflow__submissionPaymentsForm" v-bind="components.{$smarty.const.FORM_SUBMISSION_PAYMENTS}" @set="set">
				</dropdown>
			{/if}
			{if $canAccessEditorialHistory}
				<pkp-button
					ref="activityButton"
					@click="openActivity"
				>
					{translate key="editor.activityLog"}
				</pkp-button>
			{/if}
			<pkp-button
				ref="library"
				@click="openLibrary"
			>
				{translate key="editor.submissionLibrary"}
			</pkp-button>
		</template>
	</pkp-header>
	<tabs default-tab="workflow" :track-history="true">
		<tab id="workflow" label="{translate key="manager.workflow"}">
			<script type="text/javascript">
				// Initialize JS handler.
				$(function() {ldelim}
					$('#submissionWorkflow').pkpHandler(
						'$.pkp.pages.workflow.WorkflowHandler'
					);
				{rdelim});
			</script>

			<div id="submissionWorkflow" class="pkp_submission_workflow">
				{include file="controllers/notification/inPlaceNotification.tpl" notificationId="workflowNotification" requestOptions=$workflowNotificationRequestOptions}
				{capture assign=submissionProgressBarUrl}{url op="submissionProgressBar" submissionId=$submission->getId() stageId=$requestedStageId contextId="submission" escape=false}{/capture}
				{load_url_in_div id="submissionProgressBarDiv" url=$submissionProgressBarUrl}
			</div>

			{* Modal to select one of the revision decisions *}
			<modal
				:close-label="__('common.close')"
				name="selectRevisionDecision"
				title="Revisions"
				:open="isModalOpenedSelectRevisionDecision"
				@close="isModalOpenedSelectRevisionDecision = false"
			>
				<pkp-form v-bind="components.{$smarty.const.FORM_SELECT_REVISION_DECISION}" @set="set" @success="goToRevisionDecision" />
			</modal>

			{* Modal to select one of the revision recommendations *}
			<modal
				:close-label="__('common.close')"
				name="selectRevisionRecommendation"
				title="Revisions"
				:open="isModalOpenedSelectRevisionRecommendation"
				@close="isModalOpenedSelectRevisionRecommendation = false"
			>
				<pkp-form v-bind="components.{$smarty.const.FORM_SELECT_REVISION_RECOMMENDATION}" @set="set" @success="goToRevisionDecision" />
			</modal>
		</tab>
		{if $canAccessPublication}
			<tab id="publication" label="{translate key="submission.publication"}">
				{help file="editorial-workflow/publication" class="pkp_help_tab"}
				<div class="pkpPublication" ref="publication" aria-live="polite">
					<pkp-header class="pkpPublication__header" :is-one-line="false">
						<span class="pkpPublication__status">
							<strong>{{ statusLabel }}</strong>
							<span v-if="workingPublication.status === getConstant('STATUS_QUEUED') && workingPublication.id === currentPublication.id" class="pkpPublication__statusUnpublished">{translate key="publication.status.unscheduled"}</span>
							<span v-else-if="workingPublication.status === getConstant('STATUS_SCHEDULED')">{translate key="publication.status.scheduled"}</span>
							<span v-else-if="workingPublication.status === getConstant('STATUS_PUBLISHED')" class="pkpPublication__statusPublished">{translate key="publication.status.published"}</span>
							<span v-else class="pkpPublication__statusUnpublished">{translate key="publication.status.unpublished"}</span>
						</span>
						<span v-if="publicationList.length > 1" class="pkpPublication__version">
							<strong tabindex="0">{{ versionLabel }}</strong> {{ workingPublication.version }}
							<dropdown
								class="pkpPublication__versions"
								label="{translate key="publication.version.all"}"
								:is-link="true"
								submenu-label="{translate key="common.submenu"}"
							>
								<ul>
									<li v-for="publication in publicationList" :key="publication.id">
										<button
											class="pkpDropdown__action"
											:disabled="publication.id === workingPublication.id"
											@click="setWorkingPublicationById(publication.id)"
										>
											{{ publication.version }} /
											<template v-if="publication.status === getConstant('STATUS_QUEUED') && publication.id === currentPublication.id">{translate key="publication.status.unscheduled"}</template>
											<template v-else-if="publication.status === getConstant('STATUS_SCHEDULED')">{translate key="publication.status.scheduled"}</template>
											<template v-else-if="publication.status === getConstant('STATUS_PUBLISHED')">{{ publication.datePublished }}</template>
											<template v-else>{translate key="publication.status.unpublished"}</template>
										</button>
									</li>
								</ul>
							</dropdown>
						</span>
						{if $canPublish}
							<template slot="actions">
								<pkp-button
									v-if="workingPublication.status !== getConstant('STATUS_PUBLISHED') && submission.stageId >= getConstant('WORKFLOW_STAGE_ID_EDITING')"
									element="a"
									:href="workingPublication.urlPublished"
								>
									{translate key="common.preview"}
								</pkp-button>
								<pkp-button
									v-if="workingPublication.status === getConstant('STATUS_QUEUED')"
									ref="publish"
									@click="workingPublication.issueId ? openPublish() : openAssignToIssue()"
								>
									{{ submission.status === getConstant('STATUS_PUBLISHED') ? publishLabel : schedulePublicationLabel }}
								</pkp-button>
								<pkp-button
									v-else-if="workingPublication.status === getConstant('STATUS_SCHEDULED')"
									:is-warnable="true"
									@click="openUnpublish"
								>
									{translate key="publication.unschedule"}
								</pkp-button>
								<pkp-button
									v-else-if="workingPublication.status === getConstant('STATUS_PUBLISHED')"
									:is-warnable="true"
									@click="openUnpublish"
								>
									{translate key="publication.unpublish"}
								</pkp-button>
								<pkp-button
									v-if="canCreateNewVersion"
									ref="createVersion"
									@click="openCreateVersionPrompt"
								>
									{translate key="publication.createVersion"}
								</pkp-button>
							</template>
						{/if}
					</pkp-header>
					<div
						v-if="workingPublication.status === getConstant('STATUS_PUBLISHED')"
						class="pkpPublication__versionPublished"
					>
						{translate key="publication.editDisabled"}
					</div>
					<tabs class="pkpPublication__tabs" :is-side-tabs="true" :track-history="true" :label="currentPublicationTabsLabel">
						<tab id="titleAbstract" label="{translate key="publication.titleAbstract"}">
							<pkp-form v-bind="components.{$smarty.const.FORM_TITLE_ABSTRACT}" @set="set" />
						</tab>
						<tab id="contributors" label="{translate key="publication.contributors"}">
							<contributors-list-panel
								v-bind="components.contributors"
								class="pkpWorkflow__contributors"
								@set="set"
								:items="workingPublication.authors"
								:publication="workingPublication"
								:publication-api-url="submissionApiUrl + '/publications/' + workingPublication.id"
								@updated:publication="setWorkingPublication"
								@updated:contributors="setContributors"
							></contributors-list-panel>
						</tab>
						{if $metadataEnabled}
							<tab id="metadata" label="{translate key="submission.informationCenter.metadata"}">
								<pkp-form v-bind="components.{$smarty.const.FORM_METADATA}" @set="set" />
							</tab>
						{/if}
						<tab v-if="supportsReferences" id="citations" label="{translate key="submission.citations"}">
							<pkp-form v-bind="components.{$smarty.const.FORM_CITATIONS}" @set="set" />
						</tab>
						{if $identifiersEnabled}
							<tab id="identifiers" label="{translate key="submission.identifiers"}">
								<pkp-form v-bind="components.{$smarty.const.FORM_PUBLICATION_IDENTIFIERS}" @set="set" />
							</tab>
						{/if}
						{if $canAccessProduction}
							<tab id="galleys" label="{translate key="submission.layout.galleys"}">
								<div id="representations-grid" ref="representations">
									<spinner></spinner>
								</div>
							</tab>
							<tab id="license" label="{translate key="publication.publicationLicense"}">
								<pkp-form v-bind="components.{$smarty.const.FORM_PUBLICATION_LICENSE}" @set="set" />
							</tab>
							<tab id="issue" label="{translate key="issue.issue"}">
								<pkp-form v-bind="components.{$smarty.const.FORM_ISSUE_ENTRY}" @set="set" />
							</tab>
						{/if}
						{call_hook name="Template::Workflow::Publication"}
					</tabs>
					<span class="pkpPublication__mask" :class="publicationMaskClasses">
						<spinner></spinner>
					</span>
				</div>
			</tab>
		{/if}
		{call_hook name="Template::Workflow"}
	</tabs>
{/block}
