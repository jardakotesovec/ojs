@php
    $showingLogo = true;
    if (!$displayPageHeaderLogo) {
        $showingLogo = false;
    }
@endphp

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', $currentLocale) }}" xml:lang="{{ str_replace('_', '-', $currentLocale) }}">

@if (!$pageTitleTranslated)
    @php $pageTitleTranslated = __($pageTitle); @endphp
@endif

@include('frontend.components.headerHead')

<body class="pkp_page_{{ $requestedPage ?? 'index' }} pkp_op_{{ $requestedOp ?? 'index' }}{{ $showingLogo ? ' has_site_logo' : '' }}" dir="{{ $currentLocaleLangDir ?? 'ltr' }}">

<div class="pkp_structure_page">

{{-- Header --}}
<header class="pkp_structure_head" id="headerNavigationContainer" role="banner">

{{-- Skip to content nav links --}}
@include('frontend.components.skipLinks')

<div class="pkp_head_wrapper">

<div class="pkp_site_name_wrapper">

<button class="pkp_site_nav_toggle">
    <span>Open Menu</span>
</button>

@if (!$requestedPage || $requestedPage === 'index')
    <h1 class="pkp_screen_reader">
        @if ($currentContext)
            {{ $displayPageHeaderTitle }}
        @else
            {{ $siteTitle }}
        @endif
    </h1>
@endif

<div class="pkp_site_name">

@php
    $homeUrl = \PKP\template\PKPTemplateManager::getManager()->smartyUrl(['page' => 'index', 'router' => \PKP\core\PKPApplication::ROUTE_PAGE]);
@endphp

@if ($displayPageHeaderLogo)
    <a href="{{ $homeUrl }}" class="is_img">
        <img src="{{ $publicFilesDir }}/{{ $displayPageHeaderLogo['uploadName'] }}" width="{{ $displayPageHeaderLogo['width'] }}" height="{{ $displayPageHeaderLogo['height'] }}" @if ($displayPageHeaderLogo['altText'])alt="{{ $displayPageHeaderLogo['altText'] }}" @endif />
    </a>
@elseif ($displayPageHeaderTitle)
    <a href="{{ $homeUrl }}" class="is_text">{{ $displayPageHeaderTitle }}</a>
@else
    <a href="{{ $homeUrl }}" class="is_img">
        <img src="{{ $baseUrl }}/templates/images/structure/logo.png" alt="{{ $applicationName }}" title="{{ $applicationName }}" width="180" height="90" />
    </a>
@endif

</div>

</div>


<nav class="pkp_site_nav_menu" aria-label="{{ __('common.navigation.site') }}">

<a id="siteNav"></a>

<div class="pkp_navigation_primary_row">

<div class="pkp_navigation_primary_wrapper">

{{-- Primary navigation menu for current application --}}
@loadMenu(['name' => 'primary', 'id' => 'navigationPrimary', 'ulClass' => 'pkp_navigation_primary'])

{{-- Search form --}}
@if ($currentContext && $requestedPage !== 'search')
<div class="pkp_navigation_search_wrapper">
    <a href="@url(['page' => 'search'])" class="pkp_search pkp_search_desktop">
        <span class="fa fa-search" aria-hidden="true"></span>
        {{ __('common.search') }}
    </a>
</div>
@endif

</div>

</div>

<div class="pkp_navigation_user_wrapper" id="navigationUserWrapper">
    @loadMenu(['name' => 'user', 'id' => 'navigationUser', 'ulClass' => 'pkp_navigation_user', 'liClass' => 'profile'])
</div>

</nav>

</div><!-- .pkp_head_wrapper -->

</header><!-- .pkp_structure_head -->

{{-- Wrapper for page content and sidebars --}}
@if ($isFullWidth)
    @php $hasSidebar = 0; @endphp
@endif

<div class="pkp_structure_content{!! isset($hasSidebar) && $hasSidebar ? ' has_sidebar' : '' !!}">

<div class="pkp_structure_main" role="main">

<a id="pkp_content_main"></a>