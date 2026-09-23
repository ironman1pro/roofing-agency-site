// Global scripts injected into the <head> of every HTML page on the site,
// automatically — including pages added later, since this runs at request
// time in the Worker (see src/worker.js) rather than being pasted into each
// HTML file.
//
// To add a new script (Google Ads, GA4, a pixel, etc.), just add another
// entry to this array. Nothing else needs to change.
//
// Each entry is the exact <script>...</script> tag (or <script src="...">)
// as it should appear in the page.

export const GLOBAL_SCRIPTS = [
  // Snitcher — visitor identification / analytics
  `<script>
!function(e){"use strict";var t=e&&e.namespace;if(t&&e.profileId&&e.cdn){var i=window[t];if(i&&Array.isArray(i)||(i=window[t]=[]),!i.initialized&&!i._loaded)if(i._loaded)console&&console.warn("[Radar] Duplicate initialization attempted");else{i._loaded=!0;["track","page","identify","company","group","alias","ready","debug","on","off","once","trackClick","trackSubmit","trackLink","trackForm","pageview","screen","reset","register","setAnonymousId","addSourceMiddleware","addIntegrationMiddleware","addDestinationMiddleware","giveCookieConsent","denyCookieConsent"].forEach((function(e){var a;i[e]=(a=e,function(){var e=window[t];if(e.initialized)return e[a].apply(e,arguments);var i=[].slice.call(arguments);return i.unshift(a),e.push(i),e})})),-1===e.apiEndpoint.indexOf("http")&&(e.apiEndpoint="https://"+e.apiEndpoint),i.bootstrap=function(){var t,i=document.createElement("script");i.async=!0,i.type="text/javascript",i.id="__radar__",i.setAttribute("data-settings",JSON.stringify(e)),i.src=[-1!==(t=e.cdn).indexOf("http")?"":"https://",t,"/releases/latest/radar.min.js"].join("");var a=document.scripts[0];a.parentNode.insertBefore(i,a)},i.bootstrap()}}else"undefined"!=typeof console&&console.error("[Radar] Configuration incomplete")}({
  "apiEndpoint": "radar.snitcher.com",
  "cdn": "cdn.snitcher.com",
  "namespace": "Snitcher",
  "profileId": "sEb5LA6cSN"
});
</script>`,

  // Add future scripts below, e.g.:
  // `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXX"></script>`,
];
