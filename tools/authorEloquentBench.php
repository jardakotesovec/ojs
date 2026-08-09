<?php

/**
 * @file tools/authorEloquentBench.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class AuthorEloquentBench
 *
 * @brief Playground benchmark: hydrate every contributor through the legacy
 *   per-publication collector path (as publication DAO::fromRow does) and
 *   through the parallel Eloquent read model with batched side-fetches,
 *   compare query counts, wall time and data parity of the resulting
 *   DataObjects.
 */

use APP\facades\Repo;
use Illuminate\Support\Facades\DB;
use PKP\author\contributorRole\ContributorRole;
use PKP\author\creditContributorRole\CreditContributorRole;
use PKP\author\models\Author as AuthorModel;
use PKP\cliTool\CommandLineTool;
use PKP\ror\models\Ror as RorModel;

require(dirname(__FILE__) . '/bootstrap.php');

class AuthorEloquentBench extends CommandLineTool
{
    public function execute(): void
    {
        $publicationIds = DB::table('authors')
            ->distinct()
            ->pluck('publication_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        echo count($publicationIds) . " publications with contributors\n\n";

        // Legacy path: one collector per publication, per-author fan-out
        DB::enableQueryLog();
        $start = hrtime(true);
        $legacy = [];
        foreach ($publicationIds as $publicationId) {
            $authors = Repo::author()->getCollector()
                ->filterByPublicationIds([$publicationId])
                ->getMany();
            foreach ($authors as $author) {
                $legacy[$author->getId()] = $this->normalize($author);
            }
        }
        $legacyMs = (hrtime(true) - $start) / 1e6;
        $legacyQueries = count(DB::getQueryLog());
        DB::flushQueryLog();

        // Eloquent path: batched fetches for the same set
        $start = hrtime(true);
        $models = AuthorModel::withPublicationIds($publicationIds)
            ->orderBySequence()
            ->with('affiliations')
            ->get();
        $authorIds = $models->pluck('authorId')->all();

        $rors = $models->flatMap(fn ($model) => $model->affiliations->pluck('ror'))
            ->filter()->unique()->values()->all();
        $rorObjects = $rors
            ? RorModel::withRors($rors)->get()
                ->mapWithKeys(fn ($ror) => [$ror->ror => $ror->toDataObject()])
                ->all()
            : [];

        $submissionLocales = DB::table('publications as p')
            ->join('submissions as s', 'p.submission_id', '=', 's.submission_id')
            ->whereIn('p.publication_id', $publicationIds)
            ->pluck('s.locale', 'p.publication_id');

        $creditRoles = CreditContributorRole::query()
            ->whereIn('contributor_id', $authorIds)
            ->withCreditRoles()
            ->select(['contributor_id', 'credit_role_identifier as role', 'credit_degree as degree'])
            ->orderBy('credit_contributor_roles.credit_role_id')
            ->get()
            ->groupBy('contributorId');

        $contributorRoleLinks = CreditContributorRole::query()
            ->whereIn('contributor_id', $authorIds)
            ->whereNotNull('contributor_role_id')
            ->get(['contributor_id', 'contributor_role_id']);
        $contributorRolesById = ContributorRole::query()
            ->whereIn('contributor_role_id', $contributorRoleLinks->pluck('contributorRoleId')->unique()->all())
            ->get()
            ->keyBy('contributorRoleId');

        $eloquent = [];
        foreach ($models as $model) {
            $authorContributorRoles = $contributorRoleLinks
                ->where('contributorId', $model->authorId)
                ->pluck('contributorRoleId')
                ->sort()
                ->map(fn ($roleId) => $contributorRolesById[$roleId])
                ->values()
                ->all();
            $dataObject = $model->toDataObject(
                $submissionLocales[$model->publicationId] ?? null,
                $creditRoles->get($model->authorId)?->map(fn ($r) => ['role' => $r->role, 'degree' => $r->degree])->all() ?? [],
                $authorContributorRoles,
                $rorObjects
            );
            $eloquent[$model->authorId] = $this->normalize($dataObject);
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
        printf("%-10s %10d %10d\n", 'authors', count($legacy), count($eloquent));
        echo 'parity: ' . ($parity ? 'IDENTICAL' : 'MISMATCH') . "\n";

        if (!$parity) {
            $shown = 0;
            foreach ($legacy as $id => $data) {
                if (($eloquent[$id] ?? null) !== $data && $shown++ < 5) {
                    echo "author {$id}:\n  legacy:   " . json_encode($data)
                        . "\n  eloquent: " . json_encode($eloquent[$id] ?? null) . "\n";
                }
            }
            exit(1);
        }
    }

    /**
     * Reduce an Author DataObject (from either path) to a comparable array
     */
    protected function normalize(\PKP\author\Author $author): array
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

    protected function sorted(?array $value): ?array
    {
        if ($value === null || $value === []) {
            return null;
        }
        ksort($value);
        return $value;
    }
}

$tool = new AuthorEloquentBench($argv ?? []);
$tool->execute();
