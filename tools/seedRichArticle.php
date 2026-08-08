<?php

/**
 * @file tools/seedRichArticle.php
 *
 * Copyright (c) 2014-2026 Simon Fraser University
 * Copyright (c) 2003-2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SeedRichArticle
 *
 * @brief Playground seeding tool: enrich submission 1 (journal
 *   `publicknowledge`) so its publications exercise every toDataObject()
 *   bridge path of the parallel Eloquent read models: publication + galley
 *   DOIs, citations, funders, data citations, CRediT roles with degrees,
 *   subjects/disciplines/supporting agencies, multilingual biographies,
 *   competing interests, a second ROR-backed affiliation and a second
 *   galley with its own submission file. Both publications (the published
 *   current version and the queued next version) are enriched, so the
 *   article landing page and the version under edit both carry the data.
 *
 *   Idempotent: every section guards on the rows it creates, so running the
 *   tool twice produces no duplicates. Data goes through the same app
 *   services the editor UI uses wherever one exists; only the supplementary
 *   galley's file rows are written directly (modelled on submission file 12
 *   / file 7), because a real upload would need a web request.
 *
 * Usage: php tools/seedRichArticle.php [verify]
 *   verify  skip seeding, only print the hydration probe
 */

use APP\core\Application;
use APP\facades\Repo;
use Illuminate\Support\Facades\DB;
use PKP\cliTool\CommandLineTool;
use PKP\context\Context;
use PKP\controlledVocab\ControlledVocab;
use PKP\dataCitation\DataCitation;
use PKP\funder\Funder;

require(dirname(__FILE__) . '/bootstrap.php');

class SeedRichArticle extends CommandLineTool
{
    private const SUBMISSION_ID = 1;
    private const CONTEXT_ID = 1;
    private const DOI_PREFIX = '10.1234';

    /** Distinctive markers used as idempotency guards */
    private const SUPP_GALLEY_LABEL = 'Supplementary Data (PDF)';
    private const FUNDER_ROR = 'https://ror.org/021nxhr62'; // National Science Foundation
    private const FUNDER_NAME_EN = 'Public Knowledge Project Development Fund';
    private const AFFILIATION_ROR = 'https://ror.org/04ttjf776'; // RMIT University

    public function execute(): void
    {
        $verifyOnly = in_array('verify', $this->argv);

        if (!$verifyOnly) {
            $this->enableDoiSettings();
            $this->seedFunders();
            foreach ($this->publications() as $publication) {
                echo "-- publication {$publication->getId()} (version {$publication->getData('versionString')})\n";
                $this->seedSupplementaryGalley($publication);
                $this->seedDois($publication);
                $this->seedCitations($publication);
                $this->seedDataCitations($publication);
                $this->seedVocabulary($publication);
                $this->seedAuthorRichness($publication);
            }
            echo "\n";
        }

        $this->verify();
    }

    /**
     * All publications of the target submission, in version order,
     * re-fetched fresh from the repository
     *
     * @return \APP\publication\Publication[]
     */
    private function publications(): array
    {
        return Repo::publication()->getCollector()
            ->filterBySubmissionIds([self::SUBMISSION_ID])
            ->orderByVersion()
            ->getMany()
            ->values()
            ->toArray();
    }

    /**
     * Fresh copy of one publication (relations like galleys re-resolved)
     */
    private function refetch(\APP\publication\Publication $publication): \APP\publication\Publication
    {
        foreach ($this->publications() as $fresh) {
            if ($fresh->getId() === $publication->getId()) {
                return $fresh;
            }
        }
        throw new RuntimeException("Publication {$publication->getId()} disappeared");
    }

    /**
     * Enable publication + galley DOIs for the journal so the article
     * landing page renders them (ArticleHandler passes the publication's
     * doiObject to the template whenever it is set; minting requires
     * enableDois, a prefix and the type in enabledDoiTypes).
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
     * Give the publication a second galley with its own submission_files +
     * files rows, so per-galley file paths diverge from the shared file of
     * the existing galleys. The galley itself goes through Repo::galley();
     * the file rows are modelled on submission file 12 (files row 7), with
     * a duplicate files row pointing at the same physical path — fine for
     * the playground.
     */
    private function seedSupplementaryGalley(\APP\publication\Publication $publication): void
    {
        foreach ($publication->getData('galleys') as $galley) {
            if ($galley->getData('label') === self::SUPP_GALLEY_LABEL) {
                echo "supplementary galley: already present (galley {$galley->getId()})\n";
                return;
            }
        }

        $galley = Repo::galley()->newDataObject();
        $galley->setAllData([
            'publicationId' => $publication->getId(),
            'label' => self::SUPP_GALLEY_LABEL,
            'locale' => 'en',
            'seq' => 1,
            'isApproved' => false,
        ]);
        $galleyId = Repo::galley()->add($galley);

        // File rows modelled on the existing galley file (submission_file_id
        // 12 -> files 7): same physical path, own rows, proof file stage,
        // associated with the new galley.
        $template = DB::table('submission_files as sf')
            ->join('files as f', 'f.file_id', '=', 'sf.file_id')
            ->where('sf.submission_file_id', $publication->getData('galleys')->first()->getData('submissionFileId'))
            ->first(['f.path', 'f.mimetype', 'sf.uploader_user_id']);

        $fileId = DB::table('files')->insertGetId([
            'path' => $template->path,
            'mimetype' => $template->mimetype,
        ], 'file_id');

        $now = date('Y-m-d H:i:s');
        $submissionFileId = DB::table('submission_files')->insertGetId([
            'submission_id' => self::SUBMISSION_ID,
            'file_id' => $fileId,
            'genre_id' => 7, // DATASET genre of journal 1
            'file_stage' => 10, // SUBMISSION_FILE_PROOF, as galley file 12
            'created_at' => $now,
            'updated_at' => $now,
            'uploader_user_id' => $template->uploader_user_id,
            'assoc_type' => Application::ASSOC_TYPE_REPRESENTATION,
            'assoc_id' => $galleyId,
        ], 'submission_file_id');

        DB::table('submission_file_settings')->insert([
            'submission_file_id' => $submissionFileId,
            'locale' => 'en',
            'setting_name' => 'name',
            'setting_value' => 'supplementary-data.pdf',
        ]);
        DB::table('submission_file_revisions')->insert([
            'submission_file_id' => $submissionFileId,
            'file_id' => $fileId,
        ]);

        $galley = Repo::galley()->get($galleyId);
        Repo::galley()->edit($galley, ['submissionFileId' => $submissionFileId]);

        echo "supplementary galley: created galley {$galleyId} (submission file {$submissionFileId}, file {$fileId})\n";
    }

    /**
     * Mint DOIs for the publication and its galleys through the same
     * service the editor's "Assign DOI" action uses. Skips objects that
     * already carry a doiId.
     */
    private function seedDois(\APP\publication\Publication $publication): void
    {
        $publication = $this->refetch($publication);
        $hadPublicationDoi = !empty($publication->getData('doiId'));

        $failures = Repo::publication()->createDois($publication, Repo::submission()->get(self::SUBMISSION_ID));
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
    private function seedCitations(\APP\publication\Publication $publication): void
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
     * Two funders (submission-level) through the Eloquent Funder model,
     * exactly as PKPFunderController::add() creates them: one ROR-linked
     * (name derived from the registry), one free-text with a multilingual
     * name; both with grants (name + number, one with a grant DOI).
     */
    private function seedFunders(): void
    {
        $existing = Funder::withSubmissionId(self::SUBMISSION_ID)->get();

        if (!$existing->contains(fn (Funder $funder) => $funder->getRawOriginal('ror') === self::FUNDER_ROR)) {
            Funder::create([
                'submissionId' => self::SUBMISSION_ID,
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
                'submissionId' => self::SUBMISSION_ID,
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
     * as PKPDataCitationController::add() creates them. Shapes modelled on
     * the existing rows of publication 6 (all settings non-localized).
     */
    private function seedDataCitations(\APP\publication\Publication $publication): void
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
     * form use (deleteFirst replace, per-locale entries). Keywords already
     * exist and are left untouched.
     */
    private function seedVocabulary(\APP\publication\Publication $publication): void
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
     * multilingual biographies + competing interests for two authors,
     * CRediT roles with degrees for all three, and a second ROR-backed
     * affiliation for the first author.
     */
    private function seedAuthorRichness(\APP\publication\Publication $publication): void
    {
        $authors = [];
        foreach ($publication->getData('authors') as $authorId => $author) {
            $authors[] = $author;
        }
        [$first, $second, $third] = [$authors[0] ?? null, $authors[1] ?? null, $authors[2] ?? null];

        if ($first) {
            $params = [
                'biography' => [
                    'en' => '<p>Alan Mwandenga is a professor of public scholarship whose work examines open access publishing infrastructure in the Global South.</p>',
                    'fr_CA' => '<p>Alan Mwandenga est professeur de recherche publique; ses travaux portent sur les infrastructures de publication en libre accès dans les pays du Sud.</p>',
                ],
                'competingInterests' => [
                    'en' => '<p>Serves on the advisory board of the Public Knowledge Project.</p>',
                    'fr_CA' => '<p>Siège au comité consultatif du Public Knowledge Project.</p>',
                ],
                'creditRoles' => [
                    ['role' => 'https://credit.niso.org/contributor-roles/conceptualization/', 'degree' => 'LEAD'],
                    ['role' => 'https://credit.niso.org/contributor-roles/methodology/', 'degree' => 'EQUAL'],
                ],
            ];

            $affiliations = $first->getAffiliations();
            $hasSeedAffiliation = false;
            foreach ($affiliations as $affiliation) {
                if ($affiliation->getRor() === self::AFFILIATION_ROR) {
                    $hasSeedAffiliation = true;
                }
            }
            if (!$hasSeedAffiliation) {
                $affiliations[] = Repo::affiliation()->newDataObject([
                    'authorId' => $first->getId(),
                    'ror' => self::AFFILIATION_ROR,
                ]);
            }
            $params['affiliations'] = $affiliations;

            Repo::author()->edit($first, $params);
            echo "author {$first->getId()}: biography (en+fr_CA), competing interests, credit roles with degrees, "
                . count($affiliations) . " affiliations\n";
        }

        if ($second) {
            Repo::author()->edit($second, [
                'biography' => [
                    'en' => '<p>Amina Mansour is a data librarian researching research-data citation practices in scholarly journals.</p>',
                    'fr_CA' => '<p>Amina Mansour est bibliothécaire de données; elle étudie les pratiques de citation des données de recherche dans les revues savantes.</p>',
                ],
                'competingInterests' => [
                    'en' => '<p>No competing interests to declare.</p>',
                ],
                'creditRoles' => [
                    ['role' => 'https://credit.niso.org/contributor-roles/data-curation/', 'degree' => 'SUPPORTING'],
                    ['role' => 'https://credit.niso.org/contributor-roles/formal-analysis/', 'degree' => 'EQUAL'],
                ],
            ]);
            echo "author {$second->getId()}: biography (en+fr_CA), competing interests, credit roles with degrees\n";
        }

        if ($third) {
            Repo::author()->edit($third, [
                'creditRoles' => [
                    ['role' => 'https://credit.niso.org/contributor-roles/investigation/', 'degree' => 'LEAD'],
                ],
            ]);
            echo "author {$third->getId()}: credit role with degree\n";
        }
    }

    /**
     * Probe the enriched hydration through Repo::submission()->get() (the
     * Eloquent-bridged path wired in the app-level submission DAO) and print
     * what each publication now carries.
     */
    private function verify(): void
    {
        $submission = Repo::submission()->get(self::SUBMISSION_ID);

        foreach ($submission->getData('publications') as $publication) {
            echo 'verification probe (submission ' . self::SUBMISSION_ID . ", publication {$publication->getId()}"
                . ($publication->getId() === $submission->getData('currentPublicationId') ? ', current' : '')
                . "):\n";
            echo '  doi: ' . ($publication->getData('doiObject')?->getData('doi') ?? 'MISSING') . "\n";
            echo '  citations: ' . $publication->getData('citations')->count() . "\n";
            echo '  dataCitations: ' . count($publication->getData('dataCitations') ?? []) . "\n";

            $funders = $publication->getData('funders') ?? [];
            echo '  funders: ' . count($funders);
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
                echo "  {$prop}: " . ($flat ? implode(' ', $flat) : 'NONE') . "\n";
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
                echo "  author {$authorId}: bio[" . implode(',', array_keys($author->getData('biography') ?? [])) . ']'
                    . ' ci[' . implode(',', array_keys($author->getData('competingInterests') ?? [])) . ']'
                    . ' credit[' . implode(' ', $creditRoles) . ']'
                    . ' affiliations[' . implode('; ', $affiliationInfo) . "]\n";
            }

            foreach ($publication->getData('galleys') as $galley) {
                echo "  galley {$galley->getId()} '{$galley->getData('label')}':"
                    . ' doi=' . ($galley->getData('doiObject')?->getData('doi') ?? 'none')
                    . ' file=' . ($galley->getData('submissionFileId') ?? 'none')
                    . ' path=' . ($galley->getFile()?->getData('path') ?? 'none') . "\n";
            }
        }
    }
}

$tool = new SeedRichArticle($argv ?? []);
$tool->execute();
