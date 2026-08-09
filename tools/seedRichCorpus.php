<?php

/**
 * @file tools/seedRichCorpus.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SeedRichCorpus
 *
 * @brief Playground seeding tool: grow the thin test dataset into a
 *   benchmarking corpus. Every target submission is published into the
 *   already-published issue 1 through the real service path
 *   (Repo::publication()->publish()), topped up to three published
 *   publication versions via Repo::publication()->version(), and every
 *   version is enriched with the full dependent-data package that
 *   seedRichArticle.php seeds for submission 1: publication + galley DOIs,
 *   raw citations, data citations, funders (submission-level),
 *   subjects/disciplines/supporting agencies in en + fr_CA, multilingual
 *   author biographies + competing interests, CRediT roles with degrees, a
 *   ROR-backed affiliation and at least two galleys with their own
 *   submission file rows. Finally a `benchcorpus` marker sentence is
 *   appended to the EN abstract of every target publication (and of
 *   submission 1's publications) so one search token matches the whole
 *   corpus after `php tools/rebuildSearchIndex.php`.
 *
 *   Idempotent: every section guards on the rows it creates, so running the
 *   tool twice produces no duplicates. Data goes through the same app
 *   services the editor UI uses wherever one exists; only galley file rows
 *   are written directly (modelled on seedRichArticle.php), because a real
 *   upload would need a web request.
 *
 * Usage: php tools/seedRichCorpus.php [verify]
 *   verify  skip seeding, only print the hydration probe
 */

use APP\core\Application;
use APP\facades\Repo;
use APP\publication\Publication;
use Illuminate\Support\Facades\DB;
use PKP\cliTool\CommandLineTool;
use PKP\context\Context;
use PKP\controlledVocab\ControlledVocab;
use PKP\dataCitation\DataCitation;
use PKP\funder\Funder;
use PKP\galley\Galley;

require(dirname(__FILE__) . '/bootstrap.php');

// The publish/version service paths resolve the journal through the request
// router; give the CLI request a context path so Application::get()
// ->getRequest()->getContext() resolves journal 1 (`publicknowledge`) as it
// would for the editor UI. Must be set before the router caches the path.
$_SERVER['PATH_INFO'] = '/publicknowledge';

class SeedRichCorpus extends CommandLineTool
{
    private const CONTEXT_ID = 1;
    private const ISSUE_ID = 1;
    /** Submissions grown into the corpus (submission 1 stays as seeded by seedRichArticle.php) */
    private const TARGET_SUBMISSION_IDS = [4, 5, 8, 11, 13, 17];
    /** Submissions whose publications get the search marker (targets + submission 1) */
    private const MARKER_SUBMISSION_IDS = [1, 4, 5, 8, 11, 13, 17];
    private const VERSIONS_PER_SUBMISSION = 3;
    private const DOI_PREFIX = '10.1234';

    /** Distinctive markers used as idempotency guards */
    private const SEARCH_TOKEN = 'benchcorpus';
    private const SEARCH_MARKER = '<p>This article belongs to the benchcorpus benchmarking corpus.</p>';
    private const PRIMARY_GALLEY_LABEL = 'PDF';
    private const SUPP_GALLEY_LABEL = 'Supplementary Data (PDF)';
    private const SUPP_GENRE_ID = 7; // DATASET genre of journal 1
    private const FUNDER_ROR = 'https://ror.org/021nxhr62'; // National Science Foundation
    private const FUNDER_NAME_EN = 'Public Knowledge Project Development Fund';
    private const AFFILIATION_ROR = 'https://ror.org/04ttjf776'; // RMIT University

    /** Template for fresh galley file rows (submission 1's primary galley) */
    private ?object $galleyFileTemplateRow = null;

    public function execute(): void
    {
        $verifyOnly = in_array('verify', $this->argv);

        if (!$verifyOnly) {
            $this->enableDoiSettings();
            foreach (self::TARGET_SUBMISSION_IDS as $submissionId) {
                echo "== submission {$submissionId}\n";
                foreach ($this->publications($submissionId) as $publication) {
                    $this->publishPublication($submissionId, $publication);
                }
                $this->topUpVersions($submissionId);
                $this->seedFunders($submissionId);
                foreach ($this->publications($submissionId) as $publication) {
                    echo "-- publication {$publication->getId()} (version {$publication->getData('versionString')})\n";
                    $this->seedGalleys($publication);
                    $this->seedDois($publication);
                    $this->seedCitations($publication);
                    $this->seedDataCitations($publication);
                    $this->seedVocabulary($publication);
                    $this->seedAuthorRichness($publication);
                }
            }
            $this->seedSearchMarkers();
            echo "\nDone. Rebuild the search index next: php tools/rebuildSearchIndex.php\n\n";
        }

        $this->verify();
    }

    /**
     * All publications of a submission, in version order, re-fetched fresh
     * from the repository
     *
     * @return Publication[]
     */
    private function publications(int $submissionId): array
    {
        return Repo::publication()->getCollector()
            ->filterBySubmissionIds([$submissionId])
            ->orderByVersion()
            ->getMany()
            ->values()
            ->toArray();
    }

    /**
     * Fresh copy of one publication (relations like galleys re-resolved)
     */
    private function refetch(Publication $publication): Publication
    {
        $fresh = Repo::publication()->get($publication->getId());
        if (!$fresh) {
            throw new RuntimeException("Publication {$publication->getId()} disappeared");
        }
        return $fresh;
    }

    /**
     * Enable publication + galley DOIs for the journal (idempotent re-run of
     * what seedRichArticle.php already enables), so createDois() can mint.
     */
    private function enableDoiSettings(): void
    {
        $contextDao = Application::getContextDAO();
        $context = $contextDao->getById(self::CONTEXT_ID);

        $types = (array) $context->getData(Context::SETTING_ENABLED_DOI_TYPES);
        $wanted = array_values(array_unique(array_merge($types, [
            Repo::doi()::TYPE_PUBLICATION,
            Repo::doi()::TYPE_REPRESENTATION,
        ])));

        $dirty = false;
        if ($wanted != $types) {
            $context->setData(Context::SETTING_ENABLED_DOI_TYPES, $wanted);
            $dirty = true;
        }
        if (!$context->getData('enableDois')) {
            $context->setData('enableDois', true);
            $dirty = true;
        }
        if (empty($context->getData(Context::SETTING_DOI_PREFIX))) {
            $context->setData(Context::SETTING_DOI_PREFIX, self::DOI_PREFIX);
            $dirty = true;
        }

        if ($dirty) {
            $contextDao->updateObject($context);
            echo 'doi settings: enabled publication+representation DOIs, prefix ' . self::DOI_PREFIX . "\n";
        } else {
            echo "doi settings: already enabled\n";
        }
    }

    /**
     * Publish one publication into issue 1 through the same service path the
     * editor's Publish button uses: assign the issue, run validatePublish()
     * and fail loudly on errors, then publish() and reconcile the
     * submission's status/current publication exactly as the API endpoint
     * does (PKPSubmissionController::publishPublication()).
     */
    private function publishPublication(int $submissionId, Publication $publication): void
    {
        if ((int) $publication->getData('issueId') !== self::ISSUE_ID) {
            $params = ['issueId' => self::ISSUE_ID];
            if (empty($publication->getData('sectionId'))) {
                $params['sectionId'] = Repo::publication()->get(1)->getData('sectionId');
            }
            $publication = Repo::publication()->edit($publication, $params);
            echo "publication {$publication->getId()}: assigned to issue " . self::ISSUE_ID . "\n";
        }

        if ((int) $publication->getData('status') === Publication::STATUS_PUBLISHED) {
            echo "publication {$publication->getId()}: already published\n";
            return;
        }

        $submission = Repo::submission()->get($submissionId);
        $context = Application::getContextDAO()->getById(self::CONTEXT_ID);
        $errors = Repo::publication()->validatePublish(
            $publication,
            $submission,
            (array) $context->getData('supportedSubmissionLocales'),
            $submission->getData('locale')
        );
        if (!empty($errors)) {
            throw new RuntimeException(
                "publication {$publication->getId()} failed publish validation: " . json_encode($errors)
            );
        }

        Repo::publication()->publish($publication, false);

        $submission = Repo::submission()->get($submissionId);
        Repo::submission()->updateStatus($submission);
        Repo::submission()->updateCurrentPublication($submission);

        $publication = $this->refetch($publication);
        echo "publication {$publication->getId()}: published"
            . " (status {$publication->getData('status')}, version {$publication->getData('versionString')})\n";
    }

    /**
     * Create publication versions with the real versioning service until the
     * submission has the target number, publishing each new version. The
     * service copies authors, galleys, citations and data citations from the
     * source version; enrichment still runs per version afterwards.
     */
    private function topUpVersions(int $submissionId): void
    {
        $existing = count($this->publications($submissionId));
        if ($existing >= self::VERSIONS_PER_SUBMISSION) {
            echo "versions: already {$existing} present\n";
            return;
        }

        for ($i = $existing; $i < self::VERSIONS_PER_SUBMISSION; $i++) {
            $publications = $this->publications($submissionId);
            $latest = end($publications);
            $newId = Repo::publication()->version($latest); // minor version, same stage
            $newPublication = Repo::publication()->get($newId);
            echo "versions: created publication {$newId} (version {$newPublication->getData('versionString')})\n";
            $this->publishPublication($submissionId, $newPublication);
        }
    }

    /**
     * Ensure the publication carries at least a primary and a supplementary
     * galley, each with its own submission_files/files rows. Galleys go
     * through Repo::galley(); only the file rows are written directly,
     * modelled on seedRichArticle.php's supplementary galley (a real upload
     * would need a web request). Galleys cloned by version() share the
     * source version's submission file, so they get their own rows too.
     */
    private function seedGalleys(Publication $publication): void
    {
        $submissionId = (int) $publication->getData('submissionId');

        if ($publication->getData('galleys')->count() === 0) {
            $galleyId = $this->addGalley($publication->getId(), self::PRIMARY_GALLEY_LABEL, 0);
            echo "primary galley: created galley {$galleyId}\n";
            $publication = $this->refetch($publication);
        }

        $hasSupplementary = false;
        foreach ($publication->getData('galleys') as $galley) {
            if ($galley->getData('label') === self::SUPP_GALLEY_LABEL) {
                $hasSupplementary = true;
            }
        }
        if ($hasSupplementary) {
            echo "supplementary galley: already present\n";
        } else {
            $galleyId = $this->addGalley($publication->getId(), self::SUPP_GALLEY_LABEL, 1);
            echo "supplementary galley: created galley {$galleyId}\n";
            $publication = $this->refetch($publication);
        }

        foreach ($publication->getData('galleys') as $galley) {
            $this->ensureOwnGalleyFile($submissionId, $galley);
        }
    }

    /**
     * Add a bare galley through the galley service
     */
    private function addGalley(int $publicationId, string $label, int $seq): int
    {
        $galley = Repo::galley()->newDataObject();
        $galley->setAllData([
            'publicationId' => $publicationId,
            'label' => $label,
            'locale' => 'en',
            'seq' => $seq,
            'isApproved' => false,
        ]);
        return Repo::galley()->add($galley);
    }

    /**
     * Give a galley its own submission_files + files + revisions + settings
     * rows. A galley "owns" its file when the submission file's assoc points
     * back at it; fresh galleys have no file yet and galleys cloned by
     * version() point at the source galley's file. Duplicate files rows
     * pointing at the same physical path are fine in the playground.
     */
    private function ensureOwnGalleyFile(int $submissionId, Galley $galley): void
    {
        $source = null;
        $currentFileId = $galley->getData('submissionFileId');
        if ($currentFileId) {
            $current = DB::table('submission_files as sf')
                ->join('files as f', 'f.file_id', '=', 'sf.file_id')
                ->where('sf.submission_file_id', $currentFileId)
                ->first(['sf.assoc_type', 'sf.assoc_id', 'sf.submission_id', 'sf.genre_id', 'sf.file_stage', 'sf.uploader_user_id', 'f.path', 'f.mimetype']);
            if ($current
                && (int) $current->assoc_type === Application::ASSOC_TYPE_REPRESENTATION
                && (int) $current->assoc_id === $galley->getId()
                && (int) $current->submission_id === $submissionId
            ) {
                echo "galley {$galley->getId()}: own file rows already present (submission file {$currentFileId})\n";
                return;
            }
            // Cloned galley: reuse the shared file's physical path/metadata
            $source = $current;
        }
        $source ??= $this->galleyFileTemplate();

        $isSupplementary = $galley->getData('label') === self::SUPP_GALLEY_LABEL;

        $fileId = DB::table('files')->insertGetId([
            'path' => $source->path,
            'mimetype' => $source->mimetype,
        ], 'file_id');

        $now = date('Y-m-d H:i:s');
        $submissionFileId = DB::table('submission_files')->insertGetId([
            'submission_id' => $submissionId,
            'file_id' => $fileId,
            'genre_id' => $isSupplementary ? self::SUPP_GENRE_ID : $source->genre_id,
            'file_stage' => $source->file_stage, // SUBMISSION_FILE_PROOF, as galley file 12
            'created_at' => $now,
            'updated_at' => $now,
            'uploader_user_id' => $source->uploader_user_id,
            'assoc_type' => Application::ASSOC_TYPE_REPRESENTATION,
            'assoc_id' => $galley->getId(),
        ], 'submission_file_id');

        DB::table('submission_file_settings')->insert([
            'submission_file_id' => $submissionFileId,
            'locale' => 'en',
            'setting_name' => 'name',
            'setting_value' => $isSupplementary ? 'supplementary-data.pdf' : 'article-text.pdf',
        ]);
        DB::table('submission_file_revisions')->insert([
            'submission_file_id' => $submissionFileId,
            'file_id' => $fileId,
        ]);

        $galley = Repo::galley()->get($galley->getId());
        Repo::galley()->edit($galley, ['submissionFileId' => $submissionFileId]);

        echo "galley {$galley->getId()}: created own file rows (submission file {$submissionFileId}, file {$fileId})\n";
    }

    /**
     * File-row template for galleys created from scratch: submission 1's
     * primary galley file (genre Article Text, proof stage).
     */
    private function galleyFileTemplate(): object
    {
        return $this->galleyFileTemplateRow ??= DB::table('publication_galleys as g')
            ->join('submission_files as sf', 'sf.submission_file_id', '=', 'g.submission_file_id')
            ->join('files as f', 'f.file_id', '=', 'sf.file_id')
            ->where('g.publication_id', 1)
            ->orderBy('g.galley_id')
            ->first(['f.path', 'f.mimetype', 'sf.uploader_user_id', 'sf.genre_id', 'sf.file_stage']);
    }

    /**
     * Mint DOIs for the publication and its galleys through the same
     * service the editor's "Assign DOI" action uses. Skips objects that
     * already carry a doiId.
     */
    private function seedDois(Publication $publication): void
    {
        $publication = $this->refetch($publication);
        $hadPublicationDoi = !empty($publication->getData('doiId'));

        $failures = Repo::publication()->createDois(
            $publication,
            Repo::submission()->get((int) $publication->getData('submissionId'))
        );
        foreach ($failures as $exception) {
            echo 'doi: FAILED - ' . $exception->getMessage() . "\n";
        }

        $publication = $this->refetch($publication);
        echo 'doi: publication ' . $publication->getId()
            . ($hadPublicationDoi ? ' already had ' : ' -> ')
            . $publication->getData('doiObject')?->getData('doi') . "\n";
        foreach ($publication->getData('galleys') as $galley) {
            echo "doi: galley {$galley->getId()} -> " . $galley->getData('doiObject')?->getData('doi') . "\n";
        }
    }

    /**
     * Import raw citations exactly as the editor's citations form does.
     * Repo::citation()->importCitations() replaces only when the tokenized
     * list differs from what is stored, so this is naturally idempotent.
     */
    private function seedCitations(Publication $publication): void
    {
        $rawCitations = [
            'Willinsky, J. (2006). The access principle: The case for open access to research and scholarship. MIT Press.',
            'Suber, P. (2012). Open access. MIT Press. https://doi.org/10.7551/mitpress/9286.001.0001',
            'Björk, B-C., & Solomon, D. (2012). Open access versus subscription journals: A comparison of scientific impact. BMC Medicine, 10(1), 73. https://doi.org/10.1186/1741-7015-10-73',
            'Piwowar, H., Priem, J., Larivière, V., Alperin, J. P., Matthias, L., Norlander, B., Farley, A., West, J., & Haustein, S. (2018). The state of OA: A large-scale analysis of the prevalence and impact of open access articles. PeerJ, 6, e4375. https://doi.org/10.7717/peerj.4375',
            'Eve, M. P. (2014). Open access and the humanities: Contexts, controversies and the future. Cambridge University Press.',
            'Laakso, M., Welling, P., Bukvova, H., Nyman, L., Björk, B-C., & Hedlund, T. (2011). The development of open access journal publishing from 1993 to 2009. PLoS ONE, 6(6), e20961.',
            'Tennant, J. P., Waldner, F., Jacques, D. C., Masuzzo, P., Collister, L. B., & Hartgerink, C. H. J. (2016). The academic, economic and societal impacts of open access: An evidence-based review. F1000Research, 5, 632.',
            'Chan, L., Cuplinskas, D., Eisen, M., et al. (2002). Budapest Open Access Initiative. Retrieved from https://www.budapestopenaccessinitiative.org/',
            'Guédon, J-C. (2004). The "green" and "gold" roads to open access: The case for mixing and matching. Serials Review, 30(4), 315-328.',
            'Alperin, J. P., & Rozemblum, C. (2017). The reinterpretation of the visibility and quality of new policies to assess scientific publications. Revista Interamericana de Bibliotecología, 40(3), 231-241.',
        ];
        Repo::citation()->importCitations($publication, implode("\n", $rawCitations));

        $count = Repo::citation()->getByPublicationId($publication->getId())->count();
        echo "citations: {$count} stored for publication {$publication->getId()}\n";
    }

    /**
     * Two funders per submission through the Eloquent Funder model, exactly
     * as PKPFunderController::add() creates them: one ROR-linked (name
     * derived from the registry), one free-text with a multilingual name;
     * both with grants (name + number, one with a grant DOI).
     */
    private function seedFunders(int $submissionId): void
    {
        $existing = Funder::withSubmissionId($submissionId)->get();

        if (!$existing->contains(fn (Funder $funder) => $funder->getRawOriginal('ror') === self::FUNDER_ROR)) {
            Funder::create([
                'submissionId' => $submissionId,
                'ror' => self::FUNDER_ROR,
                'name' => [],
                'grants' => [
                    [
                        'grantName' => 'Open Scholarly Infrastructure Program',
                        'grantNumber' => 'NSF-2054890',
                        'grantDoi' => '10.13039/100000001.2054890',
                    ],
                ],
                'seq' => 0,
            ]);
            echo 'funder: created ROR-linked funder (' . self::FUNDER_ROR . ")\n";
        } else {
            echo "funder: ROR-linked funder already present\n";
        }

        $hasNamed = $existing->contains(
            fn (Funder $funder) => ($funder->name['en'] ?? null) === self::FUNDER_NAME_EN
        );
        if (!$hasNamed) {
            Funder::create([
                'submissionId' => $submissionId,
                'ror' => null,
                'name' => [
                    'en' => self::FUNDER_NAME_EN,
                    'fr_CA' => 'Fonds de développement du Public Knowledge Project',
                ],
                'grants' => [
                    [
                        'grantName' => 'Journal Sustainability Grant',
                        'grantNumber' => 'PKP-2026-042',
                    ],
                ],
                'seq' => 1,
            ]);
            echo 'funder: created named funder (' . self::FUNDER_NAME_EN . ")\n";
        } else {
            echo "funder: named funder already present\n";
        }
    }

    /**
     * Three data citations through the Eloquent DataCitation model, exactly
     * as PKPDataCitationController::add() creates them, guarded by title.
     * version() clones data citations, so most versions skip all three.
     */
    private function seedDataCitations(Publication $publication): void
    {
        $publicationId = $publication->getId();
        $existingTitles = DataCitation::withPublicationId($publicationId)
            ->get()
            ->map(fn (DataCitation $dataCitation) => $dataCitation->title)
            ->all();

        $dataCitations = [
            [
                'title' => 'Sea Ice Index, Version 3',
                'identifierType' => 'DOI',
                'identifier' => '10.7265/N5K072F8',
                'relationshipType' => 'supporting',
                'repository' => 'National Snow and Ice Data Center',
                'year' => 2017,
                'authors' => [
                    ['givenName' => 'Florence', 'familyName' => 'Fetterer'],
                    ['givenName' => 'Kenneth', 'familyName' => 'Knowles'],
                ],
                'url' => 'https://nsidc.org/data/g02135/versions/3',
                'seq' => 1,
            ],
            [
                'title' => 'Open Access Journal Growth Dataset 1993-2009',
                'identifierType' => 'DOI',
                'identifier' => '10.5061/dryad.8gtht76v3',
                'relationshipType' => 'analyzed',
                'repository' => 'Dryad',
                'year' => 2011,
                'authors' => [
                    ['givenName' => 'Mikael', 'familyName' => 'Laakso'],
                ],
                'seq' => 2,
            ],
            [
                'title' => 'Survey Responses on Open Access Publishing Practices',
                'relationshipType' => 'generated',
                'repository' => 'Zenodo',
                'year' => 2026,
                'url' => 'https://zenodo.org/records/1234567',
                'seq' => 3,
            ],
        ];

        $created = 0;
        foreach ($dataCitations as $params) {
            if (in_array($params['title'], $existingTitles)) {
                continue;
            }
            DataCitation::create([...$params, 'publicationId' => $publicationId]);
            $created++;
        }
        echo "data citations: {$created} created, " . (count($dataCitations) - $created) . " already present\n";
    }

    /**
     * Subjects, disciplines and supporting agencies for the publication,
     * through the same repository method the submission wizard and metadata
     * form use (deleteFirst replace, per-locale entries). Keywords are left
     * untouched.
     */
    private function seedVocabulary(Publication $publication): void
    {
        $vocabs = [
            ControlledVocab::CONTROLLED_VOCAB_SUBMISSION_SUBJECT => [
                'en' => ['Educational technology', 'Open access publishing'],
                'fr_CA' => ['Technologie éducative'],
            ],
            ControlledVocab::CONTROLLED_VOCAB_SUBMISSION_DISCIPLINE => [
                'en' => ['Education', 'Information science'],
                'fr_CA' => ['Sciences de l\'information'],
            ],
            ControlledVocab::CONTROLLED_VOCAB_SUBMISSION_AGENCY => [
                'en' => ['Social Sciences and Humanities Research Council of Canada'],
            ],
        ];

        foreach ($vocabs as $symbolic => $entries) {
            Repo::controlledVocab()->insertBySymbolic(
                $symbolic,
                $entries,
                Application::ASSOC_TYPE_PUBLICATION,
                $publication->getId()
            );
            $count = array_sum(array_map('count', $entries));
            echo "vocabulary: {$symbolic} -> {$count} entries\n";
        }
    }

    /**
     * Author enrichment for the publication's contributors, all through
     * Repo::author()->edit() (which persists settings, affiliations and
     * CRediT/contributor roles exactly as the contributor form does):
     * multilingual biographies + competing interests for the first two
     * authors, CRediT roles with degrees for all authors, and an extra
     * ROR-backed affiliation for the first author.
     */
    private function seedAuthorRichness(Publication $publication): void
    {
        $creditRoleCycle = [
            ['role' => 'https://credit.niso.org/contributor-roles/conceptualization/', 'degree' => 'LEAD'],
            ['role' => 'https://credit.niso.org/contributor-roles/methodology/', 'degree' => 'EQUAL'],
            ['role' => 'https://credit.niso.org/contributor-roles/data-curation/', 'degree' => 'SUPPORTING'],
            ['role' => 'https://credit.niso.org/contributor-roles/formal-analysis/', 'degree' => 'EQUAL'],
            ['role' => 'https://credit.niso.org/contributor-roles/investigation/', 'degree' => 'LEAD'],
        ];

        $authors = [];
        foreach ($publication->getData('authors') as $author) {
            $authors[] = $author;
        }
        // The collection's order is not stable for authors sharing a seq
        // (Postgres returns ties in arbitrary order); sort by id so the
        // "first author" guards hit the same author on every run.
        usort($authors, fn ($a, $b) => $a->getId() <=> $b->getId());

        foreach ($authors as $index => $author) {
            $params = [
                'creditRoles' => [
                    $creditRoleCycle[$index % count($creditRoleCycle)],
                    $creditRoleCycle[($index + 1) % count($creditRoleCycle)],
                ],
            ];
            $extras = ['credit roles with degrees'];

            if ($index < 2) {
                $params['biography'] = [
                    'en' => '<p>This corpus author researches open scholarly publishing infrastructure and its adoption across research communities.</p>',
                    'fr_CA' => '<p>Cet auteur du corpus étudie les infrastructures de publication savante ouverte et leur adoption dans les communautés de recherche.</p>',
                ];
                $params['competingInterests'] = [
                    'en' => '<p>No competing interests to declare.</p>',
                    'fr_CA' => '<p>Aucun conflit d\'intérêts à déclarer.</p>',
                ];
                $extras[] = 'biography + competing interests (en+fr_CA)';
            }

            if ($index === 0) {
                $affiliations = $author->getAffiliations();
                $hasSeedAffiliation = false;
                foreach ($affiliations as $affiliation) {
                    if ($affiliation->getRor() === self::AFFILIATION_ROR) {
                        $hasSeedAffiliation = true;
                    }
                }
                if (!$hasSeedAffiliation) {
                    $affiliations[] = Repo::affiliation()->newDataObject([
                        'authorId' => $author->getId(),
                        'ror' => self::AFFILIATION_ROR,
                    ]);
                }
                $params['affiliations'] = $affiliations;
                $extras[] = count($affiliations) . ' affiliations';
            }

            Repo::author()->edit($author, $params);
            echo "author {$author->getId()}: " . implode(', ', $extras) . "\n";
        }
    }

    /**
     * Append a marker sentence containing the shared search token to the EN
     * abstract of every publication version of the marker submissions, so a
     * single query matches the whole corpus once the index is rebuilt.
     */
    private function seedSearchMarkers(): void
    {
        foreach (self::MARKER_SUBMISSION_IDS as $submissionId) {
            foreach ($this->publications($submissionId) as $publication) {
                $abstract = (array) ($publication->getData('abstract') ?? []);
                if (str_contains($abstract['en'] ?? '', self::SEARCH_TOKEN)) {
                    echo "search marker: publication {$publication->getId()} already carries '" . self::SEARCH_TOKEN . "'\n";
                    continue;
                }
                $abstract['en'] = ($abstract['en'] ?? '') . self::SEARCH_MARKER;
                Repo::publication()->edit($publication, ['abstract' => $abstract]);
                echo "search marker: appended to publication {$publication->getId()}\n";
            }
        }
    }

    /**
     * Probe the enriched hydration through Repo::submission()->get() (the
     * Eloquent-bridged path wired in the app-level submission DAO) and print
     * what each publication version now carries.
     */
    private function verify(): void
    {
        foreach (self::MARKER_SUBMISSION_IDS as $submissionId) {
            $submission = Repo::submission()->get($submissionId);
            $publications = $submission->getData('publications');
            echo "verification probe (submission {$submissionId}, status {$submission->getData('status')}, "
                . count($publications) . " versions):\n";

            foreach ($publications as $publication) {
                echo "  publication {$publication->getId()} (version {$publication->getData('versionString')}, "
                    . "status {$publication->getData('status')}"
                    . ($publication->getId() === $submission->getData('currentPublicationId') ? ', current' : '')
                    . "):\n";
                echo '    doi: ' . ($publication->getData('doiObject')?->getData('doi') ?? 'MISSING') . "\n";
                echo '    citations: ' . $publication->getData('citations')->count() . "\n";
                echo '    dataCitations: ' . count($publication->getData('dataCitations') ?? []) . "\n";
                echo '    searchMarker: '
                    . (str_contains($publication->getData('abstract')['en'] ?? '', self::SEARCH_TOKEN) ? 'yes' : 'NO') . "\n";

                $funders = $publication->getData('funders') ?? [];
                echo '    funders: ' . count($funders);
                foreach ($funders as $funder) {
                    echo ' [' . ($funder->getRawOriginal('ror') ?: ($funder->name['en'] ?? '?')) . ']';
                }
                echo "\n";

                foreach (['subjects', 'disciplines', 'supportingAgencies', 'keywords'] as $prop) {
                    $entries = $publication->getData($prop) ?? [];
                    $flat = [];
                    foreach ($entries as $locale => $localeEntries) {
                        $flat[] = $locale . ':' . count($localeEntries);
                    }
                    echo "    {$prop}: " . ($flat ? implode(' ', $flat) : 'NONE') . "\n";
                }

                foreach ($publication->getData('authors') as $authorId => $author) {
                    $affiliationInfo = [];
                    foreach ($author->getAffiliations() as $affiliation) {
                        $affiliationInfo[] = ($affiliation->getRor() ?? 'custom')
                            . ($affiliation->getData('rorObject') ? ' (rorObject ok)' : '');
                    }
                    $creditRoles = array_map(
                        fn ($role) => basename(rtrim($role['role'] ?? '?', '/')) . ':' . ($role['degree'] ?? '-'),
                        $author->getCreditRoles()
                    );
                    echo "    author {$authorId}: bio[" . implode(',', array_keys($author->getData('biography') ?? [])) . ']'
                        . ' ci[' . implode(',', array_keys($author->getData('competingInterests') ?? [])) . ']'
                        . ' credit[' . implode(' ', $creditRoles) . ']'
                        . ' affiliations[' . implode('; ', $affiliationInfo) . "]\n";
                }

                foreach ($publication->getData('galleys') as $galley) {
                    echo "    galley {$galley->getId()} '{$galley->getData('label')}':"
                        . ' doi=' . ($galley->getData('doiObject')?->getData('doi') ?? 'none')
                        . ' file=' . ($galley->getData('submissionFileId') ?? 'none')
                        . ' path=' . ($galley->getFile()?->getData('path') ?? 'none') . "\n";
                }
            }
        }
    }
}

$tool = new SeedRichCorpus($argv ?? []);
$tool->execute();
