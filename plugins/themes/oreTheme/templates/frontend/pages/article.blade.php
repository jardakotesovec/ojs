

@include('frontend.components.header', ['pageTitleTranslated' => Str::sanitizeHtml($article->getCurrentPublication()->getLocalizedFullTitle(null, 'html'))])
<div class="page page_article">

    {{-- Show article overview --}}
    @include('frontend.objects.article_details')

</div><!-- .page -->
@include('frontend/components/footer')

