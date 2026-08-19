<?php

/**
 * @file classes/frontend/Frontend.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Frontend
 *
 * @brief OJS frontend surface. See PKP\frontend\Frontend for the charter.
 */

namespace APP\frontend;

use APP\view\composers\PublicationIdsComposer;

class Frontend extends \PKP\frontend\Frontend
{
    /**
     * @copydoc \PKP\frontend\Frontend::composers()
     */
    protected function composers(): array
    {
        $composers = parent::composers();
        $composers['publicationIds'] = [
            'composer' => PublicationIdsComposer::class,
            'views' => '*',
        ];
        return $composers;
    }
}
