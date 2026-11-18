#!/usr/bin/env node
/* TEAL configurator — Fig 2: the workstation, through one run cycle.
 *
 *   node tools/anatomy/workstation.mjs                 # writes anatomy-ws.js
 *   node tools/anatomy/workstation.mjs --audit         # also proves the geometry (kit audit)
 *   node tools/anatomy/workstation.mjs --preview DIR   # also standalone pages, dark and light
 *   node tools/anatomy/workstation.mjs --check         # npm test: is anatomy-ws.js current?
 *
 * A Class 1 galvo marking workstation drawn with its right-hand side panels off, built
 * with the Anatomy kit (tools/anatomy/kit, MIT). The lower cabinet holds the laser
 * source, the controller, the power supply, the safety and distribution rail and, when
 * it is configured, the fume extractor. On the worktop, behind a vertical lift door,
 * a Z column carries the scan head and its f-theta objective over a fixture with two
 * toggle clamps. The fibre runs from the source up the back wall to the head.
 *
 * The page drives it from the configurator's own simulation: the same phases (home,
 * load, clamp, locate, focus, process, verify, unload) with the same durations, and
 * during the process phase the spot follows the configuration's own process path.
 *
 * Every part is recorded with its true shape. The kit's settle pass ray-casts every
 * overlapping pair to set the drawing order, and --audit checks clearances, supports,
 * cable ends and depth order. The static drawing, the geometry the page needs and the
 * live code go into anatomy-ws.js, which uses the kit runtime that anatomy.js exposes.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { tubePieces, tubeSvg } from "./kit/tube.mjs";
import * as A from "./kit/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const W = 760, H = 640;
const AZIMUTH = 36, ELEVATION = 30;

/* ---- the world: 1 unit = 5 mm. x across the front, y from back to front, z up --- */
const FLOOR = { x: -150, y: -126, w: 290, d: 262, r: 10 };
const CAB = { x: -124, y: -104, w: 248, d: 208 };           // cabinet and enclosure footprint
const X0 = CAB.x, X1 = CAB.x + CAB.w, Y0 = CAB.y, Y1 = CAB.y + CAB.d;
const FOOT = 10;                                            // cabinet floor plate underside
const BOT = 14;                                             // top of the cabinet floor plate
const TOPC = 176;                                           // top of the cabinet
const WT = 182;                                             // top of the worktop
const ROOF0 = 318, ROOF1 = 324;
const POST = 7;
const SHELF = 96, SHELF_T = 3;
const DOOR = { x0: -86, x1: 86, y0: Y1 + 2.5, y1: Y1 + 5.5, z0: 184, z1: 298, travel: 70 };
const OPEN = { x0: -84, x1: 84, z0: 186, z1: 296 };
const RAIL_TOP = DOOR.z1 + DOOR.travel + 4;
const C = [-10, -14];                                       // lens axis = centre of the part
const PART = { x: C[0] - 28, y: C[1] - 26, w: 56, d: 52 };
const FIXT = { x: C[0] - 42, y: C[1] - 40, w: 84, d: 80 };
const FIX_Z = WT + 6, PART_Z = FIX_Z + 3;                   // fixture top, part top
const LENS_BOT = 220;
const HOME_DZ = 14;                                         // Z axis travel from focus to home
const MARK_SCALE = 50;                                      // drawn units per unit share of the field

const P = k.fitProjection(
  [...k.boxCorners(FLOOR, -4, 0), [X0, Y0, ROOF1], [X1, Y0, ROOF1], [X1, Y1, ROOF1], [X0, Y1, ROOF1],
   [DOOR.x0, Y1 + 3, RAIL_TOP], [DOOR.x1, Y1 + 3, RAIL_TOP], [X1 - 24, Y0 + 18, 381], [-182, Y1 + 12, 272]],
  W, H, { pad: 18, azimuth: AZIMUTH, elevation: ELEVATION });
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (pts, style) => k.dotsSvg(pts, style);
const path3 = (pts, closed = false) => k.pathOf(pts.map(at), closed);
const f2 = (v) => Math.round(v * 100) / 100;

/* ---- the recorder: every drawn item with its true shape -------------------------- */
const R = A.recorder(P);
const record = R.solid;
function put(name, ref, svg, shapes = [], { bias = 0, move, opt, part } = {}) {
  const attrs = (move ? ` data-move="${move}"` : "") + (opt ? ` data-opt="${opt}"` : "") + (part ? ` data-part="${part}"` : "");
  return R.put({ name: R.nameFor(name), at: ref, bias, svg, shapes, piece: "ws", attrs });
}
const XF = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const YF = G.frameOf([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
const ZF = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const fz = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const fy = (o) => G.frameOf(o, [0, 1, 0], [0, 0, 1], [1, 0, 0]);
const fx = (o) => G.frameOf(o, [1, 0, 0], [0, 1, 0], [0, 0, 1]);

/* A square block [x0,y0,z0]–[x1,y1,z1]; `inner` and `extra` carry its face details. */
function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.4, bevel = 0, extra = "", inner = "", bias = 0, move, opt, ground = false, owner } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  const shape = record(A.slab(plan, z0, z1 - z0, { name, ...(ground ? { ground: true } : {}), ...(owner ? { owner } : {}) }, 2));
  return put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    S(k.slabOf(plan, z0, z1 - z0, P, 2, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, move, opt });
}
/* A turned part along frame F, from a [s, r] profile. */
function turned(name, F, profile, style = {}, { extra = "", bias = 0, move, opt, steps, owner, bevel = 0 } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel, ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name, owner }));
  return put(name, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style }) + extra, [shape], { bias, move, opt });
}
const disc = (name, F, s0, s1, r, style, o) => turned(name, F, [[s0, r], [s1, r]], style, o);
function prism(name, F, poly, s0, s1, style = {}, { extra = "", bias = 0, move, opt } = {}) {
  const shape = record(A.prism(F, poly, s0, s1, { name }));
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  const centre = G.add3(G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.mul3(F.u, cx)), G.mul3(F.v, cy));
  return put(name, centre, S(G.prismOf(F, poly, s0, s1, P), { tone: "mid", ...style }) + extra, [shape], { bias, move, opt });
}
const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

/* face details: points on the +x face (x = X), the +y face (y = Y) and a top (z = Z) */
const onX = (X, pts) => pts.map(([y, z]) => [X, y, z]);
const onY = (Y, pts) => pts.map(([x, z]) => [x, Y, z]);
const onZ = (Z, pts) => pts.map(([x, y]) => [x, y, Z]);
const slot = (a0, a1, b0, b1) => [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
const closed = (pts, tone = "faint") => Ln(path3(pts, true), { tone });
const open = (pts, tone = "faint") => Ln(path3(pts), { tone });
const dotsAt = (pts, size = 0.45, tone = "lo") => Dots(pts.map(at), { size, tone });
/* screws: a dot with a ring, at the corners of a face rectangle */
function screwsY(Y, x0, x1, z0, z1, inset = 3) {
  const c = [[x0 + inset, z0 + inset], [x1 - inset, z0 + inset], [x1 - inset, z1 - inset], [x0 + inset, z1 - inset]];
  return dotsAt(onY(Y, c), 0.45, "lo");
}
function screwsX(X, y0, y1, z0, z1, inset = 3) {
  const c = [[y0 + inset, z0 + inset], [y1 - inset, z0 + inset], [y1 - inset, z1 - inset], [y0 + inset, z1 - inset]];
  return dotsAt(onX(X, c), 0.45, "lo");
}
function ventsX(X, y0, y1, z0, z1, n, horizontal = false) {
  let o = "";
  for (let i = 0; i < n; i++) {
    if (horizontal) { const z = z0 + (z1 - z0) * (i + 0.5) / n; o += closed(onX(X, slot(y0, y1, z - 0.5, z + 0.5)), "lo"); }
    else { const y = y0 + (y1 - y0) * (i + 0.5) / n; o += closed(onX(X, slot(y - 0.5, y + 0.5, z0, z1)), "lo"); }
  }
  return o;
}
function ventsY(Y, x0, x1, z0, z1, n) {
  let o = "";
  for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * (i + 0.5) / n; o += closed(onY(Y, slot(x0, x1, z - 0.5, z + 0.5)), "lo"); }
  return o;
}
/* a label plate on the +y face with three rule lines (printed text) */
function labelY(Y, x0, x1, z0, z1) {
  let o = closed(onY(Y, slot(x0, x1, z0, z1)), "lo");
  for (let i = 1; i <= 3; i++) {
    const z = z1 - (z1 - z0) * i / 4, x2 = x1 - (x1 - x0) * (i === 2 ? 0.35 : 0.15);
    o += Ln(path3(onY(Y, [[x0 + 1.4, z], [x2 - 1.4, z]])), { tone: "lo", free: "both" });
  }
  return o;
}
function labelX(X, y0, y1, z0, z1) {
  let o = closed(onX(X, slot(y0, y1, z0, z1)), "lo");
  for (let i = 1; i <= 3; i++) {
    const z = z1 - (z1 - z0) * i / 4, y2 = y1 - (y1 - y0) * (i === 2 ? 0.35 : 0.15);
    o += Ln(path3(onX(X, [[y0 + 1.4, z], [y2 - 1.4, z]])), { tone: "lo", free: "both" });
  }
  return o;
}

/* ---- cables: routed, filleted, cut into depth-sortable chunks -------------------- */
function cable(name, points, r, { tone = "mid", bend = 6, ends = [true, true], maxLength = 22, bias = 0.05, opt, rings } = {}) {
  const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
  R.route(name, route, r, { limp: true, piece: "ws" });
  tubePieces(route, r, P, { maxLength, spacing: Math.max(0.6, Math.min(1.6, r)), ...(rings ? { rings } : {}) }).forEach((piece, index) =>
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }), [A.tube(piece.points, piece.radii, { name: `${name}:${index}`, limp: true })], { bias, opt }));
  return route;
}

/* =================================================================================== */
/* base: floor plate, levelling feet                                                    */
/* =================================================================================== */
const back = [`<path class="iso-halo" d="${k.haloOf(FLOOR, -4, 4, P)}"/>`];
back.push(S(k.slabOf(FLOOR, -4, 4, P, 8, 1), { tone: "lo", inner: Ln(k.sideSeam(FLOOR, -2, P, 8), { tone: "faint" }) }));
back.push(Ln(k.planOutline(k.insetPlan(FLOOR, 6), 0, P), { tone: "faint" }));
{
  /* a floor rule along the front edge: ticks every 20 mm, major every 100 mm */
  const STRIP = { x: FLOOR.x + 18, y: FLOOR.y + FLOOR.d - 12, w: FLOOR.w - 36, d: 5, r: 1 };
  back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y, 0.6, [1.6, 3.2], P);
  back.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
  const sc = k.corners(FLOOR, 10);
  back.push(Ln(sc.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }), Dots(sc.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
}
record(A.slab(FLOOR, -4, 4, { name: "stand.floor", ground: true }, 8));
for (const [x, y] of k.corners(CAB, 12)) {
  turned("foot.pad", fz([x, y, 0]), [[0, 6], [2, 6], [2, 4.2], [4, 4.2]], { tone: "lo" });
  turned("foot.stem", fz([x, y, 4]), [[0, 1.6], [3, 1.6], [3, 3.6], [6, 3.6]], { tone: "mid" });
}

/* =================================================================================== */
/* lower cabinet, right side panel off                                                  */
/* =================================================================================== */
box("cab.floor", [X0, Y0, FOOT], [X1, Y1, BOT], { tone: "lo" });
box("cab.back", [X0, Y0, BOT], [X1 - POST, Y0 + 3, TOPC], { tone: "lo" }, { extra: screwsY(Y0 + 3, X0 + 3, X1 - POST, BOT, TOPC, 5) });
box("cab.left", [X0, Y0 + 3, BOT], [X0 + 3, Y1 - 3, TOPC], { tone: "lo" });
box("cab.post.rb", [X1 - POST, Y0, BOT], [X1, Y0 + POST, TOPC], { tone: "mid" },
  { extra: dotsAt(Array.from({ length: 7 }, (_, i) => [X1, Y0 + POST / 2, BOT + 14 + i * 22]), 0.45, "lo") });
box("cab.post.rf", [X1 - POST, Y1 - POST, BOT], [X1, Y1, TOPC], { tone: "mid" },
  { extra: dotsAt(Array.from({ length: 7 }, (_, i) => [X1, Y1 - POST / 2, BOT + 14 + i * 22]), 0.45, "lo") });
box("cab.rail.top", [X1 - POST, Y0 + POST, TOPC - 6], [X1, Y1 - POST, TOPC], { tone: "mid" });
box("cab.rail.bot", [X1 - POST, Y0 + POST, BOT], [X1, Y1 - POST, BOT + 6], { tone: "mid" });
{
  /* two front doors: hinges, a handle, louvres; the left one carries the nameplate */
  const z0 = BOT + 2, z1 = TOPC - 2;
  const doorL = [X0 + 3, -1], doorR = [1, X1 - POST];
  for (const [n, [x0, x1]] of [["L", doorL], ["R", doorR]]) {
    let ex = closed(onY(Y1, slot(x0 + 6, x1 - 6, z0 + 6, z1 - 6)), "faint") + ventsY(Y1, x0 + 22, x1 - 22, z0 + 12, z0 + 34, 6);
    const hx = n === "L" ? x1 - 9 : x0 + 9;
    ex += dotsAt(onY(Y1, [[hx, z1 - 48], [hx, z1 - 78]]), 0.5, "mid");
    if (n === "L") ex += labelY(Y1, x0 + 20, x0 + 62, z1 - 34, z1 - 18);
    box(`cab.door.${n}`, [x0, Y1 - 3, z0], [x1, Y1, z1], { tone: "mid" }, { extra: ex });
    /* hinge knuckles on the outer edge, the handle bar near the meeting edge */
    const hxs = n === "L" ? x0 + 1.5 : x1 - 1.5;
    for (const z of [z0 + 18, z1 - 18]) disc(`cab.door.${n}.hinge`, fz([hxs, Y1 + 1.4, z - 5]), 0, 10, 1.4, { tone: "lo" });
    box(`cab.door.${n}.handle.mount`, [hx - 1.6, Y1, z1 - 80], [hx + 1.6, Y1 + 2.2, z1 - 76], { tone: "lo" });
    box(`cab.door.${n}.handle.mount`, [hx - 1.6, Y1, z1 - 50], [hx + 1.6, Y1 + 2.2, z1 - 46], { tone: "lo" });
    disc(`cab.door.${n}.handle`, fz([hx, Y1 + 3.6, z1 - 80]), 0, 34, 1.4, { tone: "hi" });
    turned(`cab.door.${n}.lock`, fy([n === "L" ? hx - 8 : hx + 8, Y1, z1 - 63]), [[0, 2.2], [1.2, 2.2], [1.2, 1.4], [2, 1.4]], { tone: "mid" },
      { extra: dotsAt([[n === "L" ? hx - 8 : hx + 8, Y1 + 2, z1 - 63]], 0.4, "lo") });
  }
}
/* the worktop: a 30 mm steel plate with T-slots */
{
  const plan = { x: X0 - 4, y: Y0 - 4, w: CAB.w + 8, d: CAB.d + 8, r: 2 };
  let ex = "";
  for (let i = 0; i < 6; i++) {
    const y = Y0 + 30 + i * 30;
    if (y > C[1] - 44 && y < C[1] + 44) {
      ex += closed(onZ(WT, slot(X0 + 6, C[0] - 46, y - 1, y + 1)), "faint") + closed(onZ(WT, slot(C[0] + 46, X1 - 6, y - 1, y + 1)), "faint");
    } else ex += closed(onZ(WT, slot(X0 + 6, X1 - 6, y - 1, y + 1)), "faint");
  }
  const sh = record(A.slab(plan, TOPC, WT - TOPC, { name: "worktop" }, 2));
  put("worktop", [0, 0, (TOPC + WT) / 2], S(k.slabOf(plan, TOPC, WT - TOPC, P, 2, 0.8), { tone: "mid", inner: Ln(k.sideSeam(plan, TOPC + 3, P, 2), { tone: "faint" }) }) + ex, [sh]);
}

/* ---- inside the cabinet ----------------------------------------------------------- */
/* the fibre laser source: a 19-inch-style unit with handles, vents and status lamps */
const SRC = { x0: 0, x1: 104, y0: -80, y1: 50, z0: BOT, z1: 56 };
box("src.unit", [SRC.x0, SRC.y0, SRC.z0], [SRC.x1, SRC.y1, SRC.z1], { tone: "mid" }, {
  bevel: 0.8,
  extra: ventsX(SRC.x1, SRC.y0 + 10, SRC.y0 + 70, SRC.z0 + 8, SRC.z1 - 10, 14) + labelX(SRC.x1, SRC.y0 + 82, SRC.y1 - 10, SRC.z1 - 18, SRC.z1 - 8) +
    dotsAt(onX(SRC.x1, [[SRC.y0 + 84, SRC.z0 + 10], [SRC.y0 + 90, SRC.z0 + 10], [SRC.y0 + 96, SRC.z0 + 10]]), 0.6, "hi") +
    closed(onZ(SRC.z1, slot(SRC.x0 + 6, SRC.x1 - 6, SRC.y0 + 6, SRC.y1 - 6)), "faint") +
    screwsX(SRC.x1, SRC.y0, SRC.y1, SRC.z0, SRC.z1, 3) + ventsY(SRC.y1, SRC.x0 + 20, SRC.x1 - 20, SRC.z0 + 8, SRC.z1 - 8, 8),
});
for (const x of [SRC.x0 + 8, SRC.x1 - 8]) {
  box("src.handle.base", [x - 2, SRC.y1, SRC.z1 - 30], [x + 2, SRC.y1 + 2, SRC.z1 - 26], { tone: "lo" });
  box("src.handle.base", [x - 2, SRC.y1, SRC.z1 - 12], [x + 2, SRC.y1 + 2, SRC.z1 - 8], { tone: "lo" });
  disc("src.handle", fz([x, SRC.y1 + 3.4, SRC.z1 - 30]), 0, 22, 1.4, { tone: "hi" });
}
/* fibre output on the source's top, with its strain-relief boot */
const FIB_OUT = [36, -72, SRC.z1];
turned("src.fibre.port", fz(FIB_OUT), [[0, 5], [2, 5], [2, 3.4], [6, 3.4], [6, 2.4], [10, 2.4]], { tone: "hi" });

/* the fume extractor (when configured): cabinet unit with its filter door */
const FUME = { x0: -112, x1: -24, y0: -97, y1: 30, z0: BOT, z1: 90 };
box("fume.unit", [FUME.x0, FUME.y0, FUME.z0], [FUME.x1, FUME.y1, FUME.z1], { tone: "lo" }, {
  opt: "fume",
  extra: closed(onY(FUME.y1, slot(FUME.x0 + 8, FUME.x1 - 8, FUME.z0 + 8, FUME.z1 - 8)), "faint") + ventsY(FUME.y1, FUME.x0 + 16, FUME.x1 - 16, FUME.z0 + 14, FUME.z0 + 34, 6) +
    labelY(FUME.y1, FUME.x0 + 16, FUME.x0 + 48, FUME.z1 - 26, FUME.z1 - 14) + screwsY(FUME.y1, FUME.x0, FUME.x1, FUME.z0, FUME.z1, 3) +
    closed(onX(FUME.x1, slot(FUME.y0 + 8, FUME.y1 - 8, FUME.z0 + 8, FUME.z1 - 8)), "faint"),
});
turned("fume.outlet", fz([-110 + 0, -92, FUME.z1]), [[0, 5.4], [3, 5.4], [3, 4.2], [6, 4.2]], { tone: "mid" }, { opt: "fume" });

/* the shelf, the controller and the power supply */
box("shelf", [X0 + 3, -88, SHELF], [X1 - POST, Y1 - 3, SHELF + SHELF_T], { tone: "lo" });
box("shelf.bracket", [X1 - POST - 0.01, -88, SHELF - 4], [X1 - POST + 0.01, Y1 - 3, SHELF], { tone: "lo" });
const PC = { x0: 12, x1: 92, y0: -84, y1: -22, z0: SHELF + SHELF_T, z1: SHELF + SHELF_T + 42 };
{
  const fan = G.circleOf(fx([PC.x1, -53, PC.z0 + 21]), 0, 13, P, 40);
  box("pc", [PC.x0, PC.y0, PC.z0], [PC.x1, PC.y1, PC.z1], { tone: "mid" }, {
    bevel: 0.6,
    extra: Ln(fan, { tone: "lo" }) + Ln(G.circleOf(fx([PC.x1, -53, PC.z0 + 21]), 0, 8, P, 32), { tone: "faint" }) + Ln(G.circleOf(fx([PC.x1, -53, PC.z0 + 21]), 0, 3, P, 20), { tone: "lo" }) +
      dotsAt(onX(PC.x1, [[PC.y0 + 4, PC.z1 - 5], [PC.y0 + 4, PC.z1 - 9]]), 0.55, "hi") + labelX(PC.x1, PC.y1 - 22, PC.y1 - 4, PC.z1 - 14, PC.z1 - 4) +
      ventsY(PC.y1, PC.x0 + 10, PC.x1 - 10, PC.z0 + 6, PC.z1 - 6, 7) + closed(onX(PC.x1, slot(PC.y1 - 22, PC.y1 - 4, PC.z0 + 6, PC.z0 + 22)), "faint"),
  });
}
const PSU = { x0: 12, x1: 72, y0: -10, y1: 48, z0: SHELF + SHELF_T, z1: SHELF + SHELF_T + 24 };
box("psu", [PSU.x0, PSU.y0, PSU.z0], [PSU.x1, PSU.y1, PSU.z1], { tone: "mid" }, {
  extra: labelX(PSU.x1, PSU.y0 + 6, PSU.y0 + 30, PSU.z1 - 12, PSU.z1 - 4) + dotsAt(onX(PSU.x1, [[PSU.y1 - 8, PSU.z0 + 6]]), 0.6, "hi") + ventsX(PSU.x1, PSU.y0 + 36, PSU.y1 - 4, PSU.z0 + 4, PSU.z1 - 4, 6),
});
for (let i = 0; i < 9; i++) {
  const y = PSU.y0 + 4 + i * 6.2;
  box("psu.fin", [PSU.x0 + 4, y, PSU.z1], [PSU.x1 - 4, y + 1.2, PSU.z1 + 6], { tone: "lo" });
}
/* the safety and distribution rail on the back wall: breakers, relays, a duct above */
const DIN = { x0: -102, x1: -8, z: 150 };
box("din.rail", [DIN.x0, Y0 + 3, DIN.z - 2], [DIN.x1, Y0 + 5, DIN.z + 2], { tone: "lo" });
for (let i = 0; i < 10; i++) {
  const x = DIN.x0 + 3 + i * 9.2, wide = i === 0 || i === 7;
  const w = wide ? 8 : 6;
  box("din.module", [x, Y0 + 5, DIN.z - 9], [x + w, Y0 + 14, DIN.z + 9], { tone: i === 0 ? "hi" : "mid" }, {
    extra: closed(onY(Y0 + 14, slot(x + 1.4, x + w - 1.4, DIN.z - 2, DIN.z + 2)), "lo") + dotsAt(onZ(DIN.z + 9, [[x + w / 2, Y0 + 9.5]]), 0.35, "lo"),
  });
}
box("din.duct", [DIN.x0 - 2, Y0 + 3, DIN.z + 13], [DIN.x1 + 2, Y0 + 11, DIN.z + 21], { tone: "lo" }, {
  extra: Array.from({ length: 12 }, (_, i) => closed(onY(Y0 + 11, slot(DIN.x0 + 2 + i * 8, DIN.x0 + 5 + i * 8, DIN.z + 14.5, DIN.z + 19.5)), "faint")).join(""),
});

/* a slotted cable duct up the back corner, from the floor plate to under the top rail */
box("cab.duct", [106, Y0 + 3, BOT], [114, Y0 + 11, TOPC - 6], { tone: "lo" }, {
  extra: Array.from({ length: 13 }, (_, i) => closed(onX(114, slot(Y0 + 5, Y0 + 9, BOT + 8 + i * 11.6, BOT + 12 + i * 11.6)), "faint")).join(""),
});

/* =================================================================================== */
/* upper enclosure: posts, back and left walls, roof, front panels, lift door           */
/* =================================================================================== */
const POSTS = [[X0, Y0], [X1 - POST, Y0], [X0, Y1 - POST], [X1 - POST, Y1 - POST]];
for (const [x, y] of POSTS) {
  /* aluminium extrusion: a groove down each visible face */
  const gx = closed(onX(x + POST, slot(y + 2.8, y + POST - 2.8, WT + 2, ROOF0 - 2)), "lo");
  const gy = closed(onY(y + POST, slot(x + 2.8, x + POST - 2.8, WT + 2, ROOF0 - 2)), "lo");
  box("enc.post", [x, y, WT], [x + POST, y + POST, ROOF0], { tone: "mid" }, { extra: gx + gy });
}
box("enc.back", [X0 + POST, Y0, WT], [X1 - POST, Y0 + 3, ROOF0], { tone: "lo" },
  { extra: screwsY(Y0 + 3, X0 + POST, X1 - POST, WT, ROOF0, 4) + closed(onY(Y0 + 3, slot(X0 + 14, X1 - 14, WT + 8, ROOF0 - 8)), "faint") });
box("enc.left", [X0, Y0 + POST, WT], [X0 + 3, Y1 - POST, ROOF0], { tone: "lo" });
/* the roof panel is off too: its frame stays, with corner gussets */
const RF = 8;
box("enc.roof.back", [X0 - 2, Y0 - 2, ROOF0], [X1 + 2, Y0 + RF, ROOF1], { tone: "mid" }, { extra: dotsAt(onZ(ROOF1, [[X0 + 6, Y0 + 3], [X1 - 6, Y0 + 3]]), 0.5, "lo") });
box("enc.roof.front", [X0 - 2, Y1 - RF, ROOF0], [X1 + 2, Y1, ROOF1], { tone: "mid" }, { extra: dotsAt(onZ(ROOF1, [[X0 + 6, Y1 - 3], [X1 - 6, Y1 - 3]]), 0.5, "lo") });
box("enc.roof.left", [X0 - 2, Y0 + RF, ROOF0], [X0 + RF, Y1 - RF, ROOF1], { tone: "mid" });
for (const [x, y] of [[X0 + RF, Y0 + RF], [X1 - RF - 18, Y0 + RF], [X0 + RF, Y1 - RF - 18], [X1 - RF - 18, Y1 - RF - 18]])
  box("enc.roof.gusset", [x, y, ROOF1 - 1.2], [x + 18, y + 18, ROOF1], { tone: "lo" }, { extra: dotsAt(onZ(ROOF1, [[x + 9, y + 9]]), 0.45, "lo") });
box("enc.header", [X0 + POST, Y1 - 3, OPEN.z1], [X1 - POST, Y1, ROOF0], { tone: "mid" },
  { extra: closed(onY(Y1, slot(X0 + POST + 4, X1 - POST - 4, OPEN.z1 + 4, ROOF0 - 4)), "faint") });
box("enc.panel.L", [X0 + POST, Y1 - 3, WT], [OPEN.x0, Y1, OPEN.z1], { tone: "mid" },
  { extra: closed(onY(Y1, slot(X0 + POST + 4, OPEN.x0 - 4, WT + 4, OPEN.z1 - 4)), "faint") + labelY(Y1, X0 + POST + 8, OPEN.x0 - 8, OPEN.z1 - 26, OPEN.z1 - 12) });
box("enc.panel.R", [OPEN.x1, Y1 - 3, WT], [X1 - POST, Y1, OPEN.z1], { tone: "mid" },
  { extra: closed(onY(Y1, slot(OPEN.x1 + 4, X1 - POST - 4, WT + 4, OPEN.z1 - 4)), "faint") + labelY(Y1, OPEN.x1 + 8, X1 - POST - 8, OPEN.z1 - 30, OPEN.z1 - 14) });
box("enc.sill", [OPEN.x0, Y1 - 3, WT], [OPEN.x1, Y1, OPEN.z0], { tone: "lo" });
/* interior light bar under the roof */
box("enc.light", [X0 + 20, Y1 - RF + 1, ROOF0 - 5], [X1 - 20, Y1 - 3, ROOF0], { tone: "hi" });
/* door guide rails and the interlock */
for (const xr of [DOOR.x0 - 4, DOOR.x1]) {
  box("door.rail", [xr, Y1, WT + 1], [xr + 4, Y1 + 6, RAIL_TOP], { tone: "lo" },
    { extra: closed(onY(Y1 + 6, slot(xr + 1.4, xr + 2.6, WT + 6, RAIL_TOP - 4)), "faint") });
  turned("door.rail.cap", fz([xr + 2, Y1 + 3, RAIL_TOP]), [[0, 2.6], [2, 2.6]], { tone: "mid" });
}
box("door.interlock", [DOOR.x1 + 4, Y1, OPEN.z0 + 20], [DOOR.x1 + 12, Y1 + 5, OPEN.z0 + 34], { tone: "hi" },
  { extra: dotsAt(onY(Y1 + 5, [[DOOR.x1 + 8, OPEN.z0 + 30]]), 0.55, "lo") + closed(onY(Y1 + 5, slot(DOOR.x1 + 5.4, DOOR.x1 + 10.6, OPEN.z0 + 22, OPEN.z0 + 26)), "lo") });
/* the door: a frame round a laser-safety window, a handle bar, moved by the page */
{
  const { x0, x1, y0, y1, z0, z1 } = DOOR;
  const ex = closed(onY(y1, slot(x0 + 8, x1 - 8, z0 + 14, z1 - 10)), "lo") + closed(onY(y1, slot(x0 + 10, x1 - 10, z0 + 16, z1 - 12)), "faint") + screwsY(y1, x0, x1, z0, z1, 3);
  box("door.panel", [x0, y0, z0], [x1, y1, z1], { tone: "mid" }, { extra: ex, move: "door" });
  box("door.glass", [x0 + 10, y1, z0 + 16], [x1 - 10, y1 + 0.4, z1 - 12], { tone: "lo" }, { move: "door", extra: Ln(path3(onY(y1 + 0.4, [[x0 + 30, z1 - 16], [x0 + 60, z0 + 40]])), { tone: "faint", free: "both" }) });
  for (const x of [-40, 40]) box("door.handle.mount", [x - 2, y1, z0 + 5], [x + 2, y1 + 4, z0 + 9], { tone: "lo" }, { move: "door" });
  disc("door.handle", fx([-44, y1 + 5.4, z0 + 7]), 0, 88, 1.6, { tone: "hi" }, { move: "door" });
}
/* front control strip: emergency stop, start and stop buttons, key switch */
{
  const y = Y1, z0 = TOPC - 26, z1 = TOPC - 8, x0 = 34, x1 = 108;
  box("ctl.strip", [x0, y, z0], [x1, y + 4, z1], { tone: "mid" }, { extra: labelY(y + 4, x0 + 50, x1 - 4, z0 + 4, z1 - 4) });
  turned("ctl.estop.collar", fy([x0 + 10, y + 4, (z0 + z1) / 2]), [[0, 6], [2, 6]], { tone: "lo" });
  turned("ctl.estop", fy([x0 + 10, y + 6, (z0 + z1) / 2]), [[0, 3], [2, 3], [2.6, 5.6], [5, 5.6, 1], [5.6, 4.6]], { tone: "hi" });
  turned("ctl.start", fy([x0 + 26, y + 4, (z0 + z1) / 2]), [[0, 3.4], [2.4, 3.4], [2.4, 2.6], [3.4, 2.6]], { tone: "hi" });
  turned("ctl.stop", fy([x0 + 37, y + 4, (z0 + z1) / 2]), [[0, 3.4], [2.4, 3.4], [2.4, 2.6], [3.0, 2.6]], { tone: "mid" });
  turned("ctl.key", fy([x0 + 47, y + 4, (z0 + z1) / 2 + 1]), [[0, 2.6], [1.8, 2.6]], { tone: "lo" });
}

/* ---- light tower on the roof ------------------------------------------------------ */
const TWR = [X1 - 24, Y0 + 18];
turned("tower.base", fz([TWR[0], TWR[1], ROOF1]), [[0, 6], [3, 6], [3, 4], [5, 4]], { tone: "lo" });
turned("tower.pole", fz([TWR[0], TWR[1], ROOF1 + 5]), [[0, 1.6], [20, 1.6]], { tone: "mid" });
const TWR_SEG = [ROOF1 + 25, ROOF1 + 34, ROOF1 + 43];
TWR_SEG.forEach((z, i) => turned(`tower.seg${i}`, fz([TWR[0], TWR[1], z]), [[0, 4.4], [9, 4.4]], { tone: i === 2 ? "hi" : "mid" }, { extra: "" }));
turned("tower.cap", fz([TWR[0], TWR[1], ROOF1 + 52]), [[0, 4.6], [1.6, 4.6], [3, 2.4]], { tone: "lo" });

/* =================================================================================== */
/* Z column, scan head, objective                                                       */
/* =================================================================================== */
const COL = { x0: C[0] - 14, x1: C[0] + 14, y0: Y0 + 3, y1: Y0 + 19, z0: WT + 4, z1: 292 };
box("z.foot", [COL.x0 - 8, Y0 + 3, WT], [COL.x1 + 8, Y0 + 26, WT + 4], { tone: "lo" },
  { extra: dotsAt(onZ(WT + 4, [[COL.x0 - 4, Y0 + 22], [COL.x1 + 4, Y0 + 22], [COL.x0 - 4, Y0 + 8], [COL.x1 + 4, Y0 + 8]]), 0.5, "lo") });
{
  let ex = closed(onX(COL.x1, slot(COL.y0 + 4, COL.y1 - 4, COL.z0 + 4, COL.z1 - 4)), "lo");
  /* a scale strip on the side: ticks every 10 mm, a major every 50 mm */
  ex += closed(onX(COL.x1, slot(COL.y1 - 3, COL.y1 - 1, COL.z0 + 10, COL.z1 - 10)), "faint");
  for (let z = COL.z0 + 12, i = 0; z <= COL.z1 - 12; z += 2, i++) ex += Ln(path3(onX(COL.x1, [[COL.y1 - 3, z], [COL.y1 - 3 - (i % 5 === 0 ? 2.6 : 1.4), z]])), { tone: i % 5 === 0 ? "mid" : "lo", free: "end" });
  box("z.column", [COL.x0, COL.y0, COL.z0], [COL.x1, COL.y1, COL.z1], { tone: "mid" }, { extra: ex });
}
for (const x of [COL.x0 + 3, COL.x1 - 6]) box("z.guide", [x, COL.y1, COL.z0 + 8], [x + 3, COL.y1 + 2, COL.z1 - 6], { tone: "hi" });
box("z.screwcover", [C[0] - 4, COL.y1, COL.z0 + 8], [C[0] + 4, COL.y1 + 1.2, COL.z1 - 6], { tone: "lo" },
  { extra: Array.from({ length: 16 }, (_, i) => closed(onY(COL.y1 + 1.2, slot(C[0] - 2.8, C[0] + 2.8, COL.z0 + 11.7 + i * 6, COL.z0 + 12.3 + i * 6)), "faint")).join("") });
/* the stepper on top of the column with its fins and connector */
box("z.motor", [C[0] - 11, COL.y0 + 1, COL.z1], [C[0] + 11, COL.y1 - 1, COL.z1 + 12], { tone: "mid" }, {
  extra: Array.from({ length: 3 }, (_, i) => closed(onX(C[0] + 11, slot(COL.y0 + 4, COL.y1 - 4, COL.z1 + 2.4 + i * 3.4, COL.z1 + 3.6 + i * 3.4)), "lo")).join("") + screwsY(COL.y1 - 1, C[0] - 11, C[0] + 11, COL.z1, COL.z1 + 12, 2.2),
});
/* --- the moving Z assembly (data-move="z"): carriage, arm, head, objective --- */
const CAR = { x0: C[0] - 16, x1: C[0] + 16, y0: COL.y1 + 2, y1: COL.y1 + 6, z0: 238, z1: 268 };
box("z.carriage", [CAR.x0, CAR.y0, CAR.z0], [CAR.x1, CAR.y1, CAR.z1], { tone: "hi" }, { move: "z", extra: screwsY(CAR.y1, CAR.x0, CAR.x1, CAR.z0, CAR.z1, 3) });
const HEAD = { x0: C[0] - 22, x1: C[0] + 22, y0: C[1] - 40, y1: C[1] + 10, z0: 240, z1: 262 };
box("z.arm", [C[0] - 7, CAR.y1, 248], [C[0] + 7, HEAD.y0, 258], { tone: "mid" }, { move: "z", extra: closed(onX(C[0] + 7, slot(CAR.y1 + 3, HEAD.y0 - 3, 250.5, 255.5)), "faint") });
box("head.housing", [HEAD.x0, HEAD.y0, HEAD.z0], [HEAD.x1, HEAD.y1, HEAD.z1], { tone: "hi" }, {
  bevel: 0.8, move: "z",
  extra: closed(onX(HEAD.x1, slot(HEAD.y0 + 4, HEAD.y1 - 4, HEAD.z0 + 4, HEAD.z1 - 4)), "faint") + labelY(HEAD.y1, HEAD.x0 + 6, HEAD.x0 + 26, HEAD.z0 + 6, HEAD.z1 - 6) +
    screwsY(HEAD.y1, HEAD.x0, HEAD.x1, HEAD.z0, HEAD.z1, 2.4) + dotsAt(onY(HEAD.y1, [[HEAD.x1 - 6, HEAD.z1 - 6]]), 0.6, "hi") +
    closed(onZ(HEAD.z1, slot(HEAD.x0 + 4, HEAD.x1 - 4, HEAD.y0 + 4, HEAD.y1 - 4)), "faint"),
});
/* the two galvo motors seen as their end caps, and the collimator the fibre enters */
turned("head.motor.x", fx([HEAD.x1, C[1] - 28, 251]), [[0, 5], [3, 5], [3, 3.6], [5, 3.6]], { tone: "mid" }, { move: "z" });
turned("head.motor.y", fz([C[0] - 12, C[1] + 4, HEAD.z1]), [[0, 5], [3, 5], [3, 3.6], [5, 3.6]], { tone: "mid" }, { move: "z" });
const COLL = [C[0] + 10, C[1] - 30];
turned("head.collimator", fz([COLL[0], COLL[1], HEAD.z1]), [[0, 5], [2, 5], [2, 4], [12, 4], [12, 4.8], [14, 4.8], [14, 3], [16, 3]], { tone: "mid" }, { move: "z",
  extra: Ln(G.circleOf(fz([COLL[0], COLL[1], HEAD.z1]), 7, 4.02, P, 32), { tone: "lo" }) });
/* the f-theta objective: barrel, knurled focus ring, protective window */
turned("lens.barrel", fz([C[0], C[1], LENS_BOT]), [[0, 7.6], [1.2, 7.6], [1.2, 9.4], [5, 9.4], [5, 10.4], [9, 10.4], [9, 9.4], [12, 9.4], [12, 10], [20, 10]], { tone: "mid" },
  { move: "z", extra: k.fadedSvg(G.ribsOf(fz([C[0], C[1], LENS_BOT]), 5, 9, 10.4, 40, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) });
/* the vision camera with its ring light (fiducial locate / grading) */
const CAM = [HEAD.x1 + 6, C[1] + 2];
box("cam.body", [HEAD.x1, C[1] - 8, 244], [HEAD.x1 + 12, C[1] + 10, 262], { tone: "mid" }, { move: "z", opt: "cam",
  extra: labelX(HEAD.x1 + 12, C[1] - 5, C[1] + 7, 254, 260) + dotsAt(onX(HEAD.x1 + 12, [[C[1] + 7, 247]]), 0.55, "hi") });
turned("cam.lens", fz([CAM[0], CAM[1], 236]), [[0, 3.4], [8, 3.4]], { tone: "lo" }, { move: "z", opt: "cam" });
turned("cam.ring", fz([CAM[0], CAM[1], 232]), [[0, 6], [4, 6]], { tone: "hi" }, { move: "z", opt: "cam" });
/* the auto-focus triangulation sensor on the front of the head */
box("af.sensor", [C[0] - 20, HEAD.y1, 242], [C[0] - 8, HEAD.y1 + 6, 256], { tone: "mid" }, { move: "z", opt: "af",
  extra: dotsAt(onZ(242, [[C[0] - 17, HEAD.y1 + 3], [C[0] - 11, HEAD.y1 + 3]]), 0.55, "hi") });
/* the fibre's gland bracket under the roof; the page draws the leg down to the head */
const GLAND = [COLL[0], COLL[1], 306];
box("fibre.bracket", [COLL[0] - 7, Y0 + 3, 306], [COLL[0] + 7, COLL[1] + 7, 312], { tone: "lo" });
turned("fibre.gland", fz([COLL[0], COLL[1], 300]), [[0, 2.6], [2, 2.6], [2, 3.8], [6, 3.8]], { tone: "mid" });

/* ---- fixture, clamps, part -------------------------------------------------------- */
box("fix.plate", [FIXT.x, FIXT.y, WT], [FIXT.x + FIXT.w, FIXT.y + FIXT.d, FIX_Z], { tone: "lo" }, {
  extra: dotsAt(onZ(FIX_Z, k.corners(FIXT, 4)), 0.5, "lo") + Ln(k.ring(FIXT.x + 4, FIXT.y + 4, 1.8, FIX_Z, P, 14) + k.ring(FIXT.x + FIXT.w - 4, FIXT.y + FIXT.d - 4, 1.8, FIX_Z, P, 14), { tone: "lo" }),
});
for (const [x, y] of [[PART.x - 1.6, PART.y + 10], [PART.x - 1.6, PART.y + PART.d - 10], [PART.x + 14, PART.y - 1.6]])
  turned("fix.pin", fz([x, y, FIX_Z]), [[0, 1.6], [3.6, 1.6], [4.4, 0.8]], { tone: "hi" });
/* the part: a plate whose top carries the marks */
box("part", [PART.x, PART.y, FIX_Z], [PART.x + PART.w, PART.y + PART.d, PART_Z], { tone: "hi" }, { move: "part" });
/* toggle clamp bodies; the page turns their arms */
const CLAMPS = [{ x: PART.x - 8, s: 1 }, { x: PART.x + PART.w + 8, s: -1 }].map((c) => ({ ...c, y: C[1], pz: FIX_Z + 9 }));
for (const c of CLAMPS) {
  box("clamp.base", [c.x - 4, c.y - 6, FIX_Z], [c.x + 4, c.y + 6, FIX_Z + 6], { tone: "mid" }, { extra: dotsAt(onZ(FIX_Z + 6, [[c.x, c.y - 4], [c.x, c.y + 4]]), 0.45, "lo") });
  box("clamp.post", [c.x - 2, c.y - 4.5, FIX_Z + 6], [c.x + 2, c.y + 4.5, c.pz - 1.6], { tone: "mid" });
  put("clamp.arm", [c.x + c.s * 6, c.y, c.pz], `<g data-part="clamp${c.s > 0 ? "L" : "R"}"></g>`,
    [record(A.box([Math.min(c.x, c.x + c.s * 13), c.y - 2, c.pz - 1.6], [Math.max(c.x, c.x + c.s * 13), c.y + 2, c.pz + 1.6], { name: "clamp.arm" }))], { bias: 0.2 });
}

/* ---- the fume extraction hose and its nozzle (when configured) -------------------- */
const NOZ = [C[0] - 44, C[1] - 30, 212];
/* the nozzle's holder: an arm from the back wall, under the nozzle, clear of the hose */
const NOZ_SHAPE = turned("fume.nozzle", G.frameAlong(NOZ, G.unit3([0.55, 0.45, -0.7])),
  [[-8, 3.4], [-2, 3.4], [0, 4.8], [4, 6.6]], { tone: "mid" }, { opt: "fume", owner: "fume.nozzle" });
{
  /* the arm's top is set where it just meets the nozzle's underside, measured on the nozzle's own surface */
  const noz = R.solids[R.solids.length - 1], y1 = NOZ[1] + 1;
  const deepest = (zt) => { let m = Infinity; for (let x = -1.6; x <= 1.6; x += 0.4) for (let y = Y0 + 3; y <= y1; y += 0.5) m = Math.min(m, A.sdf(noz, [NOZ[0] + x, y, zt])); return m; };
  let lo = NOZ[2] - 12, hi = NOZ[2];
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (deepest(mid) > -0.25) lo = mid; else hi = mid; }
  box("fume.bracket", [NOZ[0] - 1.6, Y0 + 3, lo - 3], [NOZ[0] + 1.6, y1, lo], { tone: "lo" }, { opt: "fume", owner: "fume.nozzle" });
}

/* ---- cables ----------------------------------------------------------------------- */
/* each cable passes the worktop through a grommet: a collar on top and one underneath */
function grommet(name, x, y, r, opt, top = WT, under = TOPC) {
  turned(`${name}.top`, fz([x, y, top]), [[0, r * 1.9], [1.4, r * 1.9], [1.4, r * 1.25], [2, r * 1.25]], { tone: "lo" }, { opt });
  turned(`${name}.under`, fz([x, y, under - 1.4]), [[0, r * 1.9], [1.4, r * 1.9]], { tone: "lo" }, { opt });
}
/* inside the cabinet: the controller's signal cable and the supply's power cord, down through the shelf to the source */
const SH_TOP = SHELF + SHELF_T;
grommet("ctrl.grommet", 100, -30, 0.9, undefined, SH_TOP, SHELF);
cable("ctrl", [[PC.x1, -30, PC.z0 + 8], [100, -30, PC.z0 + 8], [100, -30, SH_TOP + 2]], 0.9, { tone: "mid", bend: 3, ends: [false, false] });
cable("ctrl.low", [[100, -30, SHELF - 1.4], [100, -30, SRC.z1]], 0.9, { tone: "mid", bend: 3, ends: [false, false] });
grommet("psu.grommet", 80, 20, 0.9, undefined, SH_TOP, SHELF);
cable("psu.cord", [[PSU.x1, 20, PSU.z0 + 6], [80, 20, PSU.z0 + 6], [80, 20, SH_TOP + 2]], 0.9, { tone: "lo", bend: 3, ends: [false, false] });
cable("psu.cord.low", [[80, 20, SHELF - 1.4], [80, 20, SRC.z1]], 0.9, { tone: "lo", bend: 3, ends: [false, false] });
const FIB_X = COLL[0] + 26, FIB_Y = Y0 + 9;
grommet("fibre.grommet", FIB_X, FIB_Y, 2);
/* the armoured fibre: from the source's port up to the worktop, then up the back wall to the gland bracket */
cable("fibre", [[FIB_OUT[0], FIB_OUT[1], FIB_OUT[2] + 10], [FIB_OUT[0], FIB_OUT[1], 80], [FIB_X, FIB_Y, 92], [FIB_X, FIB_Y, TOPC - 1.4]],
  2, { tone: "hi", bend: 8, ends: [false, false], rings: { pitch: 1.6, tone: "lo" } });
cable("fibre.up", [[FIB_X, FIB_Y, WT + 2], [FIB_X, FIB_Y, 309], [FIB_X, COLL[1] - 2, 309], [COLL[0] + 7, COLL[1] - 2, 309]],
  2, { tone: "hi", bend: 8, ends: [false, false], rings: { pitch: 1.6, tone: "lo" } });
/* the fume hose: extractor outlet, through the worktop, to the nozzle */
const NOZ_A = G.unit3([0.55, 0.45, -0.7]), HOSE_END = G.add3(NOZ, G.mul3(NOZ_A, -8));
grommet("fume.grommet", -110, -92, 3, "fume");
cable("fume.hose.low", [[-110, -92, FUME.z1 + 6], [-110, -92, TOPC - 1.4]], 3, { tone: "mid", ends: [false, false], opt: "fume", rings: { pitch: 2.2, tone: "lo" } });
cable("fume.hose", [[-110, -92, WT + 2], [-110, -92, 230], G.add3(HOSE_END, G.mul3(NOZ_A, -14)), HOSE_END],
  3, { tone: "mid", bend: 10, ends: [false, false], opt: "fume", rings: { pitch: 2.2, tone: "lo" } });

/* ---- HMI on its swing arm (left front post) --------------------------------------- */
const HMI = { x0: -182, x1: -136, y0: Y1 + 1, y1: Y1 + 7, z0: 238, z1: 272 };
box("hmi.arm", [-146, Y1 - 6, 252], [X0, Y1 - 1, 257], { tone: "lo" });
box("hmi.pivot", [-154, Y1 - 6, 248], [-146, Y1 + 1, 261], { tone: "mid" });
box("hmi.body", [HMI.x0, HMI.y0, HMI.z0], [HMI.x1, HMI.y1, HMI.z1], { tone: "mid" }, { extra: screwsY(HMI.y1, HMI.x0, HMI.x1, HMI.z0, HMI.z1, 1.6) });
put("hmi.screen", [(HMI.x0 + HMI.x1) / 2, HMI.y1, (HMI.z0 + HMI.z1) / 2],
  S(k.slabOf({ x: HMI.x0 + 3, y: HMI.y1, w: HMI.x1 - HMI.x0 - 6, d: 0.3, r: 0 }, HMI.z0 + 3, HMI.z1 - HMI.z0 - 6, P, 1), { tone: "lo", flat: true }) + `<g data-part="hmi"></g>`,
  [record(A.box([HMI.x0 + 3, HMI.y1, HMI.z0 + 3], [HMI.x1 - 3, HMI.y1 + 0.3, HMI.z1 - 3], { name: "hmi.screen" }))], { bias: 0.1 });

/* =================================================================================== */
/* settle the order, place the live slots, write the figure                            */
/* =================================================================================== */
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
/* the lift door runs in front of everything it can pass over: draw it last, in its own order */
{
  const door = R.items.filter((it) => /data-move="door"/.test(it.attrs || ""));
  const rest = R.items.filter((it) => !/data-move="door"/.test(it.attrs || ""));
  R.items.length = 0; R.items.push(...rest, ...door);
}
const idx = (name) => R.items.findIndex((it) => it.name === name);
const slots = new Map();
const addSlot = (i, s) => slots.set(i, (slots.get(i) || "") + s);
/* marks, beam and spot ride just after the part, so the clamp arms and the objective cover them */
addSlot(idx("part"), `<g data-part="marks"></g><path data-part="beam" class="iso-line" data-tone="lit" d="" style="stroke-width:1.1"/><g data-part="spot"></g>`);
/* the fibre's leg from the gland down to the moving collimator */
addSlot(idx("head.collimator"), `<g data-part="fibreleg"></g>`);
const groups = R.items.map((it, i) => `<g class="it" data-name="${it.name}"${it.attrs ?? ""}>${it.svg}</g>${slots.get(i) ?? ""}`);

const figure = k.figureSvg({
  width: W, height: H,
  label: "A Class 1 laser marking workstation with its right-hand side panels off. In the lower cabinet: the fibre laser source, the controller and power supply on a shelf, the breakers and relays on the back wall and, when fitted, the fume extractor. On the worktop, behind a vertical lift door, a Z column carries the galvo scan head with its f-theta objective over a fixture with two toggle clamps; the fibre runs from the source up the back wall to the head. A light tower stands on the roof and an operator screen hangs on a swing arm at the left.",
  body: [...back, `<g class="ws-items">${groups.join("")}</g>`],
});

const GEO = {
  P, C, PART_Z, LENS_BOT, HOME_DZ, MARK_SCALE, TRAVEL: DOOR.travel,
  CLAMPS: CLAMPS.map((c) => ({ x: c.x, y: c.y, pz: c.pz, s: c.s })),
  GLAND: [GLAND[0], GLAND[1], 300], COLL_TOP: [COLL[0], COLL[1], HEAD.z1 + 16],
  HMI: { x0: HMI.x0 + 3, x1: HMI.x1 - 3, y: HMI.y1 + 0.3, z0: HMI.z0 + 3, z1: HMI.z1 - 3 },
  TWR: { x: TWR[0], y: TWR[1], seg: TWR_SEG },
  dz: k.axisVector(P, [0, 0, 1]).map(f2),
};

/* the operator screen's glass as a plane: local u to the right, v down, in world units */
function planeMatrix(o, ex, ey) {
  const p0 = at(o), px = at(G.add3(o, ex)), py = at(G.add3(o, ey)), v = (x) => x.toFixed(4);
  return `matrix(${v(px[0] - p0[0])} ${v(px[1] - p0[1])} ${v(py[0] - p0[0])} ${v(py[1] - p0[1])} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)})`;
}
GEO.hmiMatrix = planeMatrix([GEO.HMI.x0, GEO.HMI.y, GEO.HMI.z1], [1, 0, 0], [0, 0, -1]);
GEO.hmiW = GEO.HMI.x1 - GEO.HMI.x0; GEO.hmiH = GEO.HMI.z1 - GEO.HMI.z0;
GEO.CAMRING = [CAM[0], CAM[1], 232];
/* the close-up: the work zone (head at home, objective, part, clamps, fibre leg) at the card's aspect */
{
  const pts = [[FIXT.x, FIXT.y, WT], [FIXT.x + FIXT.w, FIXT.y, WT], [FIXT.x, FIXT.y + FIXT.d, WT], [FIXT.x + FIXT.w, FIXT.y + FIXT.d, WT],
    [HEAD.x0, HEAD.y0, HEAD.z1 + HOME_DZ + 16], [HEAD.x1 + 12, HEAD.y1, HEAD.z1 + HOME_DZ], [COLL[0], COLL[1], 312], [COL.x1, COL.y0, WT]].map(at);
  let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  const pad = 14; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  let w = x1 - x0, h = y1 - y0; const ar = W / H;
  if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
  GEO.CLOSE = [x0, y0, w, h].map(f2); GEO.FULL = [0, 0, W, H];
}
GEO.AFDOTS = [[C[0] - 17, HEAD.y1 + 3, 242], [C[0] - 11, HEAD.y1 + 3, 242]];

/* ---- the live part: runs in the page, on the kit runtime anatomy.js exposes -------- */
const LIVE = String.raw`
var GEO = __GEO__, P = GEO.P;
var K = window.TEALAnatomy.kit, iso = K.iso, segment = K.segment, pathOf = K.pathOf, solidSvg = K.solidSvg, cylinder = K.cylinder;
/* timed moves from the configuration's own process path, in shares of the field:
   marking strokes plus positioning jumps at 3.2 times the speed, as the simulation does */
function movesOf(segs) {
  var mv = [], prev = null, tot = 0, i, j;
  for (i = 0; i < segs.length; i++) for (j = 0; j < segs[i].length; j++) {
    var p = segs[i][j];
    if (prev) { var d = Math.hypot(p[0] - prev[0], p[1] - prev[1]), on = j > 0, w = d / (on ? 1 : 3.2); mv.push({ a: prev, b: p, on: on, w: w, c: tot }); tot += w; }
    prev = p;
  }
  return { mv: mv, tot: tot || 1 };
}
var ease = function (t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
var span = function (u, a, b) { return ease((u - a) / (b - a)); };
/* where every moving part is, in phase k at share u of it */
function pose(k, u) {
  var o = { door: 0, z: 0, lift: 0, show: true, clamp: 0, beam: false, prog: 0, marks: false, cam: false, af: false };
  if (k === "HOME") { o.z = GEO.HOME_DZ * span(u, 0, 1); o.show = false; o.clamp = 1; }
  else if (k === "LOAD") { o.z = GEO.HOME_DZ; o.clamp = 1; o.door = span(u, 0, 0.28) * (1 - span(u, 0.78, 1)); o.lift = 1 - span(u, 0.3, 0.74); }
  else if (k === "CLAMP") { o.z = GEO.HOME_DZ; o.clamp = 1 - span(u, 0, 1); }
  else if (k === "LOCATE") { o.z = GEO.HOME_DZ; o.cam = true; }
  else if (k === "FOCUS") { o.z = GEO.HOME_DZ * (1 - span(u, 0, 1)); o.af = true; }
  else if (k === "PROCESS") { o.beam = u < 1; o.prog = u; o.marks = true; }
  else if (k === "VERIFY") { o.prog = 1; o.marks = true; o.cam = true; }
  else if (k === "UNLOAD") { o.prog = 1; o.marks = true; o.clamp = span(u, 0, 0.2); o.door = span(u, 0.2, 0.38) * (1 - span(u, 0.82, 1)); o.lift = span(u, 0.4, 0.78); o.show = u < 0.8; }
  return o;
}
function mountWS(host, cfg) {
  if (mountWS.stop) mountWS.stop();
  host.innerHTML = __PLATE__;
  var plate = host.querySelector(".iso"), stage = host.querySelector(".iso-stage"), svg = stage.querySelector("svg");
  var q = function (sel) { return svg.querySelector(sel); }, qa = function (sel) { return svg.querySelectorAll(sel); };
  var readout = host.querySelector("[data-readout]"), caption = host.querySelector(".iso-caption");
  var still = matchMedia("(prefers-reduced-motion: reduce)");
  plate.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  /* modules the configuration has: the drawing shows only those */
  var opts = cfg.opts || {};
  Array.prototype.forEach.call(qa("[data-opt]"), function (g) { g.style.display = opts[g.getAttribute("data-opt")] ? "" : "none"; });
  if (caption && cfg.caption) caption.textContent = cfg.caption;
  var el = { marks: q('[data-part="marks"]'), beam: q('[data-part="beam"]'), spot: q('[data-part="spot"]'), leg: q('[data-part="fibreleg"]'),
    hmi: q('[data-part="hmi"]'), cl: q('[data-part="clampL"]'), cr: q('[data-part="clampR"]') };
  var doorG = qa('[data-move="door"]'), zG = qa('[data-move="z"]'), partG = qa('[data-move="part"]');
  var M = movesOf(cfg.segs || [[[-0.3, 0], [0.3, 0]]]);
  var w2 = function (p, lift) { return [GEO.C[0] + p[0] * GEO.MARK_SCALE, GEO.C[1] + p[1] * GEO.MARK_SCALE, GEO.PART_Z + lift]; };
  var dz = GEO.dz;
  var tower = svg.querySelector('[data-part="tower"]');
  if (!tower) { tower = document.createElementNS("http://www.w3.org/2000/svg", "g"); tower.setAttribute("data-part", "tower"); svg.querySelector(".ws-items").appendChild(tower); }
  var cam = document.createElementNS("http://www.w3.org/2000/svg", "g"); svg.querySelector(".ws-items").appendChild(cam);
  var st = { t: 0, i: 0, paused: 0 }, frame = 0, last = 0, visible = false, stopped = false, lastKey = "";
  /* close-up: ease the view box between the whole machine and the work zone */
  var zoom = { on: false, k: 0, to: 0 }, zbtn = document.createElement("button");
  zbtn.type = "button"; zbtn.className = "ws-zoom"; zbtn.setAttribute("aria-pressed", "false"); zbtn.textContent = "Close-up";
  stage.appendChild(zbtn);
  function viewBox() {
    var e = zoom.k * zoom.k * (3 - 2 * zoom.k), F = GEO.FULL, Cz = GEO.CLOSE, v = [0, 1, 2, 3].map(function (i) { return F[i] + (Cz[i] - F[i]) * e; });
    svg.setAttribute("viewBox", v.map(function (n) { return n.toFixed(2); }).join(" "));
  }
  function setZoom(on) {
    zoom.on = on; zoom.to = on ? 1 : 0; zbtn.setAttribute("aria-pressed", on ? "true" : "false"); zbtn.textContent = on ? "Whole machine" : "Close-up";
    plate.classList.toggle("ws-close", on);
    if (still.matches) { zoom.k = zoom.to; viewBox(); }
    run(true);
  }
  zbtn.addEventListener("click", function () { setZoom(!zoom.on); });
  function phasesNow() { var lv = cfg.live ? cfg.live() : null; return lv || null; }
  function moveAt(p) {
    var x = p * M.tot, i;
    for (i = 0; i < M.mv.length; i++) { var m = M.mv[i]; if (x <= m.c + m.w) { var f = m.w ? (x - m.c) / m.w : 1; return { i: i, f: f, at: [m.a[0] + (m.b[0] - m.a[0]) * f, m.a[1] + (m.b[1] - m.a[1]) * f], on: m.on }; } }
    var e = M.mv[M.mv.length - 1]; return { i: M.mv.length, f: 1, at: e ? e.b : [0, 0], on: false };
  }
  function marksPath(p, lift) {
    var cur = moveAt(p), d = "", i;
    for (i = 0; i < Math.min(cur.i, M.mv.length); i++) if (M.mv[i].on) d += pathOf([iso(w2(M.mv[i].a, lift), P), iso(w2(M.mv[i].b, lift), P)]);
    if (cur.i < M.mv.length && M.mv[cur.i].on && cur.f > 0) d += pathOf([iso(w2(M.mv[cur.i].a, lift), P), iso(w2(cur.at, lift), P)]);
    return { d: d, at: cur.at };
  }
  function clampArm(c, open) {
    /* the arm turns about a pivot axis along y; open, it stands 70 degrees up */
    var a = open * 70 * Math.PI / 180, s = c.s;
    var u = [s * Math.cos(a), 0, Math.sin(a)], v = [-s * Math.sin(a), 0, Math.cos(a)];
    var F = K.frameOf([c.x, c.y, c.pz], [0, 1, 0], u, v);
    var arm = solidSvg(K.prismOf(F, [[0, -1.4], [13, -1.4], [13, 1.4], [0, 1.4]], -2, 2, P), { tone: "hi" });
    var tipF = K.frameOf([c.x + s * 12 * Math.cos(a) - s * 0 , c.y, c.pz + 12 * Math.sin(a)], [0, 1, 0], u, v);
    var spindle = solidSvg(K.prismOf(tipF, [[-1.2, -4.2], [1.2, -4.2], [1.2, -1.4], [-1.2, -1.4]], -1.2, 1.2, P), { tone: "mid" });
    var hF = K.frameOf([c.x, c.y, c.pz], [0, 1, 0], [-s * Math.cos(a + 0.9), 0, Math.sin(a + 0.9)], [s * Math.sin(a + 0.9), 0, Math.cos(a + 0.9)]);
    var handle = solidSvg(K.prismOf(hF, [[0, -1], [10, -1], [10, 1], [0, 1]], -1.2, 1.2, P), { tone: "lo" });
    return handle + arm + spindle;
  }
  function draw(k, u, ph, real, live) {
    var o = pose(k, u), tr = function (h) { return "translate(" + (dz[0] * h).toFixed(2) + " " + (dz[1] * h).toFixed(2) + ")"; };
    Array.prototype.forEach.call(doorG, function (g) { g.setAttribute("transform", tr(GEO.TRAVEL * o.door)); });
    Array.prototype.forEach.call(zG, function (g) { g.setAttribute("transform", tr(o.z)); });
    var lift = 26 * o.lift, fade = o.show ? (o.lift > 0.82 ? Math.max(0, (1 - o.lift) / 0.18) : 1) : 0;
    Array.prototype.forEach.call(partG, function (g) { g.setAttribute("transform", tr(lift)); g.style.opacity = fade.toFixed(3); });
    /* the fibre's leg: from the gland down to the collimator, wherever the head is */
    var top = GEO.COLL_TOP[2] + o.z;
    el.leg.innerHTML = solidSvg(cylinder(GEO.GLAND[0], GEO.GLAND[1], 1.8, top, GEO.GLAND[2] - top, P, 20), { tone: "hi" });
    el.cl.innerHTML = clampArm(GEO.CLAMPS[0], o.clamp);
    el.cr.innerHTML = clampArm(GEO.CLAMPS[1], o.clamp);
    /* marks on the part, the beam and the spot */
    var m = o.marks ? marksPath(o.prog, lift) : { d: "", at: [0, 0] };
    el.marks.innerHTML = m.d ? '<path class="iso-line" data-tone="lo" style="stroke-width:1" d="' + m.d + '"/>' : "";
    el.marks.style.opacity = fade.toFixed(3);
    var mv = o.beam ? moveAt(o.prog) : null, beamOn = !!(mv && mv.on);
    if (o.beam) {
      var spot = w2(mv.at, 0), lens = [GEO.C[0] + mv.at[0] * 3, GEO.C[1] + mv.at[1] * 3, GEO.LENS_BOT + o.z];
      el.beam.setAttribute("d", beamOn ? segment(lens, spot, P) : "");
      var s2 = iso(spot, P);
      el.spot.innerHTML = '<circle cx="' + s2[0].toFixed(2) + '" cy="' + s2[1].toFixed(2) + '" r="2.4" class="iso-wire-end" style="fill:var(--anatomy-lit);opacity:' + (beamOn ? .35 : .12) + '"/><circle cx="' + s2[0].toFixed(2) + '" cy="' + s2[1].toFixed(2) + '" r="' + (beamOn ? 1 : 0.6) + '" style="fill:var(--anatomy-lit)"/>';
    } else { el.beam.setAttribute("d", ""); el.spot.innerHTML = ""; }
    /* the light tower: the bottom lamp while the cycle runs, the top one while the laser emits */
    var T = GEO.TWR, lamp = function (i) { return solidSvg(cylinder(T.x, T.y, 4.5, T.seg[i] + 0.4, 7.8, P, 24), { tone: "hi", lit: true }); };
    tower.innerHTML = (live && !live.fault ? lamp(0) : "") + (beamOn ? lamp(2) : "");
    /* the camera's ring light while it locates or grades; the focus sensor's two spots */
    var ringOn = o.cam && cfg.opts && cfg.opts.cam, afOn = o.af && cfg.opts && cfg.opts.af;
    cam.innerHTML = (ringOn ? '<path class="iso-line" data-tone="lit" style="stroke-width:1.2" d="' + K.ring(GEO.CAMRING[0], GEO.CAMRING[1], 5.4, GEO.CAMRING[2] + o.z, P, 32) + '"/>' : "") +
      (afOn ? GEO.AFDOTS.map(function (p) { var s = iso([p[0], p[1], p[2] + o.z], P); return '<circle cx="' + s[0].toFixed(2) + '" cy="' + s[1].toFixed(2) + '" r=".9" style="fill:var(--anatomy-lit)"/>'; }).join("") : "");
    /* the operator screen: the phase, and how far through it */
    var name = live && live.fault ? "STOPPED" : (ph ? ph.n : "").toUpperCase(), key = name + "|" + Math.round(u * 40);
    if (key !== lastKey) {
      lastKey = key;
      var Wd = GEO.hmiW, Hd = GEO.hmiH, bar = Math.max(0, Math.min(1, u)) * (Wd - 8);
      el.hmi.innerHTML = '<g transform="' + GEO.hmiMatrix + '"><text x="4" y="' + (Hd * 0.44).toFixed(2) + '" class="ws-hmi">' + name.slice(0, 14) + '</text>' +
        '<rect x="4" y="' + (Hd * 0.62).toFixed(2) + '" width="' + (Wd - 8) + '" height="2" class="ws-hmi-track"/><rect x="4" y="' + (Hd * 0.62).toFixed(2) + '" width="' + bar.toFixed(2) + '" height="2" class="ws-hmi-bar"/></g>';
    }
    var text = ph ? (live ? ph.n + " · " + (u * ph.real).toFixed(2) + " of " + ph.real.toFixed(2) + " s · cycle " + real.toFixed(2) + " s"
                          : "Preview · " + ph.n + " · " + ph.real.toFixed(2) + " s of a " + real.toFixed(2) + " s cycle") : "";
    if (readout && readout.textContent !== text) readout.textContent = text;
    stage.setAttribute("aria-valuetext", text);
  }
  function step(dt) {
    var lv = phasesNow();
    if (lv) { var ph = lv.phases[lv.i]; draw(ph.k, lv.u, ph, lv.real, lv); return; }
    var P0 = cfg.phases; if (!P0 || !P0.length) return;
    if (still.matches) { var pi = 0; for (var j = 0; j < P0.length; j++) if (P0[j].k === "PROCESS") pi = j; draw("PROCESS", 1, P0[pi], cfg.real, null); return; }
    if (st.paused > 0) st.paused -= dt; else st.t += dt;
    var tot = 0, i; for (i = 0; i < P0.length; i++) tot += P0[i].d;
    st.t = ((st.t % tot) + tot) % tot;
    var acc = 0; for (i = 0; i < P0.length; i++) { if (st.t < acc + P0[i].d) break; acc += P0[i].d; }
    i = Math.min(i, P0.length - 1); st.i = i;
    draw(P0[i].k, (st.t - acc) / P0[i].d, P0[i], cfg.real, null);
  }
  function tick(now) {
    if (stopped) return;
    var dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60; last = now;
    if (zoom.k !== zoom.to) { var dk = dt / 0.6; zoom.k = zoom.to > zoom.k ? Math.min(zoom.to, zoom.k + dk) : Math.max(zoom.to, zoom.k - dk); viewBox(); }
    step(dt);
    var moving = zoom.k !== zoom.to;
    frame = (visible && !(still.matches && !phasesNow())) || moving ? requestAnimationFrame(tick) : 0;
  }
  function run(force) { if (!frame && (visible || force) && !stopped) { last = 0; frame = requestAnimationFrame(tick); } }
  /* keyboard: step through the phases of the preview */
  stage.addEventListener("keydown", function (e) {
    if ((e.key === "z" || e.key === "Z") && phasesNow()) { e.preventDefault(); setZoom(!zoom.on); return; }
    var P0 = cfg.phases; if (!P0 || phasesNow()) return;
    var acc = 0, i, starts = []; for (i = 0; i < P0.length; i++) { starts.push(acc); acc += P0[i].d; }
    if (e.key === "ArrowRight") st.i = (st.i + 1) % P0.length; else if (e.key === "ArrowLeft") st.i = (st.i - 1 + P0.length) % P0.length;
    else if (e.key === "Home") st.i = 0; else if (e.key === "End") st.i = P0.length - 1;
    else if (e.key === "z" || e.key === "Z") { e.preventDefault(); setZoom(!zoom.on); return; } else return;
    e.preventDefault(); st.t = starts[st.i] + P0[st.i].d * (P0[st.i].k === "PROCESS" ? 0.6 : 0.5); st.paused = 6;
    step(0); run();
  });
  var io = new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" });
  io.observe(stage);
  step(0);
  mountWS.stop = function () { stopped = true; if (frame) cancelAnimationFrame(frame); frame = 0; io.disconnect(); };
  mountWS.wake = function () { run(); };
  return { state: st, step: step, stop: mountWS.stop };
}
window.TEALAnatomy.ws = { mount: mountWS, geo: GEO, pose: pose };
`;

const plate = k.plateHtml({
  fig: "Fig 2",
  title: "The workstation",
  hint: "Start simulation to drive it · ← → · Z",
  readout: " ",
  keys: [
    { mark: "lit", label: "The beam and the spot, while the laser emits" },
    { mark: "raised", label: "The scan head on its Z carriage, the part and the clamps" },
  ],
  caption: " ",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-roledescription="figure" aria-label="The workstation through one run cycle. Left and right arrows step through the phases; Z toggles a close-up of the work zone; the Start simulation button runs it live.">${figure}</div>`,
});
const live = LIVE.replace("__GEO__", JSON.stringify(GEO)).replace("__PLATE__", JSON.stringify(`<div class="iso tealfig tealws">${plate}</div>`));
const js = `/* Generated by tools/anatomy/workstation.mjs — do not edit. Anatomy kit (MIT): tools/anatomy/kit/LICENSE. Needs anatomy.js first. */\n(function(){"use strict";\nif(!window.TEALAnatomy||!window.TEALAnatomy.kit) return;\n${live}\n})();\n`;
console.log(`items ${R.items.length}, solids ${R.solids.length}, routes ${R.routes.length}, scale ${KS.toFixed(3)}, js ${Math.round(js.length / 1024)} KB`);
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(join(ROOT, "anatomy-ws.js"), "utf8"); } catch {}
  if (cur !== js) { console.error("out of date: anatomy-ws.js — run npm run anatomy"); process.exit(1); }
  console.log("anatomy-ws.js current");
} else {
  writeFileSync(join(ROOT, "anatomy-ws.js"), js);
  console.log("wrote anatomy-ws.js");
}
const pv = process.argv.indexOf("--preview");
if (pv > 0) {
  const dir = process.argv[pv + 1]; mkdirSync(dir, { recursive: true });
  const base = readFileSync(join(ROOT, "anatomy.js"), "utf8"), css = readFileSync(join(ROOT, "anatomy.css"), "utf8");
  const PH = [["HOME", "Home", 0.35], ["LOAD", "Load", 1.6], ["CLAMP", "Clamp", 0.35], ["LOCATE", "Locate", 0.55], ["FOCUS", "Auto-focus", 0.35], ["PROCESS", "Mark", 3.2], ["VERIFY", "Grade", 0.6], ["UNLOAD", "Unload", 1.4]]
    .map(([k2, n, d]) => ({ k: k2, n, d, real: d }));
  for (const theme of ["dark", "light"]) {
    const page = k.pageHtml({ title: "Workstation", theme, body: `<div id="host"></div>`, width: 820,
      script: base + js + `\ndocument.documentElement.setAttribute("data-theme", "${theme}");\nvar segs=[];for(var i=0;i<10;i++){var y=-0.3+i*0.066;segs.push(i%2?[[0.3,y],[-0.3,y]]:[[-0.3,y],[0.3,y]]);}\nwindow.FIG = TEALAnatomy.ws.mount(document.getElementById("host"), { opts: { fume: 1, cam: 1, af: 1 }, segs: segs, phases: ${JSON.stringify(PH)}, real: 8.4, caption: "Preview page." });` });
    writeFileSync(join(dir, `ws${theme === "light" ? "-light" : ""}.html`), page.replace("<head>", `<head><style>${css}.ws-hmi{font:600 5px ui-monospace,monospace;fill:var(--anatomy-hi)}.ws-hmi-track{fill:var(--anatomy-faint)}.ws-hmi-bar{fill:var(--anatomy-hi)}.iso-svg{overflow:hidden}.iso-stage{position:relative}.ws-zoom{position:absolute;top:6px;right:6px;font:600 11px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;padding:6px 10px;border-radius:6px;border:1px solid var(--anatomy-faint);background:var(--anatomy-card);color:var(--anatomy-text);cursor:pointer}</style>`));
  }
  console.log("previews in " + dir);
}
A.auditOrExit(R, P, {});
