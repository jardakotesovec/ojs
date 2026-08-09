<?php

/**
 * @file tools/publicationBenchNormalizer.inc.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @brief Shared deep normalization of Publication DataObjects (with their
 *   authors and galleys) for the Eloquent parity benches. Extracted from
 *   publicationEloquentBench so submissionEloquentBench compares the same
 *   coverage instead of duplicating it. Call initPublicationNormalization()
 *   once before normalizing.
 */

trait PublicationBenchNormalization
{
    private array $publicationPrimaryProps;
    private array $publicationSettingNames;
    private array $publicationMultilingualNames;

    protected function initPublicationNormalization(): void
    {
        $this->publicationPrimaryProps = array_keys(\APP\facades\Repo::publication()->dao->primaryTableColumns);
        $model = new \APP\publication\models\Publication();
        $settingNames = $model->getSettings();
        sort($settingNames);
        $this->publicationSettingNames = $settingNames;
        $this->publicationMultilingualNames = $model->getMultilingualProps();
    }

    /**
     * Reduce a Publication DataObject (from either path) to a comparable array
     */
    protected function normalizePublication(\APP\publication\Publication $publication): array
    {
        $data = [];
        foreach ($this->publicationPrimaryProps as $prop) {
            $data[$prop] = $publication->getData($prop);
        }
        foreach ($this->publicationSettingNames as $name) {
            $value = $publication->getData($name);
            $data['setting:' . $name] = in_array($name, $this->publicationMultilingualNames)
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

        $data['dataCitations'] = array_map(
            fn ($dataCitation) => [
                'id' => $dataCitation->getKey(),
                'publicationId' => $dataCitation->publicationId,
                'seq' => $dataCitation->seq,
                'title' => $dataCitation->title,
                'identifierType' => $dataCitation->identifierType,
                'identifier' => $dataCitation->identifier,
                'relationshipType' => $dataCitation->relationshipType,
                'repository' => $dataCitation->repository,
                'year' => $dataCitation->year,
                'authors' => $dataCitation->authors,
                'url' => $dataCitation->url,
            ],
            $publication->getData('dataCitations') ?? []
        );
        $data['funders'] = array_map(
            fn ($funder) => [
                'id' => $funder->getKey(),
                'submissionId' => $funder->submissionId,
                'ror' => $funder->ror,
                'seq' => $funder->seq,
                'name' => $this->sorted($funder->name),
                'grants' => $funder->grants,
            ],
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
