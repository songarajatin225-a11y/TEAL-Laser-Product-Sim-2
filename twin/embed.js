/* TEAL configurator: settings for a V8 simulation passed in the address.
 *   ?embed=1          viewport only (see embed.css)
 *   ?src=<key>        laser source, as the page's own Laser buttons
 *   ?cfg=<A|B>        process point / handling, as the page's own buttons
 *   ?prod=<key>       product, as the page's own buttons
 *   ?theme=light|dark
 * Each setting presses the same button a user would, so the simulation's own
 * code does the work. Unknown values are ignored. */
(function(){
  var q = new URLSearchParams(location.search), root = document.documentElement;
  if (q.get('embed') === '1') root.classList.add('embed');
  var th = q.get('theme'); if (th === 'light' || th === 'dark') root.setAttribute('data-theme', th);
  function press(sel){ var b = document.querySelector(sel); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); }
  function ok(v){ return v && /^[A-Za-z0-9_-]{1,24}$/.test(v); }
  var t0 = Date.now();
  (function wait(){
    var s = window.__sim;
    if (!(s && s.steps)) { if (Date.now() - t0 < 20000) setTimeout(wait, 100); return; }
    if (ok(q.get('cfg'))) press('[data-cfg-btn="' + q.get('cfg') + '"]');
    if (ok(q.get('prod'))) press('[data-prod="' + q.get('prod') + '"]');
    if (ok(q.get('src'))) press('[data-src="' + q.get('src') + '"]');
    if (root.classList.contains('embed')) {
      /* the floating review toolbar and the V5 / V6 launchers belong to the full page */
      document.querySelectorAll('#view > div, #view > button').forEach(function(e){
        var st = e.getAttribute('style') || '';
        if (e.tagName === 'BUTTON' || /bottom:\s*70px/.test(st)) e.classList.add('twin-hide');
      });
      var lab = document.getElementById('t-labels'); if (lab && lab.checked) lab.click();
      var fov = document.getElementById('t-fov'); if (fov && fov.checked) fov.click();
      window.dispatchEvent(new Event('resize'));
    }
    root.setAttribute('data-twin-ready', '1');
  })();
})();
