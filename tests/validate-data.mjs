#!/usr/bin/env node
/* TEAL value-store validator — zero dependencies.
 *
 *   node tests/validate-data.mjs [path/to/data.json]
 *
 * Checks that every cross-reference in the catalogue resolves, that defaults are
 * members of the lists they default from, that applications recommend things
 * their platform can actually fit, and that every price is a number. Exits 1 on
 * any CRITICAL or HIGH finding so it can gate a commit or a CI job.
 *
 * Severity follows the data-quality brief:
 *   CRITICAL  can produce a wrong configuration, price or technical representation
 *   HIGH      affects selection or compatibility, or leaves needed information out
 *   MEDIUM    reduces usability or content quality
 *   LOW       cosmetic or non-essential metadata
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2] || new URL('../data.json', import.meta.url).pathname;
const D = JSON.parse(readFileSync(path, 'utf8'));
const F = [];
const add = (sev, where, msg) => F.push({ sev, where, msg });
const has = (t, k) => Object.prototype.hasOwnProperty.call(D[t] || {}, k);
const num = v => typeof v === 'number' && Number.isFinite(v);
const MODX = k => has('MOD', k) || has('EXTRA', k);
const DELIV = new Set(Object.values(D.PLAT).map(p => p.deliv));

/* Same rule the configurator uses: per-source power classes win over the list. */
const powersFor = (p, s) => (p.pwBySrc && s && p.pwBySrc[s] && p.pwBySrc[s].length) ? p.pwBySrc[s] : (p.pw || []);

/* Same fitment rule as modFits() in index.html. */
function fits(pk, k) {
  const p = D.PLAT[pk], f = D.MODFIT[k];
  if (!f) return true;
  if (f.fam && !f.fam.includes(p.fam)) return false;
  if (f.noFam && f.noFam.includes(p.fam)) return false;
  if (f.deliv && !f.deliv.includes(p.deliv)) return false;
  if (f.noDeliv && f.noDeliv.includes(p.deliv)) return false;
  if (f.noPlat && f.noPlat.includes(pk)) return false;
  if (f.mat && !Object.values(p.apps || {}).some(a => f.mat.includes(a.mat))) return false;
  return true;
}

/* ---- mandatory fields --------------------------------------------------- */
const REQ = {
  SRC:  ['n', 'wl', 'um', 'm2', 'dia', 'mode', 'wpe', 'prem'],
  LENS: ['n', 'f', 'fld'],
  MAT:  ['n', 'k', 'tm', 'rho', 'cp', 'a'],
  IND:  ['n', 'd'],
  STD:  ['n', 'd', 's'],
  FAM:  ['n', 'ch', 's', 'd'],
  PLAT: ['fam', 'code', 'n', 't', 'base', 'deliv', 'src', 'dsrc', 'pw', 'dpw', 'lens', 'dlens', 'apps', 'lead', 'warranty', 'install'],
  MOD:  ['g', 'n', 'd', 'p'],
  SW:   ['n', 'd', 'p'],
  EXTRA:['n', 'd', 'p']
};
for (const [t, req] of Object.entries(REQ))
  for (const [k, v] of Object.entries(D[t] || {}))
    for (const f of req)
      if (v[f] === undefined || v[f] === null || v[f] === '')
        add(t === 'PLAT' || t === 'SRC' ? 'CRITICAL' : 'HIGH', `${t}.${k}`, `missing mandatory field "${f}"`);

/* ---- prices are numbers --------------------------------------------------- */
for (const [k, p] of Object.entries(D.PLAT)) if (!num(p.base) || p.base <= 0) add('CRITICAL', `PLAT.${k}`, `base price is not a positive number (${p.base})`);
for (const t of ['MOD', 'SW', 'EXTRA'])
  for (const [k, v] of Object.entries(D[t])) if (!num(v.p) || v.p < 0) add('CRITICAL', `${t}.${k}`, `price is not a non-negative number (${v.p})`);
for (const [k, s] of Object.entries(D.SRC)) if (!num(s.prem)) add('CRITICAL', `SRC.${k}`, `premium is not a number (${s.prem})`);

/* ---- sources: pulsed sources need a pulse model ----------------------------- */
for (const [k, s] of Object.entries(D.SRC)) {
  if (s.mode === 'pulsed' && (!num(s.tau) || !Array.isArray(s.frep)))
    add('HIGH', `SRC.${k}`, 'pulsed source without tau and frep — pulse energy and peak power cannot be computed');
  if (Array.isArray(s.frep) && !(s.frep[0] < s.frep[1])) add('HIGH', `SRC.${k}`, `frep band is not ascending (${s.frep})`);
  if (num(s.wpe) && (s.wpe <= 0 || s.wpe > 1)) add('HIGH', `SRC.${k}`, `wall-plug efficiency outside (0,1] (${s.wpe})`);
}

/* ---- platforms ------------------------------------------------------------ */
const codes = {};
for (const [pk, p] of Object.entries(D.PLAT)) {
  const at = `PLAT.${pk}`;
  if (!has('FAM', p.fam)) add('CRITICAL', at, `family "${p.fam}" does not exist`);
  (p.ind || []).forEach(i => { if (!has('IND', i)) add('HIGH', at, `industry "${i}" does not exist`); });
  (p.src || []).forEach(s => { if (!has('SRC', s)) add('CRITICAL', at, `source "${s}" does not exist`); });
  (p.lens || []).forEach(l => { if (!has('LENS', l)) add('CRITICAL', at, `objective "${l}" does not exist`); });
  if (!(p.src || []).includes(p.dsrc)) add('CRITICAL', at, `default source "${p.dsrc}" is not in its source list`);
  if (!(p.lens || []).includes(p.dlens)) add('CRITICAL', at, `default objective "${p.dlens}" is not in its objective list`);
  if (!powersFor(p, p.dsrc).includes(p.dpw)) add('CRITICAL', at, `default power ${p.dpw} W is not a class of the default source`);
  for (const [s, l] of Object.entries(p.pwBySrc || {})) {
    if (!(p.src || []).includes(s)) add('HIGH', at, `pwBySrc names source "${s}" the platform does not list`);
    if (!Array.isArray(l) || !l.length || !l.every(num)) add('CRITICAL', at, `pwBySrc.${s} is not a list of numbers`);
  }
  (p.src || []).forEach(s => { if (!powersFor(p, s).length) add('CRITICAL', at, `source "${s}" has no power classes`); });
  (p.std || []).forEach(m => {
    if (!MODX(m)) add('CRITICAL', at, `standard module "${m}" does not exist`);
    else if (!fits(pk, m)) add('HIGH', at, `standard module "${m}" is excluded by its own fitment rule on this platform`);
  });
  if (codes[p.code]) add('HIGH', at, `designation code "${p.code}" duplicates PLAT.${codes[p.code]}`);
  codes[p.code] = pk;
  if (!Object.keys(p.apps || {}).length) add('CRITICAL', at, 'no applications — the application step cannot complete');

  for (const [ak, a] of Object.entries(p.apps || {})) {
    const aat = `${at}.apps.${ak}`;
    if (!has('MAT', a.mat)) add('CRITICAL', aat, `material "${a.mat}" does not exist`);
    if (!has('SRC', a.src)) add('CRITICAL', aat, `recommended source "${a.src}" does not exist`);
    else if (!(p.src || []).includes(a.src)) add('CRITICAL', aat, `recommends source "${a.src}", which this platform does not list`);
    else if (a.pw != null && !powersFor(p, a.src).includes(a.pw))
      add('HIGH', aat, `recommends ${a.pw} W, not a power class of ${a.src} on this platform (${powersFor(p, a.src).join('/')})`);
    if (!a.n || !a.d) add('MEDIUM', aat, 'missing name or description');
    if (!a.w) add('LOW', aat, 'no rationale text');
  }
  if (!Array.isArray(p.specs) || !p.specs.length) add('MEDIUM', at, 'no specification rows');
}

/* ---- fitment ---------------------------------------------------------------- */
for (const [k, f] of Object.entries(D.MODFIT)) {
  const at = `MODFIT.${k}`;
  if (!MODX(k)) add('HIGH', at, 'rule for a module that does not exist');
  [...(f.fam || []), ...(f.noFam || [])].forEach(x => { if (!has('FAM', x)) add('HIGH', at, `family "${x}" does not exist`); });
  [...(f.deliv || []), ...(f.noDeliv || [])].forEach(x => { if (!DELIV.has(x)) add('HIGH', at, `delivery "${x}" is not used by any platform`); });
  (f.noPlat || []).forEach(x => { if (!has('PLAT', x)) add('HIGH', at, `platform "${x}" does not exist`); });
  (f.mat || []).forEach(x => { if (!has('MAT', x)) add('HIGH', at, `material "${x}" does not exist`); });
}
for (const k of [...Object.keys(D.MOD), ...Object.keys(D.EXTRA)])
  if (!Object.keys(D.PLAT).some(pk => fits(pk, k))) add('HIGH', `MOD.${k}`, 'fits no platform — it can never be selected');

/* ---- recommendation rules --------------------------------------------------- */
const REF = { plat: 'PLAT', fam: 'FAM', src: 'SRC', mat: 'MAT', lens: 'LENS', ind: 'IND' };
for (const r of D.RECO || []) {
  const at = `RECO.${r.id}`;
  for (const [key, vals] of Object.entries(r.iff || {})) {
    const t = REF[key]; if (!t) continue;
    [].concat(vals).forEach(v => { if (!has(t, v)) add('HIGH', at, `condition ${key}="${v}" does not exist`); });
  }
  const th = r.then || {};
  (th.mods || []).forEach(m => { if (!has('MOD', m)) add('HIGH', at, `recommends module "${m}", which does not exist`); });
  (th.extra || []).forEach(m => { if (!has('EXTRA', m)) add('HIGH', at, `recommends extra "${m}", which does not exist`); });
  if (th.sw && !has('SW', th.sw)) add('HIGH', at, `recommends software "${th.sw}", which does not exist`);
  if (!r.why) add('MEDIUM', at, 'no rationale');
}
const ids = (D.RECO || []).map(r => r.id);
ids.filter((x, i) => ids.indexOf(x) !== i).forEach(x => add('HIGH', `RECO.${x}`, 'duplicate rule id'));

/* ---- unused records ----------------------------------------------------------- */
const used = { SRC: new Set(), LENS: new Set(), MAT: new Set(), IND: new Set() };
for (const p of Object.values(D.PLAT)) {
  (p.src || []).forEach(s => used.SRC.add(s)); (p.lens || []).forEach(l => used.LENS.add(l));
  (p.ind || []).forEach(i => used.IND.add(i)); Object.values(p.apps || {}).forEach(a => used.MAT.add(a.mat));
}
for (const [t, set] of Object.entries(used))
  for (const k of Object.keys(D[t])) if (!set.has(k)) add('MEDIUM', `${t}.${k}`, 'not referenced by any platform or application');

/* ---- duplicate display names ------------------------------------------------- */
for (const t of ['SRC', 'LENS', 'MAT', 'FAM', 'PLAT', 'MOD', 'SW', 'EXTRA', 'IND']) {
  const seen = {};
  for (const [k, v] of Object.entries(D[t])) {
    if (seen[v.n]) add('MEDIUM', `${t}.${k}`, `display name "${v.n}" duplicates ${t}.${seen[v.n]}`);
    seen[v.n] = k;
  }
}

/* ---- report ---------------------------------------------------------------- */
const ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const counts = Object.fromEntries(ORDER.map(s => [s, F.filter(f => f.sev === s).length]));
if (process.argv.includes('--json')) { console.log(JSON.stringify({ counts, findings: F }, null, 2)); }
else {
  console.log(`TEAL value-store validation — ${path}`);
  console.log(`${Object.keys(D.PLAT).length} platforms · ${Object.keys(D.SRC).length} sources · ` +
              `${Object.keys(D.LENS).length} objectives · ${Object.keys(D.MOD).length} modules · ` +
              `${Object.keys(D.EXTRA).length} extras · ${(D.RECO || []).length} rules\n`);
  for (const s of ORDER) {
    const list = F.filter(f => f.sev === s);
    if (!list.length) continue;
    console.log(`${s} (${list.length})`);
    list.forEach(f => console.log(`  ${f.where.padEnd(34)} ${f.msg}`));
    console.log('');
  }
  console.log(ORDER.map(s => `${s} ${counts[s]}`).join(' · '));
}
process.exit(counts.CRITICAL || counts.HIGH ? 1 : 0);
