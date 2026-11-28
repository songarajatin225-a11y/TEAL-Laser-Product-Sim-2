#!/usr/bin/env node
/* TEAL configurator — unpack the V8 digital-twin simulations into plain files.
 *
 *   node tools/twin/extract.mjs <TEAL_Laser_Engineering_OS_V8.html>
 *
 * The V8 page ships its four 3D CAD simulations (semi, pcb, fiber, mw), the
 * three.js r147 build they run on and their thumbnails as base64 strings
 * inside one 2 MB HTML file. This writes them out as ordinary files so the
 * site can load one simulation at a time, cache them, and keep a strict
 * Content-Security-Policy (no inline script):
 *
 *   twin/lib/{three,orbit,room,extra}.js   three.js r147 + addons (MIT)
 *   twin/<key>.html                        the simulation page
 *   twin/<key>.js                          its script, moved out of the page
 *   twin/thumbs/<key>.jpg                  the V8 thumbnail
 *
 * The simulations' own code is not changed, apart from the script move, a
 * CSP meta tag and the configurator's settings layer (twin/embed.js and
 * twin/embed.css, written by hand and linked into each page).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, normalize } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/twin/extract.mjs <V8.html>'); process.exit(2); }
const ROOT = normalize(join(new URL('.', import.meta.url).pathname, '..', '..'));
const OUT = join(ROOT, 'twin');
const page = readFileSync(src, 'utf8');

function bundle(name) {
  const m = page.match(new RegExp('const ' + name + ' = (\\{.*?\\});\\s*$', 'm'));
  if (!m) throw new Error('bundle not found: ' + name);
  return JSON.parse(m[1]);
}
const b64 = s => Buffer.from(s, 'base64');
const LIB = bundle('LIB64'), SHELL = bundle('SHELL64'), THUMBS = bundle('THUMBS');

mkdirSync(join(OUT, 'lib'), { recursive: true });
mkdirSync(join(OUT, 'thumbs'), { recursive: true });
for (const [k, v] of Object.entries(LIB)) writeFileSync(join(OUT, 'lib', k + '.js'), b64(v));
for (const [k, v] of Object.entries(THUMBS)) writeFileSync(join(OUT, 'thumbs', k + '.jpg'), b64(v));

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'">`;
for (const [k, v] of Object.entries(SHELL)) {
  let h = b64(v).toString('utf8'), code = [];
  h = h.replace(/<script>([\s\S]*?)<\/script>/g, (all, body) => {
    const lib = body.trim().match(/^\/\*@LIB:([a-z]+)@\*\/$/);
    if (lib) return `<script src="lib/${lib[1]}.js"></script>`;
    code.push(body); return code.length === 1 ? `<script src="${k}.js"></script>` : '';
  });
  if (code.length !== 1) throw new Error(k + ': expected one simulation script, found ' + code.length);
  h = h.replace(/<meta charset="utf-8">/i, m => m + '\n' + CSP);
  /* the configurator's settings layer: embed mode and address parameters (twin/embed.js, kept by hand) */
  h = h.replace('</head>', '<link rel="stylesheet" href="embed.css">\n</head>').replace('</body>', '<script src="embed.js"></script>\n</body>');
  writeFileSync(join(OUT, k + '.html'), h);
  writeFileSync(join(OUT, k + '.js'), code[0].trim() + '\n');
  console.log(`twin/${k}.html  ${(h.length / 1024).toFixed(0)} KB page, ${(code[0].length / 1024).toFixed(0)} KB script`);
}
