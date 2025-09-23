@php
    // Override the $currentJournal context if desired
    if (isset($journalOverride)) {
        $currentJournal = $journalOverride;
    }

    // Determine galley type and URL op
    $type = $galley->isPdfGalley() ? 'pdf' : 'file';

    // Get path for URL
    if ($parent instanceof \APP\issue\Issue) {
        $page = 'issue';
        $parentId = $parent->getBestIssueId();
        $path = [$parentId, $galley->getBestGalleyId()];
    } else { // APP\submission\Submission
        $page = 'article';
        if (isset($publication)) {
            if ($publication->getId() !== $parent->getData('currentPublicationId')) {
                // Get a versioned link if we have an older publication
                $path = [$parent->getBestId(), 'version', $publication->getId(), $galley->getBestGalleyId()];
            } else {
                $parentId = $publication->getData('urlPath') ?? $parent->getId(); // Note: assuming $article is $parent here
                $path = [$parentId, $galley->getBestGalleyId()];
            }
        } else {
            $path = [$parent->getBestId(), $galley->getBestGalleyId()];
        }
    }

    // Get user access flag
    $restricted = false;
    if (!isset($hasAccess) || !$hasAccess) {
        if ((isset($restrictOnlyPdf) && $restrictOnlyPdf && $type === 'pdf') || !isset($restrictOnlyPdf)) {
            $restricted = true;
        }
    }
@endphp

{{-- Don't be frightened. This is just a link --}}
<a class="{{ $isSupplementary ? 'obj_galley_link_supplementary' : 'obj_galley_link' }} {{ $type }}{{ $restricted ? ' restricted' : '' }}" 
   href="@url([ 'page' => $page, 'op' => 'view', 'path' => $path ])"
   {{ isset($id) ? 'id="' . $id . '"' : '' }}
   {{ isset($labelledBy) ? 'aria-labelledby="' . $labelledBy . '"' : '' }}>
    
    {{-- Add some screen reader text to indicate if a galley is restricted --}}
    @if($restricted)
        <span class="pkp_screen_reader">
            @if(isset($purchaseArticleEnabled) && $purchaseArticleEnabled)
                {{ __('reader.subscriptionOrFeeAccess') }}
            @else
                {{ __('reader.subscriptionAccess') }}
            @endif
        </span>
    @endif
    
    {{ $galley->getGalleyLabel() }}
    
    @if($restricted && isset($purchaseFee) && isset($purchaseCurrency))
        <span class="purchase_cost">
            {{ __('reader.purchasePrice', ['price' => $purchaseFee, 'currency' => $purchaseCurrency]) }}
        </span>
    @endif
</a>