<?php

/**
 * @file classes/testing/bootstrap/Processor/IssueProcessor.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class IssueProcessor
 *
 * @brief Creates issues for one journal and optionally marks them published.
 *
 * Issues are OJS-specific — no other application has Repo::issue() — so
 * this processor lives on the OJS side of the scenario stack. It is
 * reached only through JournalScenarioController::afterContextCreated(),
 * and the `issues` spec key that drives it is an OJS schema overlay, so
 * an OMP/OPS spec naming it is rejected by validation before any code
 * here could run. (It lived in lib/pkp until the multi-app port; moved
 * out so the shared path carries no app-only Repo dependency.)
 */

namespace APP\testing\bootstrap\Processor;

use APP\facades\Repo;
use PKP\core\Core;

class IssueProcessor
{
    /**
     * @param array $issueSpecs [{volume, number, year, published?, title?, description?, showTitle?}]
     *
     * @return array Numerically-indexed list of issue metadata fragments matching the spec order.
     */
    public function run(int $contextId, array $issueSpecs): array
    {
        $results = [];
        foreach ($issueSpecs as $spec) {
            $data = [
                'journalId' => $contextId,
                'volume' => $spec['volume'] ?? null,
                'number' => $spec['number'] ?? null,
                'year' => $spec['year'] ?? null,
                'title' => $spec['title'] ?? [],
                'description' => $spec['description'] ?? [],
                'published' => 0,
                'showVolume' => $spec['showVolume'] ?? 1,
                'showNumber' => $spec['showNumber'] ?? 1,
                'showYear' => $spec['showYear'] ?? 1,
                'showTitle' => $spec['showTitle'] ?? 0,
            ];
            // Optional: per-issue access status (subscription-based access
            // tests need to flag the issue as Subscription explicitly so
            // IssueAction::subscriptionRequired returns true even if the
            // surrounding journal is in subscription mode). Issue::ISSUE_ACCESS_OPEN=1,
            // ISSUE_ACCESS_SUBSCRIPTION=2.
            if (isset($spec['accessStatus'])) {
                $data['accessStatus'] = $spec['accessStatus'];
            }
            $issue = Repo::issue()->newDataObject($data);
            $issueId = Repo::issue()->add($issue);

            if (!empty($spec['published'])) {
                $issue = Repo::issue()->get($issueId);
                $issue->setPublished(1);
                $issue->setDatePublished(Core::getCurrentDate());
                Repo::issue()->edit($issue, []);
                Repo::issue()->updateCurrent($contextId, $issue);
            }

            $results[] = [
                'id' => $issueId,
                'volume' => $spec['volume'] ?? null,
                'number' => $spec['number'] ?? null,
                'year' => $spec['year'] ?? null,
                'published' => !empty($spec['published']),
            ];
        }
        return $results;
    }
}
