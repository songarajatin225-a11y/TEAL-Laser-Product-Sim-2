/* TEAL configurator — the V8 digital-twin simulations inside the configurator.
 *
 * Four platforms have a hand-built 3D CAD simulation from the TEAL Laser
 * Engineering OS V8 (twin/<key>.html, unpacked by tools/twin/extract.mjs).
 * For those platforms the realistic views show that simulation instead of the
 * generic cad3d.js render. The configuration is passed in the address and
 * applied by twin/embed.js pressing the simulation's own buttons.
 *
 *   mount(host, cfg)  -> { stop(), wake(), url, full }
 *   cfg = { plat, src, app, load, mods: Set, theme: 'light'|'dark', embed: true }
 */
export const TWIN = { semispm: 'semi', markc2i: 'pcb', markf: 'fiber', weldp: 'mw' };

export const TWIN_INFO = {
  semi:  { code: 'LMS-SEMI', name: 'Semiconductor laser marking system' },
  pcb:   { code: 'LMS-PCB',  name: 'Dual-head CO₂ PCB laser marker' },
  fiber: { code: 'FLM-25',   name: '25 W fiber laser marking system (XYZ)' },
  mw:    { code: 'µWELD',    name: 'Compact laser micro-welding workstation' }
};

/* the configurator's choices, in each simulation's own terms */
export function twinParams(c) {
  const k = TWIN[c.plat]; if (!k) return null;
  const has = m => !!(c.mods && c.mods.has(m)), q = {};
  if (k === 'semi') {
    q.src = ({ fiber: 'fiber', green: 'green', uv: 'uv' })[c.src] || 'fiber';
    q.cfg = has('traytwr') ? 'A' : 'B';                       /* JEDEC trays, else strips in magazines */
  } else if (k === 'pcb') {
    q.src = c.src === 'uv' ? 'uv' : 'co2';                    /* both CO₂ wavelengths run on the CO₂ head */
    q.cfg = has('conveyor') ? 'inline' : 'offline';
  } else if (k === 'fiber') {
    q.src = c.src === 'mopa' ? 'mopa' : 'qs';
    q.cfg = c.load === 'belt' ? 'inline' : (c.load === 'dial' ? 'rotary' : 'door');
    q.prod = c.app === 'anod' ? 'housing' : 'flange';
  } else if (k === 'mw') {
    q.src = c.src === 'qcw' ? 'qcw' : (has('wobble') ? 'wob' : 'cw');
    q.prod = c.app === 'seam' ? 'can' : 'tab';
  }
  if (c.theme) q.theme = c.theme;
  return { key: k, q };
}

export function twinUrl(c, embed) {
  const t = twinParams(c); if (!t) return '';
  const u = new URLSearchParams(t.q); if (embed) u.set('embed', '1');
  return 'twin/' + t.key + '.html?' + u.toString();
}

export function mount(host, c) {
  if (host.__cad && host.__cad.stop) { try { host.__cad.stop(); } catch (e) {} }
  host.innerHTML = '';
  const url = twinUrl(c, c.embed !== false), t = twinParams(c);
  if (!url) return null;
  const f = document.createElement('iframe');
  f.className = 'twinframe';
  f.src = url;
  f.title = TWIN_INFO[t.key].name + ' — 3D CAD simulation';
  f.setAttribute('allow', 'fullscreen');
  f.setAttribute('referrerpolicy', 'no-referrer');
  host.appendChild(f);
  const api = {
    url, full: twinUrl(c, false), key: t.key,
    stop() { try { f.src = 'about:blank'; f.remove(); } catch (e) {} host.__cad = null; },
    wake() {}
  };
  host.__cad = api;
  return api;
}
