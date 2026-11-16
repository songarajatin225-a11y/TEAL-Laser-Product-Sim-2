/* Theme before first paint, so a dark-theme visitor never sees a white flash.
   "system" follows the operating system; the choice is kept in this browser. */
(function(){
  var t='system';
  try{ var v=JSON.parse(localStorage.getItem('teal.theme')); if(v==='light'||v==='dark') t=v; }catch(e){}
  var dark = t==='dark' || (t==='system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme-pref', t);
})();
/* Access before first paint: the page stays covered until a passkey is accepted.
   A session that already holds a token shows a plain cover while it is checked,
   rather than flashing the passkey form. */
(function(){
  var r=document.documentElement; r.classList.add('locked');
  try{ if(sessionStorage.getItem('teal.access')||localStorage.getItem('teal.access')) r.classList.add('unlocking'); }catch(e){}
})();
