#!/usr/bin/env node
/* TEAL configurator — Fig 1: how a galvo scan head places the spot.
 *
 *   node tools/anatomy/scanhead.mjs                 # writes anatomy.js and anatomy.css
 *   node tools/anatomy/scanhead.mjs --preview DIR   # also standalone pages, dark and light
 *
 * An isometric figure built with the Anatomy kit (tools/anatomy/kit, MIT). A laser
 * source and a beam expander on an optical breadboard feed a two-mirror galvo block
 * on a Z column; an f-theta objective focuses the beam onto a calibration plate.
 * The X mirror turns about z and the Y mirror about x; each turn of θ swings the
 * beam by 2θ, and the objective puts the spot at x = f·2θx, y = f·2θy. The page
 * passes the configuration's own focal length, field and spot, so every angle
 * the readout shows comes from the configurator's optics model.
 *
 * The figure is drawn once here. The page gets the static SVG, the geometry it
 * needs to move the mirrors and the beam, and the kit's runtime, all in anatomy.js,
 * which is loaded as a file because the site's content security policy forbids
 * inline script.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const W = 640, H = 420;

/* ---- the world, in units of about a pixel ------------------------------------ */
const BB = { x: -222, y: -92, w: 356, d: 196, r: 8 };            // optical breadboard
const BB_H = 10, FOOT_H = 6;
const BEAM_Z = 92;                                                 // beam height above the board
const C = [40, 20];                                                // lens axis = field centre
const FIELD = 120;                                                 // drawn field, side
const HALF = FIELD / 2;
const FIX = { x: C[0] - 78, y: C[1] - 78, w: 156, d: 156, r: 4 };  // fixture plate
const FIX_H = 6;
const WORK = { x: C[0] - 68, y: C[1] - 68, w: 136, d: 136, r: 2 }; // calibration plate
const WORK_Z = FIX_H, WORK_H = 2, ZW = WORK_Z + WORK_H;           // top of the plate
const LENS_R = 15, LENS_BOT = 48, LENS_TOP = 72;
const BLOCK = { x: C[0] - 22, y: C[1] - 56, w: 58, d: 74, r: 3 };  // galvo block plate
const BLOCK_Z = LENS_TOP, BLOCK_H = 8, BLOCK_TOP = BLOCK_Z + BLOCK_H;
const XM = [C[0], C[1] - 40, BEAM_Z];                              // X mirror centre
const YM = [C[0], C[1], BEAM_Z];                                   // Y mirror centre
const COL = { x: C[0] - 12, y: -86, w: 24, d: 18, r: 2 };          // Z column
const COL_TOP = 150;
const SRC_PED = { x: -212, y: XM[1] - 17, w: 66, d: 34, r: 2 };
const SRC_BOX = { x: -208, y: XM[1] - 14, w: 58, d: 28, r: 3 };
const SRC_Z = 72, SRC_TOP = 112;
const EXP_A = -126, EXP_B = -66;                                   // expander barrel span along x
const APERTURE_X = BLOCK.x + 4;

const P = k.fitProjection(
  [...k.boxCorners(BB, -BB_H - FOOT_H, 0), [COL.x, COL.y, COL_TOP + 8], [COL.x + COL.w, COL.y + COL.d, COL_TOP + 8],
   [SRC_BOX.x, SRC_BOX.y, SRC_TOP + 6], [YM[0] + 36, YM[1], BEAM_Z + 10]],
  W, H, { pad: 22, azimuth: 52 });

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const fx = (o) => G.frameOf(o, [1, 0, 0], [0, 1, 0], [0, 0, 1]);   // an axis along +x
const fz = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);   // an axis along +z

/* ---- base: breadboard on feet, tapped holes, ruler, label plate --------------- */
function base() {
  const o = [`<path class="iso-halo" d="${k.haloOf(BB, -BB_H - FOOT_H, BB_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BB, 22))) {
    o.push(S(k.cylinder(x, y, 8, -BB_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    o.push(S(k.cylinder(x, y, 6, -BB_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  o.push(S(k.slabOf(BB, -BB_H, BB_H, P, 8, 1.6), { tone: "lo", inner: L(k.sideSeam(BB, -BB_H + 3, P, 8), { tone: "faint" }) }));
  o.push(L(k.planOutline(k.insetPlan(BB, 5), 0, P), { tone: "faint" }));
  const holes = [];
  for (let x = BB.x + 15; x <= BB.x + BB.w - 15; x += 12.5)
    for (let y = BB.y + 15; y <= BB.y + BB.d - 28; y += 12.5) holes.push(at([x, y, 0]));
  o.push(Dt(holes, { size: 0.42, tone: "lo" }));
  const screws = k.corners(BB, 10);
  o.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  o.push(Dt(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  /* ruler strip along the near edge, ticks rooted on its edge */
  const strip = { x: BB.x + 20, y: BB.y + BB.d - 16, w: 250, d: 7, r: 1 };
  o.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.6, 0.6, [2, 3.8], P);
  o.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  o.push(Dt([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  /* label plate with three rule lines that stand for printed text */
  const lab = { x: BB.x + 282, y: BB.y + BB.d - 22, w: 40, d: 14, r: 1.2 };
  o.push(S(k.slabOf(lab, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  o.push(L(k.planOutline(k.insetPlan(lab, 1.6), 0.8, P), { tone: "faint" }));
  [[26, 4.6], [18, 7.2], [22, 9.8]].forEach(([w, y]) =>
    o.push(L(k.lineOnTop([lab.x + 4, lab.y + y], [lab.x + 4 + w, lab.y + y], 0.8, P), { tone: "lo", free: true })));
  o.push(Dt([at([lab.x + 36.4, lab.y + 4, 0.8]), at([lab.x + 36.4, lab.y + 10, 0.8])], { size: 0.42 }));
  return o.join("");
}

/* ---- the laser controller in front of the source ------------------------------ */
const CTRL = { x: -204, y: 22, w: 118, d: 56, r: 3 }, CTRL_H = 22;
function controller() {
  const o = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CTRL, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  for (const [x, y] of byDepth(k.corners(CTRL, 8))) o.push(S(k.cylinder(x, y, 3.2, 0, 2, P, 18), { tone: "lo" }));
  o.push(S(k.slabOf(CTRL, 2, CTRL_H, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(CTRL, 8, P, 5), { tone: "faint" }) }));
  const top = 2 + CTRL_H;
  o.push(Dt(k.corners(CTRL, 4).map(([x, y]) => at([x, y, top])), { size: 0.45 }));
  /* vent slots across the back of the lid, each a closed outline */
  const vents = []; for (let i = 0; i < 9; i++) vents.push(k.planOutline({ x: CTRL.x + 10 + i * 6, y: CTRL.y + 6, w: 2.2, d: 18, r: 1.1 }, top, P, 3));
  o.push(L(vents.join(""), { tone: "lo" }));
  /* display bezel and window, with the line it is showing */
  const bz = { x: CTRL.x + 70, y: CTRL.y + 7, w: 40, d: 18, r: 1.6 };
  o.push(S(k.slabOf(bz, top, 1.2, P, 3, 0.4), { tone: "mid" }));
  const win = k.insetPlan(bz, 2.4);
  o.push(S(k.slabOf(win, top + 1.2, 0.2, P, 2), { tone: "lo", crease: "none" }));
  [[22, 4.6], [14, 8.6], [18, 12.6]].forEach(([w, y]) =>
    o.push(L(k.lineOnTop([win.x + 3, bz.y + y], [win.x + 3 + w, bz.y + y], top + 1.4, P), { tone: "mid", free: true })));
  /* key, emission lamp, four buttons and a knurled power knob */
  const row = CTRL.y + CTRL.d - 14;
  o.push(S(k.cylinder(CTRL.x + 14, row, 4, top, 2.6, P, 24), { tone: "mid" }));
  o.push(L(k.lineOnTop([CTRL.x + 11.6, row], [CTRL.x + 16.4, row], top + 2.6, P), { tone: "hi" }));
  o.push(S(k.cylinder(CTRL.x + 28, row, 3, top, 1, P, 20), { tone: "mid" }));
  o.push(S(k.cylinder(CTRL.x + 28, row, 2, top + 1, 1.8, P, 20), { tone: "hi" }));
  for (let i = 0; i < 4; i++) {
    const b = { x: CTRL.x + 40 + i * 9, y: row - 3, w: 6, d: 6, r: 1.2 };
    o.push(S(k.slabOf(b, top, 1.6, P, 3, 0.3), { tone: "mid" }));
  }
  o.push(S(k.cylinder(CTRL.x + 96, row, 8, top, 1.4, P, 40), { tone: "lo" }));
  o.push(S(k.cylinder(CTRL.x + 96, row, 6.4, top + 1.4, 4.4, P, 40), { tone: "mid" }));
  o.push(L(k.knurl(CTRL.x + 96, row, 6.4, top + 1.4, top + 5.8, 44, P), { tone: "lo" }));
  o.push(L(k.lineOnTop([CTRL.x + 96, row], [CTRL.x + 96 + 4.6, row - 2], top + 5.8, P), { tone: "hi" }));
  const ticks = k.radialTicks(CTRL.x + 96, row, 9, 24, 6, top, [1.2, 2.2], P, -Math.PI * 0.75, Math.PI * 1.5);
  o.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return o.join("");
}

/* ---- the laser source on its pedestal ----------------------------------------- */
function source() {
  const o = [];
  o.push(S(k.slabOf(SRC_PED, 0, SRC_Z, P, 3, 0.6), { tone: "lo", inner: L(k.sideSeam(SRC_PED, 10, P, 3), { tone: "faint" }) }));
  o.push(Dt(k.corners(SRC_PED, 4).map(([x, y]) => at([x, y, SRC_Z])), { size: 0.45 }));
  /* access panel on the near face: screws, a pull and a column of vent slots */
  const fy = SRC_PED.y + SRC_PED.d, px0 = SRC_PED.x + 7, px1 = SRC_PED.x + SRC_PED.w - 7, pz0 = 14, pz1 = 62;
  o.push(S(k.slabOf({ x: px0, y: fy, w: px1 - px0, d: 0.8, r: 0.3 }, pz0, pz1 - pz0, P, 2), { tone: "lo", crease: "none" }));
  const fy2 = fy + 0.8;
  o.push(Dt([[px0 + 3, pz0 + 3], [px1 - 3, pz0 + 3], [px0 + 3, pz1 - 3], [px1 - 3, pz1 - 3]].map(([x, z]) => at([x, fy2, z])), { size: 0.45 }));
  const slot = (x, z) => k.pathOf([[x, fy2, z], [x + 16, fy2, z], [x + 16, fy2, z + 1.6], [x, fy2, z + 1.6]].map(at), true);
  const slots = []; for (let z = pz0 + 8; z <= pz1 - 12; z += 4.4) slots.push(slot(px0 + 8, z), slot(px0 + 28, z));
  o.push(L(slots.join(""), { tone: "faint" }));
  o.push(S(k.slabOf({ x: px1 - 9, y: fy2, w: 3, d: 2.4, r: 0.8 }, 30, 14, P, 2), { tone: "mid", crease: "none" }));
  o.push(S(k.slabOf(SRC_BOX, SRC_Z, SRC_TOP - SRC_Z, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(SRC_BOX, SRC_TOP - 6, P, 4), { tone: "faint" }) }));
  /* cooling fins across the lid, front fin last */
  for (let i = 0; i < 8; i++) {
    const fin = { x: SRC_BOX.x + 6 + i * 4.6, y: SRC_BOX.y + 3, w: 1.6, d: SRC_BOX.d - 6, r: 0.4 };
    o.push(S(k.slabOf(fin, SRC_TOP, 4.5, P, 2), { tone: "mid", crease: "none" }));
  }
  /* status lamp and key switch on the lid, front right */
  const lamp = [SRC_BOX.x + SRC_BOX.w - 9, SRC_BOX.y + SRC_BOX.d - 8];
  o.push(S(k.cylinder(lamp[0], lamp[1], 3.4, SRC_TOP, 1.2, P, 24), { tone: "mid" }));
  o.push(S(k.cylinder(lamp[0], lamp[1], 2.4, SRC_TOP + 1.2, 2.2, P, 24), { tone: "hi" }));
  const key = [SRC_BOX.x + SRC_BOX.w - 9, SRC_BOX.y + 8];
  o.push(S(k.cylinder(key[0], key[1], 3.2, SRC_TOP, 2.6, P, 24), { tone: "mid" }));
  o.push(L(k.lineOnTop([key[0] - 2, key[1]], [key[0] + 2, key[1]], SRC_TOP + 2.6, P), { tone: "hi" }));
  /* collimator barrel out of the front face, on the beam axis */
  const F = fx([SRC_BOX.x + SRC_BOX.w, XM[1], BEAM_Z]);
  o.push(S(G.solidOf([[0, 7], [2, 7], [2, 5], [12, 5], [12, 4.2], [15, 4.2]], F, P), { tone: "mid" }));
  o.push(L(G.circleOf(F, 15, 1.6, P), { tone: "lo" }));
  /* the beam leaves the collimator window from its centre */
  o.push(Dt([at([SRC_BOX.x + SRC_BOX.w + 15, XM[1], BEAM_Z])], { size: 0.55, tone: "hi" }));
  return o.join("");
}

/* ---- the beam expander on two posts ------------------------------------------- */
function post(x) {
  const o = [];
  o.push(S(k.cylinder(x, XM[1], 7, 0, 2, P, 28), { tone: "lo" }));
  o.push(S(k.cylinder(x, XM[1], 5, 2, 22, P, 28), { tone: "mid", inner: L(k.sideArc(x, XM[1], 5, 14, P, 16), { tone: "faint" }) }));
  o.push(S(k.slabOf({ x: x + 3.4, y: XM[1] - 1.6, w: 3, d: 3.2, r: 0.8 }, 15, 3.4, P, 2), { tone: "mid", crease: "none" }));
  o.push(S(k.cylinder(x + 7.6, XM[1], 2.2, 14.4, 4.6, P, 18), { tone: "mid" }));
  o.push(S(k.cylinder(x, XM[1], 3, 24, 56, P, 24), { tone: "mid", crease: "none", inner: L(k.sideArc(x, XM[1], 3, 52, P, 12), { tone: "faint" }) }));
  const v = { x: x - 7, y: XM[1] - 7, w: 14, d: 14, r: 1.6 };
  o.push(S(k.slabOf(v, 80, 5, P, 3, 0.5), { tone: "mid" }));
  o.push(Dt([at([v.x + 2.2, v.y + 2.2, 85]), at([v.x + 11.8, v.y + 11.8, 85])], { size: 0.4 }));
  return o.join("");
}
function expander() {
  const o = [post(EXP_A + 12), post(EXP_B - 12)];
  const F = fx([EXP_A, XM[1], BEAM_Z]);
  const len = EXP_B - EXP_A;
  o.push(S(G.solidOf([[0, 4.2], [3, 4.2], [3, 6.4], [len - 14, 6.4], [len - 14, 7], [len - 4, 7], [len - 4, 8.6], [len, 8.6]], F, P),
    { tone: "mid", inner: L(G.arcOf(F, 18, 6.4, P), { tone: "faint" }) }));
  /* knurled adjustment ring, ribs ending on its two seams */
  o.push(S(G.disc(24, 31, 7.6, F, P), { tone: "mid" }));
  o.push(k.fadedSvg(G.ribsOf(F, 24, 31, 7.6, 40, P, { fade: [0.1, 0.55] }), { tone: "lo" }));
  o.push(L(G.circleOf(F, len, 5.4, P), { tone: "lo" }));
  o.push(Dt([at([EXP_B, XM[1], BEAM_Z])], { size: 0.55, tone: "hi" }));
  return o.join("");
}

/* ---- the Z column, carriage and arm ------------------------------------------- */
function column() {
  const o = [];
  const flange = k.insetPlan(COL, -6);
  o.push(S(k.slabOf(flange, 0, 4, P, 4, 0.6), { tone: "lo" }));
  o.push(Dt(k.corners(flange, 3).map(([x, y]) => at([x, y, 4])), { size: 0.45 }));
  o.push(S(k.slabOf(COL, 4, COL_TOP - 4, P, 3, 0.6), { tone: "mid",
    inner: L(k.segment([C[0], COL.y + COL.d, 4], [C[0], COL.y + COL.d, COL_TOP], P), { tone: "faint" }) }));
  const ticks = k.sideTicks(16, COL_TOP - 8, 5, 5, COL.y + COL.d, 0, [1.8, 3.4], P, "z");
  void ticks;
  /* Z scale: ticks hang from a strip along the column's right face */
  const strip = { x: COL.x + COL.w, y: COL.y + 3, w: 0.6, d: COL.d - 6, r: 0.2 };
  o.push(S(k.slabOf(strip, 14, COL_TOP - 24, P, 2), { tone: "lo", crease: "none" }));
  for (let z = 18; z <= COL_TOP - 14; z += 6)
    o.push(L(k.segment([strip.x + 0.6, strip.y, z], [strip.x + 0.6, strip.y + ((z - 18) % 30 === 0 ? 5 : 3), z], P), { tone: (z - 18) % 30 === 0 ? "mid" : "lo" }));
  o.push(S(k.slabOf(k.insetPlan(COL, -1.2), COL_TOP, 3, P, 3, 0.5), { tone: "mid" }));
  /* handwheel on top: hub, knurled rim, crank */
  o.push(S(k.cylinder(C[0], COL.y + COL.d / 2, 4, COL_TOP + 3, 2, P, 20), { tone: "mid" }));
  o.push(S(k.cylinder(C[0], COL.y + COL.d / 2, 11, COL_TOP + 5, 3.4, P, 48), { tone: "mid" }));
  o.push(L(k.knurl(C[0], COL.y + COL.d / 2, 11, COL_TOP + 5, COL_TOP + 8.4, 60, P), { tone: "lo" }));
  o.push(L(k.ring(C[0], COL.y + COL.d / 2, 7.4, COL_TOP + 8.4, P, 40), { tone: "faint" }));
  o.push(S(k.cylinder(C[0] + 7.6, COL.y + COL.d / 2 + 3, 1.6, COL_TOP + 8.4, 6, P, 16), { tone: "hi" }));
  /* carriage on the front face, with two clamp screws */
  const car = { x: COL.x - 4, y: COL.y + COL.d, w: COL.w + 8, d: 5, r: 1.2 };
  o.push(S(k.slabOf(car, BLOCK_Z - 14, 30, P, 3, 0.5), { tone: "mid" }));
  for (const x of [car.x + 5, car.x + car.w - 5]) {
    o.push(S(k.cylinder(x, car.y + car.d + 1.6, 2.2, BLOCK_Z + 10, 3.2, P, 18), { tone: "mid" }));
    o.push(L(k.knurl(x, car.y + car.d + 1.6, 2.2, BLOCK_Z + 10, BLOCK_Z + 13.2, 14, P), { tone: "lo" }));
  }
  /* arm from the carriage to the galvo block */
  const arm = { x: C[0] - 10, y: car.y + car.d, w: 20, d: BLOCK.y - car.y - car.d, r: 1 };
  o.push(S(k.slabOf(arm, BLOCK_Z, BLOCK_H, P, 2, 0.4), { tone: "mid" }));
  o.push(Dt([at([arm.x + 4, arm.y + arm.d / 2, BLOCK_TOP]), at([arm.x + arm.w - 4, arm.y + arm.d / 2, BLOCK_TOP])], { size: 0.45 }));
  return o.join("");
}

/* ---- the fixture and the calibration plate ------------------------------------ */
function fixture() {
  const o = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(FIX, 4), 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  o.push(S(k.slabOf(FIX, 0, FIX_H, P, 5, 0.8), { tone: "mid" }));
  o.push(Dt(k.corners(FIX, 4.5).map(([x, y]) => at([x, y, FIX_H])), { size: 0.45 }));
  /* locating pins against two edges of the plate */
  for (const [x, y] of [[WORK.x - 2.6, WORK.y + 20], [WORK.x - 2.6, WORK.y + WORK.d - 20], [WORK.x + 24, WORK.y - 2.6]])
    o.push(S(k.cylinder(x, y, 2.4, FIX_H, 4, P, 18), { tone: "mid" }));
  o.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(WORK, 2), WORK_Z, 0.1, P)}" style="filter:blur(2px);opacity:.5"/>`);
  o.push(S(k.slabOf(WORK, WORK_Z, WORK_H, P, 3, 0.5), { tone: "hi", crease: "lo" }));
  /* the field the objective can reach, as four corner marks engraved on the fixture */
  const f = [C[0] - HALF, C[1] - HALF, C[0] + HALF, C[1] + HALF], m = 8;
  const cornerMark = (x, y, sx, sy) => k.onTop([[x + sx * m, y], [x, y], [x, y + sy * m]], ZW, P);
  o.push(L([cornerMark(f[0], f[1], 1, 1), cornerMark(f[2], f[1], -1, 1), cornerMark(f[0], f[3], 1, -1), cornerMark(f[2], f[3], -1, -1)].join(""), { tone: "faint", free: true }));
  /* toggle clamp holding the plate's near edge */
  const tc = { x: C[0] + 30, y: WORK.y + WORK.d + 2, w: 16, d: 10, r: 1.4 };
  o.push(S(k.slabOf(tc, FIX_H, 5, P, 3, 0.5), { tone: "mid" }));
  o.push(S(k.slabOf({ x: tc.x + 5, y: tc.y - 4.6, w: 6, d: 6, r: 1 }, FIX_H + 5, 2.4, P, 2), { tone: "mid", crease: "none" }));
  o.push(S(k.cylinder(tc.x + 8, tc.y + 6, 2, FIX_H + 5, 6, P, 16), { tone: "mid" }));
  return o.join("");
}

/* ---- the f-theta objective, hanging under the block --------------------------- */
function lens() {
  const o = [];
  const F = fz([C[0], C[1], LENS_BOT]);
  const h = LENS_TOP - LENS_BOT;
  o.push(S(G.solidOf([[0, LENS_R - 3], [2, LENS_R - 3], [2, LENS_R], [h - 4, LENS_R], [h - 4, LENS_R + 2.4], [h, LENS_R + 2.4]], F, P),
    { tone: "mid", inner: L(G.arcOf(F, 8, LENS_R, P), { tone: "faint" }) + L(G.arcOf(F, 14, LENS_R, P), { tone: "faint" }) }));
  o.push(k.fadedSvg(G.ribsOf(F, 8, 14, LENS_R, 56, P, { fade: [0.1, 0.55] }), { tone: "lo" }));
  o.push(Dt(G.dotsOf(F, h - 2, LENS_R + 2.4, 8, P, { fade: [0.04, 0.42] }), { size: 0.45 }));
  return o.join("");
}

/* ---- the galvo block, its motors and the aperture ----------------------------- */
function block() {
  const o = [];
  o.push(S(k.slabOf(BLOCK, BLOCK_Z, BLOCK_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BLOCK, BLOCK_Z + 3, P, 4), { tone: "faint" }) }));
  o.push(Dt(k.corners(BLOCK, 3.5).map(([x, y]) => at([x, y, BLOCK_TOP])), { size: 0.45 }));
  o.push(L(k.ring(YM[0], YM[1], 5.2, BLOCK_TOP, P, 32), { tone: "lo" }));          // the beam's way down to the lens
  /* entrance aperture on a small post at the block's left edge */
  o.push(S(k.slabOf({ x: APERTURE_X - 2, y: XM[1] - 3, w: 4, d: 6, r: 0.8 }, BLOCK_TOP, BEAM_Z - 4.4 - BLOCK_TOP, P, 2), { tone: "mid" }));
  o.push(Dt([at([APERTURE_X, XM[1], BEAM_Z - 4.4])], { size: 0.4 }));
  /* X motor: vertical, under the X mirror */
  o.push(S(k.cylinder(XM[0], XM[1], 7, BLOCK_TOP, 2, P, 32), { tone: "lo" }));
  o.push(S(k.cylinder(XM[0], XM[1], 5.6, BLOCK_TOP + 2, 3.6, P, 32), { tone: "mid", inner: L(k.sideArc(XM[0], XM[1], 5.6, BLOCK_TOP + 4, P, 20), { tone: "faint" }) }));
  o.push(S(k.cylinder(XM[0], XM[1], 1.2, BLOCK_TOP + 5.6, BEAM_Z - 5 - BLOCK_TOP - 5.6, P, 16), { tone: "mid", crease: "none" }));
  return o.join("");
}
/* Y motor: lying along x beside the Y mirror, on a bracket */
const YMOTOR_A = YM[0] + 11, YMOTOR_B = YM[0] + 36;
function ymotor() {
  const o = [];
  const br = { x: YMOTOR_A + 4, y: YM[1] - 6, w: 18, d: 12, r: 1.2 };
  o.push(S(k.slabOf(br, BLOCK_TOP, BEAM_Z - 6.4 - BLOCK_TOP, P, 3, 0.5), { tone: "mid" }));
  o.push(Dt([at([br.x + 3, br.y + br.d - 2.4, BEAM_Z - 6.4]), at([br.x + br.w - 3, br.y + br.d - 2.4, BEAM_Z - 6.4])], { size: 0.4 }));
  const F = fx([YMOTOR_A, YM[1], BEAM_Z]);
  const len = YMOTOR_B - YMOTOR_A;
  /* shaft and the clamp hub that holds the mirror's edge */
  o.push(S(G.solidOf([[-2.6, 2.6], [-1.4, 2.6], [-1.4, 1.2], [0, 1.2]], F, P), { tone: "mid" }));
  o.push(S(G.solidOf([[0, 5], [2, 6.4], [len - 3, 6.4], [len - 3, 5.4], [len, 5.4]], F, P),
    { tone: "mid", inner: L(G.arcOf(F, 9, 6.4, P), { tone: "faint" }) }));
  o.push(Dt(G.dotsOf(F, len, 3.4, 4, P, { all: true }), { size: 0.4 }));
  return o.join("");
}

/* ---- mirrors and beam: geometry the page rebuilds per frame ------------------- */
const MIRROR = { x: { c: XM, w: 12, h: 10, t: 1.2 }, y: { c: YM, w: 17, h: 12, t: 1.2 } };
function mirrorPaths(axis, theta) {
  const m = MIRROR[axis];
  let n, u, v;
  if (axis === "x") {
    /* about z; at rest it turns +x into +y, normal (−1, 1, 0)/√2 */
    const a = Math.PI * 3 / 4 + theta;
    n = [Math.cos(a), Math.sin(a), 0]; u = [-Math.sin(a), Math.cos(a), 0]; v = [0, 0, 1];
  } else {
    /* about x; at rest it turns +y into −z, normal (0, −1, −1)/√2 */
    const a = -Math.PI * 3 / 4 + theta;
    n = [0, Math.cos(a), Math.sin(a)]; u = [1, 0, 0]; v = [0, -Math.sin(a), Math.cos(a)];
  }
  const F = G.frameOf(m.c, n, u, v);
  const poly = [[-m.w / 2, -m.h / 2], [m.w / 2, -m.h / 2], [m.w / 2, m.h / 2], [-m.w / 2, m.h / 2]];
  return G.prismOf(F, poly, -m.t / 2, m.t / 2, P);
}

const figure = k.figureSvg({
  width: W, height: H,
  label: "A galvo scan head on an optical breadboard. A laser source feeds a beam expander; the beam enters a block carrying two small mirrors on motors, held on a Z column. The first mirror turns about the vertical axis and the second about a horizontal axis; together they steer the beam down through an f-theta objective onto a calibration plate, where the spot draws the field's border and a grid of crosses.",
  body: [
    base(),
    source(),
    `<path data-part="beam-in" class="iso-line" data-tone="lit" d="${k.segment([SRC_BOX.x + SRC_BOX.w + 15, XM[1], BEAM_Z], [EXP_A, XM[1], BEAM_Z], P)}" style="stroke-width:1"/>`,
    expander(),
    controller(),
    column(),
    fixture(),
    `<g data-part="marks"></g>`,
    lens(),
    block(),
    `<path data-part="beam-mid" class="iso-line" data-tone="lit" d="" style="stroke-width:1"/>`,
    `<g data-part="xmirror"></g>`,
    `<path data-part="beam-xy" class="iso-line" data-tone="lit" d="" style="stroke-width:1"/>`,
    `<path data-part="beam-down" class="iso-line" data-tone="lit" d="" style="stroke-width:1"/>`,
    ymotor(),
    `<g data-part="ymirror"></g>`,
    `<g data-part="aperture">${S(G.ringBand(-0.8, 0.8, 1.8, 4.4, fx([APERTURE_X, XM[1], BEAM_Z]), P), { tone: "mid" })}</g>`,
    `<path data-part="beam-out" class="iso-line" data-tone="lit" d="" style="stroke-width:1.1"/>`,
    `<g data-part="spot"></g>`,
  ],
});

const GEO = { P, C, HALF, ZW, LENS_BOT, LENS_R, XM, YM, BLOCK_TOP, BEAM_Z, EXP_B, APERTURE_X, MIRROR };

/* ---- the live part: runs in the page ------------------------------------------ */
const LIVE = String.raw`
var GEO = __GEO__, P = GEO.P;
${mirrorPaths.toString().replace(/MIRROR\[/g, "GEO.MIRROR[")}
/* The calibration program a real operator marks to check a field: the border,
   then a 3 × 3 grid of crosses. Coordinates are shares of the half-field. */
function program() {
  var s = [], g = [-0.6, 0, 0.6], a = 0.12, i, j;
  s.push([[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]);
  for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
    var x = g[j], y = g[(j % 2) ? 2 - i : i];
    s.push([[x - a, y], [x + a, y]]); s.push([[x, y - a], [x, y + a]]);
  }
  return s;
}
var PROG = program();
function mount(host, cfg) {
  if (mount.stop) mount.stop();
  host.innerHTML = __PLATE__;
  var plate = host.querySelector(".iso"), stage = host.querySelector(".iso-stage"), svg = stage.querySelector("svg");
  var part = function (n) { return svg.querySelector('[data-part="' + n + '"]'); };
  var el = { xm: part("xmirror"), ym: part("ymirror"), mid: part("beam-mid"), xy: part("beam-xy"), down: part("beam-down"), out: part("beam-out"), spot: part("spot"), marks: part("marks") };
  var readout = host.querySelector("[data-readout]"), caption = host.querySelector(".iso-caption");
  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var f = cfg.f, half = cfg.fld / 2;
  var deg = function (r) { return r * 180 / Math.PI; };
  var maxT = deg(half / f / 2);
  if (caption) caption.textContent = "With the " + cfg.lens + " objective (f = " + f + " mm, field " + cfg.fld + " × " + cfg.fld + " mm), each mirror turns up to ± " + maxT.toFixed(2) + "° mechanical to reach the edge of the field: a mirror turned by θ swings the beam by 2θ, and the objective puts the spot at f·2θ. The spot itself is about " + Math.round(cfg.spot) + " µm, too small to draw at this scale. Not to scale; the angles are the configuration's.";
  plate.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  /* state: the spot's commanded and actual position, in shares of the half-field */
  var st = { u: 0, v: 0, tu: 0, tv: 0, mode: "tour", seg: 0, pt: 0, done: [], cur: null, hold: 0 }, frame = 0, last = 0, visible = false, idle = 0, stopped = false;
  var MARK = 0.42, JUMP = 1.5;                    /* shares of the half-field per second, slowed to be followed */
  function world(u, v) { return [GEO.C[0] + u * GEO.HALF, GEO.C[1] + v * GEO.HALF, GEO.ZW]; }
  function polyOnPlate(list) { return list.length < 2 ? "" : pathOf(list.map(function (p) { return iso(world(p[0], p[1]), P); })); }
  function draw() {
    /* an f-theta objective is made so that the spot lands at r = f·θ for a beam
       turned by θ; a mirror turned by θm turns the beam by 2θm, so θm = x / 2f */
    var tx = st.u * half / f / 2, ty = st.v * half / f / 2;
    var xm = mirrorPaths("x", tx), ym = mirrorPaths("y", ty);
    el.xm.innerHTML = solidSvg(xm, { tone: "hi" });
    el.ym.innerHTML = solidSvg(ym, { tone: "hi" });
    var on = st.mode === "tour" ? st.cur !== null : true, spot = world(st.u, st.v);
    var dx = Math.sin(2 * tx), hitY = [GEO.YM[0] + dx * (GEO.YM[1] - GEO.XM[1]), GEO.YM[1], GEO.BEAM_Z];
    el.mid.setAttribute("d", segment([GEO.EXP_B, GEO.XM[1], GEO.BEAM_Z], GEO.XM, P));
    el.xy.setAttribute("d", segment(GEO.XM, hitY, P));
    el.down.setAttribute("d", segment(hitY, [hitY[0], hitY[1], GEO.BLOCK_TOP], P));
    var exit = [GEO.C[0] + st.u * GEO.LENS_R * 0.45, GEO.C[1] + st.v * GEO.LENS_R * 0.45, GEO.LENS_BOT];
    el.out.setAttribute("d", segment(exit, spot, P));
    var s = iso(spot, P);
    var ex = iso(exit, P);
    el.spot.innerHTML = '<circle cx="' + ex[0].toFixed(2) + '" cy="' + ex[1].toFixed(2) + '" r=".55" style="fill:var(--anatomy-hi)"/><circle cx="' + s[0].toFixed(2) + '" cy="' + s[1].toFixed(2) + '" r="2.6" class="iso-wire-end" style="fill:var(--anatomy-lit);opacity:' + (on ? .35 : .15) + '"/><circle cx="' + s[0].toFixed(2) + '" cy="' + s[1].toFixed(2) + '" r="1.05" style="fill:var(--anatomy-lit)"/>';
    /* what is marked: finished strokes, and the one being marked up to where the spot really is */
    var marks = st.done.map(polyOnPlate).join("") + (st.cur ? polyOnPlate(st.cur.concat([[st.u, st.v]])) : "");
    el.marks.innerHTML = marks ? '<path class="iso-line" data-tone="hi" style="stroke-width:.9" d="' + marks + '"/>' : "";
    var x = st.u * half, y = st.v * half, sg = function (n) { return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2); };
    var text = "X " + sg(deg(tx)) + "° · Y " + sg(deg(ty)) + "° · spot " + sg(x).replace("+", "") + ", " + sg(y).replace("+", "") + " mm";
    if (readout && readout.textContent !== text) readout.textContent = text;
  }
  function describe() {
    stage.setAttribute("aria-valuetext", st.mode === "tour" ? "Marking the calibration grid" : "Aiming at " + (st.tu * half).toFixed(1) + ", " + (st.tv * half).toFixed(1) + " mm");
  }
  function tourStep(dt) {
    if (st.hold > 0) { st.hold -= dt; if (st.hold <= 0) { st.done = []; st.seg = 0; st.pt = 0; } return; }
    var seg = PROG[st.seg], to = seg[st.pt];
    var d = Math.hypot(to[0] - st.tu, to[1] - st.tv), speed = st.cur ? MARK : JUMP, step = speed * dt;
    if (d <= step) {
      st.tu = to[0]; st.tv = to[1];
      if (!st.cur) st.cur = [[to[0], to[1]]]; else st.cur.push([to[0], to[1]]);
      st.pt++;
      if (st.pt >= seg.length) { st.done.push(st.cur); st.cur = null; st.seg++; st.pt = 0;
        if (st.seg >= PROG.length) { st.seg = 0; st.hold = 1.8; } }
    } else { st.tu += (to[0] - st.tu) / d * step; st.tv += (to[1] - st.tv) / d * step; }
  }
  function tick(now) {
    if (stopped) return;
    var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60; last = now;
    if (st.mode === "tour" && !still.matches) tourStep(dt);
    var k = still.matches ? 1 : 1 - Math.exp(-dt / 0.035);           /* the mirrors' small lag */
    st.u += (st.tu - st.u) * k; st.v += (st.tv - st.v) * k;
    draw();
    var settled = st.mode !== "tour" && Math.abs(st.tu - st.u) < 5e-4 && Math.abs(st.tv - st.v) < 5e-4;
    if (settled) { st.u = st.tu; st.v = st.tv; draw(); }
    frame = (visible || st.mode === "aim") && !settled ? requestAnimationFrame(tick) : 0;
  }
  function run(force) { if (!frame && (visible || force) && !stopped) { last = 0; frame = requestAnimationFrame(tick); } }
  function aim(u, v) {
    st.mode = "aim"; st.cur = null; st.tu = Math.max(-1, Math.min(1, u)); st.tv = Math.max(-1, Math.min(1, v));
    describe(); clearTimeout(idle);
    idle = setTimeout(function () { if (still.matches) return; st.mode = "tour"; st.done = []; st.seg = 0; st.pt = 0; st.hold = 0; describe(); run(); }, 3600);
    run(true);
  }
  /* screen → the plate's plane: invert the projection of x and y on that plane */
  var ax = axisVector(P, [1, 0, 0]), ay = axisVector(P, [0, 1, 0]), o0 = iso(world(0, 0), P), det = ax[0] * ay[1] - ax[1] * ay[0];
  function toPlate(clientX, clientY) {
    var b = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, sx = (clientX - b.left) / b.width * vb.width - o0[0], sy = (clientY - b.top) / b.height * vb.height - o0[1];
    var wx = (sx * ay[1] - sy * ay[0]) / det, wy = (ax[0] * sy - ax[1] * sx) / det;
    return [wx / GEO.HALF, wy / GEO.HALF];
  }
  stage.addEventListener("pointermove", function (e) { var q = toPlate(e.clientX, e.clientY); if (Math.abs(q[0]) <= 1.6 && Math.abs(q[1]) <= 1.6) aim(q[0], q[1]); });
  stage.addEventListener("keydown", function (e) {
    var s = e.shiftKey ? 0.25 : 0.05, u = st.mode === "aim" ? st.tu : st.u, v = st.mode === "aim" ? st.tv : st.v;
    if (e.key === "ArrowRight") u += s; else if (e.key === "ArrowLeft") u -= s; else if (e.key === "ArrowDown") v += s; else if (e.key === "ArrowUp") v -= s;
    else if (e.key === "Home") { u = 0; v = 0; } else if (e.key === "End") { u = 1; v = 1; } else return;
    e.preventDefault(); aim(u, v);
  });
  var io = new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" });
  io.observe(stage);
  if (still.matches) st.mode = "aim";
  describe(); draw();
  mount.stop = function () { stopped = true; if (frame) cancelAnimationFrame(frame); frame = 0; io.disconnect(); clearTimeout(idle); };
  return { state: st, draw: draw, aim: aim, stop: mount.stop, maxAngle: maxT };
}
/* the kit's runtime, shared with Fig 2 (anatomy-ws.js) */
var KIT = { iso: iso, segment: segment, pathOf: pathOf, solidSvg: solidSvg, lineSvg: lineSvg, cylinder: cylinder, ring: ring, axisVector: axisVector, frameOf: G.frameOf, prismOf: G.prismOf };
window.TEALAnatomy = Object.assign(window.TEALAnatomy || {}, { mount: mount, geo: GEO, kit: KIT });
`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Galvo scan head",
  hint: "Hover the plate to aim the spot",
  readout: "X +0.00° · Y +0.00° · spot 0.00, 0.00 mm",
  keys: [
    { mark: "lit", label: "The beam: source, expander, X mirror, Y mirror, objective, spot" },
    { mark: "raised", label: "The two galvo mirrors and the calibration plate" },
  ],
  caption: " ",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Galvo scan head. Arrow keys move the spot across the field; Shift for bigger steps; Home centres it." aria-valuemin="-1" aria-valuemax="1" aria-valuenow="0">${figure}</div>`,
});

/* the kit's runtime, with its exports and its one import stripped */
const kitSrc = readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");
const latheSrc = readFileSync(join(HERE, "kit", "lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const live = LIVE.replace("__GEO__", JSON.stringify(GEO)).replace("__PLATE__", JSON.stringify(`<div class="iso tealfig">${plate}</div>`));
const js = `/* Generated by tools/anatomy/scanhead.mjs — do not edit. Anatomy kit (MIT): tools/anatomy/kit/LICENSE. */\n(function(){"use strict";\n${kitSrc}\nvar G = (function(){\n${latheSrc}\nreturn { frameOf: frameOf, prismOf: prismOf };\n})();\n${live}\n})();\n`;
const css = `/* Generated by tools/anatomy/scanhead.mjs. Anatomy kit styles (MIT), scoped to .iso. */\n${k.ISO_CSS}\n` +
  `.tealfig{margin-top:16px}.tealfig .iso-figure{margin:0}.tealfig .iso-svg{width:100%;height:auto;display:block}` +
  `.tealfig .iso-stage{touch-action:pan-y;outline:none}.tealfig .iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}` +
  `.tealfig .iso-plate{border-radius:var(--r,12px);overflow:hidden}.tealfig .iso-legend{display:grid;gap:8px;margin-top:10px;font-size:12px;color:var(--ink-2,#556)}\n`;
if (process.argv.includes("--check")) {
  /* npm test: the committed files must be what this script builds */
  const same = (f, want) => { try { return readFileSync(join(ROOT, f), "utf8") === want; } catch { return false; } };
  const stale = [["anatomy.js", js], ["anatomy.css", css]].filter(([f, want]) => !same(f, want)).map(([f]) => f);
  if (stale.length) { console.error("out of date: " + stale.join(", ") + " — run npm run anatomy"); process.exit(1); }
  console.log("anatomy.js and anatomy.css current");
  process.exit(0);
}
writeFileSync(join(ROOT, "anatomy.js"), js);
writeFileSync(join(ROOT, "anatomy.css"), css);
console.log("wrote anatomy.js (" + Math.round(js.length / 1024) + " KB) and anatomy.css; svg " + Math.round(figure.length / 1024) + " KB");

const pv = process.argv.indexOf("--preview");
if (pv > 0) {
  const dir = process.argv[pv + 1]; mkdirSync(dir, { recursive: true });
  for (const theme of ["dark", "light"]) {
    const page = k.pageHtml({ title: "Galvo scan head", theme, body: `<div id="host"></div>`,
      script: js + `\ndocument.documentElement.setAttribute("data-theme", "${theme}");\nwindow.FIG = TEALAnatomy.mount(document.getElementById("host"), { f: 254, fld: 175, spot: 32, lens: "F254" });` });
    writeFileSync(join(dir, `scanhead${theme === "light" ? "-light" : ""}.html`), page.replace("<head>", `<head><style>${css}</style>`));
  }
  console.log("previews in " + dir);
}
