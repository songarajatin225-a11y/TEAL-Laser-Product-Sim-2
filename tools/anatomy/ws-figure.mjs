/* TEAL configurator — Fig 2: the workstation, one handling variant per import.
 *
 * Imported by workstation.mjs as ws-figure.mjs?v=<variant>: hand, belt, mag, tray, chute,
 * dial2, dial4 or arm. Each import builds, records and settles its own figure.
 *
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
const VAR = new URL(import.meta.url).searchParams.get("v") || "hand";
const BELT = ["belt", "mag", "tray", "chute"].includes(VAR), ARM = VAR === "arm", DIAL = VAR === "dial2" || VAR === "dial4";

/* ---- the world: 1 unit = 5 mm. x across the front, y from back to front, z up --- */
const FLOOR = { x: -150, y: -126, w: 290 + (BELT ? 170 : ARM ? 100 : 0), d: 262, r: 10 };
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
const BT = WT + 8;                                          // belt top (conveyor variants)
const DT = WT + 18;                                         // disc top (turntable variants)
const D = [C[0], C[1] + 54], R_ST = 54, R_DISC = 74;        // dial centre, station radius, disc radius
const PART = BELT ? { x: C[0] - 22, y: C[1] - 16, w: 44, d: 32 } : DIAL ? { x: C[0] - 20, y: C[1] - 17, w: 40, d: 34 } : { x: C[0] - 28, y: C[1] - 26, w: 56, d: 52 };
const FIXT = { x: C[0] - 42, y: C[1] - 40, w: 84, d: 80 };
const FIX_Z = BELT ? BT : DIAL ? DT + 3 : WT + 6;           // where the part sits
const PART_Z = FIX_Z + 3;                                   // the part's top
const LENS_BOT = 220;
const HOME_DZ = 14;                                         // Z axis travel from focus to home
const MARK_SCALE = BELT ? 40 : DIAL ? 36 : 50;              // drawn units per unit share of the field
const OB = { x0: X1 + 4, x1: X1 + 104, end: X1 + 112 };     // the outside conveyor
const ST_X = OB.end + 6;                                    // where an upstream station starts
const RB = [X1 + 48, 46], TB = [X1 + 48, -60];              // robot pedestal, part tray (arm variant)

const P = k.fitProjection(
  [...k.boxCorners(FLOOR, -4, 0), [X0, Y0, ROOF1], [X1, Y0, ROOF1], [X1, Y1, ROOF1], [X0, Y1, ROOF1],
   [DOOR.x0, Y1 + 3, RAIL_TOP], [DOOR.x1, Y1 + 3, RAIL_TOP], [X1 - 24, Y0 + 18, 381], [-182, Y1 + 12, 272],
   ...(BELT ? [[ST_X + 56, C[1] + 34, 0], [ST_X + 56, C[1] - 34, VAR === "mag" ? 268 : VAR === "tray" ? 236 : BT + 40]] : []),
   ...(ARM ? [[RB[0] + 24, RB[1] + 24, 0], [RB[0] + 24, RB[1] + 24, 330], [TB[0] + 24, TB[1] - 26, 0]] : [])],
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
const record = (s) => R.solid(s);
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
if (!DIAL) box("enc.sill", [OPEN.x0, Y1 - 3, WT], [OPEN.x1, Y1, OPEN.z0], { tone: "lo" });
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
  /* on a turntable the door stands open for good: it is built raised */
  const { x0, x1, y0, y1 } = DOOR, z0 = DOOR.z0 + (DIAL ? DOOR.travel : 0), z1 = DOOR.z1 + (DIAL ? DOOR.travel : 0);
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

/* ---- the work zone: fixture and clamps, a conveyor, a turntable, or a robot cell ---- */
let CLAMPS = [];
function fixtureAndClamps() {
  box("fix.plate", [FIXT.x, FIXT.y, WT], [FIXT.x + FIXT.w, FIXT.y + FIXT.d, FIX_Z], { tone: "lo" }, {
    extra: dotsAt(onZ(FIX_Z, k.corners(FIXT, 4)), 0.5, "lo") + Ln(k.ring(FIXT.x + 4, FIXT.y + 4, 1.8, FIX_Z, P, 14) + k.ring(FIXT.x + FIXT.w - 4, FIXT.y + FIXT.d - 4, 1.8, FIX_Z, P, 14), { tone: "lo" }),
  });
  for (const [x, y] of [[PART.x - 1.6, PART.y + 10], [PART.x - 1.6, PART.y + PART.d - 10], [PART.x + 14, PART.y - 1.6]])
    turned("fix.pin", fz([x, y, FIX_Z]), [[0, 1.6], [3.6, 1.6], [4.4, 0.8]], { tone: "hi" });
  box("part", [PART.x, PART.y, FIX_Z], [PART.x + PART.w, PART.y + PART.d, PART_Z], { tone: "hi" }, { move: "part" });
  /* toggle clamp bodies; the page turns their arms */
  CLAMPS = [{ x: PART.x - 8, s: 1 }, { x: PART.x + PART.w + 8, s: -1 }].map((c) => ({ ...c, y: C[1], pz: FIX_Z + 9 }));
  for (const c of CLAMPS) {
    box("clamp.base", [c.x - 4, c.y - 6, FIX_Z], [c.x + 4, c.y + 6, FIX_Z + 6], { tone: "mid" }, { extra: dotsAt(onZ(FIX_Z + 6, [[c.x, c.y - 4], [c.x, c.y + 4]]), 0.45, "lo") });
    box("clamp.post", [c.x - 2, c.y - 4.5, FIX_Z + 6], [c.x + 2, c.y + 4.5, c.pz - 1.6], { tone: "mid" });
    put("clamp.arm", [c.x + c.s * 6, c.y, c.pz], `<g data-part="clamp${c.s > 0 ? "L" : "R"}"></g>`,
      [record(A.box([Math.min(c.x, c.x + c.s * 13), c.y - 2, c.pz - 1.6], [Math.max(c.x, c.x + c.s * 13), c.y + 2, c.pz + 1.6], { name: "clamp.arm" }))], { bias: 0.2 });
  }
}
/* a conveyor run: two side rails, the belt between them, cleat lines across it */
function beltRun(name, x0, x1, beltTo = x1) {
  const y0 = C[1] - 17, y1 = C[1] + 17;
  const railX = (y, yy) => closed(onY(yy, slot(x0 + 3, x1 - 3, BT - 6, BT - 3)), "faint");
  box(`${name}.rail.b`, [x0, y0 - 3, BT - 8], [x1, y0, BT + 1], { tone: "mid" });
  box(`${name}.rail.f`, [x0, y1, BT - 8], [x1, y1 + 3, BT + 1], { tone: "mid" }, { extra: railX(0, y1 + 3) + dotsAt(Array.from({ length: Math.floor((x1 - x0) / 16) }, (_, i) => [x0 + 8 + i * 16, y1 + 3, BT - 1.5]), 0.4, "lo") });
  box(`${name}.belt`, [x0, y0, BT - 2], [beltTo, y1, BT], { tone: "lo" },
    { extra: Array.from({ length: Math.floor((beltTo - x0) / 9) }, (_, i) => closed(onZ(BT, slot(x0 + 4 + i * 9, x0 + 4.6 + i * 9, y0 + 2, y1 - 2)), "faint")).join("") });
}
function conveyor() {
  /* inside: on the worktop, from the left wall to the worktop's edge */
  beltRun("belt.in", X0 + 3, X1 + 4);
  /* outside: on two leg frames, with the drive drum and motor at the far end */
  beltRun("belt.out", OB.x0, OB.end, OB.x1);
  turned("belt.drum", fy([OB.x1 + 4, C[1] - 17, BT - 4]), [[0, 4], [34, 4]], { tone: "mid" },
    { extra: k.fadedSvg(G.ribsOf(fy([OB.x1 + 4, C[1] - 17, BT - 4]), 2, 32, 4.02, 10, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
  for (const x of [OB.x0 + 14, OB.x1 - 12]) {
    for (const y of [C[1] - 20, C[1] + 17]) box("belt.leg", [x - 2, y, 1.2], [x + 2, y + 3, BT - 8], { tone: "mid" });
    box("belt.brace", [x - 1.5, C[1] - 17, 40], [x + 1.5, C[1] + 17, 44], { tone: "lo" });
    for (const y of [C[1] - 18.5, C[1] + 18.5]) turned("belt.foot", fz([x, y, 0]), [[0, 3.4], [1.2, 3.4]], { tone: "lo" });
  }
  box("belt.motor", [OB.x1 - 10, C[1] + 20, BT - 24], [OB.x1 + 4, C[1] + 30, BT - 8], { tone: "mid" },
    { extra: Array.from({ length: 4 }, (_, i) => closed(onY(C[1] + 30, slot(OB.x1 - 8, OB.x1 + 2, BT - 21 + i * 3.4, BT - 20 + i * 3.4)), "lo")).join("") });
  /* photo-eye on the front rail, the side clamp on the back rail, its pad moved by the page */
  box("belt.eye", [C[0] + 30, C[1] + 20, BT - 6], [C[0] + 36, C[1] + 24, BT + 1], { tone: "hi" }, { extra: dotsAt([[C[0] + 33, C[1] + 24, BT - 2.5]], 0.55, "lo") });
  box("belt.clamp", [C[0] - 7, C[1] - 32, BT + 1], [C[0] + 7, C[1] - 17, BT + 8], { tone: "mid" },
    { extra: closed(onX(C[0] + 7, slot(C[1] - 30, C[1] - 19, BT + 2.5, BT + 6.5)), "faint") });
  box("belt.pad", [C[0] - 4, C[1] - 17, BT + 2], [C[0] + 4, C[1] - 16.4, BT + 6], { tone: "hi" }, { move: "push" });
  box("part", [PART.x, PART.y, FIX_Z], [PART.x + PART.w, PART.y + PART.d, PART_Z], { tone: "hi" }, { move: "part" });
  station();
}
/* the upstream station that hands parts to the conveyor */
let INPATH = null;
function station() {
  const cy = C[1], beltEnd = OB.x1 - 6;
  if (VAR === "mag") {
    /* a magazine elevator: four guide strips, carriers stepping past belt height, a pusher */
    const x0 = ST_X, x1 = ST_X + 44, y0 = cy - 26, y1 = cy + 26;
    for (const [x, y] of [[x0, y0], [x1 - 4, y0], [x0, y1 - 4], [x1 - 4, y1 - 4]])
      box("mag.guide", [x, y, 0], [x + 4, y + 4, 262], { tone: "mid" }, { extra: closed(onX(x + 4, slot(y + 1.4, y + 2.6, 6, 256)), "faint") });
    box("mag.top", [x0, y0, 262], [x1, y1, 266], { tone: "mid" }, { extra: labelY(y1, x0 + 6, x1 - 6, 262.6, 265.4) });
    for (let i = 0; i < 7; i++) {
      const z = BT - 3 + (i - 3) * 16;
      box("mag.carrier", [x0 + 3.7, y0, z], [x1 - 3.7, y1, z + 3], { tone: "lo" });
      if (i !== 3) box("mag.part", [x0 + 10, cy - 12, z + 3], [x1 - 10, cy + 12, z + 6], { tone: "mid" });
    }
    box("mag.pusher.bar", [x1, y0, BT - 4], [x1 + 4, y1, BT + 10], { tone: "lo" });
    box("mag.pusher", [x1 + 4, cy - 6, BT - 2], [x1 + 18, cy + 6, BT + 8], { tone: "mid" }, { extra: dotsAt([[x1 + 18, cy, BT + 3]], 0.5, "lo") });
    INPATH = [[x0 + 22, cy, BT], [beltEnd, cy, BT], [C[0], cy, BT]];
  } else if (VAR === "tray") {
    /* a tray tower: a cabinet of drawers, the top one out at belt height with its grid of parts */
    const x0 = ST_X + 10, x1 = ST_X + 56, y0 = cy - 30, y1 = cy + 30;
    let ex = labelX(x1, y0 + 8, y0 + 30, 210, 222);
    for (let i = 0; i < 8; i++) ex += closed(onX(x1, slot(y0 + 4, y1 - 4, 20 + i * 22, 38 + i * 22)), "faint") + dotsAt([[x1, cy, 29 + i * 22]], 0.5, "mid");
    box("tray.tower", [x0, y0, 0], [x1, y1, 230], { tone: "mid" }, { extra: ex });
    turned("tray.lamp", fz([x0 + 10, y0 + 10, 230]), [[0, 3], [6, 3]], { tone: "hi" });
    box("tray.drawer", [ST_X - 2, y0 + 6, BT - 6], [x0, y1 - 6, BT - 3], { tone: "lo" });
    for (let j = 0; j < 3; j++) if (j !== 1) box("tray.part", [ST_X + 0.6, y0 + 9 + j * 16, BT - 3], [ST_X + 8, y0 + 21 + j * 16, BT - 1.4], { tone: "mid" });
    INPATH = [[ST_X + 4, cy, BT + 10], [beltEnd, cy, BT + 6], [beltEnd - 6, cy, BT], [C[0], cy, BT]];
  } else if (VAR === "chute") {
    /* a vibratory bowl feeder on its stand, with the outlet chute down to the belt */
    const cx = ST_X + 30, cyy = cy, top = BT + 12;
    box("feeder.stand", [cx - 22, cyy - 22, 0], [cx + 22, cyy + 22, top], { tone: "mid" }, { extra: labelX(cx + 22, cyy - 14, cyy + 8, top - 16, top - 6) + ventsX(cx + 22, cyy - 14, cyy + 14, 20, 50, 8) });
    const bowl = [[0, 10], [2, 10], [3, 20], [12, 24, 1], [14, 24]];
    turned("feeder.bowl", fz([cx, cyy, top]), bowl, { tone: "hi" }, { extra: Ln(G.circleOf(fz([cx, cyy, top]), 14, 23.6, P, 48) + G.circleOf(fz([cx, cyy, top]), 9, 21.4, P, 48), { tone: "faint" }) });
    /* the chute: a channel falling from the bowl's rim to the belt, on a post at its low end */
    const a = [cx - 24.6, cyy, top + 12.4], b = [OB.x1 - 2, cyy, BT + 3.4];
    const dir = G.unit3(G.sub3(b, a)), len = G.len3(G.sub3(b, a));
    const F = G.frameOf(a, dir, [0, 1, 0], G.cross3(dir, [0, 1, 0]));
    prism("feeder.chute", F, [[-6, -1], [6, -1], [6, 1], [-6, 1]], 0, len, { tone: "mid" });
    box("feeder.post", [OB.x1 - 1, cyy - 3, BT + 1], [OB.x1 + 3, cyy + 3, BT + 3.6], { tone: "lo" });
    INPATH = [[cx - 24, cyy, top + 14], [OB.x1 - 2, cyy, BT + 5], [beltEnd - 4, cyy, BT], [C[0], cyy, BT]];
  } else {
    /* the line's own conveyor: an interface box for the upstream handshake */
    box("belt.smema", [OB.x1 - 30, C[1] - 32, BT - 26], [OB.x1 - 14, C[1] - 20, BT - 8], { tone: "mid" },
      { extra: labelX(OB.x1 - 14, C[1] - 30, C[1] - 22, BT - 22, BT - 12) + dotsAt([[OB.x1 - 14, C[1] - 23, BT - 24]], 0.5, "hi") });
    INPATH = [[OB.x1 - 4, C[1], BT], [C[0], C[1], BT]];
  }
}
/* the turntable: an index drive and a disc straddling the open front; the page turns the stations */
function dial() {
  turned("dial.drive", fz([D[0], D[1], WT]), [[0, 28], [2, 28], [2, 24], [14, 24]], { tone: "mid" },
    { extra: k.fadedSvg(G.ribsOf(fz([D[0], D[1], WT]), 4, 12, 24.02, 36, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
  turned("dial.disc", fz([D[0], D[1], DT - 4]), [[0, R_DISC], [4, R_DISC]], { tone: "lo" });
  put("dial.stations", [D[0], D[1], DT + 3], `<g data-part="dial"></g>`, [record(A.box([D[0] - 2, D[1] - 2, DT], [D[0] + 2, D[1] + 2, DT + 0.5], { name: "dial.stations" }))], { bias: 0.05 });
}
/* the robot cell: a pedestal and a part tray outside the open side; the page draws the arm */
function robotCell() {
  fixtureAndClamps();
  box("robot.pedestal", [RB[0] - 20, RB[1] - 20, 4], [RB[0] + 20, RB[1] + 20, 120], { tone: "mid" },
    { extra: labelX(RB[0] + 20, RB[1] - 12, RB[1] + 10, 96, 110) + screwsX(RB[0] + 20, RB[1] - 20, RB[1] + 20, 4, 120, 4) });
  box("robot.plate", [RB[0] - 24, RB[1] - 24, 0], [RB[0] + 24, RB[1] + 24, 4], { tone: "lo" }, { extra: dotsAt(onZ(4, k.corners({ x: RB[0] - 24, y: RB[1] - 24, w: 48, d: 48 }, 3)), 0.5, "lo") });
  turned("robot.base", fz([RB[0], RB[1], 120]), [[0, 17], [6, 17], [6, 15]], { tone: "hi" });
  box("tray.table", [TB[0] - 22, TB[1] - 24, 0], [TB[0] + 22, TB[1] + 24, 146], { tone: "mid" }, { extra: labelX(TB[0] + 22, TB[1] - 14, TB[1] + 8, 120, 134) });
  box("tray.top", [TB[0] - 20, TB[1] - 22, 146], [TB[0] + 20, TB[1] + 22, 149], { tone: "lo" });
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (i + j > 0)
    box("tray.part", [TB[0] - 16 + i * 18, TB[1] - 18 + j * 20, 149], [TB[0] - 2 + i * 18, TB[1] - 6 + j * 20, 152], { tone: "mid" });
  /* the cell's fence post and light-curtain columns at the open side */
  for (const y of [-80, 80]) box("robot.curtain", [X1 + 10, y - 3, 0], [X1 + 16, y + 3, 236], { tone: "lo" }, { extra: dotsAt(Array.from({ length: 10 }, (_, i) => [X1 + 16 - 0, y, 30 + i * 20]), 0.4, "hi") });
}
if (BELT) conveyor();
else if (DIAL) dial();
else if (ARM) robotCell();
else fixtureAndClamps();

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
addSlot(DIAL ? idx("dial.stations") : idx("part"), `<g data-part="marks"></g><path data-part="beam" class="iso-line" data-tone="lit" d="" style="stroke-width:1.1"/><g data-part="spot"></g>`);
/* the fibre's leg from the gland down to the moving collimator */
addSlot(idx("head.collimator"), `<g data-part="fibreleg"></g>`);
/* parts in transit and the robot arm ride in front of everything but the door */
addSlot(R.items.findIndex((it) => /data-move="door"/.test(it.attrs || "")) - 1, `<g data-part="carry"></g><g data-part="robot"></g>`);
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
/* what the page needs to move this variant */
GEO.VAR = VAR;
GEO.ax = k.axisVector(P, [1, 0, 0]).map((n) => +n.toFixed(4)); GEO.ay = k.axisVector(P, [0, 1, 0]).map((n) => +n.toFixed(4)); GEO.dz = k.axisVector(P, [0, 0, 1]).map((n) => +n.toFixed(4));
GEO.PARTC = [C[0], C[1], FIX_Z];
GEO.PARTSZ = [PART.w, PART.d];
GEO.X1 = X1;
if (BELT) { GEO.INPATH = INPATH; GEO.OUTPATH = [[C[0], C[1], BT], [X0 + 26, C[1], BT]]; }
if (DIAL) { GEO.D = D; GEO.R_ST = R_ST; GEO.DT = DT; GEO.N = VAR === "dial4" ? 4 : 2; GEO.R_DISC = R_DISC; }
if (ARM) {
  GEO.RB = [RB[0], RB[1], 126]; GEO.L1 = 110; GEO.L2 = 100; GEO.GRIP = 24; GEO.SH = 24;
  const up = PART_Z + GEO.GRIP;
  GEO.WAY = { home: [RB[0] - 30, RB[1] - 30, 262], pickUp: [TB[0], TB[1], 200], pick: [TB[0] - 7, TB[1] - 12 + 0, 152 + GEO.GRIP], out: [TB[0] + 9, TB[1] + 12, 152 + GEO.GRIP + 2],
    entry: [X1 - 14, C[1], 236], placeUp: [C[0], C[1], up + 18], place: [C[0], C[1], up] };
}
export { figure, GEO, R, P, KS, W, H, VAR };

