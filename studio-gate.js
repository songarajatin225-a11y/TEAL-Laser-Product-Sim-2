/* TEAL Engineering Studio — opens only for a session that holds the internal passkey.
 * The configurator (index.html) asks for the passkey and keeps the derived key for the
 * session; this checks it against access.json, as the configurator does. Like the
 * configurator's gate, this keeps casual visitors out and is not a security boundary:
 * the files are public. Nothing confidential belongs on this page (see SECURITY.md). */
(function(){
  var root = document.documentElement; root.classList.add('locked');
  function hex(buf){ var a = new Uint8Array(buf), h = '', i; for (i = 0; i < a.length; i++) h += (a[i] < 16 ? '0' : '') + a[i].toString(16); return h; }
  function bytes(h){ var a = new Uint8Array(h.length / 2), i; for (i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  function deny(){
    var m = document.getElementById('gatemsg'); if (m) m.hidden = false;
    root.classList.add('denied');
  }
  var t = null;
  try { t = JSON.parse(sessionStorage.getItem('teal.access') || localStorage.getItem('teal.access') || 'null'); } catch (e) {}
  if (!t || t.r !== 'internal' || !/^[0-9a-f]{64}$/.test(t.k || '') || !(window.crypto && crypto.subtle)) { document.addEventListener('DOMContentLoaded', deny); return; }
  Promise.all([fetch('access.json', { cache: 'no-cache' }).then(function(r){ return r.json(); }), crypto.subtle.digest('SHA-256', bytes(t.k))])
    .then(function(a){
      if (a[0] && a[0].internal && a[0].internal.v === hex(a[1])) { root.classList.remove('locked'); root.classList.add('unlocked'); document.dispatchEvent(new Event('teal-unlocked')); }
      else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', deny); else deny();
    }).catch(function(){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', deny); else deny(); });
})();
