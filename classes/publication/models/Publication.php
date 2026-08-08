<?php

/**
 * @file classes/publication/models/Publication.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class Publication
 *
 * @brief OJS Eloquent read model for publications. Adds the casts for the
 *   app-level primary table columns (see the app-level publication DAO's
 *   $primaryTableColumns); the settings/multilingual lists are derived from
 *   the schema service by the parent and already include the app schema
 *   additions.
 */

namespace APP\publication\models;

class Publication extends \PKP\publication\models\Publication
{
    protected function casts(): array
    {
        return array_merge(parent::casts(), [
            'access_status' => 'integer',
            'section_id' => 'integer',
            'status' => 'integer',
            'issue_id' => 'integer',
        ]);
    }
}
