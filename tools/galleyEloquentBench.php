<?php

/**
 * @file tools/galleyEloquentBench.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class GalleyEloquentBench
 *
 * @brief Playground benchmark: hydrate every galley in the database through
 *   the legacy per-publication collector path (as publication DAO::fromRow
 *   does) and through the parallel Eloquent read model, compare query
 *   counts, wall time and data parity.
 */

use APP\facades\Repo;
use Illuminate\Support\Facades\DB;
use PKP\cliTool\CommandLineTool;
use PKP\galley\models\Galley as GalleyModel;

require(dirname(__FILE__) . '/bootstrap.php');

class GalleyEloquentBench extends CommandLineTool
{
    public function execute(): void
    {
        $publicationIds = DB::table('publication_galleys')
            ->distinct()
            ->pluck('publication_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        echo count($publicationIds) . " publications with galleys\n\n";

        // Legacy path: one collector per publication, as publication DAO::fromRow does
        DB::enableQueryLog();
        $start = hrtime(true);
        $legacy = [];
        foreach ($publicationIds as $publicationId) {
            $galleys = Repo::galley()->getCollector()
                ->filterByPublicationIds([$publicationId])
                ->getMany();
            foreach ($galleys as $galley) {
                $legacy[$galley->getId()] = $this->normalizeLegacy($galley);
            }
        }
        $legacyMs = (hrtime(true) - $start) / 1e6;
        $legacyQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        // Eloquent path: one batched fetch for the same set
        $start = hrtime(true);
        $eloquent = [];
        foreach (GalleyModel::withPublicationIds($publicationIds)->get() as $galley) {
            $eloquent[$galley->id] = $this->normalizeEloquent($galley);
        }
        $eloquentMs = (hrtime(true) - $start) / 1e6;
        $eloquentQueries = count(DB::getQueryLog());
        DB::disableQueryLog();

        ksort($legacy);
        ksort($eloquent);
        $parity = $legacy === $eloquent;

        printf("%-10s %10s %10s\n", '', 'legacy', 'eloquent');
        printf("%-10s %10d %10d\n", 'queries', $legacyQueries, $eloquentQueries);
        printf("%-10s %9.1fms %9.1fms\n", 'wall', $legacyMs, $eloquentMs);
        printf("%-10s %10d %10d\n", 'galleys', count($legacy), count($eloquent));
        echo 'parity: ' . ($parity ? 'IDENTICAL' : 'MISMATCH') . "\n";

        if (!$parity) {
            foreach ($legacy as $id => $data) {
                if (($eloquent[$id] ?? null) !== $data) {
                    echo "galley {$id}:\n  legacy:   " . json_encode($data)
                        . "\n  eloquent: " . json_encode($eloquent[$id] ?? null) . "\n";
                }
            }
            exit(1);
        }
    }

    protected function normalizeLegacy(\PKP\galley\Galley $galley): array
    {
        return [
            'publicationId' => (int) $galley->getData('publicationId'),
            'locale' => $galley->getData('locale'),
            'label' => $galley->getData('label'),
            'submissionFileId' => $galley->getData('submissionFileId') === null ? null : (int) $galley->getData('submissionFileId'),
            'seq' => (float) $galley->getData('seq'),
            'urlRemote' => $galley->getData('urlRemote'),
            'isApproved' => (bool) $galley->getData('isApproved'),
            'urlPath' => $galley->getData('urlPath'),
            'publisherId' => $galley->getData('pub-id::publisher-id'),
        ];
    }

    protected function normalizeEloquent(GalleyModel $galley): array
    {
        $attributes = $galley->getAttributes();
        return [
            'publicationId' => $galley->publicationId,
            'locale' => $galley->locale,
            'label' => $galley->label,
            'submissionFileId' => $galley->submissionFileId,
            'seq' => $galley->seq,
            'urlRemote' => $galley->remoteUrl,
            'isApproved' => $galley->isApproved,
            'urlPath' => $galley->urlPath,
            'publisherId' => $attributes['pub-id::publisher-id'] ?? $attributes['pubId::publisherId'] ?? null,
        ];
    }
}

$tool = new GalleyEloquentBench($argv ?? []);
$tool->execute();
