#!/usr/bin/env node
/* TEAL configurator — build the Engineering Studio page from the V8 page.
 *
 *   node tools/twin/studio.mjs <TEAL_Laser_Engineering_OS_V8.html>
 *
 * Writes studio.html and studio-1.js … studio-N.js: the V8 overview, the four
 * machines with their digital-twin panel, the comparison, the Engineering Studio
 * and the Custom Machine Builder. The changes from V8 are mechanical:
 *   - the three base64 bundles are dropped; the simulations, thumbnails and
 *     three.js load from twin/ (see tools/twin/extract.mjs);
 *   - each inline script becomes a file, so the page keeps a strict CSP;
 *   - the page opens only for an internal-passkey session (studio-gate.js),
 *     and its header links back to the configurator.
 */
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, normalize } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/twin/studio.mjs <V8.html>'); process.exit(2); }
const ROOT = normalize(join(new URL('.', import.meta.url).pathname, '..', '..'));
let h = readFileSync(src, 'utf8');

/* 1. drop the bundles */
h = h.split('\n').filter((l) => !/^const (LIB64|SHELL64|THUMBS) = \{/.test(l)).join('\n');

/* 2. load from files instead of the bundles */
const rep = (a, b) => { if (!h.includes(a)) throw new Error('not found: ' + a.slice(0, 80)); h = h.split(a).join(b); };
rep('const libText = () => libs || (libs = Object.fromEntries(Object.entries(LIB64).map(([k, v]) => [k, dec(v)])));', '');
h = h.replace(/  let h = dec\(SHELL64\[key\]\); const L = libText\(\);\n  for \(const \[k, v\] of Object\.entries\(L\)\) h = h\.split\(`\/\*@LIB:\$\{k\}@\*\/`\)\.join\(v\);\n  frame\.srcdoc = h;/,
  "  frame.src = 'twin/' + key + '.html';");
if (/SHELL64/.test(h)) throw new Error('SHELL64 still referenced');
rep('frame.srcdoc = "";', 'frame.src = "about:blank";');
rep('data:image/jpeg;base64,${THUMBS[m.key]}', 'twin/thumbs/${m.key}.jpg');
rep('data:image/jpeg;base64,${THUMBS[key]}', 'twin/thumbs/${key}.jpg');
rep('loadScript(LIB64.three)', "loadScript('twin/lib/three.js')");
rep('loadScript(LIB64.orbit)', "loadScript('twin/lib/orbit.js')");
h = h.replace(/function loadScript\(b\)\{return new Promise\(\(resolve,reject\)=>\{let el=document\.createElement\('script'\),u=URL\.createObjectURL\(new Blob\(\[Uint8Array\.from\(atob\(b\),c=>c\.charCodeAt\(0\)\)\],\{type:'text\/javascript'\}\)\);/,
  "function loadScript(u){return new Promise((resolve,reject)=>{let el=document.createElement('script');");
if (/LIB64|THUMBS\[/.test(h)) throw new Error('bundle still referenced');

/* 3. scripts to files */
for (const f of readdirSync(ROOT)) if (/^studio-\d+\.js$/.test(f)) unlinkSync(join(ROOT, f));
let n = 0;
h = h.replace(/<script>([\s\S]*?)<\/script>/g, (all, body) => {
  n++; writeFileSync(join(ROOT, `studio-${n}.js`), body.trim() + '\n'); return `<script src="studio-${n}.js"></script>`;
});

/* 4. CSP, gate, the way back */
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'">`;
h = h.replace(/<meta charset="utf-8">/i, (m) => m + '\n' + CSP + '\n<meta name="robots" content="noindex">\n<link rel="icon" href="assets/icon-192.png">\n<link rel="stylesheet" href="studio.css">\n<script src="studio-gate.js"></script>');
h = h.replace('<header>', '<header>\n  <a class="backcfg" href="index.html">← Configurator</a>');
h = h.replace('<body>', `<body>
<div id="gatemsg" hidden><div><h1>Engineering Studio</h1><p>This workspace opens with the internal passkey. Open the configurator, switch to the Internal view and give the passkey there, then come back.</p><p><a class="btn p" href="index.html">Open the configurator</a></p></div></div>`);
h = h.replace(/<title>[^<]*<\/title>/, '<title>TEAL Engineering Studio — digital twins, Studio and Custom Machine Builder</title>');
writeFileSync(join(ROOT, 'studio.html'), h);
console.log(`studio.html ${(h.length / 1024).toFixed(0)} KB, ${n} scripts`);
