</div><!-- pkp_structure_main -->

{{-- Sidebars --}}
@if (empty($isFullWidth))
    @php
        ob_start();
        \PKP\template\PKPTemplateManager::getManager()->smartyCallHook(['name' => 'Templates::Common::Sidebar']);
        $sidebarCode = ob_get_clean();
    @endphp
    @if ($sidebarCode)
        <div class="pkp_structure_sidebar left" role="complementary">
            {!! $sidebarCode !!}
        </div><!-- pkp_sidebar.left -->
    @endif
@endif

</div><!-- pkp_structure_content -->

<div class="pkp_structure_footer_wrapper" role="contentinfo">
    <a id="pkp_content_footer"></a>
    <div class="pkp_structure_footer">
        @if ($pageFooter)
            <div class="pkp_footer_content">
                {!! $pageFooter !!}
            </div>
        @endif
        <div class="pkp_brand_footer">
            <a href="@url(['page' => 'about', 'op' => 'aboutThisPublishingSystem'])">
                <img alt="{{ __('about.aboutThisPublishingSystem') }}" src="{{ $baseUrl }}/{{ $brandImage }}">
            </a>
        </div>
    </div>
</div><!-- pkp_structure_footer_wrapper -->

</div><!-- pkp_structure_page -->

@loadScript(['context' => 'frontend'])

@callHook(['name' => 'Templates::Common::Footer::PageFooter'])

</body>
</html>