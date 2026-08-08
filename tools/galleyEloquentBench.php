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
 *
 *   The legacy path also resolves every galley's submission file through
 *   the deprecated template-time getFile() (two queries per galley), and
 *   the eloquent side runs twice: plain (no relationship autoloading — the
 *   bridged DataObject must leave the $_submissionFile memo null so the
 *   legacy lazy fetch still applies) and with relationship autoloading
 *   (the bridged DataObject's preloaded $_submissionFile must normalize
 *   identically to the legacy getFile() result).
 */

use APP\facades\Repo;
use Illuminate\Support\Facades\DB;
use PKP\cliTool\CommandLineTool;
use PKP\galley\models\Galley as GalleyModel;
use PKP\submissionFile\models\SubmissionFile as SubmissionFileModel;

require(dirname(__FILE__) . '/bootstrap.php');

class GalleyEloquentBench extends CommandLineTool
{
    private array $filePrimaryProps;
    private array $fileSettingNames;
    private array $fileMultilingualNames;

    public function execute(): void
    {
        $this->filePrimaryProps = array_keys(Repo::submissionFile()->dao->primaryTableColumns);
        $fileModel = new SubmissionFileModel();
        $fileSettingNames = $fileModel->getSettings();
        sort($fileSettingNames);
        $this->fileSettingNames = $fileSettingNames;
        $this->fileMultilingualNames = $fileModel->getMultilingualProps();

        $publicationIds = DB::table('publication_galleys')
            ->distinct()
            ->pluck('publication_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        echo count($publicationIds) . " publications with galleys\n\n";

        // Legacy path: one collector per publication, as publication
        // DAO::fromRow does, plus the template-time getFile() per galley
        DB::enableQueryLog();
        $start = hrtime(true);
        $legacy = [];
        $legacyFiles = [];
        foreach ($publicationIds as $publicationId) {
            $galleys = Repo::galley()->getCollector()
                ->filterByPublicationIds([$publicationId])
                ->getMany();
            foreach ($galleys as $galley) {
                $legacy[$galley->getId()] = $this->normalizeLegacy($galley);
                $legacyFiles[$galley->getId()] = $this->normalizeFile($galley->getFile());
            }
        }
        $legacyMs = (hrtime(true) - $start) / 1e6;
        $legacyQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        // Eloquent path, plain: one batched fetch, no relationship
        // autoloading. toDataObject() must succeed and must leave the
        // $_submissionFile memo null (no hidden per-galley file queries).
        $start = hrtime(true);
        $eloquent = [];
        $plainPreloads = [];
        foreach (GalleyModel::withPublicationIds($publicationIds)->get() as $galley) {
            $eloquent[$galley->id] = $this->normalizeEloquent($galley);
            if ($galley->toDataObject()->_submissionFile !== null) {
                $plainPreloads[] = $galley->id;
            }
        }
        $plainMs = (hrtime(true) - $start) / 1e6;
        $plainQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        // Eloquent path, autoloading: the wired mode. The bridged
        // DataObjects must match the legacy normalization and carry a
        // preloaded $_submissionFile matching the legacy getFile() result.
        $start = hrtime(true);
        $bridged = [];
        $bridgedFiles = [];
        $models = GalleyModel::withPublicationIds($publicationIds)
            ->get()
            ->withRelationshipAutoloading();
        foreach ($models as $model) {
            $dataObject = $model->toDataObject();
            $bridged[$dataObject->getId()] = $this->normalizeLegacy($dataObject);
            $bridgedFiles[$dataObject->getId()] = $this->normalizeFile($dataObject->_submissionFile);
        }
        $autoMs = (hrtime(true) - $start) / 1e6;
        $autoQueries = count(DB::getQueryLog());
        DB::disableQueryLog();

        ksort($legacy);
        ksort($eloquent);
        ksort($legacyFiles);
        ksort($bridged);
        ksort($bridgedFiles);
        $galleyParity = $legacy === $eloquent && $legacy === $bridged;
        $fileParity = $legacyFiles === $bridgedFiles;
        $plainMemoNull = $plainPreloads === [];

        printf("%-10s %10s %12s %12s\n", '', 'legacy', 'eloq-plain', 'eloq-auto');
        printf("%-10s %10d %12d %12d\n", 'queries', $legacyQueries, $plainQueries, $autoQueries);
        printf("%-10s %9.1fms %11.1fms %11.1fms\n", 'wall', $legacyMs, $plainMs, $autoMs);
        printf("%-10s %10d %12d %12d\n", 'galleys', count($legacy), count($eloquent), count($bridged));
        echo 'galley parity (plain + autoload): ' . ($galleyParity ? 'IDENTICAL' : 'MISMATCH') . "\n";
        echo 'file parity (autoload preload vs legacy getFile): ' . ($fileParity ? 'IDENTICAL' : 'MISMATCH') . "\n";
        echo 'plain-mode memo left null: ' . ($plainMemoNull ? 'YES' : 'NO: galleys ' . implode(',', $plainPreloads)) . "\n";
        echo 'parity: ' . ($galleyParity && $fileParity && $plainMemoNull ? 'IDENTICAL' : 'MISMATCH') . "\n";

        if (!$galleyParity || !$fileParity || !$plainMemoNull) {
            foreach ($legacy as $id => $data) {
                if (($eloquent[$id] ?? null) !== $data) {
                    echo "galley {$id} (plain):\n  legacy:   " . json_encode($data)
                        . "\n  eloquent: " . json_encode($eloquent[$id] ?? null) . "\n";
                }
                if (($bridged[$id] ?? null) !== $data) {
                    echo "galley {$id} (autoload):\n  legacy:   " . json_encode($data)
                        . "\n  bridged:  " . json_encode($bridged[$id] ?? null) . "\n";
                }
            }
            foreach ($legacyFiles as $id => $data) {
                if (($bridgedFiles[$id] ?? null) !== $data) {
                    echo "galley {$id} file:\n  legacy:   " . json_encode($data)
                        . "\n  bridged:  " . json_encode($bridgedFiles[$id] ?? null) . "\n";
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

    /**
     * Reduce a SubmissionFile DataObject (from either path) to a comparable
     * array: all primary props, the three joined fields and all schema
     * settings, with multilingual locale keys sorted
     */
    protected function normalizeFile(?\PKP\submissionFile\SubmissionFile $file): ?array
    {
        if ($file === null) {
            return null;
        }
        $data = [];
        foreach ($this->filePrimaryProps as $prop) {
            $data[$prop] = $file->getData($prop);
        }
        foreach (['submissionLocale', 'path', 'mimetype'] as $prop) {
            $data[$prop] = $file->getData($prop);
        }
        foreach ($this->fileSettingNames as $name) {
            $value = $file->getData($name);
            if (in_array($name, $this->fileMultilingualNames) && is_array($value)) {
                ksort($value);
            }
            $data['setting:' . $name] = $value;
        }
        return $data;
    }
}

$tool = new GalleyEloquentBench($argv ?? []);
$tool->execute();
