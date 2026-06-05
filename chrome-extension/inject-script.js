/* Leadvault — MAIN-world injector
   Runs at document_start in the ISOLATED world.
   Injects injected.js as a <script> tag so it runs in the MAIN world (page context)
   and can patch window.fetch / XMLHttpRequest before LinkedIn's own scripts execute.
   The window.__lv_injected guard in injected.js prevents double-patching when
   the manifest's world:"MAIN" content_script also fires. */
(function () {
  if (document.getElementById('__lv_inject')) return;
  const s = document.createElement('script');
  s.id  = '__lv_inject';
  s.src = chrome.runtime.getURL('injected.js');
  (document.head || document.documentElement).appendChild(s);
})();
