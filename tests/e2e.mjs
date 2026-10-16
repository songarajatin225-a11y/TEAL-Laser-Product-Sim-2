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
               '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
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
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Test configuration' : ''));   // name prompts and confirmations
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
  const hdr = await pg.evaluate(() => ({
    views: [...document.querySelectorAll('#vsw [role=radio]')].map(b => b.textContent.trim() + (b.getAttribute('aria-checked') === 'true' ? '*' : '')).join('/'),
    themes: [...document.querySelectorAll('#tsw [role=radio]')].map(b => b.getAttribute('data-theme')).join('/'),
    val: getComputedStyle(document.querySelector('#hVal')).display, fab: getComputedStyle(document.querySelector('#adminBtn')).display }));
  check('header carries the Customer / Internal and Light / Dark / System switches, Customer by default', hdr.views === 'Customer*/Internal' && hdr.themes === 'light/dark/system', JSON.stringify(hdr));
  check('the value store is not offered in the Customer view', hdr.val === 'none' && hdr.fab === 'none', JSON.stringify(hdr));
  await pg.click('#hInq'); await pg.waitForTimeout(350);
  check('header enquiry with no configuration leads to the advisor, not a dead end', await pg.$eval('#advisor', e => e.classList.contains('open')));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
  await pg.goto(BASE + C2I, { waitUntil: 'networkidle' }); await pg.waitForFunction(() => typeof BOOTED !== 'undefined' && BOOTED);
  for (const [btn, dlg] of [['#openAdvisor', '#advisor'], ['#openSaved', '#drawer'], ['#hInq', '#inquiry'], ['#hVal', '#admin']]) {
    if (btn === '#hVal') { await pg.evaluate(() => viewSet('internal', 'cfg')); await pg.waitForTimeout(200); }
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
  check('clicking an assembly opens its detail panel with Focus and Isolate',
    (await pg.$$('#v3dinfo [data-a="focus"]')).length === 1 && (await pg.$$('#v3dinfo [data-a="iso"]')).length === 1);
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
  sec('Components, CAD assets and kinematics');
  pg = await open('#p=markf&m=visfid.fume.conveyor');
  await pg.evaluate(() => { document.querySelector('#v3d').scrollIntoView(); M3D.vp.spin = false; });
  await pg.waitForTimeout(700);
  const man = await pg.evaluate(async () => { await cadLoad(); return { state: CAD.state, n: Object.keys(CAD.man.components).length }; });
  check('the component manifest loads after boot', man.state === 'ready' && man.n > 60, JSON.stringify(man));
  const map = await pg.evaluate(() => {
    const sc = M3D.scene, ids = sc.filter(x => x.cid && x.cid.indexOf('mod:') !== 0).map(x => x.cid);
    const alias = { zchain: 1, gantrychain: 1, gantrycolumn: 1, gantrycarriage: 1, gantrysensor: 1, conveyorleg: 1, headmount: 1, window: 1, guard: 1 };
    return { noRecord: [...new Set(ids.filter(id => !cadRec(id) && !alias[id]))], noInfo: [...new Set(sc.filter(x => x.cid && !compInfo(x.cid)).map(x => x.cid))],
             have: ['source', 'tower', 'hmi', 'estop', 'chiller', 'workpiece', 'fume'].filter(id => sc.some(x => x.cid === id)) };
  });
  check('every component the model draws has a description and a manifest record', !map.noRecord.length && !map.noInfo.length, JSON.stringify(map));
  check('the source, chiller, beacon, HMI, e-stop, workpiece and modules can be picked by name', map.have.length === 7, map.have.join(' '));
  const card = await pg.evaluate(() => { showComp('scanhead', { gid: 'optic' }); const d = document.querySelector('#v3dinfo details'); d.open = true; return d.innerText; });
  check('the inspector states identity, geometry, CAD search and pricing basis without claiming a part number',
    /not specified in the product data/.test(card) && /Parametric/.test(card) && /CAD on request only/.test(card) && /platform base/.test(card), card.slice(0, 200));
  const un = await pg.evaluate(() => { showComp(null, { gid: 'optic' }); return document.querySelector('#v3dinfo').innerText; });
  check('geometry without a record is reported as an unresolved mapping, not guessed', /Unresolved mapping/i.test(un) && /no record is guessed/.test(un));
  const st0 = await pg.evaluate(() => JSON.stringify([S, cur, price()]));
  await pg.click('#expBtn'); await pg.waitForTimeout(250);
  await pg.fill('#v3dexp input', 'servo'); await pg.waitForTimeout(150);
  const found = await pg.$$eval('#v3dexp .xn', b => b.map(x => x.textContent));
  check('the explorer search narrows the component list', found.length >= 1 && found.every(t => /servo/i.test(t)), found.join(' | '));
  await pg.fill('#v3dexp input', ''); await pg.waitForTimeout(150);
  const hid = await pg.evaluate(async () => {
    const n0 = M3D.faces.filter(f => f.cid === 'feet').length;
    document.querySelector('#v3dexp .xv[data-k="feet"]').click(); M3D.vp.dirty = true;
    await new Promise(r => setTimeout(r, 250));
    return { n0, n1: M3D.faces.filter(f => f.cid === 'feet').length, listed: !!document.querySelector('#v3dexp .xr.off .xn[data-k="feet"]') };
  });
  check('hiding a component removes its geometry but keeps it listed', hid.n0 > 0 && hid.n1 === 0 && hid.listed, JSON.stringify(hid));
  const ms = await pg.evaluate(async () => {
    document.querySelector('#v3dexp .xn[data-k="plenum"]').click();
    document.querySelector('#v3dexp .xn[data-k="frame"]').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    document.querySelector('#v3dexp [data-a="iso"]').click(); M3D.vp.dirty = true;
    await new Promise(r => setTimeout(r, 250));
    const F = M3D.faces.filter(f => !f.kind && f.gid && f.gid !== 'site');
    return { sel: M3D.sel.slice(), hi: F.filter(f => f.cid === 'plenum' || f.cid === 'frame').every(f => /0,226,229/.test(f.e || '')),
             ghost: Math.max(...F.filter(f => f.cid !== 'plenum' && f.cid !== 'frame').map(f => f.a)) };
  });
  check('shift-click multi-selects; isolating the selection highlights it and ghosts the rest',
    ms.sel.join() === 'plenum,frame' && ms.hi && ms.ghost < 0.1, JSON.stringify(ms));
  await pg.click('#v3dexp [data-a="all"]'); await pg.waitForTimeout(250);
  const clr = await pg.evaluate(() => ({ st: JSON.stringify([S, cur, price()]), hidden: Object.keys(M3D.hide).length, sel: M3D.sel.length,
    feet: M3D.faces.filter(f => f.cid === 'feet').length }));
  check('Show all restores everything, and the explorer never touched the configuration or price',
    clr.hidden === 0 && clr.sel === 0 && clr.feet > 0 && clr.st === st0);

  const glb = await pg.evaluate(async () => {
    const rep = await (await fetch('tests/fixtures/cad/test-bracket.report.json')).json();
    const g = glbParse(await (await fetch('tests/fixtures/cad/test-bracket.glb')).arrayBuffer());
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    g.tris.forEach(t => t.forEach(p => { for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], p[c]); mx[c] = Math.max(mx[c], p[c]); } }));
    let bad = ''; try { glbParse(new ArrayBuffer(64)); } catch (e) { bad = e.message; }
    return { tris: g.tris.length, want: rep.solids.reduce((a, s) => a + s.triangles, 0), parts: g.names.length,
             mm: mx.map((v, i) => Math.round((v - mn[i]) * 1000 * 100) / 100), bad };
  });
  check('a converted GLB parses with its triangles, parts and true size (synthetic 60 × 40 × 30 mm fixture)',
    glb.tris === glb.want && glb.parts === 2 && glb.mm.join() === '60,40,30', JSON.stringify(glb));
  check('a file that is not a GLB is refused', /not a GLB/.test(glb.bad), glb.bad);
  const swap = await pg.evaluate(async () => {
    const count = () => { const b = new B3(); b.q = 1; b.lod = 1; mmBuild(b, M3D.vp.T, null);
      const F = b.f.filter(f => f.cid === 'feet' && !f.kind); return { all: F.length, cad: F.filter(f => f.cad).length,
        ys: Math.max(...F.map(f => Math.max(...f.v.map(v => v[1])))) }; };
    const before = count();
    await cadUse('feet', 'tests/fixtures/cad/test-bracket.glb', { status: 'cad-provisional' });
    const withCad = count(), m = CAD.mesh.feet;
    delete CAD.mesh.feet;
    const after = count();
    return { before, withCad, after, n: m.n };
  });
  check('a component with CAD is drawn from it at every instance, and reverts to parametric without it',
    swap.withCad.cad === swap.n * 4 && swap.withCad.all === swap.withCad.cad && Math.abs(swap.withCad.ys - 0.4) < 1e-6 &&
    swap.after.cad === 0 && swap.after.all === swap.before.all, JSON.stringify(swap));

  const kin = await pg.evaluate(async () => {
    reach = 5; go(5); SIM.rate = 6; simStart();
    const out = { bad: [], seen: {} };
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 30));
      Object.keys(KIN).forEach(k => { const j = KIN[k]; if (!j.on) return; out.seen[k] = 1;
        if (j.q < j.lim[0] - 1e-9 || j.q > j.lim[1] + 1e-9) out.bad.push(k + '=' + j.q); });
    }
    simStop();
    const p = P(), keep = JSON.stringify(p.specs);
    specSet(p, 'Z-axis', '150 mm motorised'); render();
    const b = new B3(); SIM.on = true; SIM.phases = simPhases(); SIM.total = SIM.phases.reduce((a, x) => a + x.d, 0);
    SIM.ph = 0; SIM.u = 0.5; mmBuild(b, 0, null); SIM.on = false;
    out.zMax = KIN.z.lim[1]; out.zq = KIN.z.q; out.basis = KIN.z.basis;
    p.specs = JSON.parse(keep); render();
    return out;
  });
  check('every joint stays inside its limits through a running cycle', !kin.bad.length && kin.seen.z && kin.seen.gx && kin.seen.clamp, JSON.stringify(kin));
  check('a Z stroke stated in the product data limits the Z joint', kin.zMax === 1.5 && kin.zq <= 1.5 && kin.basis === 'product data', JSON.stringify(kin));
  const ovl = await pg.evaluate(() => {
    const tags = () => { const b = new B3(); mmBuild(b, 0, M3D.vp); return b.tags.map(t => t.t).join(' | '); };
    const off = tags(); M3D.layers.kin = true; const on = tags(); M3D.layers.kin = false; return { off: /DATUM/.test(off), on: /DATUM/.test(on) && /Galvo/.test(on) };
  });
  check('the axes and joints overlay is off by default and labels the datum and galvo angles when on', !ovl.off && ovl.on, JSON.stringify(ovl));

  const seek = await pg.evaluate(() => {
    SIM.faults = false; SIM.loop = true; simStart(); SIM.rate = 0;
    const pose = () => JSON.stringify([R3D.headY, R3D.partX, R3D.clamp, R3D.spot, SIM.ph].map(v => typeof v === 'number' ? +v.toFixed(6) : v));
    const build = () => { const b = new B3(); mmBuild(b, 0, null); };
    const T = SIM.total * 0.62;
    for (let t = 0; t < T - 1e-9; t += 0.05) simAdvance(Math.min(0.05, T - t));
    build(); const played = pose(), tp = SIM.t;
    simSeek(0); simSeek(T); build(); const sought = pose();
    document.querySelector('#simBack').click(); const back = SIM.t;
    document.querySelector('#simStep').click(); const fwd = SIM.t;
    SIM.faults = true; SIM.plan = SIM.pend = { f: simFaults()[0], t: SIM.t + 0.05 };
    simAdvance(0.1); const f1 = SIM.fault; simSeek(SIM.plan.t - 0.2); const pend = !!SIM.pend; simAdvance(0.3); const f2 = SIM.fault;
    document.querySelector('#simRew').click(); const rew = SIM.t;
    SIM.loop = false; SIM.fault = null; SIM.pend = SIM.plan = null; SIM.faults = false; const c0 = SIM.cyc;
    simSeek(SIM.total - 0.05); simAdvance(0.2); const c1 = SIM.cyc, held = SIM.hold;
    simSeek(SIM.total * 0.5); simAdvance(SIM.total); const c2 = SIM.cyc;
    simStop();
    return { same: played === sought, tp: +tp.toFixed(4), T: +T.toFixed(4), back: +(T - back).toFixed(3), fwd: +(fwd - back).toFixed(3), f1, pend, f2, rew, c0, c1, c2, held };
  });
  check('seeking to a point gives the same machine pose as playing to it', seek.same && Math.abs(seek.tp - seek.T) < 1e-6, JSON.stringify(seek));
  check('step back and step forward move a paused run by one tenth of a second', seek.back === 0.1 && seek.fwd === 0.1, JSON.stringify(seek));
  check('a stoppage replays at the same point after scrubbing back', seek.f1 === 'interlock' && seek.pend && seek.f2 === 'interlock', JSON.stringify(seek));
  check('restart rewinds the cycle; replaying a finished single cycle counts it once', seek.rew === 0 && seek.c1 === seek.c0 + 1 && seek.held && seek.c2 === seek.c1, JSON.stringify(seek));
  const csv = await pg.evaluate(async () => { await cadLoad(); return compCSV(); });
  check('the component register exports identity, geometry and CAD status per drawn component',
    /Component ID,Component,Assembly/.test(csv) && /scanhead/.test(csv) && /not specified/.test(csv) && /parametric-provisional/.test(csv), csv.slice(0, 160));
  check('no script errors in the component, CAD and kinematics checks', pg.errors.length === 0, pg.errors.join(' | '));
  await pg.close();

  /* ------------------------------------------------------------------ */
  sec('Mechanisms, comparison, assistant and missions');
  pg = await open('#p=markf&m=fume');
  await pg.evaluate(() => { document.querySelector('#v3d').scrollIntoView(); M3D.vp.spin = false; });
  await pg.waitForTimeout(500);
  const mech = await pg.evaluate(() => {
    const pose = () => { const b = new B3(); mmBuild(b, 0, null); };
    SIM.faults = false; SIM.loop = true; simStart(); SIM.rate = 0;
    const L = simPhaseStart('LOAD'), P2 = simPhaseStart('PROCESS');
    simSeek(L.t + L.d * 0.5); pose(); const load = KIN.door.q, st = (simStatus(), document.querySelector('#v3dstat').innerText);
    simSeek(P2.t + P2.d * 0.5); pose(); const proc = KIN.door.q, beam = R3D.beamOn;
    SIM.faults = true; SIM.plan = SIM.pend = { f: simFaults()[0], t: SIM.t + 0.01 }; simAdvance(0.02); simAdvance(0.8); pose();
    const fault = { k: SIM.fault, q: KIN.door.q, lim: KIN.door.lim[1] };
    simAdvance(2.0); pose(); const after = { k: SIM.fault, q: KIN.door.q };
    simStop(); SIM.faults = true;
    return { load, st: /Open — loading/i.test(st), proc, beam, fault, after };
  });
  check('a hand-loaded machine opens its chamber door to load, and the status says so', mech.load > 1 && mech.st, JSON.stringify(mech));
  check('the door is shut whenever the beam can fire', mech.proc === 0, JSON.stringify(mech));
  check('a guard stoppage swings the door open on its joint, inside its limit, and closes it before resuming',
    mech.fault.k === 'interlock' && mech.fault.q > 0.5 && mech.fault.q <= mech.fault.lim && mech.after.k === null && mech.after.q < 0.02, JSON.stringify(mech));
  const stop = await pg.evaluate(() => {
    S.mods.conveyor = true; render(); SIM.faults = false; simStart(); SIM.rate = 0;
    const b = () => { const x = new B3(); mmBuild(x, 0, null); return KIN.stop.q; };
    const P2 = simPhaseStart('PROCESS'), U = simPhaseStart('UNLOAD');
    simSeek(P2.t + P2.d * 0.5); const proc = b(); simSeek(U.t + U.d * 0.4); const unl = b(); simSeek(U.t + U.d * 0.99); const end = b();
    simStop(); delete S.mods.conveyor; render(); SIM.faults = true;
    return { proc, unl, end };
  });
  check('the conveyor blade stopper holds the part through the process, drops to release it, and rises again',
    stop.proc === 1 && stop.unl === 0 && stop.end > 0.9, JSON.stringify(stop));
  const lum = await pg.evaluate(async () => {
    const vp = M3D.vp, mean = () => { const c = vp.cv, x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let t = 0;
      for (let i = 0; i < x.length; i += 16) t += x[i] * 0.2126 + x[i + 1] * 0.7152 + x[i + 2] * 0.0722; return t / (x.length / 16); };
    const geo = () => { const b = new B3(); mmBuild(b, 0, null); return b.f.length; };
    vp.paint(1); const a = mean(), ga = geo();
    vp.light = 'inspection'; vp.paint(1); const b = mean(), gb = geo();
    vp.light = 'studio'; vp.paint(1);
    return { a: +a.toFixed(1), b: +b.toFixed(1), same: ga === gb };
  });
  check('inspection lighting brightens the view without changing the geometry', lum.b > lum.a + 3 && lum.same, JSON.stringify(lum));

  const cmp3 = await pg.evaluate(async () => {
    const before = JSON.stringify([S, cur, reach]);
    saveCfg('Base'); const a = SAVED[0].id;
    const keep = JSON.parse(JSON.stringify(S));
    S.src = 'mopa'; S.pw = powersFor(P(), 'mopa').slice(-1)[0]; S.mods.visfid = true; render();
    saveCfg('With vision'); const b = SAVED[0].id;
    S = keep; famSel = PLAT[S.plat].fam; render();
    const mid = JSON.stringify([S, cur, reach]);
    CMP = [a, b]; openCompare(); await new Promise(r => setTimeout(r, 400));
    const D = CMP3.diff, txt = document.querySelector('#cmp3list').innerText;
    const out = { add: Object.keys(D.add).sort().join(), rem: Object.keys(D.rem).length, srcWhy: D.why.source || '', lines: D.lines.map(l => l.l.id).sort().join(),
      live: !!CMP3.vp, txt: /Added in B/i.test(txt) && /Built differently/i.test(txt), same: mid === JSON.stringify([S, cur, reach]) };
    CMP = [a, a]; openCompare(); await new Promise(r => setTimeout(r, 200));
    const D2 = CMP3.diff; out.ident = Object.keys(D2.add).length + Object.keys(D2.rem).length + Object.keys(D2.chg).length;
    closeOverlay('#compare'); out.closed = CMP3.vp === null;
    SAVED.splice(0, 2); Store.set('teal.saved', SAVED); CMP = [];
    out.restored = before === JSON.stringify([S, cur, reach]);
    return out;
  });
  check('the 3D comparison shows what B adds, what it drops, and what is specified differently, with the reason',
    cmp3.add.includes('vision') && cmp3.rem === 0 && /MOPA/.test(cmp3.srcWhy) && /visfid/.test(cmp3.lines) && cmp3.txt && cmp3.live, JSON.stringify(cmp3));
  check('two identical configurations compare with no differences', cmp3.ident === 0, JSON.stringify(cmp3));
  check('comparing never changes the configuration, and closing it stops its viewport', cmp3.same && cmp3.closed && cmp3.restored, JSON.stringify(cmp3));

  const ask = await pg.evaluate(() => {
    const st = JSON.stringify(S), o = optics();
    const spot = askAnswer('what is the spot size?'), wd = askAnswer('working distance?'), out = askAnswer('tell me a joke'),
          safe = askAnswer('is it safe?'), heat = askAnswer('what is the heat load');
    const r = askRun('What does the chiller do?');
    return { spot: spot.h.includes(o.spot.toFixed(0) + ' µm') && /optics model/.test(spot.basis),
             wd: /not in the product data/.test(wd.h), out: /outside what I can work out/.test(out.h) && !out.cid,
             safe: safe.h.includes(specGet(P(), /safety/i).row[1]), heat: heat.cid === 'chiller' && heat.h.includes(num(physics().heat_kW)),
             sel: M3D.sel.join() === 'chiller' && r.cid === 'chiller', same: st === JSON.stringify(S) };
  });
  check('the assistant computes answers from the configurator’s own models and says where they come from', ask.spot && ask.heat && ask.safe, JSON.stringify(ask));
  check('the assistant states data gaps and declines what it cannot work out', ask.wd && ask.out, JSON.stringify(ask));
  check('asking highlights the part concerned and leaves the configuration alone', ask.sel && ask.same, JSON.stringify(ask));

  const mis = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const snap = () => JSON.stringify([S, cur, reach, famSel, M3D.vmode, localStorage.getItem('teal.hist'), location.hash]);
    const before = snap(), R = {};
    misStart('find'); ['scanhead', 'objective', 'interlock'].forEach(c => showComp(c, { gid: 'optic' })); misAnswer(MIS.opts.findIndex(o => o.ok));
    R.find = MIS.done && MIS.score === 100; misEnd(true);
    misStart('trace'); showComp('objective', { gid: 'optic' }); R.wrong = /before/.test(MIS.fb);
    ['source', 'beamguide', 'collimator', 'scanhead', 'objective', 'workpiece'].forEach(c => showComp(c, { gid: 'optic' }));
    misAnswer(MIS.opts.findIndex(o => o.ok)); R.trace = MIS.done && MIS.score < 100; misEnd(true);
    misStart('config'); const t = MIS.data.target, s0 = optics().spot;
    S.lens = P().lens.slice().sort((a, b) => LENS[a].f - LENS[b].f)[0]; render();
    R.config = s0 > t && optics().spot <= t && MIS.i === 1; misEnd(true);
    misStart('cycle'); simStart(); SIM.rate = 8; for (let i = 0; i < 120 && MIS.i < 2; i++) await wait(100);
    misAnswer(MIS.opts.findIndex(o => o.ok)); misAnswer(MIS.opts.findIndex(o => o.ok)); R.cycle = MIS.done; misEnd(true);
    misStart('fault'); SIM.rate = 4; for (let i = 0; i < 150 && MIS.i < 1; i++) await wait(100);
    await wait(900); R.held = !!SIM.fault && SIM.faultHold;
    misAnswer(MIS.opts.findIndex(o => o.ok)); misAnswer(MIS.opts.findIndex(o => o.ok));
    document.querySelector('#v3dmis [data-a="act"]').click(); await wait(1000); R.fault = MIS.done && !SIM.fault; misEnd(true);
    R.same = before === snap();
    return R;
  });
  check('every mission runs to completion and scores hints and wrong tries', mis.find && mis.trace && mis.wrong && mis.config && mis.cycle, JSON.stringify(mis));
  check('the stoppage mission holds the fault until it is diagnosed and acknowledged', mis.held && mis.fault, JSON.stringify(mis));
  check('missions give back the configuration, step, view, History and link exactly', mis.same, JSON.stringify(mis));
  check('no script errors in mechanisms, comparison, assistant or missions', pg.errors.length === 0, pg.errors.join(' | '));
  await pg.close();
  /* ------------------------------------------------------------------ */
  sec('Views, themes and configuration identity');
  pg = await open(C2I);
  const th = await pg.evaluate(async () => {
    const out = {}, st0 = JSON.stringify([S, cur, reach]);
    const bg = () => getComputedStyle(document.body).backgroundColor, card = () => getComputedStyle(document.querySelector('.stage')).backgroundColor;
    themeApply('light'); out.light = [document.documentElement.dataset.theme, bg(), card()];
    themeApply('dark'); out.dark = [document.documentElement.dataset.theme, bg(), card()];
    out.stored = Store.get('teal.theme', null);
    themeApply('system'); out.sys = document.documentElement.dataset.theme;
    out.same = st0 === JSON.stringify([S, cur, reach]);
    return out;
  });
  const luma = c => { const m = c.match(/\d+/g).map(Number); return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; };
  check('Light and Dark change the page and its panels, and the choice is kept', th.light[0] === 'light' && th.dark[0] === 'dark' && luma(th.dark[1]) < 40 && luma(th.light[1]) > 200 && luma(th.dark[2]) < 50 && th.stored === 'dark', JSON.stringify(th));
  check('switching the theme never touches the configuration', th.same);
  await pg.close();
  for (const scheme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    const p2 = await ctx.newPage(); await p2.addInitScript(() => { try { localStorage.setItem('teal.seenAdvisor', 'true'); } catch (e) {} });
    await p2.goto(BASE + C2I, { waitUntil: 'networkidle' }); await p2.waitForFunction(() => typeof BOOTED !== 'undefined' && BOOTED);
    const t = await p2.evaluate(() => [document.documentElement.dataset.theme, THEME.pref]);
    await p2.emulateMedia({ colorScheme: scheme === 'dark' ? 'light' : 'dark' }); await p2.waitForTimeout(150);
    const t2 = await p2.evaluate(() => document.documentElement.dataset.theme);
    check(`System follows an operating system set to ${scheme}, and follows it when it changes`, t[0] === scheme && t[1] === 'system' && t2 === (scheme === 'dark' ? 'light' : 'dark'), t.join('/') + ' → ' + t2);
    await ctx.close();
  }
  pg = await open(C2I);
  const vw = await pg.evaluate(async () => {
    const st0 = JSON.stringify(S), out = {};
    document.querySelector('#vsw [data-view="internal"]').click(); await new Promise(r => setTimeout(r, 200));
    out.bar = !document.querySelector('#wsbar').hidden; out.story = document.querySelector('#story').hidden;
    out.secs = [...document.querySelectorAll('#wsnav button')].map(b => b.textContent);
    out.val = getComputedStyle(document.querySelector('#hVal')).display !== 'none';
    for (const sec of WSEC.map(x => x[0])) { viewSet('internal', sec); out[sec] = sec === 'cfg' ? !document.querySelector('#cfgwrap').hidden : document.querySelector('#ws .wsp') !== null; }
    out.banner = /demonstration/i.test(document.querySelector('#wsbar').textContent) && /Not access-controlled/i.test(document.querySelector('#wsbar').textContent);
    document.querySelector('#vsw [data-view="customer"]').click(); await new Promise(r => setTimeout(r, 200));
    out.back = document.querySelector('#wsbar').hidden && !document.querySelector('#cfgwrap').hidden && getComputedStyle(document.querySelector('#hVal')).display === 'none';
    out.same = st0 === JSON.stringify(S);
    return out;
  });
  check('Internal shows its ten-section workspace under a demonstration banner; Customer hides it again', vw.bar && vw.story && vw.secs.length === 10 && vw.banner && vw.back && vw.val, JSON.stringify(vw));
  check('every Internal section renders', ['portfolio','cfg','eng','bom','comp','trials','release','enq','mgmt','settings'].every(k => vw[k]), JSON.stringify(vw));
  check('switching views never touches the configuration', vw.same);
  const kb = await pg.evaluate(() => { const b = document.querySelector('#tsw [aria-checked="true"]'); b.focus();
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); const a = THEME.pref;
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); return [a, THEME.pref, document.activeElement.getAttribute('data-theme')]; });
  check('the switches are radio groups the arrow keys move through', kb[0] !== kb[1] && kb[1] === kb[2], kb.join(' → '));
  const sec2 = await pg.evaluate(async () => {
    const src = await (await fetch('index.html')).text(), data = await (await fetch('data.json')).text();
    return { pin: /adminPin|teal2026/.test(src + data), prompt: /prompt\(\s*'Enter the admin PIN/.test(src) };
  });
  check('no password is shipped in the page or the data, and the value store asks for none', !sec2.pin && !sec2.prompt, JSON.stringify(sec2));
  const id = await pg.evaluate(async () => {
    const out = { id: CFG.id, rev: CFG.rev, hash: location.hash };
    S.pw = powersFor(P(), S.src).filter(w => w !== S.pw)[0]; render();
    out.rev2 = CFG.rev; out.hash2 = location.hash; out.sameId = CFG.id === out.id;
    const saved = JSON.parse(localStorage.getItem('teal.cfg'));
    out.auto = saved.id === CFG.id && saved.rev === CFG.rev;
    cfgUndo(); out.undo = [CFG.rev, S.pw]; cfgRedo(); out.redo = CFG.rev;
    S.lens = Object.keys(LENS).find(l => l !== S.lens && P().lens.indexOf(l) >= 0); render(); out.branch = CFG.rev;
    out.bar = document.querySelector('#cfgbar').innerText;
    saveCfg('Identity test'); out.saved = [SAVED[0].cfgId, SAVED[0].rev];
    return out;
  });
  check('a configuration has an ID, every change makes a new revision, and the link carries both',
    /^TC-[0-9A-F]{6}$/.test(id.id) && id.rev2 === id.rev + 1 && id.sameId && id.hash2.includes('id=' + id.id) && id.hash2.includes('r=' + id.rev2), JSON.stringify(id));
  check('the working revision is autosaved; undo and redo step through revisions', id.auto && id.undo[0] === id.rev && id.redo === id.rev2 && id.branch === id.rev2 + 1, JSON.stringify(id));
  check('saved copies keep the configuration ID and revision', id.saved[0] === id.id && id.saved[1] === id.branch, JSON.stringify(id));
  /* the same browser comes back without a link */
  await pg.goto('about:blank'); await pg.goto(BASE, { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => typeof BOOTED !== 'undefined' && BOOTED && window.M3D && M3D.vp);
  const offer = await pg.evaluate(() => ({ text: document.querySelector('#cfgbar').innerText, shown: !document.querySelector('#cfgbar').hidden, plat: S.plat }));
  check('a returning visitor is offered their unfinished configuration, not forced into it', offer.shown && /unfinished configuration/i.test(offer.text) && !offer.plat, JSON.stringify(offer));
  const rest = await pg.evaluate(() => { document.querySelector('#cfgbar [data-c="restore"]').click(); return { plat: S.plat, ref: cfgRef() }; });
  check('restoring brings back the same ID and revision', rest.plat === 'markc2i' && /^TC-[0-9A-F]{6} r\d+$/.test(rest.ref), JSON.stringify(rest));
  const shared = await pg.evaluate(async () => { const h = location.hash; localStorage.removeItem('teal.cfg');
    return h; });
  await pg.close();
  pg = await open(shared.replace(/^[^#]*/, ''));
  const fork = await pg.evaluate(() => { const a = cfgRef(); S.mods.visfid = !S.mods.visfid; render(); return { a, b: cfgRef(), from: CFG.from }; });
  check('a configuration opened from someone else’s link keeps its reference, and becomes a copy when changed',
    fork.a !== '—' && fork.b.split(' ')[0] !== fork.a.split(' ')[0] && fork.from === fork.a, JSON.stringify(fork));
  const rs = await pg.evaluate(async () => { reach = 5; go(5); await new Promise(r => setTimeout(r, 200));
    let asked = ''; const c = window.confirm; window.confirm = m => { asked = m; return false; };
    document.querySelector('#rs').click(); const kept = !!S.plat; window.confirm = c; return { asked: asked.slice(0, 40), kept }; });
  check('Start over asks first, and declining keeps the configuration', /Start over/.test(rs.asked) && rs.kept, JSON.stringify(rs));
  await pg.close();

  /* ------------------------------------------------------------------ */
  sec('Internal workspace and customer requests');
  pg = await open(C2I);
  const ws = await pg.evaluate(async () => {
    const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    viewSet('internal', 'bom'); await wait(300);
    const rows = [...document.querySelectorAll('#ws tr.l2')];
    out.items = rows.length; out.docked = !!document.querySelector('#wsdock .view');
    out.inner = rows.some(r => r.getAttribute('data-cid') === 'plc') && rows.some(r => r.getAttribute('data-cid') === 'vent');
    out.noCost = /Not available — costs incomplete/.test(document.querySelector('#ws').innerText);
    const r0 = rows.find(r => r.getAttribute('data-cid') === 'scanhead'); r0.click(); await wait(200);
    out.sel = M3D.sel.join(); out.card = document.querySelector('#v3dinfo').classList.contains('open');
    showComp('objective', { gid: 'optic' }); await wait(100);
    out.mark = document.querySelector('#ws tr.l2.on') && document.querySelector('#ws tr.l2.on').getAttribute('data-cid');
    ROLE.cur = 'design'; viewSet('internal', 'bom'); await wait(200);
    out.designCost = /Cost \/ machine/.test(document.querySelector('#ws').innerText); out.designNav = [...document.querySelectorAll('#wsnav button')].length;
    ROLE.cur = 'pm'; viewSet('internal', 'bom'); await wait(200);
    /* cost every item and every labour category: totals and margin appear */
    const d = wsData(); bomItems().forEach(it => { if (it.lvl === 2) d.costs[it.cid] = { unit: 1000, src: 'test', updated: Date.now() }; });
    LABOURCAT.forEach(c => { d.costs['cat:' + c] = { unit: 5000, src: 'test', updated: Date.now() }; }); wsSave(); wsRender(); await wait(100);
    const B = bomCosts(bomItems()); out.complete = B.complete; out.total = B.total;
    const n = bomItems().filter(i => i.lvl === 2).length; out.expect = n * 1000 + LABOURCAT.length * 5000;
    out.margin = /gross margin/i.test(document.querySelector('#ws').innerText) && /%/.test(document.querySelector('#ws').innerText);
    ROLE.cur = 'procurement'; viewSet('internal', 'bom'); await wait(100); out.procMargin = /gross margin/i.test(document.querySelector('#ws').innerText);
    ROLE.cur = 'pm'; Object.keys(d.costs).forEach(k => delete d.costs[k]); wsSave();
    viewSet('internal', 'cfg'); await wait(100); out.undocked = !document.querySelector('#wsdock .view') && !!document.querySelector('.plate .view');
    return out;
  });
  check('the BOM lists every part of the machine, cut-away internals and outline-only parts included', ws.items > 40 && ws.inner, JSON.stringify(ws));
  check('a BOM row finds the part in the docked 3D view, and the 3D view finds the row', ws.docked && ws.sel === 'scanhead' && ws.card && ws.mark === 'objective' && ws.undocked, JSON.stringify(ws));
  check('costs total only when every item is costed, and margins show only to roles allowed to see them',
    ws.noCost && ws.complete && ws.total === ws.expect && ws.margin && !ws.procMargin && !ws.designCost && ws.designNav < 10, JSON.stringify(ws));
  const wf = await pg.evaluate(async () => {
    const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    viewSet('internal', 'trials'); await wait(150);
    document.querySelector('#tr_new').click(); await wait(100);
    document.querySelector('#tf_st').value = 'Approved'; document.querySelector('[data-tf="material"]').value = 'SS316L';
    document.querySelector('#tf_ok').click(); out.blocked = document.querySelector('#tf_err').textContent;
    document.querySelector('[data-tf="inspect"]').value = 'Grader'; document.querySelector('[data-tf="accept"]').value = 'Grade B';
    document.querySelector('[data-tf="achieved"]').value = 'Grade A'; document.querySelector('#tf_ok').click(); await wait(100);
    out.trial = wsData().trials[0].status; out.evidence = /validated/i.test(document.querySelector('#ws').innerText);
    viewSet('internal', 'release'); await wait(100);
    const go2 = t => { const b = [...document.querySelectorAll('#ws [data-to]')].find(x => x.getAttribute('data-to') === t); b.click(); };
    document.querySelector('#rl_n').value = 'Initial release'; go2('In Review'); out.needOwner = document.querySelector('#rl_err').textContent;
    document.querySelector('#rl_o').value = 'Owner'; document.querySelector('#rl_n').value = 'Initial release'; go2('In Review'); await wait(50);
    document.querySelector('#rl_o').value = 'Owner'; document.querySelector('#rl_r').value = 'Owner'; document.querySelector('#rl_n').value = 'ok'; go2('Approved'); out.selfApprove = document.querySelector('#rl_err').textContent;
    document.querySelector('#rl_r').value = 'Reviewer'; go2('Approved'); await wait(50);
    document.querySelector('#rl_o').value = 'Owner'; document.querySelector('#rl_r').value = 'Reviewer'; document.querySelector('#rl_n').value = 'ship'; go2('Released'); await wait(50);
    const rel = wsRelRec(CFG.id); out.released = rel.state + ' r' + rel.released.rev; const relRev = rel.released.rev, relSnap = rel.released.snap;
    S.mods.visver = !S.mods.visver; render(); await wait(50);
    out.frozen = wsRelRec(CFG.id).released.snap === relSnap && /differs from the released/.test(document.querySelector('#ws').innerText);
    viewSet('internal', 'mgmt'); await wait(100); out.mgmt = /1 released/.test(document.querySelector('#ws').innerText) && /catalogue health/i.test(document.querySelector('#ws').innerText);
    viewSet('internal', 'settings'); await wait(100); out.audit = document.querySelectorAll('#ws .wst tbody tr').length > 4;
    return out;
  });
  check('a trial cannot be approved without inspection results, acceptance criteria and the achieved result', /needs inspection/.test(wf.blocked) && wf.trial === 'Approved' && wf.evidence, JSON.stringify(wf));
  check('release needs an owner, a separate reviewer and a description; a released revision is frozen', /owner/.test(wf.needOwner) && /must not be the owner/.test(wf.selfApprove) && /^Released r\d+$/.test(wf.released) && wf.frozen, JSON.stringify(wf));
  check('the management overview and the audit log reflect the records', wf.mgmt && wf.audit, JSON.stringify(wf));
  const dm = await pg.evaluate(async () => { viewSet('internal', 'settings'); document.querySelector('#st_demo').click(); await new Promise(r => setTimeout(r, 100));
    const d = wsData(), n = d.enquiries.filter(e => e.demo).length, c = Object.keys(d.costs).filter(k => d.costs[k].demo).length;
    viewSet('internal', 'bom'); const synth = /SYNTHETIC/.test(document.querySelector('#ws').innerText);
    viewSet('internal', 'settings'); document.querySelector('#st_undemo').click();
    return { n, c, synth, left: wsData().enquiries.filter(e => e.demo).length + Object.keys(wsData().costs).filter(k => wsData().costs[k].demo).length }; });
  check('demonstration records are marked SYNTHETIC wherever they appear, and remove cleanly', dm.n > 0 && dm.c > 0 && dm.synth && dm.left === 0, JSON.stringify(dm));
  await pg.evaluate(() => viewSet('customer'));
  const rq = await pg.evaluate(async () => {
    const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    openTrial(); await wait(100);
    out.title = document.querySelector('#inquiry h3').textContent; out.ref = document.querySelector('.reqref').textContent.includes(CFG.id);
    document.querySelector('#iq_csv').click(); out.err = document.querySelector('#iq_err').textContent;
    document.querySelector('#iq_name').value = 'A. Tester'; document.querySelector('#iq_co').value = 'Test Co'; document.querySelector('#iq_em').value = 'a@test.example';
    document.querySelector('#iq_tgt').value = 'Grade A 2D code';
    let dl = ''; const d0 = window.download; window.download = (n, t) => { dl = t; }; document.querySelector('#iq_csv').click(); window.download = d0;
    out.csv = dl.includes(CFG.id) && dl.includes('trial'); out.done = document.querySelector('#iq_done').innerText;
    const e = wsData().enquiries[0], t = wsData().trials[0];
    out.rec = e.type === 'trial' && e.cfg === cfgRef() && e.status === 'New' && t.status === 'Requested' && t.id === e.id;
    closeOverlay('#inquiry'); openInquiry(); await wait(50);
    out.qtitle = document.querySelector('#inquiry h3').textContent; out.fields = ['iq_cty','iq_app','iq_proc','iq_qt','iq_tp','iq_wh','iq_bud','iq_att'].every(i => !!document.getElementById(i));
    closeOverlay('#inquiry');
    return out;
  });
  check('requests carry the configuration ID and revision, validate their fields, and say plainly that nothing was sent',
    /Organisation is required/.test(rq.err) && rq.ref && rq.csv && /Nothing has been sent/.test(rq.done) && rq.rec, JSON.stringify(rq));
  check('quotation and trial requests ask for the fields the application needs', /trial/i.test(rq.title) && /quotation/i.test(rq.qtitle) && rq.fields, JSON.stringify(rq));
  const sheetOut = await pg.evaluate(() => { reach = 5; go(5); const h = document.querySelector('#sheet').innerText;
    return { id: h.includes(CFG.id), assum: /Assumptions and limitations/i.test(h), next: /Recommended next steps/i.test(h), safety: /Class 1 per IEC 60825-1 \(platform specification\)|not stated in the specification/.test(h) }; });
  check('the printed specification names the configuration revision, its assumptions and next steps, and takes the laser class from the data',
    sheetOut.id && sheetOut.assum && sheetOut.next && sheetOut.safety, JSON.stringify(sheetOut));
  const zone = await pg.evaluate(() => {
    const st = snapshot(), out = {};
    const look = k => { pickPlatform(k); S.app = Object.keys(PLAT[k].apps)[0]; const b = new B3(); mmBuild(b, 0, M3D.vp); const d = document.createElement('div'); uiSpec(d);
      return { tag: b.tags.map(t => t.t).filter(t => /ZONE/.test(t)).join('|'), spec: (d.textContent.match(/Laser safety(.{0,70})/) || [])[1] || '' }; };
    out.markf = look('markf'); out.cleanp = look('cleanp'); out.markc2i = look('markc2i');
    restore(st);
    return out;
  });
  check('the floor plan and the specification call a machine Class 1 only where its specification says so',
    zone.markf.tag === 'CLASS 1 ENCLOSED ZONE' && /Class 1 per IEC 60825-1/.test(zone.markf.spec) &&
    zone.cleanp.tag === 'KEEP-OUT ZONE' && !/Class 1/.test(zone.cleanp.spec) &&
    zone.markc2i.tag === 'KEEP-OUT ZONE' && /Not stated in the specification/.test(zone.markc2i.spec), JSON.stringify(zone));
  const v3 = await pg.evaluate(async () => {
    const vp = M3D.vp, out = {}; document.querySelector('#v3d').scrollIntoView();
    vp.preset('side'); out.side = Math.abs(vp.cam.yaw - 1.5708) < 1e-6;
    const t0 = [vp.cam.tx, vp.cam.ty, vp.cam.tz]; vp.pan(80, 0); out.pan = Math.hypot(vp.cam.tx - t0[0], vp.cam.tz - t0[2]) > 0.5 && Math.abs(vp.cam.ty - t0[1]) < 1e-6;
    vp.reset(); out.reset = vp.cam.tx === vp.home.tx && vp.cam.tz === vp.home.tz;
    const tags = () => { const b = new B3(); mmBuild(b, 0, vp); return b.tags.map(t => t.t).join('|'); };
    M3D.layers.dim = true; out.dims = /W [\d,]+ mm/.test(tags()) && /H [\d,]+ mm/.test(tags()); M3D.layers.dim = false;
    vp.setLite(true); out.lite = vp.lite && vp.dprCap === 1 && lodOf(vp) === 0; const n1 = (() => { const b = new B3(); b.lod = 0; mmBuild(b, 0, vp); return b.f.length; })();
    vp.setLite(false); out.full = !vp.lite && lodOf(vp) >= 1;
    return out;
  });
  check('the view adds a side preset, panning, an overall-dimension layer and a lite rendering mode', v3.side && v3.pan && v3.reset && v3.dims && v3.lite && v3.full, JSON.stringify(v3));
  /* records can arrive in an imported file from anyone, so every screen must show
     every field as text, and malformed records must not break a screen */
  const hostile = await pg.evaluate(() => {
    let i = 0; const X = () => `"'><img src=x data-pwn="${i++}" onerror="window.__pwn=1"><svg onload="window.__pwn=1">`;
    const all = ks => Object.fromEntries(ks.map(k => [k, X()]));
    const cid = bomItems().find(x => x.lvl === 2).cid;
    const f = { v: 1,
      products: { [S.plat]: all(['status', 'owner', 'rev', 'actions', 'updated']), junk: null },
      costs: { [cid]: all(['unit', 'src', 'cur', 'origin', 'lead', 'sourcing', 'supplier', 'cat', 'updated']), 'cat:asm': all(['unit', 'src']) },
      suppliers: { [cid]: [all(['name', 'pn', 'lead', 'status', 'doc', 'ts', 'by']), null, 'x'], scanhead: 'not a list' },
      trials: [{ ...all(['id', 'plat', 'app', 'appName', 'material', 'thick', 'geom', 'req', 'params', 'recipe', 'owner', 'date', 'inspect', 'accept',
        'achieved', 'issues', 'status', 'cfg', 'ref', 'srcName', 'optics', 'created', 'updated']), photos: ['x" onerror="window.__pwn=1', 'data:image/jpeg;base64,AA" onerror="window.__pwn=1'] }, null, 7],
      enquiries: [all(['id', 'type', 'ts', 'updated', 'org', 'name', 'email', 'country', 'cfg', 'hash', 'desig', 'app', 'qty', 'when', 'target', 'budget',
        'status', 'owner', 'next', 'quote', 'material', 'note']), 'junk'],
      releases: { [CFG.id]: { ...all(['state', 'owner', 'reviewer']), released: { rev: X(), snap: '{}', ts: X() },
        log: [all(['ts', 'rev', 'from', 'to', 'owner', 'reviewer', 'role', 'note']), null] }, 'TC-000000': 5 },
      baseline: all(['total', 'ts', 'ref']),
      audit: [all(['ts', 'role', 'action', 'rec', 'detail']), null] };
    ROLE.cur = 'admin'; viewSet('internal', 'settings');
    return { n: i, json: JSON.stringify(f) };
  });
  await pg.setInputFiles('#st_imp', { name: 'hostile.json', mimeType: 'application/json', buffer: Buffer.from(hostile.json) });
  await pg.waitForFunction(() => wsData().trials.length > 0 && wsData().trials[0].photos);
  const errs0 = pg.errors.length, leaks = [];
  /* injected markup shows up as a data-pwn attribute on some element: an <img>, or
     an <input> whose value it broke out of. Each screen replaces the last, so look
     after every one */
  const leaked = async s => { const n = await pg.evaluate(() => document.querySelectorAll('[data-pwn], [onerror], svg[onload]').length); if (n) leaks.push(s + ' ' + n); };
  for (const s of ['portfolio', 'eng', 'bom', 'comp', 'trials', 'release', 'enq', 'mgmt', 'settings']) {
    await pg.evaluate(s => viewSet('internal', s), s);
    /* open the detail and edit views of the rows that carry the imported text */
    for (let k = 0; k < 4; k++) {
      const b = [];
      for (const x of await pg.$$('#ws tr:has-text("data-pwn") button, #ws [data-v]')) if (!/delete|remove/i.test(await x.textContent())) b.push(x);
      if (!b[k]) break;
      await b[k].click().catch(() => {}); await pg.waitForTimeout(40); await leaked(s);
    }
    await leaked(s);
  }
  await pg.waitForTimeout(200);
  const xss = await pg.evaluate(() => ({ ran: !!window.__pwn,
    junk: wsData().trials.length === 1 && wsData().enquiries.length === 1 && !wsData().products.junk && !wsData().baseline }));
  check('an imported workspace file is shown as text on every screen, never run as markup, and malformed records are dropped',
    hostile.n >= 80 && !xss.ran && !leaks.length && xss.junk && pg.errors.length === errs0,
    `${hostile.n} payloads · ${JSON.stringify(xss)} · leaked: ${leaks.join(', ') || 'none'} · ${pg.errors.slice(errs0).join(' | ')}`);
  await pg.evaluate(() => { ROLE.cur = 'pm'; WSDB.d = null; try { localStorage.removeItem('teal.ws'); } catch (e) {} viewSet('customer'); });
  check('no script errors in views, themes, identity, workspace or requests', pg.errors.length === 0, pg.errors.join(' | '));
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
  sec('Machine story');
  pg = await open();
  const scene = async i => { await pg.evaluate(i => { STORY.reduce = true; storyJump(i); STORY.reduce = false; }, i);
                             await pg.waitForTimeout(1300); return pg.evaluate(() => STORY.i); };
  check('the story opens at the top with the machine and its headline', await pg.evaluate(() =>
    STORY.on && STORY.i === 0 && !!document.querySelector('.sty-scene.on h2') && scrollY < 5));
  check('with nothing configured it tells a labelled example', await pg.evaluate(() =>
    STORY.ex && /Example/.test(document.querySelector('.sty-scene[data-s="0"]').textContent)));
  await pg.waitForTimeout(2600);
  check('the opening reveal settles on the hero framing', await pg.evaluate(() => {
    const k = storyKey(0), c = STORY.vp.cam; return !STORY.intro && Math.abs(c.yaw - k.yaw) < 0.12 && Math.abs(c.dist - k.dist) / k.dist < 0.05; }));
  const stBefore = await pg.evaluate(() => JSON.stringify({ S, cur, reach, vm: M3D.vmode, ex: M3D.expA, iso: M3D.iso,
                                                          sim: [SIM.on, SIM.cyc], h: localStorage.getItem('teal.hist') }));
  check('scene B ghosts the enclosure back', await scene(1) === 1 && await pg.evaluate(() => STORY.view.xk > 0.5));
  check('scene C separates the assemblies', await scene(2) === 2 && await pg.evaluate(() => STORY.view.expA > 0.5));
  check('scene D isolates the optical system', await scene(3) === 3 && await pg.evaluate(() =>
    STORY.view.isoW.optic > 0.9 && STORY.view.isoW._ < 0.3));
  check('scene E draws the beam from the configured optical train', await scene(4) === 4 && await pg.evaluate(() =>
    document.getElementById('styE').classList.contains('on') && STORY.insE.lines.length > 0 &&
    STORY.insE.lines.some(l => parseFloat(l.el.style.strokeDashoffset) < l.n)));
  check('scene F traces the real scan path', await scene(5) === 5 && await pg.evaluate(() =>
    document.getElementById('styF').classList.contains('on') && +STORY.insF.path.getAttribute('stroke-dashoffset') < 1));
  check('the process time shown is the process model’s own', await pg.evaluate(() => {
    const t = withStory(() => procModel().t).toFixed(2);
    return document.querySelector('.sty-scene[data-s="5"]').textContent.includes(t + ' s'); }));
  check('scene G hands over to the configurator', await scene(6) === 6 && !!(await pg.$('.sty-scene.on [data-go]')));
  const stAfter = await pg.evaluate(() => JSON.stringify({ S, cur, reach, vm: M3D.vmode, ex: M3D.expA, iso: M3D.iso,
                                                         sim: [SIM.on, SIM.cyc], h: localStorage.getItem('teal.hist') }));
  check('scrolling the story changes no configuration, simulation, viewer or History state', stBefore === stAfter);
  check('the scene index is navigable: jumping to A returns to the top', await scene(0) === 0 && await pg.evaluate(() => scrollY < 5));
  await pg.click('#stySkip'); await pg.waitForTimeout(900);
  check('“Skip to configurator” lands on the workspace', await pg.evaluate(() => {
    const t = document.getElementById('rail').getBoundingClientRect().top; return t > 40 && t < 200; }));
  await pg.evaluate(() => { famSel = 'mark'; render(); });
  await pg.evaluate(() => { pickPlatform('markc2i'); render(); go(2); }); await pg.waitForTimeout(800);
  check('step changes keep the workspace in view rather than scrolling to the story', await pg.evaluate(() =>
    document.getElementById('story').getBoundingClientRect().bottom < innerHeight * 0.3));
  check('the schematic glow cannot drop axis-aligned beams', await pg.evaluate(() =>
    /<filter id="gl" filterUnits="userSpaceOnUse"/.test(schematicSVG())));
  const sweep = await pg.evaluate(() => {
    const keep = JSON.stringify(S), keepCur = cur, bad = [];
    for (const pk of Object.keys(PLAT)) {
      S = {plat:null,app:null,src:null,pw:null,lens:null,mods:{},sw:'desktop',extra:{},notes:''};
      pickPlatform(pk); S.app = Object.keys(PLAT[pk].apps)[0];
      try { storySync();
        for (let i = 0; i < 7; i++) { const w = storyWant(i, 0.6); Object.assign(STORY.view, {xk:w.xk, expA:w.expA, isoW:w.w});
          const b = new B3(); b.q = 1; b.lod = 1; storyBuild(b, 1, STORY.vp);
          if (!Object.values(storyKey(i)).every(isFinite)) bad.push(pk + ' scene ' + i + ' camera'); }
        if (/NaN|undefined|Infinity/.test(document.getElementById('styCopy').textContent)) bad.push(pk + ' caption');
        if (!(STORY.insF.len > 0) || !STORY.insE.lines.length) bad.push(pk + ' insets');
      } catch (e) { bad.push(pk + ': ' + e.message); }
    }
    S = JSON.parse(keep); cur = keepCur; render(); return bad;
  });
  check('every platform tells the whole story: all scenes build, all figures finite', sweep.length === 0, sweep.join(', '));
  check('no script errors in the story', pg.errors.length === 0, pg.errors.join(' | '));
  await pg.close();

  pg = await open('#p=markf&a=metal&s=mopa&w=50&l=f420');
  check('a shared link lands on the workspace, with the story above it', await pg.evaluate(() => {
    const t = document.getElementById('rail').getBoundingClientRect().top; return t > 40 && t < 200 && scrollY > 200; }));
  check('the story follows the configuration: it tells the user’s own machine', await pg.evaluate(() =>
    !STORY.ex && document.querySelector('.sty-scene[data-s="0"] h2').textContent === P().n));
  await pg.evaluate(() => { S.lens = 'f163'; render(); });
  check('changing an option rebuilds the story’s machine and its numbers', await pg.evaluate(() =>
    STORY.S.lens === 'f163' && document.querySelector('.sty-scene[data-s="3"]').textContent.includes('F163')));
  await pg.close();

  pg = await open('', { reducedMotion: 'reduce' });
  check('reduced motion: no opening reveal, and the camera starts where it rests', await pg.evaluate(() => {
    const k = storyKey(0), c = STORY.vp.cam; return STORY.reduce && !STORY.intro && Math.abs(c.yaw - k.yaw) < 1e-6; }));
  await pg.close();

  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('teal.seenAdvisor', 'true'); } catch (e) {}
    const g = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function () { return this.id === 'scanvas' ? null : g.apply(this, arguments); }; });
  pg = await ctx.newPage(); pg.errors = []; pg.on('pageerror', e => pg.errors.push(e.message));
  await pg.goto(BASE, { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  check('without a canvas the story falls back to readable text, and the configurator still works', await pg.evaluate(() =>
    document.getElementById('story').classList.contains('sty-static') &&
    document.querySelectorAll('.sty-scene').length >= 1 && typeof render === 'function' && !!document.querySelector('#rail .st, #rail > *')));
  check('the fallback raises no script errors', pg.errors.length === 0, pg.errors.join(' | '));
  await ctx.close();

  /* ------------------------------------------------------------------ */
  sec('Layout and accessibility');
  pg = await open(C2I);
  const bad = [];
  for (let w = 360; w <= 1900; w += 40) {
    await pg.setViewportSize({ width: w, height: 900 }); await pg.waitForTimeout(40);
    /* Measure ink, not boxes: a group may shrink below its non-wrapping text, so
       the extent is taken over every visible descendant, text overflow included. */
    const m = await pg.evaluate(() => {
      const ink = el => { let l = 1e9, r = -1e9; [el, ...el.querySelectorAll('*')].forEach(e => {
        if (getComputedStyle(e).display === 'none') return; const q = e.getBoundingClientRect(); if (!q.width) return;
        l = Math.min(l, q.left); r = Math.max(r, e.children.length ? q.right : Math.max(q.right, q.left + e.scrollWidth)); }); return { l, r }; };
      const k = [...document.querySelector('header .wrap').children].filter(x => getComputedStyle(x).display !== 'none');
      /* groups on the same row must keep apart; a phone puts the switches on a second row */
      const row = (a, b) => { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return p.top < q.bottom - 2 && q.top < p.bottom - 2; };
      let gap = 1e9; for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) if (row(k[i], k[j])) {
        const A = ink(k[i]), B = ink(k[j]); gap = Math.min(gap, A.r <= B.l ? B.l - A.r : A.l - B.r); }
      return { gap, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    if (m.gap < 8 || m.doc > 1) bad.push(`${w}px (gap ${Math.round(m.gap)})`);
  }
  check('header groups keep at least 8 px of clear space and the page never scrolls sideways, 360–1900 px', bad.length === 0, bad.join(' '));
  const bar = [];
  for (let w = 320; w <= 1900; w += 20) {
    await pg.setViewportSize({ width: w, height: 900 }); await pg.waitForTimeout(30);
    const o = await pg.evaluate(() => { const a = document.querySelector('#v3dview').getBoundingClientRect(), c = document.querySelector('#v3dctl').getBoundingClientRect(),
      v = document.querySelector('#v3d').getBoundingClientRect();
      const apart = c.left - a.right >= 4 || a.top - c.bottom >= 4 || c.top - a.bottom >= 4;
      return { apart, inside: a.left >= v.left && c.right <= v.right + 0.5 }; });
    if (!o.apart || !o.inside) bar.push(w + 'px');
  }
  check('the camera presets and the view tools never overlap, 320–1900 px', bar.length === 0, bar.join(' '));
  await pg.evaluate(() => { reach = 5; go(5); simStart(); SIM.rate = 0; simCtlSync(); });
  const runBad = [];
  for (let w = 320; w <= 1900; w += 40) {
    await pg.setViewportSize({ width: w, height: 900 }); await pg.waitForTimeout(30);
    const o = await pg.evaluate(() => { const v = document.querySelector('#v3d').getBoundingClientRect();
      return [...document.querySelectorAll('.simrow button')].filter(b => b.offsetParent).every(b => { const r = b.getBoundingClientRect(); return r.left >= v.left - 0.5 && r.right <= v.right + 0.5; }); });
    if (!o) runBad.push(w + 'px');
  }
  check('every run control stays inside the viewer while paused, 320–1900 px', runBad.length === 0, runBad.join(' '));
  await pg.evaluate(() => simStop()); await pg.setViewportSize({ width: 1600, height: 1000 });
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
