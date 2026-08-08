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

class PublicationEloquentBench extends CommandLineTool
{
    private array $primaryProps;
    private array $settingNames;
    private array $multilingualNames;

    public function execute(): void
    {
        $this->primaryProps = array_keys(Repo::publication()->dao->primaryTableColumns);
        $model = new PublicationModel();
        $settingNames = $model->getSettings();
        sort($settingNames);
        $this->settingNames = $settingNames;
        $this->multilingualNames = $model->getMultilingualProps();

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
            $normalized[] = [$publicationId, $this->normalize($publication)];
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
            $normalized[] = [$model->publicationId, $this->normalize($model->toDataObject($submissionLocale, $submissionContextId))];
        }
        return $normalized;
    }

    /**
     * Reduce a Publication DataObject (from either path) to a comparable array
     */
    protected function normalize(\APP\publication\Publication $publication): array
    {
        $data = [];
        foreach ($this->primaryProps as $prop) {
            $data[$prop] = $publication->getData($prop);
        }
        foreach ($this->settingNames as $name) {
            $value = $publication->getData($name);
            $data['setting:' . $name] = in_array($name, $this->multilingualNames)
                ? $this->sorted($value)
                : $value;
        }

        $data['locale'] = $publication->getData('locale');
        $data['versionString'] = $publication->getData('versionString');
        $data['categoryIds'] = $publication->getData('categoryIds');
        $data['doiObjectId'] = $publication->getData('doiObject')?->getId();

        $citations = $publication->getData('citations');
        $data['citationsCount'] = $citations->count();
        $data['firstCitationRaw'] = $citations->first()?->getRawCitation();

        $data['dataCitationIds'] = array_map(
            fn ($dataCitation) => $dataCitation->getKey(),
            $publication->getData('dataCitations') ?? []
        );
        $data['funderIds'] = array_map(
            fn ($funder) => $funder->getKey(),
            $publication->getData('funders') ?? []
        );

        $authors = [];
        foreach ($publication->getData('authors') as $authorId => $author) {
            $authors[] = [$authorId, $this->normalizeAuthor($author)];
        }
        $data['authors'] = $authors;

        $galleys = [];
        foreach ($publication->getData('galleys') as $key => $galley) {
            $galleys[] = [$key, $this->normalizeGalley($galley)];
        }
        $data['galleys'] = $galleys;

        return $data;
    }

    /**
     * Reduce an Author DataObject to a comparable array (same coverage as
     * the author bench, with relation-derived roles in the eloquent path)
     */
    protected function normalizeAuthor(\PKP\author\Author $author): array
    {
        return [
            'publicationId' => $author->getData('publicationId'),
            'email' => $author->getData('email'),
            'includeInBrowse' => $author->getData('includeInBrowse'),
            'seq' => $author->getData('seq'),
            'contributorType' => $author->getData('contributorType'),
            'submissionLocale' => $author->getData('submissionLocale'),
            'givenName' => $this->sorted($author->getData('givenName')),
            'familyName' => $this->sorted($author->getData('familyName')),
            'preferredPublicName' => $this->sorted($author->getData('preferredPublicName')),
            'biography' => $this->sorted($author->getData('biography')),
            'competingInterests' => $this->sorted($author->getData('competingInterests')),
            'organizationName' => $this->sorted($author->getData('organizationName')),
            'country' => $author->getData('country'),
            'orcid' => $author->getData('orcid'),
            'url' => $author->getData('url'),
            'affiliations' => array_map(fn ($affiliation) => [
                'id' => $affiliation->getId(),
                'ror' => $affiliation->getRor(),
                'name' => $this->sorted($affiliation->getData('name')),
                'rorObject' => ($rorObject = $affiliation->getData('rorObject')) ? [
                    'id' => $rorObject->getId(),
                    'ror' => $rorObject->getData('ror'),
                    'displayLocale' => $rorObject->getData('displayLocale'),
                    'isActive' => $rorObject->getData('isActive'),
                    'searchPhrase' => $rorObject->getData('searchPhrase'),
                    'name' => $this->sorted($rorObject->getData('name')),
                ] : null,
            ], array_values($author->getAffiliations())),
            'creditRoles' => $author->getCreditRoles(),
            'contributorRoles' => array_map(
                fn ($role) => $role->contributorRoleId,
                array_values($author->getContributorRoles())
            ),
        ];
    }

    /**
     * Reduce a Galley DataObject to a comparable array (same coverage as
     * the galley bench, plus the DOI attach)
     */
    protected function normalizeGalley(\PKP\galley\Galley $galley): array
    {
        return [
            'id' => $galley->getId(),
            'publicationId' => $galley->getData('publicationId'),
            'locale' => $galley->getData('locale'),
            'label' => $galley->getData('label'),
            'submissionFileId' => $galley->getData('submissionFileId'),
            'seq' => $galley->getData('seq'),
            'urlRemote' => $galley->getData('urlRemote'),
            'isApproved' => $galley->getData('isApproved'),
            'urlPath' => $galley->getData('urlPath'),
            'publisherId' => $galley->getData('pub-id::publisher-id'),
            'doiId' => $galley->getData('doiId'),
            'doiObjectId' => $galley->getData('doiObject')?->getId(),
        ];
    }

    protected function sorted(?array $value): ?array
    {
        if ($value === null || $value === []) {
            return null;
        }
        ksort($value);
        return $value;
    }
}

$tool = new PublicationEloquentBench($argv ?? []);
$tool->execute();
