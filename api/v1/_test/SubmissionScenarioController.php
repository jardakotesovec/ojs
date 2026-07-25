<?php

/**
 * @file api/v1/_test/SubmissionScenarioController.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SubmissionScenarioController
 *
 * @ingroup api_v1_test
 *
 * @brief OJS-specific subclass for the submission scenario endpoint.
 *        Adds OJS-only post-processing (compiled usage-metrics seeding)
 *        on top of the shared submission pipeline.
 */

namespace APP\API\v1\_test;

use APP\testing\bootstrap\Processor\MetricsProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use PKP\API\v1\_test\PKPSubmissionScenarioController;

class SubmissionScenarioController extends PKPSubmissionScenarioController
{
    /**
     * Wrap the shared handler with an OJS-only post-create extension point,
     * mirroring how JournalScenarioController hangs OJS concepts off
     * afterContextCreated(). The parent has no such hook for submissions,
     * so the wrapper lives here (OJS subclass only — the lib/pkp parent
     * stays untouched).
     */
    public function submission(Request $illuminateRequest): JsonResponse
    {
        $response = parent::submission($illuminateRequest);
        if ($response->getStatusCode() !== Response::HTTP_OK) {
            return $response;
        }

        try {
            $payload = $this->afterSubmissionCreated(
                $illuminateRequest->all(),
                $response->getData(true)
            );
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Scenario build failed',
                'message' => $e->getMessage(),
                'class' => get_class($e),
                'file' => $e->getFile() . ':' . $e->getLine(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        $response->setData($payload);
        return $response;
    }

    /**
     * OJS-only post-processing after the shared pipeline succeeded.
     * Receives the validated spec and the response payload (which carries
     * the created submission id); returns the payload, optionally enriched.
     */
    protected function afterSubmissionCreated(array $spec, array $payload): array
    {
        if (!empty($spec['metrics']) && is_array($spec['metrics'])) {
            $submissionId = (int) ($payload['submission']['id'] ?? 0);
            if (!$submissionId) {
                throw new \RuntimeException('metrics: scenario response carried no submission id');
            }
            $payload['metrics'] = (new MetricsProcessor())->run($submissionId, $spec['metrics']);
        }
        return $payload;
    }

    /**
     * OJS-only additions merged into the shared submission.json schema
     * before validation — PKPSubmissionScenarioController consults this
     * hook during validateAgainstSchema(), same as the context-side hook
     * on PKPContextScenarioController.
     *
     * Shape mirrors MetricsProcessor's spec contract — see its class-level
     * PHPDoc for semantics.
     */
    protected function schemaOverlayProperties(): array
    {
        return [
            // `section` is the OJS/OPS submission container (OMP uses
            // `series`), so it is an overlay rather than a shared key.
            // Required here — every OJS submission has a section, and the
            // whole existing OJS fixture corpus passes one — which keeps
            // the pre-multi-app validation behaviour byte-identical.
            'section' => ['type' => 'string', 'minLength' => 1],
            'metrics' => [
                'type' => 'object',
                'additionalProperties' => false,
                'properties' => [
                    'views' => ['type' => 'integer', 'minimum' => 0],
                    'downloads' => ['type' => 'integer', 'minimum' => 0],
                    'months' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 24],
                ],
            ],
        ];
    }

    /**
     * OJS keeps `section` required, exactly as the shared schema did
     * before the key moved out to this overlay.
     */
    protected function schemaRequiredOverlay(): array
    {
        return ['section'];
    }

    /**
     * The OJS publishing container + representation model, overlaid onto
     * the shared `$defs/publication`. `issue` and `galleys` are OJS
     * concepts (OMP publishes into a catalog via publication formats;
     * OPS posts continuously with no container), so they live here and
     * $ref the reusable building blocks the shared schema still carries.
     */
    protected function schemaOverlayDefProperties(): array
    {
        return [
            'publication' => [
                'issue' => ['$ref' => '#/$defs/issue'],
                'galleys' => [
                    'type' => 'array',
                    'items' => ['$ref' => '#/$defs/galley'],
                ],
                'mediaFiles' => [
                    'type' => 'array',
                    'items' => ['$ref' => '#/$defs/mediaFile'],
                ],
            ],
        ];
    }
}
