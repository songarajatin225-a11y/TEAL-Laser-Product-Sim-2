#!/usr/bin/env node
/* TEAL configurator — end-to-end checks in a real browser.
 *
 *   npm test            # validator, then this suite
 *   node tests/e2e.mjs  # this suite alone
 *
 * Serves the repository itself on a free local port — no build, no config — and
 * drives index.html in headless Chromium. Each check names the behaviour it
 * protects. Exits 1 if any check fails.
 *
 * Needs Playwright: `npm install` then `npx playwright install chromium`. A
 * globally installed Playwright is used if the local one is absent.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }

const ROOT = normalize(join(new URL('.', import.meta.url).pathname, '..'));
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript',
               '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'));
  if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(p); res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }).end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;
const C2I = '#p=markc2i&a=dual&s=co2&w=30&l=f254';   // the worked example the README documents

const results = [];
let section = '';
const sec = s => { section = s; };
const check = (name, ok, detail = '') => results.push({ section, name, ok: !!ok, detail: String(detail) });

const browser = await pw.chromium.launch();
async function open(hash = '', opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, ...opts });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'teal2026' : ''));   // the value store is PIN-gated
  await page.addInitScript(() => { try { localStorage.setItem('teal.seenAdvisor', 'true'); } catch (e) {} });
  await page.goto(BASE + hash, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof BOOTED !== 'undefined' && BOOTED && window.M3D && M3D.vp);
  return page;
}

try {
  /* ------------------------------------------------------------------ */
  sec('Baseline');
  let pg = await open();
  check('page boots without script errors', pg.errors.length === 0, pg.errors.join(' | '));
  const drift = await pg.evaluate(async () => {
    const live = await (await fetch('data.json', { cache: 'no-store' })).json();
    return ['SRC','LENS','MAT','IND','STD','LEX','FAM','PLAT','MOD','SW','EXTRA','MODFIT','RECO','RULES']
      .filter(t => JSON.stringify(DEFAULTS[t]) !== JSON.stringify(live[t]));
  });
  check('embedded defaults match data.json (file:// and hosted show the same catalogue)', drift.length === 0, drift.join(', '));
  const nav = await pg.$$eval('#hnav button', b => b.map(x => x.textContent.trim()));
  check('header carries Configurator / Portfolio / Applications / Engineering', nav.join('/') === 'Configurator/Portfolio/Applications/Engineering', nav.join('/'));
  await pg.click('#hInq'); await pg.waitForTimeout(350);
  check('header enquiry with no configuration leads to the advisor, not a dead end', await pg.$eval('#advisor', e => e.classList.contains('open')));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
  await pg.goto(BASE + C2I, { waitUntil: 'networkidle' }); await pg.waitForFunction(() => typeof BOOTED !== 'undefined' && BOOTED);
  for (const [btn, dlg] of [['#openAdvisor', '#advisor'], ['#openSaved', '#drawer'], ['#hInq', '#inquiry'], ['#hVal', '#admin']]) {
    await pg.click(btn); await pg.waitForTimeout(350);
    check(`${btn} opens ${dlg}`, await pg.$eval(dlg, e => e.classList.contains('open')));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
    await pg.evaluate(() => { if (window.adminOpen) closeAdmin(); });
  }
  await pg.close();

  /* ------------------------------------------------------------------ */
  sec('Configuration and pricing');
  pg = await open(C2I);
  const cfg = await pg.evaluate(() => ({ d: desig(), o: !!optics(), ph: !!physics(), p: price(),
                                         band: document.getElementById('bv').textContent.trim() }));
  check('shared link restores the configuration', /^TEAL-PCB-C2i/.test(cfg.d), cfg.d);
  check('optics and process physics compute', cfg.o && cfg.ph);
  check('budget band renders', /₹/.test(cfg.band), cfg.band);
  const recon = await pg.evaluate(() => {
    const keep = JSON.stringify(S); let n = 0, worst = 0, colBad = 0;
    for (const pk of Object.keys(PLAT)) { const pl = PLAT[pk];
      for (const src of pl.src) for (const pw of powersFor(pl, src)) for (const lens of Object.keys(LENS)) {
        S.plat = pk; S.app = Object.keys(pl.apps)[0]; S.src = src; S.pw = pw; S.lens = lens;
        S.mods = {}; Object.keys(MOD).forEach((m, i) => { if ((i + n) % 3 === 0) S.mods[m] = true; });
        S.extra = {}; Object.keys(EXTRA).forEach((m, i) => { if ((i + n) % 2 === 0) S.extra[m] = true; });
        const r = priceLines(), sum = r.lines.reduce((t, l) => t + l.ext, 0), B = bomRows();
        worst = Math.max(worst, Math.abs(sum - r.total), Math.abs(price() - r.total));
        if (B.rows.reduce((t, x) => t + x.v, 0) !== B.total) colBad++;
        n++;
      } }
    Object.assign(S, JSON.parse(keep)); return { n, worst, colBad };
  });
  check(`BOM lines reconcile to price() across ${recon.n} configurations`, recon.worst < 1e-6, `max error ${recon.worst}`);
  check('displayed BOM column sums exactly to the displayed total', recon.colBad === 0, `${recon.colBad} mismatches`);
  await pg.evaluate(() => go(5)); await pg.waitForTimeout(500);
  check('specification step shows the commercial breakdown', await pg.$('.bomtab tbody tr') !== null);
  check('every BOM line that carries a price is labelled Estimate', await pg.evaluate(() => {
    const B = bomRows(); return B.rows.filter(x => x.l.ext !== 0).every(x => x.l.basis === 'estimate'); }));
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#bomx')]);
  check('BOM exports as CSV', /^TEAL-BOM-.*\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const sum = await pg.evaluate(() => simSummaryText());
  check('simulation summary reports an un-run cycle as NOT RUN', sum.includes('NOT RUN'));
  check('simulation summary states it is not a quotation', /not a quotation/i.test(sum));

  sec('Fit and considerations');
  const fit = await pg.evaluate(() => ({ sc: document.getElementById('fitsc').textContent, n: document.querySelectorAll('#fitrows .fitrow').length,
    thr: [...document.querySelectorAll('#fitrows .fs')].pop().textContent }));
  check('indicative fit renders five dimensions', fit.n === 5, fit.sc);
  check('throughput is "Not available" until a cycle is run', fit.thr === 'Not available', fit.thr);
  const cons = await pg.evaluate(() => { const c = MODCONFLICT.find(x => modFits(P(), x[0]) && modFits(P(), x[1]));
    S.mods[c[0]] = S.mods[c[1]] = true; render();
    const ok = !!document.querySelector('.econs') && !/invalid/i.test(document.querySelector('.econs').textContent);
    delete S.mods[c[0]]; delete S.mods[c[1]]; render(); return ok; });
  check('a module conflict raises an engineering consideration (never "invalid")', cons);
  await pg.evaluate(() => go(3)); await pg.waitForTimeout(300);
  const std = await pg.$$eval('.pgrid .pcell', e => e.filter(x => x.offsetParent).length);
  await pg.click('#vmEng'); await pg.waitForTimeout(300);
  const eng = await pg.$$eval('.pgrid .pcell', e => e.filter(x => x.offsetParent).length);
  check('engineering view reveals more computed data than standard', eng > std, `${std} → ${eng}`);
  await pg.click('#vmStd');
  await pg.close();

  /* ------------------------------------------------------------------ */
  sec('3D machine view');
  pg = await open(C2I);
  await pg.evaluate(() => { reach = 5; go(5); M3D.vp.spin = false; }); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('#v3dctl button')].find(x => /layer/i.test(x.title || x.getAttribute('aria-label') || '')); b && b.click(); });
  await pg.waitForTimeout(300);
  const modes = await pg.evaluate(() => { const pn = document.getElementById('v3dlay').getBoundingClientRect();
    return [...document.querySelectorAll('#v3dlay .vmode button')].map(b => { const r = b.getBoundingClientRect();
      return { t: b.textContent, inside: r.left >= pn.left - 1 && r.right <= pn.right + 1 }; }); });
  check('all four view modes are reachable inside the layer panel', modes.length === 4 && modes.every(m => m.inside), modes.map(m => m.t + (m.inside ? '' : '(clipped)')).join(' '));
  const geo = await pg.evaluate(() => {
    const build = () => { const b = new B3(); b.q = 1; b.lod = 1; mmBuild(b, M3D.vp.T, null); return b; };
    const minY = id => { let m = 1e9; build().f.forEach(f => { if (f.gid === id && !f.kind) f.v.forEach(v => { m = Math.min(m, v[1]); }); }); return m; };
    M3D.vmode = 'solid'; M3D.expA = 0; const a = minY('frame'); const solid = build().f.map(f => JSON.stringify(f.v));
    M3D.vmode = 'xray'; const x = minY('frame');
    M3D.vmode = 'exploded'; M3D.expA = 1; const ex = build(); const moved = ex.f.filter(f => f.gid === 'optic' && !f.kind).length;
    M3D.vmode = 'solid'; M3D.expA = 0; const back = build().f.map(f => JSON.stringify(f.v));
    return { solidY: a, xrayY: x, moved, same: solid.length === back.length && solid.every((v, i) => v === back[i]) };
  });
  check('X-ray mode leaves the frame on the floor', Math.abs(geo.xrayY - geo.solidY) < 1e-9, `${geo.solidY} vs ${geo.xrayY}`);
  check('exploded view returns every vertex exactly to its assembled position', geo.same);
  const pick = await pg.evaluate(() => { const vp = M3D.vp, r = vp.cv.getBoundingClientRect(), f = vp._pick.find(x => x.f.gid === 'optic') || vp._pick[0];
    const c = f.s.reduce((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]).map(v => v / f.s.length); return { x: r.left + c[0], y: r.top + c[1] }; });
  await pg.mouse.click(pick.x, pick.y); await pg.waitForTimeout(300);
  check('clicking an assembly opens its detail panel with Focus and Isolate', (await pg.$$('#v3dinfo .iact button')).length === 2);
  await pg.click('#v3dinfo [data-a="iso"]'); await pg.waitForTimeout(300);
  const iso = await pg.evaluate(() => ({ iso: M3D.iso, others: Math.max(...M3D.faces.filter(f => f.gid && f.gid !== M3D.iso && f.gid !== 'site' && !f.kind).map(f => f.a)),
                                         pickable: [...new Set(M3D.vp._pick.map(x => x.f.gid))] }));
  check('isolation ghosts every other assembly and limits picking to the isolated one', iso.others < 0.1 && iso.pickable.join() === iso.iso, JSON.stringify(iso));
  const d0 = await pg.evaluate(() => M3D.vp.cam.dist);
  await pg.click('#v3dinfo [data-a="focus"]'); await pg.waitForTimeout(900);
  check('focus flies the camera to the component and claims it from auto-framing', await pg.evaluate(d => !M3D.vp.fly && M3D.vp.touched && Math.abs(M3D.vp.cam.dist - d) > 1, d0));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  check('Esc leaves isolation', await pg.evaluate(() => M3D.iso === null));
  const hc = await pg.evaluate(() => { M3D.vmode = 'exploded'; M3D.expA = 0.4; isoSet('optic');
    const before = JSON.stringify([M3D.vmode, M3D.expA, M3D.iso, S, cur]);
    const box = document.createElement('div'); aHealth(box);
    const fails = [...box.querySelectorAll('*')].filter(e => /3D build failed/.test(e.textContent)).length;
    const same = before === JSON.stringify([M3D.vmode, M3D.expA, M3D.iso, S, cur]);
    M3D.vmode = 'solid'; isoSet(null); return { fails, same }; });
  check('health check builds every platform in every view mode without failure', hc.fails === 0, `${hc.fails} failures`);
  check('health check leaves the live view state untouched', hc.same);
  check('no script errors in the 3D checks', pg.errors.length === 0, pg.errors.join(' | '));
  await pg.close();
  pg = await open(C2I, { deviceScaleFactor: 2 });               // a retina panel, where downshifting matters
  const dpr = await pg.evaluate(() => { const vp = M3D.vp; vp._warm = 1e9; vp.dprCap = 1.25; vp.resize(); vp.resize(); return [vp.dprMax, vp.dpr]; });
  check('an adaptive resolution downshift survives resize()', dpr[0] === 2 && dpr[1] === 1.25, dpr.join(' → '));
  await pg.close();

  /* ------------------------------------------------------------------ */
  sec('Simulation and presentation');
  pg = await open('#p=markf&a=metal&s=mopa&w=50&l=f420');
  await pg.evaluate(() => { reach = 5; go(5); SIM.rate = 8; simStart(); });
  await pg.waitForFunction(() => SIM.cyc >= 1, null, { timeout: 30000 });
  const run = await pg.evaluate(() => ({ phases: SIM.phases.map(p => p.n), stats: document.getElementById('simstats').textContent }));
  check('the cycle runs through its phases', run.phases.length >= 3, run.phases.join(' → '));
  check('telemetry classifies the result', /Result(Optimal|Within target|Attention|Outside target|Requires validation)/.test(run.stats));
  await pg.evaluate(() => simStop());
  check('a completed cycle makes throughput derivable', await pg.evaluate(() => [...document.querySelectorAll('#fitrows .fs')].pop().textContent !== 'Not available'));
  await pg.evaluate(() => { S.lens = Object.keys(LENS).find(k => k !== S.lens); render(); });
  check('changing the configuration retires the old cycle result', await pg.evaluate(() => [...document.querySelectorAll('#fitrows .fs')].pop().textContent === 'Not available'));

  await pg.evaluate(() => { S.mods.rotary = true; reach = 5; go(4); M3D.vmode = 'xray'; buildLayerPanel(); });
  const before = await pg.evaluate(() => JSON.stringify({ S, cur, reach, famSel, vm: M3D.vmode, h: localStorage.getItem('teal.hist') }));
  await pg.keyboard.press('Shift+D'); await pg.waitForTimeout(200);
  await pg.click('#demoPlay'); await pg.waitForTimeout(300);
  await pg.click('#demoNext'); await pg.click('#demoNext'); await pg.click('#demoPrev');
  const det = await pg.evaluate(() => { demoScene(5); const a = JSON.stringify([S, cur, M3D.vmode]); demoScene(0); demoScene(7); demoScene(5);
    return a === JSON.stringify([S, cur, M3D.vmode]); });
  check('a presentation scene is the same however it is reached', det);
  const seeded = await pg.evaluate(() => { demoScene(4);
    const std = (PLAT[DEMOCFG.plat].std || []).every(m => S.mods[m]);
    return std && S.sw === 'inline' && hasMod('visfid'); });
  check('presentation picks the platform as a card click does: standard content and edition seeded', seeded);
  await pg.evaluate(() => demoScene(7));
  await pg.click('#demoEnd'); await pg.waitForTimeout(500);
  const after = await pg.evaluate(() => JSON.stringify({ S, cur, reach, famSel, vm: M3D.vmode, h: localStorage.getItem('teal.hist') }));
  check('leaving the presentation restores the configuration exactly and writes no History', before === after);
  check('no script errors in simulation or presentation', pg.errors.length === 0, pg.errors.join(' | '));
  await pg.close();

  /* ------------------------------------------------------------------ */
  sec('Layout and accessibility');
  pg = await open(C2I);
  const bad = [];
  for (let w = 360; w <= 1900; w += 40) {
    await pg.setViewportSize({ width: w, height: 900 }); await pg.waitForTimeout(40);
    const m = await pg.evaluate(() => { const k = [...document.querySelector('header .wrap').children].filter(x => getComputedStyle(x).display !== 'none');
      let ov = 0; for (let i = 0; i < k.length - 1; i++) ov = Math.max(ov, k[i].getBoundingClientRect().right - k[i + 1].getBoundingClientRect().left);
      return { ov, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    if (m.ov > 0.5 || m.doc > 1) bad.push(`${w}px`);
  }
  check('header never overlaps and the page never scrolls sideways, 360–1900 px', bad.length === 0, bad.join(' '));
  await pg.setViewportSize({ width: 1600, height: 1000 });
  const unnamed = await pg.$$eval('header button, #dmode button, #demobar button, #v3dctl button',
    e => e.filter(x => !x.textContent.trim() && !x.getAttribute('aria-label') && !x.title).length);
  check('every control in the chrome has an accessible name', unnamed === 0, `${unnamed} unnamed`);
  await pg.close();
} finally {
  await browser.close();
  server.close();
}

let last = '';
for (const r of results) {
  if (r.section !== last) { console.log(`\n${r.section}`); last = r.section; }
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail && !r.ok ? '  — ' + r.detail : ''}`);
}
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
