<?php

/**
 * @file tools/publicationEloquentBench.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class PublicationEloquentBench
 *
 * @brief Playground benchmark: hydrate the full publications of every
 *   submission through the legacy per-submission collector path (as
 *   submission DAO::fromRow does) and through the parallel Eloquent read
 *   model with relationship autoloading (as now wired in the app-level
 *   submission DAO), compare query counts, wall time and data parity of
 *   the resulting DataObjects.
 */

use APP\facades\Repo;
use APP\publication\models\Publication as PublicationModel;
use Illuminate\Support\Facades\DB;
use PKP\cliTool\CommandLineTool;

require(dirname(__FILE__) . '/bootstrap.php');
require(dirname(__FILE__) . '/publicationBenchNormalizer.inc.php');

class PublicationEloquentBench extends CommandLineTool
{
    use PublicationBenchNormalization;

    public function execute(): void
    {
        $this->initPublicationNormalization();

        $submissionRows = DB::table('submissions')
            ->orderBy('submission_id')
            ->get(['submission_id', 'locale', 'context_id']);
        $locales = $submissionRows->pluck('locale', 'submission_id')->all();
        // The eloquent path passes the submission's context id to the bridge,
        // exactly as \APP\submission\DAO::fromRow() does
        $contextIds = $submissionRows->pluck('context_id', 'submission_id')
            ->map(fn ($contextId) => (int) $contextId)
            ->all();
        $submissionIds = array_keys($locales);
        echo count($submissionIds) . " submissions\n\n";

        // Legacy path: one collector per submission, as submission DAO::fromRow did
        DB::enableQueryLog();
        $start = hrtime(true);
        $legacy = [];
        $legacyCount = 0;
        foreach ($submissionIds as $submissionId) {
            $legacy[$submissionId] = $this->legacyPublications($submissionId);
            $legacyCount += count($legacy[$submissionId]);
        }
        $legacyMs = (hrtime(true) - $start) / 1e6;
        $legacyQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        // Eloquent path: read model plus relationship autoloading, as wired
        $start = hrtime(true);
        $eloquent = [];
        $eloquentCount = 0;
        foreach ($submissionIds as $submissionId) {
            $eloquent[$submissionId] = $this->eloquentPublications($submissionId, $locales[$submissionId], $contextIds[$submissionId]);
            $eloquentCount += count($eloquent[$submissionId]);
        }
        $eloquentMs = (hrtime(true) - $start) / 1e6;
        $eloquentQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        // Landing-page proxy: query counts for a single submission
        $proxyId = 1;
        $this->legacyPublications($proxyId);
        $legacyProxyQueries = count(DB::getQueryLog());
        DB::flushQueryLog();
        $this->eloquentPublications($proxyId, $locales[$proxyId] ?? null, $contextIds[$proxyId] ?? null);
        $eloquentProxyQueries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $parity = $legacy === $eloquent;

        printf("%-22s %10s %10s\n", '', 'legacy', 'eloquent');
        printf("%-22s %10d %10d\n", 'queries', $legacyQueries, $eloquentQueries);
        printf("%-22s %9.1fms %9.1fms\n", 'wall', $legacyMs, $eloquentMs);
        printf("%-22s %10d %10d\n", 'publications', $legacyCount, $eloquentCount);
        printf("%-22s %10d %10d\n", "queries (submission {$proxyId})", $legacyProxyQueries, $eloquentProxyQueries);
        echo 'parity: ' . ($parity ? 'IDENTICAL' : 'MISMATCH') . "\n";

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
     * Hydrate and normalize a submission's publications the legacy way,
     * preserving the collection keys and ordering
     */
    protected function legacyPublications(int $submissionId): array
    {
        $normalized = [];
        $publications = Repo::publication()->getCollector()
            ->filterBySubmissionIds([$submissionId])
            ->orderByVersion()
            ->getMany();
        foreach ($publications as $publicationId => $publication) {
            $normalized[] = [$publicationId, $this->normalizePublication($publication)];
        }
        return $normalized;
    }

    /**
     * Hydrate and normalize a submission's publications through the read
     * model and bridge, exactly as wired in \APP\submission\DAO::fromRow()
     */
    protected function eloquentPublications(int $submissionId, ?string $submissionLocale, ?int $submissionContextId): array
    {
        $normalized = [];
        $models = PublicationModel::withSubmissionIds([$submissionId])
            ->orderByVersion()
            ->get()
            ->withRelationshipAutoloading();
        foreach ($models as $model) {
            $normalized[] = [$model->publicationId, $this->normalizePublication($model->toDataObject($submissionLocale, $submissionContextId))];
        }
        return $normalized;
    }
}

$tool = new PublicationEloquentBench($argv ?? []);
$tool->execute();
