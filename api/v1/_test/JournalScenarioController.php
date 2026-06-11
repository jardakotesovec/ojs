<?php

/**
 * @file api/v1/_test/JournalScenarioController.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class JournalScenarioController
 *
 * @ingroup api_v1_test
 *
 * @brief OJS subclass of PKPContextScenarioController. Registers
 *        POST /api/v1/_test/scenarios/journal which invokes the shared
 *        context-build pipeline plus OJS-specific extensions.
 *
 * Overrides `context()` to pull OJS-only concepts (issues) into the
 * journal scratch build. Issues are OJS-specific and never reach OMP/OPS,
 * so keeping them off the shared controller avoids polluting the
 * cross-app schema.
 */

namespace APP\API\v1\_test;

use APP\testing\bootstrap\Processor\SubscriptionProcessor;
use Illuminate\Support\Facades\Route;
use PKP\API\v1\_test\PKPContextScenarioController;
use PKP\testing\bootstrap\Processor\IssueProcessor;

class JournalScenarioController extends PKPContextScenarioController
{
    public function getGroupRoutes(): void
    {
        Route::post('journal', $this->context(...))
            ->name('test.scenarios.journal');
    }

    /**
     * OJS-specific post-processing hook fired from the shared
     * PKPContextScenarioController::context() flow. Keeps the shared
     * controller's context() intact while adding OJS-only steps (issues
     * and subscription seeding) inside the same transaction.
     *
     * Note: subscriptions[] never flips the journal's publishingMode —
     * tests that need the subscription gate pass `publishingMode`
     * themselves through the shared context schema.
     *
     * @see PKPContextScenarioController::afterContextCreated()
     */
    protected function afterContextCreated(array $spec, int $contextId): void
    {
        if (!empty($spec['issues']) && is_array($spec['issues'])) {
            (new IssueProcessor())->run($contextId, $spec['issues']);
        }

        if (!empty($spec['subscriptions']) && is_array($spec['subscriptions'])) {
            (new SubscriptionProcessor())->run($contextId, $spec['subscriptions']);
        }
    }

    /**
     * OJS-only additions merged into the shared context.json schema before
     * validation. Inert until PKPContextScenarioController consults
     * schemaOverlayProperties() during validateAgainstSchema() (landing in
     * lib/pkp separately); a plain override is harmless in the meantime.
     *
     * Shape mirrors SubscriptionProcessor's spec contract — see its
     * class-level PHPDoc for semantics.
     */
    protected function schemaOverlayProperties(): array
    {
        return [
            'subscriptions' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'required' => ['type'],
                    'additionalProperties' => false,
                    'properties' => [
                        'type' => [
                            'type' => 'object',
                            'required' => ['name'],
                            'additionalProperties' => false,
                            'properties' => [
                                'name' => ['type' => 'string', 'minLength' => 1],
                                'description' => ['type' => 'string'],
                                'format' => ['type' => 'string', 'enum' => ['online', 'print', 'printOnline']],
                                'duration' => ['type' => ['integer', 'null'], 'minimum' => 1],
                                'cost' => ['type' => 'number', 'minimum' => 0],
                                'currency' => ['type' => 'string', 'minLength' => 3, 'maxLength' => 3],
                                'institutional' => ['type' => 'boolean'],
                            ],
                        ],
                        'user' => ['type' => 'string', 'minLength' => 1],
                        'institution' => [
                            'type' => 'object',
                            'required' => ['name'],
                            'additionalProperties' => false,
                            'properties' => [
                                'name' => ['type' => 'string', 'minLength' => 1],
                                'ipRanges' => [
                                    'type' => 'array',
                                    'minItems' => 1,
                                    'items' => ['type' => 'string', 'minLength' => 1],
                                ],
                            ],
                        ],
                        'status' => ['type' => 'string', 'enum' => ['active', 'expired']],
                        'dateStart' => ['type' => 'string', 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
                        'dateEnd' => ['type' => 'string', 'pattern' => '^\\d{4}-\\d{2}-\\d{2}$'],
                    ],
                ],
            ],
        ];
    }
}
