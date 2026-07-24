(function LoadLocalWebGazerFallback() {
  'use strict';

  if (window.webgazer) return;

  var loader = document.currentScript;
  var fallbackUrl = loader && loader.getAttribute('data-fallback-src');
  if (!fallbackUrl) return;

  var escapedFallbackUrl = fallbackUrl
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  document.write('<script src="' + escapedFallbackUrl + '"><\/script>');
})();
