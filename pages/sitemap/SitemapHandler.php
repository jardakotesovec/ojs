<?php

/**
 * @file pages/sitemap/SitemapHandler.php
 *
 * Copyright (c) 2014-2021 Simon Fraser University
 * Copyright (c) 2003-2021 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SitemapHandler
 *
 * @ingroup pages_sitemap
 *
 * @brief Produce a sitemap in XML format for submitting to search engines.
 */

namespace APP\pages\sitemap;

use APP\facades\Repo;
use APP\issue\Collector;
use APP\submission\Submission;
use PKP\pages\sitemap\PKPSitemapHandler;
use PKP\plugins\Hook;

class SitemapHandler extends PKPSitemapHandler
{
    /**
     * @copydoc PKPSitemapHandler_createContextSitemap()
     *
     * @hook SitemapHandler::createJournalSitemap [[&$doc]]
     */
    public function _createContextSitemap($request)
    {
        $doc = parent::_createContextSitemap($request);
        $root = $doc->documentElement;

        $journal = $request->getJournal();
        $journalId = $journal->getId();

        // Search
        $root->appendChild($this->_createUrlTree($doc, $request->url($journal->getPath(), 'search')));
        // Issues
        if ($journal->getData('publishingMode') != \APP\journal\Journal::PUBLISHING_MODE_NONE) {
            $root->appendChild($this->_createUrlTree($doc, $request->url($journal->getPath(), 'issue', 'current')));
            $root->appendChild($this->_createUrlTree($doc, $request->url($journal->getPath(), 'issue', 'archive')));
            $publishedIssues = Repo::issue()->getCollector()
                ->filterByContextIds([$journalId])
                ->filterByPublished(true)
                ->orderBy(Collector::ORDERBY_PUBLISHED_ISSUES)
                ->getMany();
            foreach ($publishedIssues as $issue) {
                $root->appendChild($this->_createUrlTree($doc, $request->url($journal->getPath(), 'issue', 'view', [$issue->getId()])));
                // Articles for issue
                // Published submissions assigned to this issue. NOT
                // filterByLatestPublished(true): that flag is the
                // continuous-publication filter (current publication
                // issueless or attached to an UNpublished issue —
                // classes/submission/Collector.php), which contradicts
                // filterByIssueIds() on a published issue and yields an
                // empty set, dropping every article/galley URL from the
                // sitemap (regression in da7c68874e / pkp/pkp-lib#12245).
                $submissions = Repo::submission()
                    ->getCollector()
                    ->filterByContextIds([$journal->getId()])
                    ->filterByIssueIds([$issue->getId()])
                    ->filterByStatus([Submission::STATUS_PUBLISHED])
                    ->getMany();

                foreach ($submissions as $submission) {
                    // Abstract
                    $root->appendChild($this->_createUrlTree($doc, $request->url($journal->getPath(), 'article', 'view', [$submission->getBestId()])));
                    // Galley files
                    $galleys = Repo::galley()
                        ->getCollector()
                        ->filterByPublicationIds([($submission->getCurrentPublication()->getId())])
                        ->getMany();

                    foreach ($galleys as $galley) {
                        $root->appendChild($this->_createUrlTree($doc, $request->url($journal->getPath(), 'article', 'view', [$submission->getBestId(), $galley->getBestGalleyId()])));
                    }
                }
            }
        }

        $doc->appendChild($root);

        // Enable plugins to change the sitemap
        Hook::call('SitemapHandler::createJournalSitemap', [&$doc]);

        return $doc;
    }
}
