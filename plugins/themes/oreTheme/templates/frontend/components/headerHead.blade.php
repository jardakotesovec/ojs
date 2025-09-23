<head>
<meta charset="{{ $defaultCharset }}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>
        {{ strip_tags($pageTitleTranslated) }}
        {{-- Add the journal name to the end of page titles --}}
        @if (($requestedPage ?? 'index') !== 'index' && $currentContext && $currentContext->getLocalizedName())
            | {{ $currentContext->getLocalizedName() }}
        @endif
    </title>
    @loadHeader(['context' => 'frontend'])
    @loadStylesheet(['context' => 'frontend'])
</head>