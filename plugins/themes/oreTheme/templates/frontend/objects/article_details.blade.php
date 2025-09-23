<article class="obj_article_details">

{{-- Indicate if this is only a preview --}}
@if($publication->getData('status') !== \PKP\publication\PKPPublication::STATUS_PUBLISHED)
    <div class="cmp_notification notice">
        @php $submissionUrl = @url(['page' => 'dashboard', 'op' => 'editorial', 'workflowSubmissionId' => $article->getId()]); @endphp
        {{ __('submission.viewingPreview', ['url' => $submissionUrl]) }}
    </div>
    {{-- Notification that this is an old version --}}
@elseif($currentPublication->getId() !== $publication->getId())
    <div class="cmp_notification notice">
        @php $latestVersionUrl = @url(['page' => 'article', 'op' => 'view', 'path' => [$article->getBestId()]]); @endphp
        {{ __('submission.outdatedVersion', [
            'datePublished' => $publication->getData('datePublished')->translatedFormat($dateFormatShort),
            'urlRecentVersion' => $latestVersionUrl
        ]) }}
    </div>
@endif

<h1 class="page_title">
    {{ Str::sanitizeHtml($publication->getLocalizedTitle(null, 'html')) }}
</h1>

@if($publication->getLocalizedData('subtitle'))
    <h2 class="subtitle">
        {{ Str::sanitizeHtml($publication->getLocalizedSubTitle(null, 'html')) }}
    </h2>
@endif

	<div class="row">
		<div class="main_entry">
            {{-- DOI --}}
            @if(isset($doiObject))
                @php
                    $doiUrl = $doiObject->getData('resolvingUrl');
                    $translatedDOI = __('doi.readerDisplayName');
                    $doiLabel = __('semicolon', ['label' => $translatedDOI]);
                @endphp
                <section class="item doi">
                    <h2 class="label">{{ $doiLabel }}</h2>
                    <span class="value">
                        <a href="{{ $doiUrl }}">
                            {{ $doiUrl }}
                        </a>
                    </span>
                </section>
            @endif

            {{-- Keywords --}}
            @if(!empty($publication->getLocalizedData('keywords')))
                @php
                    $translatedKeywords = __('article.subject');
                    $keywordsLabel = __('semicolon', ['label' => $translatedKeywords]);
                @endphp
                <section class="item keywords">
                    <h2 class="label">{{ $keywordsLabel }}</h2>
                    <span class="value">
                        @foreach($publication->getLocalizedData('keywords') as $keyword)
                            {{ $keyword }}
                            @if(!$loop->last){{ __('common.commaListSeparator') }}@endif
                        @endforeach
                    </span>
                </section>
            @endif


            <div data-vue-root class="article-tabs">
                <pkp-tab-root default-value="article">
                    <pkp-tab-list>
                        <pkp-tab-trigger value="article">Article</pkp-tab-trigger>
                        <pkp-tab-trigger value="authors">Authors</pkp-tab-trigger>
                    </pkp-tab-list>
                    <pkp-tab-content value="article">
                        <div v-pre>
                            {{-- Abstract --}}
                            @if($publication->getLocalizedData('abstract'))
                                <section class="item abstract">
                                    <h2 class="label">{{ __('article.abstract') }}</h2>
                                    {{ Str::sanitizeHtml($publication->getLocalizedData('abstract')) }}
                                </section>
                            @endif
                            {{-- Plain language summary --}}
                            @if($publication->getLocalizedData('plainLanguageSummary'))
                                <section class="item abstract">
                                    <h2 class="label">{{ __('submission.plainLanguageSummary') }}</h2>
                                    {{ Str::sanitizeHtml($publication->getLocalizedData('plainLanguageSummary')) }}
                                </section>
                            @endif
                        </div>
                    </pkp-tab-content>
                    <pkp-tab-content value="authors">
                        <div v-pre>
                            @if($publication->getData('authors'))
                                <section class="item authors">
                                    <h2 class="pkp_screen_reader">{{ __('article.authors') }}</h2>
                                    <ul class="authors">
                                        @foreach($publication->getData('authors') as $author)
                                            <li>
                                                <span class="name">
                                                    {{ $author->getFullName() }}
                                                </span>
                                                @if(count($author->getAffiliations()) > 0)
                                                    <span class="affiliation">
                                                        @foreach($author->getAffiliations() as $affiliation)
                                                            <span>{{ $affiliation->getLocalizedName() }}</span>
                                                            @if($affiliation->getRor())
                                                                <a href="{{ $affiliation->getRor() }}">{!! $rorIdIcon !!}</a>
                                                            @endif
                                                            @if(!$loop->last)
                                                                {{ __('common.commaListSeparator') }}
                                                            @endif
                                                        @endforeach
                                                    </span>
                                                @endif
                                                @php
                                                    $authorUserGroup = $userGroupsById[$author->getData('userGroupId')] ?? null;
                                                @endphp
                                                @if($authorUserGroup && $authorUserGroup->showTitle)
                                                    <span class="userGroup">
                                                        {{ $authorUserGroup->getLocalizedData('name') }}
                                                    </span>
                                                @endif
                                                @if($author->getData('orcid'))
                                                    <span class="orcid">
                                                        @if($author->hasVerifiedOrcid())
                                                            {{ $orcidIcon }}
                                                        @else
                                                            {{ $orcidUnauthenticatedIcon }}
                                                        @endif
                                                        <a href="{{ $author->getData('orcid') }}" target="_blank">
                                                            {{ $author->getOrcidDisplayValue() }}
                                                        </a>
                                                    </span>
                                                @endif
                                                @if($author->getData('creditRoles'))
                                                    <span class="credit_roles">
                                                        @foreach($author->getData('creditRoles') as $credit)
                                                            <span class="value">
                                                                {{ $creditRoleTerms['roles'][$credit['role']] ?? '' }}
                                                                @if(isset($creditRoleTerms['degrees'][$credit['degree']]))
                                                                    &nbsp;({{ $creditRoleTerms['degrees'][$credit['degree']] }})
                                                                @endif
                                                            </span>
                                                            @if(!$loop->last)
                                                                {{ __('common.commaListSeparator') }}
                                                            @endif
                                                        @endforeach
                                                    </span>
                                                @endif
                                            </li>
                                        @endforeach
                                    </ul>
                                </section>
                            @endif
                        </div>
                    </pkp-tab-content>
                </pkp-tab-root>
            </div>

            @if ($enablePublicComments)
                <section class="item comments" data-vue-root>
                    <h2 class="label">
                        {{ __('userComment.commentsOnThisPublication') }}
                    </h2>
                    <pkp-comments v-bind="{{ json_encode($userCommentsInitConfig) }}"></pkp-comments>
                </section>
            @endif        
        </div>
        <div class="entry_details">
            {!! $publication->getLocalizedData('coverImage') || ($issue && $issue->getLocalizedCoverImage()) ? '<div class="item cover_image"><div class="sub_item">' : '' !!}
            @if ($publication->getLocalizedData('coverImage'))
            @php $coverImage = $publication->getLocalizedData('coverImage'); @endphp
            <img
                src="{{ $publication->getLocalizedCoverImageUrl($article->getData('contextId')) }}"
                alt="{{ $coverImage->altText ?? '' }}"
            >
            @else
            <a href="@url(['page' => 'issue', 'op' => 'view', 'path' => $issue->getBestIssueId()])">
                <img src="{{ $issue->getLocalizedCoverImageUrl() }}" alt="{{ $issue->getLocalizedCoverImageAltText() ?? '' }}">
            </a>
            @endif
            {!! $publication->getLocalizedData('coverImage') || ($issue && $issue->getLocalizedCoverImage()) ? '</div></div>' : '' !!}
            @if ($primaryGalleys)
            <div class="item galleys">
                <h2 class="pkp_screen_reader">
                    {{ __('submission.downloads') }}
                </h2>
                <ul class="value galleys_links">
                    @foreach ($primaryGalleys as $galley)
                        <li>
                            @include('frontend.components.galley_link', [
                                'parent' => $article,
                                'publication' => $publication,
                                'galley' => $galley,
                                'purchaseFee' => $currentJournal->getData('purchaseArticleFee'),
                                'purchaseCurrency' => $currentJournal->getData('currency')
                            ])
                        </li>
                    @endforeach
                </ul>
            </div>
            @endif
            @if ($supplementaryGalleys)
            <div class="item galleys">
                <h3 class="pkp_screen_reader">
                    {{ __('submission.additionalFiles') }}
                </h3>
                <ul class="value supplementary_galleys_links">
                    @foreach ($supplementaryGalleys as $galley)
                        <li>
                            @include('frontend.objects.galley_link', [
                                'parent' => $article,
                                'publication' => $publication,
                                'galley' => $galley,
                                'isSupplementary' => true
                            ])
                        </li>
                    @endforeach
                </ul>
            </div>
            @endif
            @if ($publication->getData('datePublished'))
            <div class="item published">
                <section class="sub_item">
                    <h2 class="label">
                        {{ __('submissions.published') }}
                    </h2>
                    <div class="value">
                        @if ($firstPublication->getId() === $publication->getId())
                            <span>{{ $firstPublication->getData('datePublished') }}</span>
                        @else
                            <span>{{ __('submission.updatedOn', [
                                'datePublished' => $firstPublication->getData('datePublished'),
                                'dateUpdated' => $publication->getData('datePublished')
                            ]) }}</span>
                        @endif
                    </div>
                </section>
                <section class="sub_item versions">
                    <h2 class="label">
                        {{ __('submission.versions') }}
                    </h2>
                    <ul class="value">
                        @foreach (array_reverse($article->getPublishedPublications()) as $iPublication)
                            @php
                                $name = __('submission.versionIdentity', [
                                    'datePublished' => $iPublication->getData('datePublished'),
                                    'version' => $iPublication->getData('versionString')
                                ]);
                            @endphp
                            <li>
                                @if ($iPublication->getId() === $publication->getId())
                                    {{ $name }}
                                @elseif ($iPublication->getId() === $currentPublication->getId())
                                    <a href="(['page' => 'article', 'op' => 'view', 'path' => $article->getBestId()])">{{ $name }}</a>
                                @else
                                    <a href="@url(['page' => 'article', 'op' => 'view', 'path' => array_merge([$article->getBestId()], ['version' => $iPublication->getId()])])">{{ $name }}</a>
                                @endif
                            </li>
                        @endforeach
                    </ul>
                </section>
            </div>
            @endif
        </div>
    </div>
</artcle>