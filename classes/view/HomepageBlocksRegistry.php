<?php

/**
 * @file classes/view/MetadataBlockRepository.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Repository
 *
 * @brief A repository to register and load metadata blocks.
 */

namespace APP\view;

use APP\core\Application;
use APP\facades\Repo;
use APP\template\TemplateManager;
use PKP\context\Context;
use PKP\view\HomepageBlock;

class HomepageBlocksRegistry extends \PKP\view\HomepageBlocksRegistry
{
    protected function registerDefaultBlocks(): void
    {
        parent::registerDefaultBlocks();

        $this->register(
            new HomepageBlock(
                component: 'homepage.issue-summary',
                title: __('manager.homepageBlocks.issueSummary'),
                forSite: false,
            )
        );
        $this->register(
            new HomepageBlock(
                component: 'homepage.issue-toc',
                title: __('manager.homepageBlocks.issueToc'),
                forSite: false,
            )
        );
        $this->register(
            new HomepageBlock(
                component: 'homepage.latest-articles',
                title: __('plugins.themes.eidos.option.homepageBlocks.latestArticles'),
                loader: function (?Context $context) {
                    $collector = Repo::submission()
                        ->getCollector()
                        ->filterByLatestPublished(true)
                        ->limit(9);
                    if ($context) {
                        $collector->filterByContextIds([$context->getId()]);
                    } else {
                        $collector->filterByContextIds([Application::SITE_CONTEXT_ID_ALL]);
                    }
                    $latestPublications = $collector->getMany();
                    $templateMgr = TemplateManager::getManager(Application::get()->getRequest());
                    $templateMgr->assign([
                        'latestPublications' => $latestPublications,
                        'latestPublicationsTitle' => __('submissions.published.latest'),
                        'latestPublicationsDescription' => $context
                            ? __('submissions.published.latest.description', [
                                'url' => Application::get()->getRequest()->url(null, 'issue', 'archive'),
                            ])
                            : __('submissions.published.latest.description.site', [
                                'url' => Application::get()->getRequest()->url(null, 'search'),
                            ]),
                    ]);

                    if ($context) {
                        $sections = Repo::section()
                            ->getCollector()
                            ->filterByContextIds([$context->getId()])
                            ->getMany();
                        $templateMgr->assign('sections', $sections);
                    }
                }
            )
        );
    }
}
