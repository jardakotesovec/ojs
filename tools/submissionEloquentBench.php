<?php

/**
 * @file tools/submissionEloquentBench.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SubmissionEloquentBench
 *
 * @brief Playground benchmark: hydrate every submission through the legacy
 *   per-id Repo::submission()->get() path (the search-loop pattern) and
 *   through the batched Eloquent read model
 *   (\PKP\submission\models\Submission::hydrateMany()), compare query
 *   counts, wall time and deep data parity of the resulting DataObjects —
 *   primary columns, settings, and the publications collection (keys,
 *   order, and per-publication authors/galleys deep coverage shared with
 *   publicationEloquentBench). Also prints a search-page simulation
 *   contrasting the flat query cost of the batched path with the linear
 *   per-result cost of the legacy loop.
 */

use APP\facades\Repo;
use Illuminate\Support\Facades\DB;
use PKP\cliTool\CommandLineTool;
use PKP\submission\models\Submission as SubmissionModel;

require(dirname(__FILE__) . '/bootstrap.php');
require(dirname(__FILE__) . '/publicationBenchNormalizer.inc.php');

class SubmissionEloquentBench extends CommandLineTool
{
    use PublicationBenchNormalization;

    private array $submissionPrimaryProps;
    private array $submissionSettingNames;
    private array $submissionMultilingualNames;

    public function execute(): void
    {
        $this->initPublicationNormalization();
        $this->submissionPrimaryProps = array_keys(Repo::submission()->dao->primaryTableColumns);
        $model = new SubmissionModel();
        $settingNames = $model->getSettings();
        sort($settingNames);
        $this->submissionSettingNames = $settingNames;
        $this->submissionMultilingualNames = $model->getMultilingualProps();

        $submissionIds = DB::table('submissions')
            ->orderBy('submission_id')
            ->pluck('submission_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        echo count($submissionIds) . " submissions\n\n";

        // Legacy path: one Repo::submission()->get() per id, as the search
        // result loop did before adopting hydrateMany()
        DB::enableQueryLog();
        $start = hrtime(true);
        $legacy = [];
        foreach ($submissionIds as $submissionId) {
            $legacy[$submissionId] = $this->normalizeSubmission(Repo::submission()->get($submissionId));
        }
        $legacyMs = (hrtime(true) - $start) / 1e6;
        $legacyQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        // Eloquent path: one batched hydrateMany() over all ids
        $start = hrtime(true);
        $eloquent = [];
        foreach (SubmissionModel::hydrateMany($submissionIds) as $submissionId => $submission) {
            $eloquent[$submissionId] = $this->normalizeSubmission($submission);
        }
        $eloquentMs = (hrtime(true) - $start) / 1e6;
        $eloquentQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        $count = max(count($submissionIds), 1);
        $parity = $legacy === $eloquent;

        printf("%-22s %10s %10s\n", '', 'legacy', 'eloquent');
        printf("%-22s %10d %10d\n", 'queries', $legacyQueries, $eloquentQueries);
        printf("%-22s %9.1fms %9.1fms\n", 'wall', $legacyMs, $eloquentMs);
        printf("%-22s %10.1f %10.1f\n", 'queries/submission', $legacyQueries / $count, $eloquentQueries / $count);
        echo 'parity: ' . ($parity ? 'IDENTICAL' : 'MISMATCH') . "\n\n";

        $this->searchPageSimulation();

        if (!$parity) {
            $shown = 0;
            foreach ($legacy as $submissionId => $data) {
                if (($eloquent[$submissionId] ?? null) !== $data && $shown++ < 3) {
                    echo "submission {$submissionId}:\n  legacy:   " . json_encode($data)
                        . "\n  eloquent: " . json_encode($eloquent[$submissionId] ?? null) . "\n";
                }
            }
            exit(1);
        }
    }

    /**
     * Simulate the SubmissionSearchResult::newCollection() hot loop over the
     * published submissions: hydrate each result and touch its current
     * publication's status/section, exactly what the generator needs before
     * yielding. Context and section lookups are cached identically on both
     * paths, so the contrast isolates hydration cost: linear per-result
     * queries (legacy) vs a flat batched cost (eloquent).
     */
    protected function searchPageSimulation(): void
    {
        $resultIds = DB::table('submissions')
            ->where('status', \PKP\submission\PKPSubmission::STATUS_PUBLISHED)
            ->orderBy('submission_id')
            ->pluck('submission_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $count = max(count($resultIds), 1);

        DB::flushQueryLog();
        $legacyYields = $this->simulateSearchLoop($resultIds, function (array $ids) {
            foreach ($ids as $id) {
                if ($submission = Repo::submission()->get($id)) {
                    yield $submission;
                }
            }
        });
        $legacyQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        $eloquentYields = $this->simulateSearchLoop($resultIds, function (array $ids) {
            yield from SubmissionModel::hydrateMany($ids);
        });
        $eloquentQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        printf(
            "search-page simulation: %d results\n%-22s %10d %10.1f per result\n%-22s %10d %10.1f per result\n",
            count($resultIds),
            'legacy queries',
            $legacyQueries,
            $legacyQueries / $count,
            'eloquent queries',
            $eloquentQueries,
            $eloquentQueries / $count
        );
        if ($legacyYields !== $eloquentYields) {
            echo "search simulation yields: MISMATCH\n  legacy:   " . json_encode($legacyYields)
                . "\n  eloquent: " . json_encode($eloquentYields) . "\n";
            exit(1);
        }
        echo "search simulation yields: IDENTICAL\n";
    }

    /**
     * Run the newCollection()-shaped loop over hydrated submissions produced
     * by $hydrator and record what the generator yields per result
     */
    protected function simulateSearchLoop(array $resultIds, callable $hydrator): array
    {
        $yields = [];
        foreach ($hydrator($resultIds) as $submission) {
            $currentPublication = $submission->getCurrentPublication();
            if ($currentPublication->getData('status') != \PKP\publication\PKPPublication::STATUS_PUBLISHED) {
                continue;
            }
            $yields[] = [
                'submissionId' => $submission->getId(),
                'currentPublicationId' => $currentPublication->getId(),
                'contextId' => $submission->getData('contextId'),
                'sectionId' => $currentPublication->getData('sectionId'),
            ];
        }
        return $yields;
    }

    /**
     * Reduce a Submission DataObject (from either path) to a comparable
     * array: primary columns, settings, and the publications collection with
     * its keys and order plus the shared per-publication deep normalization
     */
    protected function normalizeSubmission(\APP\submission\Submission $submission): array
    {
        $data = [];
        foreach ($this->submissionPrimaryProps as $prop) {
            $data[$prop] = $submission->getData($prop);
        }
        foreach ($this->submissionSettingNames as $name) {
            $value = $submission->getData($name);
            $data['setting:' . $name] = in_array($name, $this->submissionMultilingualNames)
                ? $this->sorted($value)
                : $value;
        }

        $publications = [];
        foreach ($submission->getData('publications') as $publicationId => $publication) {
            $publications[] = [$publicationId, $this->normalizePublication($publication)];
        }
        $data['publications'] = $publications;

        return $data;
    }
}

$tool = new SubmissionEloquentBench($argv ?? []);
$tool->execute();
