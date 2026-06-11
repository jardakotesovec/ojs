<?php

/**
 * @file classes/testing/bootstrap/Processor/SubscriptionProcessor.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SubscriptionProcessor
 *
 * @brief Seeds subscription types and individual/institutional subscriptions
 *        for one journal scratch scenario.
 *
 * OJS-only: invoked from JournalScenarioController::afterContextCreated(),
 * mirroring how IssueProcessor is wired. Each item creates its own
 * subscription_types row (the same way SubscriptionTypeForm::execute() does)
 * and then one subscriptions row through the same DAO insert paths the
 * Individual/InstitutionalSubscriptionForm grids use, so the payments grids,
 * the reader-facing /about/subscriptions page, the user profile
 * Subscriptions tab, and IssueAction's subscription gates all see exactly
 * the rows a journal manager would have produced.
 *
 * Note: the spec does NOT flip the journal's publishingMode — tests that
 * need subscription gating pass `publishingMode` themselves via the shared
 * context schema.
 *
 * Spec item shape (validated here; structural validation also declared via
 * JournalScenarioController::schemaOverlayProperties()):
 * {
 *   type: {
 *     name: string,                          // localized into the journal's primary locale
 *     format?: 'online'|'print'|'printOnline', // default 'online'
 *     duration?: int|null,                   // months; default 12; null = non-expiring
 *     cost?: number,                         // default 0
 *     currency?: string,                     // default 'USD'
 *     institutional?: bool                   // default false (individual)
 *   },
 *   user?: string,                           // username; required for individual,
 *                                            // optional contact for institutional (default 'admin')
 *   institution?: { name: string, ipRanges?: string[] }, // required for institutional
 *   status?: 'active'|'expired',             // default 'active'; 'expired' = ACTIVE status + dateEnd in the past
 *   dateStart?: 'YYYY-MM-DD',
 *   dateEnd?: 'YYYY-MM-DD'
 * }
 */

namespace APP\testing\bootstrap\Processor;

use APP\core\Application;
use APP\facades\Repo;
use APP\subscription\IndividualSubscription;
use APP\subscription\IndividualSubscriptionDAO;
use APP\subscription\InstitutionalSubscription;
use APP\subscription\InstitutionalSubscriptionDAO;
use APP\subscription\Subscription;
use APP\subscription\SubscriptionType;
use APP\subscription\SubscriptionTypeDAO;
use InvalidArgumentException;
use PKP\db\DAORegistry;

class SubscriptionProcessor
{
    /** Spec format string => SubscriptionType::SUBSCRIPTION_TYPE_FORMAT_* */
    protected const FORMATS = [
        'online' => SubscriptionType::SUBSCRIPTION_TYPE_FORMAT_ONLINE,
        'print' => SubscriptionType::SUBSCRIPTION_TYPE_FORMAT_PRINT,
        'printOnline' => SubscriptionType::SUBSCRIPTION_TYPE_FORMAT_PRINT_ONLINE,
    ];

    /**
     * @param int $contextId Journal ID of the scratch journal
     * @param array $subscriptionSpecs List of spec items (shape above)
     *
     * @return array Numerically-indexed results: {typeId, subscriptionId,
     *               institutional, username?, institutionId?, dateStart?, dateEnd?}
     */
    public function run(int $contextId, array $subscriptionSpecs): array
    {
        $journal = Application::getContextDAO()->getById($contextId);
        if (!$journal) {
            throw new InvalidArgumentException("subscriptions: journal {$contextId} not found");
        }
        $primaryLocale = $journal->getPrimaryLocale();

        $results = [];
        foreach ($subscriptionSpecs as $i => $spec) {
            $results[] = $this->buildOne($contextId, $primaryLocale, $spec, $i);
        }
        return $results;
    }

    protected function buildOne(int $contextId, string $primaryLocale, array $spec, int $index): array
    {
        $typeSpec = $spec['type'] ?? null;
        if (!is_array($typeSpec) || empty($typeSpec['name']) || !is_string($typeSpec['name'])) {
            throw new InvalidArgumentException("subscriptions[{$index}].type.name is required");
        }
        $institutional = !empty($typeSpec['institutional']);

        // Duration in months; explicit null means non-expiring (production
        // leaves the date fields empty for non-expiring types).
        $duration = array_key_exists('duration', $typeSpec)
            ? ($typeSpec['duration'] === null ? null : (int) $typeSpec['duration'])
            : 12;
        if ($duration !== null && $duration < 1) {
            throw new InvalidArgumentException("subscriptions[{$index}].type.duration must be >= 1 month or null (non-expiring)");
        }

        $formatKey = $typeSpec['format'] ?? 'online';
        if (!isset(self::FORMATS[$formatKey])) {
            throw new InvalidArgumentException("subscriptions[{$index}].type.format must be one of: " . implode(', ', array_keys(self::FORMATS)));
        }

        $status = $spec['status'] ?? 'active';
        if (!in_array($status, ['active', 'expired'], true)) {
            throw new InvalidArgumentException("subscriptions[{$index}].status must be 'active' or 'expired'");
        }
        if ($status === 'expired' && $duration === null) {
            throw new InvalidArgumentException("subscriptions[{$index}]: a non-expiring type (duration: null) cannot be 'expired'");
        }

        $typeId = $this->insertType($contextId, $primaryLocale, $typeSpec, $institutional, $duration, self::FORMATS[$formatKey]);

        [$dateStart, $dateEnd] = $this->resolveDates($spec, $status, $duration, $index);

        if ($institutional) {
            return $this->insertInstitutionalSubscription($contextId, $primaryLocale, $spec, $typeId, $dateStart, $dateEnd, $index);
        }
        return $this->insertIndividualSubscription($contextId, $spec, $typeId, $dateStart, $dateEnd, $index);
    }

    /**
     * Mirror of SubscriptionTypeForm::execute() (insert branch): same field
     * defaults the form posts (membership 0, public display enabled), same
     * REALLY_BIG_NUMBER + resequence dance for the grid ordering, name and
     * description written to subscription_type_settings via insertObject().
     */
    protected function insertType(int $contextId, string $primaryLocale, array $typeSpec, bool $institutional, ?int $duration, int $format): int
    {
        /** @var SubscriptionTypeDAO $subscriptionTypeDao */
        $subscriptionTypeDao = DAORegistry::getDAO('SubscriptionTypeDAO');

        $subscriptionType = $subscriptionTypeDao->newDataObject();
        $subscriptionType->setInstitutional((int) $institutional);
        $subscriptionType->setJournalId($contextId);
        $subscriptionType->setName($typeSpec['name'], $primaryLocale);
        if (!empty($typeSpec['description'])) {
            $subscriptionType->setDescription($typeSpec['description'], $primaryLocale);
        }
        $subscriptionType->setCost(round((float) ($typeSpec['cost'] ?? 0), 2));
        $subscriptionType->setCurrencyCodeAlpha($typeSpec['currency'] ?? 'USD');
        $subscriptionType->setDuration($duration);
        $subscriptionType->setFormat($format);
        $subscriptionType->setMembership(0);
        $subscriptionType->setDisablePublicDisplay(0);
        $subscriptionType->setSequence(REALLY_BIG_NUMBER);
        $subscriptionTypeDao->insertObject($subscriptionType);
        $subscriptionTypeDao->resequenceSubscriptionTypes($contextId);

        return $subscriptionType->getId();
    }

    /**
     * Resolve dateStart/dateEnd the way the SubscriptionForm date pickers
     * would. Returns [?string dateStart 'Y-m-d', ?int dateEnd end-of-day
     * timestamp] — the timestamp matches SubscriptionForm::execute()'s
     * mktime(23, 59, 59, ...) normalization. Non-expiring types carry no
     * dates, exactly like the production form.
     */
    protected function resolveDates(array $spec, string $status, ?int $duration, int $index): array
    {
        if ($duration === null) {
            if (!empty($spec['dateStart']) || !empty($spec['dateEnd'])) {
                throw new InvalidArgumentException("subscriptions[{$index}]: non-expiring types must not carry dateStart/dateEnd");
            }
            return [null, null];
        }

        foreach (['dateStart', 'dateEnd'] as $key) {
            if (isset($spec[$key]) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $spec[$key])) {
                throw new InvalidArgumentException("subscriptions[{$index}].{$key} must be formatted YYYY-MM-DD");
            }
        }

        if ($status === 'expired') {
            // The whole point of seeding: the create form cannot produce a
            // subscription whose dateEnd already passed.
            $dateEndDay = $spec['dateEnd'] ?? date('Y-m-d', strtotime('yesterday'));
            $dateStart = $spec['dateStart'] ?? date('Y-m-d', strtotime("{$dateEndDay} -{$duration} months"));
        } else {
            $dateStart = $spec['dateStart'] ?? date('Y-m-d');
            $dateEndDay = $spec['dateEnd'] ?? date('Y-m-d', strtotime("{$dateStart} +{$duration} months"));
        }

        $end = strtotime($dateEndDay);
        $dateEnd = mktime(23, 59, 59, (int) date('m', $end), (int) date('d', $end), (int) date('Y', $end));

        if ($status === 'expired' && $dateEnd >= time()) {
            throw new InvalidArgumentException("subscriptions[{$index}]: status 'expired' requires dateEnd in the past (got {$dateEndDay})");
        }

        return [$dateStart, $dateEnd];
    }

    /**
     * Mirror of IndividualSubscriptionForm::execute() + SubscriptionForm::execute():
     * one subscriptions row with status ACTIVE (expiry in OJS is date-based,
     * never a status), membership/reference/notes left null like an untouched
     * form, inserted through IndividualSubscriptionDAO::insertObject().
     */
    protected function insertIndividualSubscription(int $contextId, array $spec, int $typeId, ?string $dateStart, ?int $dateEnd, int $index): array
    {
        if (empty($spec['user']) || !is_string($spec['user'])) {
            throw new InvalidArgumentException("subscriptions[{$index}].user (username) is required for individual subscriptions");
        }
        $user = Repo::user()->getByUsername($spec['user'], true);
        if (!$user) {
            throw new InvalidArgumentException("subscriptions[{$index}].user '{$spec['user']}' not found — declare it in users[] or use a bootstrap-seeded username");
        }

        /** @var IndividualSubscriptionDAO $individualSubscriptionDao */
        $individualSubscriptionDao = DAORegistry::getDAO('IndividualSubscriptionDAO');

        // Same uniqueness rule the production form enforces.
        if ($individualSubscriptionDao->subscriptionExistsByUserForJournal($user->getId(), $contextId)) {
            throw new InvalidArgumentException("subscriptions[{$index}]: user '{$spec['user']}' already has an individual subscription for this journal");
        }

        $subscription = new IndividualSubscription();
        $this->hydrateSubscription($subscription, $contextId, $user->getId(), $typeId, $dateStart, $dateEnd);
        $individualSubscriptionDao->insertObject($subscription);

        return [
            'typeId' => $typeId,
            'subscriptionId' => $subscription->getId(),
            'institutional' => false,
            'username' => $spec['user'],
            'dateStart' => $dateStart,
            'dateEnd' => $dateEnd !== null ? date('Y-m-d H:i:s', $dateEnd) : null,
        ];
    }

    /**
     * Mirror of InstitutionalSubscriptionForm::execute(): the institution is
     * created first through Repo::institution()->add() — the same path the
     * Settings > Institutions form uses, including institution_ip range
     * parsing in PKP\institution\DAO::insertIPRanges() — then one
     * subscriptions + institutional_subscriptions row pair via
     * InstitutionalSubscriptionDAO::insertObject(). The production form
     * requires a domain or at least one IP range for online formats; this
     * seed supports IP ranges only, so it requires ipRanges outright.
     */
    protected function insertInstitutionalSubscription(int $contextId, string $primaryLocale, array $spec, int $typeId, ?string $dateStart, ?int $dateEnd, int $index): array
    {
        $institutionSpec = $spec['institution'] ?? null;
        if (!is_array($institutionSpec) || empty($institutionSpec['name']) || !is_string($institutionSpec['name'])) {
            throw new InvalidArgumentException("subscriptions[{$index}].institution.name is required for institutional subscriptions");
        }
        $ipRanges = $institutionSpec['ipRanges'] ?? [];
        if (!is_array($ipRanges) || empty($ipRanges)) {
            throw new InvalidArgumentException("subscriptions[{$index}].institution.ipRanges (non-empty array) is required — domain-based institutional access is not seedable; create it through the UI");
        }
        foreach ($ipRanges as $ipRange) {
            if (!is_string($ipRange) || !$this->isValidIpRange($ipRange)) {
                throw new InvalidArgumentException("subscriptions[{$index}]: invalid IP range '" . (is_string($ipRange) ? $ipRange : gettype($ipRange)) . "' — use x.x.x.x, x.x.x.* wildcards, x.x.x.x - y.y.y.y, or CIDR");
            }
        }

        // Contact user: the grid's SubscriberSelect always records one; the
        // spec may name it, else fall back to the site admin seeded by the
        // test bootstrap.
        $contactUsername = $spec['user'] ?? 'admin';
        $contact = Repo::user()->getByUsername($contactUsername, true);
        if (!$contact) {
            throw new InvalidArgumentException("subscriptions[{$index}].user '{$contactUsername}' not found for the institutional contact");
        }

        $institution = Repo::institution()->newDataObject([
            'contextId' => $contextId,
            'name' => [$primaryLocale => $institutionSpec['name']],
            'ipRanges' => array_map(trim(...), $ipRanges),
        ]);
        $institutionId = Repo::institution()->add($institution);

        $subscription = new InstitutionalSubscription();
        $this->hydrateSubscription($subscription, $contextId, $contact->getId(), $typeId, $dateStart, $dateEnd);
        $subscription->setInstitutionId($institutionId);
        // Blank-form parity: the grid posts empty strings for the unused
        // mailing address / domain fields (the setters are string-typed).
        $subscription->setInstitutionMailingAddress('');
        $subscription->setDomain('');

        /** @var InstitutionalSubscriptionDAO $institutionalSubscriptionDao */
        $institutionalSubscriptionDao = DAORegistry::getDAO('InstitutionalSubscriptionDAO');
        $institutionalSubscriptionDao->insertObject($subscription);

        return [
            'typeId' => $typeId,
            'subscriptionId' => $subscription->getId(),
            'institutional' => true,
            'institutionId' => $institutionId,
            'username' => $contactUsername,
            'dateStart' => $dateStart,
            'dateEnd' => $dateEnd !== null ? date('Y-m-d H:i:s', $dateEnd) : null,
        ];
    }

    /**
     * Field-for-field copy of what SubscriptionForm::execute() sets before
     * the DAO insert.
     */
    protected function hydrateSubscription(Subscription $subscription, int $contextId, int $userId, int $typeId, ?string $dateStart, ?int $dateEnd): void
    {
        $subscription->setJournalId($contextId);
        $subscription->setStatus(Subscription::SUBSCRIPTION_STATUS_ACTIVE);
        $subscription->setUserId($userId);
        $subscription->setTypeId($typeId);
        $subscription->setMembership(null);
        $subscription->setReferenceNumber(null);
        $subscription->setNotes(null);
        if ($dateStart !== null) {
            $subscription->setDateStart($dateStart);
            $subscription->setDateEnd($dateEnd);
        }
    }

    /**
     * Same IP-range grammar PKP\institution\Repository::validate() accepts
     * (single IP, wildcard, dash range, CIDR), so the seed rejects exactly
     * what the Institutions form would reject before DAO parsing.
     */
    protected function isValidIpRange(string $ipRange): bool
    {
        $octet = '([0-9]|[1-9][0-9]|[1][0-9]{2}|[2][0-4][0-9]|[2][5][0-5]|[*])';
        $strictOctet = '([0-9]|[1-9][0-9]|[1][0-9]{2}|[2][0-4][0-9]|[2][5][0-5])';
        $ip = $octet . '([.]' . $octet . '){3}';
        $strictIp = $strictOctet . '([.]' . $strictOctet . '){3}';
        $pattern = '/^((' . $ip . '((\s)*[-](\s)*' . $ip . '){0,1})|(' . $strictIp . '([\/](([3][0-2]{0,1})|([1-2]{0,1}[0-9])))))$/';
        return (bool) preg_match($pattern, trim($ipRange));
    }
}
