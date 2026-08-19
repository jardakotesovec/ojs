<?php

/**
 * @file classes/view/composers/PublicationIdsComposer.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class PublicationIdsComposer
 *
 * @brief Provides the journal's ISSNs and other publication identifiers
 *  to the views displaying them.
 */

namespace APP\view\composers;

use APP\core\Application;
use Illuminate\Support\Collection;
use Illuminate\View\View;
use PKP\context\Context;

class PublicationIdsComposer
{
    /** @var ?Collection Memoized for repeat renders within the same request */
    protected ?Collection $publicationIds = null;

    public function compose(View $view): void
    {
        $view->with('publicationIds', $this->publicationIds ??= $this->getPublicationIds());
    }

    /**
     * Get an array of ISSNs and other publication IDs
     */
    protected function getPublicationIds(): Collection
    {
        $context = Application::get()->getRequest()->getContext();

        $ids = collect([]);

        if ($context?->getData('printIssn')) {
            $ids->add([
                'id' => 'printIssn',
                'name' => __('journal.issn'),
                'value' => $context->getData('printIssn'),
            ]);
        }

        if ($context?->getData('onlineIssn')) {
            $ids->add([
                'id' => 'onlineIssn',
                'name' => __('metadata.property.displayName.eissn'),
                'value' => $context->getData('onlineIssn'),
            ]);
        }

        if ($context?->getData(Context::SETTING_DOI_PREFIX)) {
            $ids->add([
                'id' => Context::SETTING_DOI_PREFIX,
                'name' => __('manager.dois.title'),
                'value' => $context->getData(Context::SETTING_DOI_PREFIX),
            ]);
        }

        return $ids;
    }
}
