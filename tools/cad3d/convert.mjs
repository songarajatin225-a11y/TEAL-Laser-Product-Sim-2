#!/usr/bin/env node
/* Convert the open-licence STEP parts the CAD view uses into compact meshes.
 *
 *   node tools/cad3d/convert.mjs <FreeCAD-library checkout> [occt-import-js dir]
 *
 * The parts come from the FreeCAD parts library (github.com/FreeCAD/FreeCAD-library),
 * every part CC-BY 3.0, credited in assets/cad3d/CREDITS.md. occt-import-js (LGPL,
 * OpenCascade compiled to WebAssembly) reads the STEP at build time only; it is never
 * shipped. Each part becomes assets/cad3d/<id>.bin: a little-endian header (vertex and
 * index counts, the bounding box in mm) followed by Int16 positions quantized to the box,
 * Int8 normals and Uint16/Uint32 indices. The page reads it with a few lines of code.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const [lib, occtDir] = process.argv.slice(2);
if (!lib) { console.error("usage: convert.mjs <FreeCAD-library checkout> [dir holding node_modules/occt-import-js]"); process.exit(1); }
const require = createRequire(join(occtDir || ROOT, "package.json"));
const occt = await require("occt-import-js")();

export const PARTS = [
  { id: "profile40", path: "Mechanical Parts/Profiles EN/Generic/Profile-40x40L-I-Type_Slot8.step", defl: 0.004 },
  { id: "mgn12", path: "Mechanical Parts/Bearings/linear_bearings/LinearSlide-MGN12-Rail.step", defl: 0.004 },
  { id: "nema23", path: "Electrical Parts/Motors/Stepper/NEMA/NEMA_23_with_connector.step", defl: 0.05 },
  { id: "estop", path: "Electrical Parts/Push buttons/Emergency stop mushroom head push-button - 22 mm.step", defl: 0.006 },
  { id: "btn_green", path: "Electrical Parts/Push buttons/Green Push-button - 22 mm.step", defl: 0.006 },
  { id: "btn_red", path: "Electrical Parts/Push buttons/Red Push-button - 22 mm.step", defl: 0.006 },
  { id: "fan50", path: "Electrical Parts/fans/fan-50x50mm.step", defl: 0.006 },
];
const OUT = join(ROOT, "assets", "cad3d");
mkdirSync(OUT, { recursive: true });
const report = [];
for (const p of PARTS) {
  const res = occt.ReadStepFile(new Uint8Array(readFileSync(join(lib, p.path))), { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: p.defl, angularDeflection: 0.5 });
  if (!res.success) throw new Error("could not read " + p.path);
  /* merge every mesh of the part, keeping each mesh's colour as a group */
  const pos = [], nor = [], idx = [], groups = [];
  for (const m of res.meshes) {
    const base = pos.length / 3, P = m.attributes.position.array, N = m.attributes.normal ? m.attributes.normal.array : null, I = m.index.array;
    for (let i = 0; i < P.length; i++) pos.push(P[i]);
    for (let i = 0; i < P.length; i++) nor.push(N ? N[i] : 0);
    const start = idx.length;
    for (let i = 0; i < I.length; i++) idx.push(I[i] + base);
    groups.push({ start, count: I.length, color: m.color ? m.color.map((c) => +c.toFixed(3)) : null });
  }
  const n = pos.length / 3, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[i * 3 + a]); hi[a] = Math.max(hi[a], pos[i * 3 + a]); }
  const big = n > 65535;
  const head = { v: n, i: idx.length, lo, hi, big, groups };
  const hj = Buffer.from(JSON.stringify(head));
  const hpad = Buffer.alloc((4 - ((4 + hj.length) % 4)) % 4, 32);
  const qp = new Int16Array(n * 3), qn = new Int8Array(n * 3 + ((4 - ((n * 3) % 4)) % 4));
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) {
    const s = hi[a] - lo[a] || 1;
    qp[i * 3 + a] = Math.round(((pos[i * 3 + a] - lo[a]) / s) * 65534 - 32767);
    qn[i * 3 + a] = Math.max(-127, Math.min(127, Math.round(nor[i * 3 + a] * 127)));
  }
  const qpBuf = Buffer.from(qp.buffer), qpPad = Buffer.alloc((4 - (qpBuf.length % 4)) % 4);
  const ib = big ? Buffer.from(new Uint32Array(idx).buffer) : Buffer.from(new Uint16Array(idx).buffer);
  const len = Buffer.alloc(4); len.writeUInt32LE(hj.length + hpad.length);
  const file = Buffer.concat([len, hj, hpad, qpBuf, qpPad, Buffer.from(qn.buffer), ib]);
  writeFileSync(join(OUT, p.id + ".bin"), file);
  report.push(`${p.id.padEnd(10)} ${String(n).padStart(7)} vertices ${String(idx.length / 3).padStart(7)} triangles  ${(file.length / 1024).toFixed(0)} KB  size ${hi.map((h, a) => (h - lo[a]).toFixed(1)).join(" × ")} mm`);
}
console.log(report.join("\n"));
