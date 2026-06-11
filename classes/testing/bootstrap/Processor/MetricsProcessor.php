<?php

/**
 * @file classes/testing/bootstrap/Processor/MetricsProcessor.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class MetricsProcessor
 *
 * @brief Seeds compiled usage-statistics rows for one submission.
 *
 * OJS-only: invoked from SubmissionScenarioController::afterSubmissionCreated().
 * Writes directly into `metrics_submission` — the table the nightly usage
 * stats loader's compileSubmissionMetrics() step fills and the only table
 * the Stats > Articles page (PKPStatsPublicationQueryBuilder) reads — using
 * exactly the column shape that compile step produces:
 *
 *  - abstract views: load_id, context_id, submission_id,
 *    assoc_type = ASSOC_TYPE_SUBMISSION, date, metric
 *  - galley downloads: the same plus representation_id, submission_file_id
 *    and file_type, assoc_type = ASSOC_TYPE_SUBMISSION_FILE
 *
 * The numbers are synthetic (no usage event log existed); the row shape and
 * load_id naming (`usage_events_YYYYMMDD.log`) match the pipeline so the
 * stats pages, date-range filters and CSV reports render them exactly like
 * compiled production data. The log-processing pipeline itself stays
 * untested in round 1.
 *
 * Spec shape (declared via SubmissionScenarioController::schemaOverlayProperties()):
 * {
 *   views?: int,      // total abstract views, spread across months
 *   downloads?: int,  // total galley/file views, spread across months
 *   months?: int      // monthly buckets backwards from the current month, default 3
 * }
 *
 * Rows land on the 1st of each bucket month; the total is split evenly with
 * the remainder credited to the most recent month. The inserted rows are
 * echoed back in the scenario response so tests can derive date-range
 * filters without re-implementing the layout.
 */

namespace APP\testing\bootstrap\Processor;

use APP\core\Application;
use APP\facades\Repo;
use DateTimeImmutable;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use PKP\statistics\PKPStatisticsHelper;

class MetricsProcessor
{
    /**
     * @param int $submissionId The scenario submission to attach metrics to
     * @param array $spec {views?, downloads?, months?}
     *
     * @return array Summary echoed into the scenario response:
     *               {submissionId, totals: {views, downloads}, rows: [{date, assocType, metric}]}
     */
    public function run(int $submissionId, array $spec): array
    {
        $views = (int) ($spec['views'] ?? 0);
        $downloads = (int) ($spec['downloads'] ?? 0);
        $months = (int) ($spec['months'] ?? 3);

        if ($views < 0 || $downloads < 0) {
            throw new InvalidArgumentException('metrics: views and downloads must be >= 0');
        }
        if ($views === 0 && $downloads === 0) {
            throw new InvalidArgumentException('metrics: at least one of views/downloads must be > 0');
        }
        if ($months < 1 || $months > 24) {
            throw new InvalidArgumentException('metrics: months must be between 1 and 24');
        }

        $submission = Repo::submission()->get($submissionId);
        if (!$submission) {
            throw new InvalidArgumentException("metrics: submission {$submissionId} not found");
        }
        $contextId = (int) $submission->getData('contextId');

        // Monthly bucket dates, most recent first: 1st of the current month,
        // then the 1st of each prior month.
        $firstOfMonth = new DateTimeImmutable('first day of this month');
        $dates = [];
        for ($i = 0; $i < $months; $i++) {
            $dates[] = $firstOfMonth->modify("-{$i} months")->format('Y-m-d');
        }

        // Two batches with distinct column sets, mirroring the two
        // insertUsing() calls in compileSubmissionMetrics() (and required by
        // Laravel's multi-row insert, which assumes uniform columns).
        $abstractRows = [];
        $fileRows = [];
        $summary = [];

        foreach ($this->spread($views, $months) as $i => $metric) {
            if ($metric < 1) {
                continue; // the compile step never writes metric=0 rows
            }
            $abstractRows[] = [
                'load_id' => $this->loadId($dates[$i]),
                'context_id' => $contextId,
                'submission_id' => $submissionId,
                'assoc_type' => Application::ASSOC_TYPE_SUBMISSION,
                'date' => $dates[$i],
                'metric' => $metric,
            ];
            $summary[] = ['date' => $dates[$i], 'assocType' => 'submission', 'metric' => $metric];
        }

        if ($downloads > 0) {
            [$representationId, $submissionFileId, $fileType] = $this->resolveGalley($submission);
            foreach ($this->spread($downloads, $months) as $i => $metric) {
                if ($metric < 1) {
                    continue;
                }
                $fileRows[] = [
                    'load_id' => $this->loadId($dates[$i]),
                    'context_id' => $contextId,
                    'submission_id' => $submissionId,
                    'representation_id' => $representationId,
                    'submission_file_id' => $submissionFileId,
                    'file_type' => $fileType,
                    'assoc_type' => Application::ASSOC_TYPE_SUBMISSION_FILE,
                    'date' => $dates[$i],
                    'metric' => $metric,
                ];
                $summary[] = ['date' => $dates[$i], 'assocType' => 'submissionFile', 'metric' => $metric];
            }
        }

        // Plain inserts — deliberately NOT the compile step's
        // delete-by-load_id-then-insert, which exists to make log
        // re-processing idempotent and would wipe rows seeded by parallel
        // tests for the same date.
        if (!empty($abstractRows)) {
            DB::table('metrics_submission')->insert($abstractRows);
        }
        if (!empty($fileRows)) {
            DB::table('metrics_submission')->insert($fileRows);
        }

        return [
            'submissionId' => $submissionId,
            'totals' => ['views' => $views, 'downloads' => $downloads],
            'rows' => $summary,
        ];
    }

    /**
     * Same naming the usage-event log / stats loader uses for the load that
     * would have produced rows on this date.
     */
    protected function loadId(string $date): string
    {
        return 'usage_events_' . str_replace('-', '', $date) . '.log';
    }

    /**
     * Split a total across N buckets: even split, remainder credited to the
     * most recent (index 0) buckets so every unit lands somewhere.
     *
     * @return int[] One value per bucket, index 0 = current month
     */
    protected function spread(int $total, int $buckets): array
    {
        $base = intdiv($total, $buckets);
        $remainder = $total % $buckets;
        $out = [];
        for ($i = 0; $i < $buckets; $i++) {
            $out[] = $base + ($i < $remainder ? 1 : 0);
        }
        return $out;
    }

    /**
     * Resolve the galley/file columns for download rows. When the current
     * publication has a galley with a file (e.g. added via the production
     * stage before seeding metrics), its real IDs and document type are
     * used — identical to compiled rows. When the scenario submission has
     * no galley, the IDs stay null and the file type defaults to PDF;
     * the stats pages aggregate by assoc_type only, so the numbers render
     * the same. Parity caveat documented in the audit fragment.
     *
     * @return array [?int representationId, ?int submissionFileId, int fileType]
     */
    protected function resolveGalley($submission): array
    {
        $publication = $submission->getCurrentPublication();
        if ($publication) {
            $galleys = Repo::galley()->getCollector()
                ->filterByPublicationIds([$publication->getId()])
                ->getMany();
            foreach ($galleys as $galley) {
                $submissionFileId = $galley->getData('submissionFileId');
                if (!$submissionFileId) {
                    continue;
                }
                $file = Repo::submissionFile()->get((int) $submissionFileId);
                $fileType = $file
                    ? PKPStatisticsHelper::getDocumentType((string) $file->getData('mimetype'))
                    : PKPStatisticsHelper::STATISTICS_FILE_TYPE_OTHER;
                return [(int) $galley->getId(), (int) $submissionFileId, $fileType];
            }
        }
        return [null, null, PKPStatisticsHelper::STATISTICS_FILE_TYPE_PDF];
    }
}
