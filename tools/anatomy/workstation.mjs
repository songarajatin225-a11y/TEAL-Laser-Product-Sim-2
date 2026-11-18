#!/usr/bin/env node
/* TEAL configurator — Fig 2: the workstation, through one run cycle.
 *
 *   node tools/anatomy/workstation.mjs                 # writes anatomy-ws.js and anatomy-ws-<variant>.js
 *   node tools/anatomy/workstation.mjs --audit         # also proves every variant's geometry (kit audit)
 *   node tools/anatomy/workstation.mjs --preview DIR   # also standalone pages per variant, dark and light
 *   node tools/anatomy/workstation.mjs --check         # npm test: are the written files current?
 *
 * A Class 1 galvo marking workstation drawn with its right-hand side and roof panels off,
 * built with the Anatomy kit (tools/anatomy/kit, MIT). ws-figure.mjs builds one handling
 * variant per import:
 *
 *   hand   loading by hand through the lift door: fixture and two toggle clamps
 *   belt   an SMEMA conveyor through the enclosure, out to a conveyor on legs
 *   mag    the conveyor, fed by a magazine elevator
 *   tray   the conveyor, fed by a tray tower
 *   chute  the conveyor, fed by a vibratory bowl feeder and its chute
 *   dial2  a two-station turntable straddling the open front
 *   dial4  a four-station rotary indexer
 *   arm    a six-axis robot on a pedestal, loading the fixture from a part tray
 *
 * Every part is recorded with its true shape, the kit's settle pass sets the drawing order
 * and --audit proves clearances, supports, cable ends and depth order for each variant.
 *
 * anatomy-ws.js carries the live code and the hand variant (the Standard view, and the one
 * most configurations use); each other variant is a small file the page loads only when the
 * configuration needs it. All of them use the kit runtime that anatomy.js exposes.
 *
 * The page drives the figure from the configurator's own simulation: the same phases with
 * the same durations, and during the process phase the spot follows the configuration's own
 * process path. In the detailed view it adds process effects by process kind (sparks, smoke
 * or plasma at the spot, a glow, a heat tint on the newest marks) and the amber lamp of a
 * stoppage.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as A from "./kit/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const VARIANTS = ["hand", "belt", "mag", "tray", "chute", "dial2", "dial4", "arm"];
const AUDIT = process.argv.includes("--audit"), CHECK = process.argv.includes("--check");

/* ---- the live part: runs in the page, on the kit runtime anatomy.js exposes -------- */
const LIVE = String.raw`
var K = window.TEALAnatomy.kit, iso = K.iso, segment = K.segment, pathOf = K.pathOf, solidSvg = K.solidSvg, cylinder = K.cylinder;
var WS = window.TEALAnatomy.ws = window.TEALAnatomy.ws || {};
WS.figs = WS.figs || {};
WS.add = function (v, plate, geo) { WS.figs[v] = { plate: plate, geo: geo }; };
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
var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
var add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
var mul = function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; };
var len = function (a) { return Math.hypot(a[0], a[1], a[2]); };
var unit = function (a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
/* a point at share u of a polyline's length */
function along(path, u) {
  var L = [], tot = 0, i;
  for (i = 1; i < path.length; i++) { var l = len(sub(path[i], path[i - 1])); L.push(l); tot += l; }
  var x = Math.max(0, Math.min(1, u)) * tot;
  for (i = 0; i < L.length; i++) { if (x <= L[i] || i === L.length - 1) { var f = L[i] ? Math.min(1, x / L[i]) : 1; return add(path[i], mul(sub(path[i + 1], path[i]), f)); } x -= L[i]; }
  return path[path.length - 1];
}
/* the robot's wrist route through a phase: [share of the phase, waypoint] pairs */
function route(keys, W, u) {
  for (var i = 1; i < keys.length; i++) if (u <= keys[i][0]) { var a = keys[i - 1], b = keys[i], f = ease((u - a[0]) / (b[0] - a[0] || 1)); return add(W[a[1]], mul(sub(W[b[1]], W[a[1]]), f)); }
  return W[keys[keys.length - 1][1]];
}
/* where every moving part is, in phase k at share u of it, for this variant */
function pose(g, k, u) {
  var belt = !!g.INPATH, dial = !!g.D, arm = !!g.WAY;
  var o = { door: 0, z: 0, off: [0, 0, 0], show: true, clamp: 0, push: 0, beam: false, prog: 0, marks: false, cam: false, af: false,
    carry: false, dialA: 0, marksA: 0, marksFade: 1, wrist: null, grip: false };
  var stepA = dial ? Math.PI * 2 / g.N : 0;
  if (k === "HOME") { o.z = g.HOME_DZ * span(u, 0, 1); o.show = dial; o.clamp = 1; if (dial) { o.dialA = stepA / 2; o.marks = true; o.prog = 1; o.marksA = stepA / 2; } }
  else if (k === "LOAD") {
    o.z = g.HOME_DZ; o.clamp = 1;
    if (belt) { var q = along(g.INPATH, ease(u)); o.off = sub(q, g.PARTC); o.carry = q[0] > g.X1 - 2; }
    else if (dial) { o.dialA = stepA / 2 + stepA / 2 * span(u, 0, 1); o.marks = true; o.prog = 1; o.marksA = o.dialA; }
    else if (arm) {
      o.wrist = route([[0, "home"], [0.14, "pickUp"], [0.24, "pick"], [0.34, "pickUp"], [0.5, "entry"], [0.62, "placeUp"], [0.74, "place"], [0.86, "placeUp"], [1, "entry"]], g.WAY, u);
      o.grip = u > 0.24 && u < 0.74; o.show = u > 0.24;
      if (o.grip) { o.off = sub(sub(o.wrist, [0, 0, g.GRIP]), g.PARTC); o.carry = true; }
    } else { o.door = span(u, 0, 0.28) * (1 - span(u, 0.78, 1)); o.off = [0, 0, 26 * (1 - span(u, 0.3, 0.74))]; }
  }
  else if (k === "CLAMP") { o.z = g.HOME_DZ; o.clamp = 1 - span(u, 0, 1); o.push = span(u, 0, 1); if (dial) { o.marks = true; o.prog = 1; o.marksA = stepA; o.marksFade = 1 - span(u, 0, 1); } }
  else if (k === "LOCATE") { o.z = g.HOME_DZ; o.cam = true; o.push = 1; }
  else if (k === "FOCUS") { o.z = g.HOME_DZ * (1 - span(u, 0, 1)); o.af = true; o.push = 1; }
  else if (k === "PROCESS") { o.beam = u < 1; o.prog = u; o.marks = true; o.push = 1; }
  else if (k === "VERIFY") { o.prog = 1; o.marks = true; o.cam = true; o.push = 1; }
  else if (k === "UNLOAD") {
    o.prog = 1; o.marks = true;
    if (belt) { o.push = 1 - span(u, 0, 0.15); var q2 = along(g.OUTPATH, span(u, 0.15, 0.95)); o.off = sub(q2, g.PARTC); o.show = u < 0.95; }
    else if (dial) { o.dialA = stepA / 2 * span(u, 0, 1); o.marksA = o.dialA; }
    else if (arm) {
      o.clamp = span(u, 0, 0.12);
      o.wrist = route([[0, "home"], [0.12, "entry"], [0.26, "placeUp"], [0.38, "place"], [0.5, "placeUp"], [0.64, "entry"], [0.8, "pickUp"], [0.9, "out"], [1, "home"]], g.WAY, u);
      o.grip = u > 0.38 && u < 0.9; o.show = u < 0.9;
      if (o.grip) { o.off = sub(sub(o.wrist, [0, 0, g.GRIP]), g.PARTC); o.carry = true; }
    } else { o.clamp = span(u, 0, 0.2); o.door = span(u, 0.2, 0.38) * (1 - span(u, 0.82, 1)); o.off = [0, 0, 26 * span(u, 0.4, 0.78)]; o.show = u < 0.8; }
  }
  if (arm && !o.wrist) o.wrist = g.WAY.home;
  return o;
}
/* a box-section link from a to b, w wide (horizontal) and h deep */
function link(g, a, b, w, h, tone) {
  var ax = unit(sub(b, a)), u = Math.abs(ax[2]) > 0.98 ? [1, 0, 0] : unit(cross([0, 0, 1], ax)), v = cross(ax, u);
  var F = K.frameOf(a, ax, u, v);
  return { d: K.depthOf(mul(add(a, b), 0.5), g.P), svg: solidSvg(K.prismOf(F, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 0, len(sub(b, a)), g.P), { tone: tone || "mid" }) };
}
/* the six-axis arm, solved for a wrist point: turret, shoulder, upper arm, elbow, forearm, wrist, gripper */
function robotSvg(g, T, grip) {
  var B = g.RB, sh = [B[0], B[1], B[2] + g.SH], yaw = Math.atan2(T[1] - B[1], T[0] - B[0]);
  var r = Math.hypot(T[0] - B[0], T[1] - B[1]), z = T[2] - sh[2], d = Math.min(Math.hypot(r, z), g.L1 + g.L2 - 0.5);
  var a1 = Math.atan2(z, r) + Math.acos(Math.max(-1, Math.min(1, (g.L1 * g.L1 + d * d - g.L2 * g.L2) / (2 * g.L1 * d))));
  var c = Math.cos(yaw), s = Math.sin(yaw), side = [-s, c, 0];
  var E = [sh[0] + c * g.L1 * Math.cos(a1), sh[1] + s * g.L1 * Math.cos(a1), sh[2] + g.L1 * Math.sin(a1)];
  var Wd = [T[0], T[1], T[2]], g0 = sub(Wd, [0, 0, 8]), g1 = sub(Wd, [0, 0, 14]), f = grip ? 3.4 : 5.6;
  var parts = [
    { d: K.depthOf([B[0], B[1], B[2] + 8], g.P), svg: solidSvg(cylinder(B[0], B[1], 13, B[2], 16, g.P, 32), { tone: "hi" }) },
    link(g, add(sh, mul(side, -10)), add(sh, mul(side, 10)), 18, 18, "hi"),
    link(g, sh, E, 12, 14, "mid"),
    link(g, add(E, mul(side, -8)), add(E, mul(side, 8)), 13, 13, "hi"),
    link(g, E, Wd, 9, 10, "mid"),
    link(g, Wd, g0, 9, 9, "hi"),
    link(g, g0, g1, 16, 6, "mid"),
    link(g, add(g1, mul(side, f)), add(sub(g1, [0, 0, 10]), mul(side, f)), 2, 4, "lo"),
    link(g, add(g1, mul(side, -f)), add(sub(g1, [0, 0, 10]), mul(side, -f)), 2, 4, "lo")
  ];
  parts.sort(function (p, q) { return p.d - q.d; });
  return parts.map(function (p) { return p.svg; }).join("");
}
/* a rotated box (a station's fixture or part), as a prism about z */
function rbox(g, c, a, w, d, z0, z1, tone) {
  var u = [Math.cos(a), Math.sin(a), 0], v = [-Math.sin(a), Math.cos(a), 0];
  var F = K.frameOf([c[0], c[1], z0], [0, 0, 1], u, v);
  return { d: K.depthOf([c[0], c[1], (z0 + z1) / 2], g.P), svg: solidSvg(K.prismOf(F, [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], 0, z1 - z0, g.P), { tone: tone }) };
}
function mountWS(host, cfg) {
  if (mountWS.stop) mountWS.stop();
  var fig = WS.figs[cfg.variant] || WS.figs.hand, g = fig.geo, P = g.P;
  WS.current = g;
  host.innerHTML = fig.plate;
  var plate = host.querySelector(".iso"), stage = host.querySelector(".iso-stage"), svg = stage.querySelector("svg");
  var q = function (sel) { return svg.querySelector(sel); }, qa = function (sel) { return svg.querySelectorAll(sel); };
  var readout = host.querySelector("[data-readout]"), caption = host.querySelector(".iso-caption");
  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var fx = cfg.effects ? (cfg.fx || "spark") : null;
  plate.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  plate.setAttribute("data-variant", g.VAR);
  /* modules the configuration has: the drawing shows only those */
  var opts = cfg.opts || {};
  Array.prototype.forEach.call(qa("[data-opt]"), function (n) { n.style.display = opts[n.getAttribute("data-opt")] ? "" : "none"; });
  if (caption && cfg.caption) caption.textContent = cfg.caption;
  var el = { marks: q('[data-part="marks"]'), beam: q('[data-part="beam"]'), spot: q('[data-part="spot"]'), leg: q('[data-part="fibreleg"]'),
    hmi: q('[data-part="hmi"]'), cl: q('[data-part="clampL"]'), cr: q('[data-part="clampR"]'), carry: q('[data-part="carry"]'),
    robot: q('[data-part="robot"]'), dial: q('[data-part="dial"]') };
  var doorG = qa('[data-move="door"]'), zG = qa('[data-move="z"]'), pushG = qa('[data-move="push"]');
  var partG = q('[data-move="part"]'), partHome = partG ? { parent: partG.parentNode, next: partG.nextSibling } : null;
  var marksHome = { parent: el.marks.parentNode, next: el.marks.nextSibling }, carried = false;
  var M = movesOf(cfg.segs || [[[-0.3, 0], [0.3, 0]]]);
  var items = svg.querySelector(".ws-items");
  var mk = function (tag) { var n = document.createElementNS("http://www.w3.org/2000/svg", tag || "g"); items.appendChild(n); return n; };
  var tower = mk(), cam = mk(), fxg = mk();
  var parts = [];                                      /* particles, in world units */
  var st = { t: 0, i: 0, paused: 0 }, frame = 0, last = 0, visible = false, stopped = false, lastKey = "";
  /* close-up: ease the view box between the whole machine and the work zone */
  var zoom = { on: false, k: 0, to: 0 }, zbtn = document.createElement("button");
  zbtn.type = "button"; zbtn.className = "ws-zoom"; zbtn.setAttribute("aria-pressed", "false"); zbtn.textContent = "Close-up";
  stage.appendChild(zbtn);
  function viewBox() {
    var e = zoom.k * zoom.k * (3 - 2 * zoom.k), F = g.FULL, Cz = g.CLOSE, v = [0, 1, 2, 3].map(function (i) { return F[i] + (Cz[i] - F[i]) * e; });
    svg.setAttribute("viewBox", v.map(function (n) { return n.toFixed(2); }).join(" "));
  }
  function setZoom(on) {
    zoom.on = on; zoom.to = on ? 1 : 0; zbtn.setAttribute("aria-pressed", on ? "true" : "false"); zbtn.textContent = on ? "Whole machine" : "Close-up";
    plate.classList.toggle("ws-close", on);
    if (still.matches) { zoom.k = zoom.to; viewBox(); }
    run(true);
  }
  zbtn.addEventListener("click", function () { setZoom(!zoom.on); });
  function phasesNow() { return cfg.live ? cfg.live() : null; }
  function moveAt(p) {
    var x = p * M.tot, i;
    for (i = 0; i < M.mv.length; i++) { var m = M.mv[i]; if (x <= m.c + m.w) { var f = m.w ? (x - m.c) / m.w : 1; return { i: i, f: f, at: [m.a[0] + (m.b[0] - m.a[0]) * f, m.a[1] + (m.b[1] - m.a[1]) * f], on: m.on }; } }
    var e = M.mv[M.mv.length - 1]; return { i: M.mv.length, f: 1, at: e ? e.b : [0, 0], on: false };
  }
  /* a share of the field to a world point on the part, wherever the part is */
  function placer(off, a) {
    var c = g.PARTC, ca = Math.cos(a || 0), sa = Math.sin(a || 0), D = g.D;
    return function (p) {
      var w = [c[0] + p[0] * g.MARK_SCALE, c[1] + p[1] * g.MARK_SCALE, g.PART_Z];
      if (D && a) { var dx = w[0] - D[0], dy = w[1] - D[1]; w = [D[0] + dx * ca - dy * sa, D[1] + dx * sa + dy * ca, w[2]]; }
      return add(w, off);
    };
  }
  function marksPath(p, W, from) {
    var cur = moveAt(p), d = "", hot = "", i, start = from == null ? -1 : from;
    var seg = function (a, b) { return pathOf([iso(W(a), P), iso(W(b), P)]); };
    for (i = 0; i < Math.min(cur.i, M.mv.length); i++) if (M.mv[i].on) { var sgm = seg(M.mv[i].a, M.mv[i].b); if (M.mv[i].c / M.tot >= start && start >= 0) hot += sgm; else d += sgm; }
    if (cur.i < M.mv.length && M.mv[cur.i].on && cur.f > 0) hot += seg(M.mv[cur.i].a, cur.at);
    if (start < 0) { d += hot; hot = ""; }
    return { d: d, hot: hot, at: cur.at };
  }
  function clampArm(c, open) {
    /* the arm turns about a pivot axis along y; open, it stands 70 degrees up */
    var a = open * 70 * Math.PI / 180, s = c.s;
    var u = [s * Math.cos(a), 0, Math.sin(a)], v = [-s * Math.sin(a), 0, Math.cos(a)];
    var F = K.frameOf([c.x, c.y, c.pz], [0, 1, 0], u, v);
    var arm = solidSvg(K.prismOf(F, [[0, -1.4], [13, -1.4], [13, 1.4], [0, 1.4]], -2, 2, P), { tone: "hi" });
    var tipF = K.frameOf([c.x + s * 12 * Math.cos(a), c.y, c.pz + 12 * Math.sin(a)], [0, 1, 0], u, v);
    var spindle = solidSvg(K.prismOf(tipF, [[-1.2, -4.2], [1.2, -4.2], [1.2, -1.4], [-1.2, -1.4]], -1.2, 1.2, P), { tone: "mid" });
    var hF = K.frameOf([c.x, c.y, c.pz], [0, 1, 0], [-s * Math.cos(a + 0.9), 0, Math.sin(a + 0.9)], [s * Math.sin(a + 0.9), 0, Math.cos(a + 0.9)]);
    var handle = solidSvg(K.prismOf(hF, [[0, -1], [10, -1], [10, 1], [0, 1]], -1.2, 1.2, P), { tone: "lo" });
    return handle + arm + spindle;
  }
  var screen = function (w) { return [g.ax[0] * w[0] + g.ay[0] * w[1] + g.dz[0] * w[2], g.ax[1] * w[0] + g.ay[1] * w[1] + g.dz[1] * w[2]]; };
  var tr = function (w) { var s = screen(w); return "translate(" + s[0].toFixed(2) + " " + s[1].toFixed(2) + ")"; };
  function setCarry(on) {
    /* a part in transit is drawn in front of the machine, then goes back to its place */
    if (on === carried || !partG) return; carried = on;
    if (on) { el.carry.appendChild(partG); el.carry.appendChild(el.marks); }
    else { marksHome.parent.insertBefore(el.marks, marksHome.next); partHome.parent.insertBefore(partG, partHome.next); }
  }
  function effects(dt, spot, on) {
    if (!fx) { fxg.innerHTML = ""; return; }
    var i, n, out = "";
    if (on && dt > 0) {
      if (fx === "smoke") { if (parts.length < 26 && Math.random() < dt * 30) parts.push({ k: "s", p: add(spot, [0, 0, 1]), v: [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 12 + Math.random() * 8], l: 1, r: 1.4 }); }
      else if (fx === "spark") { for (i = 0; i < 3 && parts.length < 60; i++) { var a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 46; parts.push({ k: "k", p: spot.slice(), v: [Math.cos(a) * sp, Math.sin(a) * sp, 26 + Math.random() * 44], l: 0.35 + Math.random() * 0.25 }); } }
    }
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      if (p.k === "s") { p.l -= dt * 0.8; p.r += dt * 4.5; p.v[2] *= 1 - dt * 0.4; }
      else { p.l -= dt; p.v[2] -= 170 * dt; }
      p.p = add(p.p, mul(p.v, dt));
      if (p.l <= 0 || (p.k === "k" && p.p[2] < g.PART_Z - 2)) { parts.splice(i, 1); continue; }
      var s = iso(p.p, P);
      if (p.k === "s") out += '<circle cx="' + s[0].toFixed(1) + '" cy="' + s[1].toFixed(1) + '" r="' + p.r.toFixed(1) + '" class="ws-smoke" style="opacity:' + (0.32 * p.l).toFixed(2) + '"/>';
      else { var t = iso(sub(p.p, mul(p.v, 0.025)), P); out += '<path class="ws-spark" d="M' + t[0].toFixed(1) + " " + t[1].toFixed(1) + "L" + s[0].toFixed(1) + " " + s[1].toFixed(1) + '" style="opacity:' + Math.min(1, p.l * 2.4).toFixed(2) + '"/>'; }
    }
    if (on) {
      var c = iso(spot, P), fl = fx === "plasma" ? 3 + Math.random() * 1.6 : 4.6;
      out = '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (fl * 2).toFixed(1) + '" class="ws-glow" style="opacity:' + (fx === "plasma" ? 0.32 : 0.18) + '"/>' +
        (fx === "plasma" ? '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + fl.toFixed(1) + '" class="ws-glow" style="opacity:.55"/>' : "") + out;
    }
    fxg.innerHTML = out;
  }
  function draw(k, u, ph, real, live, dt) {
    var o = pose(g, k, u);
    Array.prototype.forEach.call(doorG, function (n) { n.setAttribute("transform", tr([0, 0, g.TRAVEL * o.door])); });
    Array.prototype.forEach.call(zG, function (n) { n.setAttribute("transform", tr([0, 0, o.z])); });
    Array.prototype.forEach.call(pushG, function (n) { n.setAttribute("transform", tr([0, 0.5 * o.push, 0])); });
    var dialPart = !!g.D, lift = o.off[2], fade = o.show ? (!g.INPATH && !g.WAY && lift > 21 ? Math.max(0, (26 - lift) / 5) : 1) : 0;
    if (partG) { setCarry(o.carry); partG.setAttribute("transform", tr(o.off)); partG.style.opacity = fade.toFixed(3); }
    /* the fibre's leg: from the gland down to the collimator, wherever the head is */
    var top = g.COLL_TOP[2] + o.z;
    el.leg.innerHTML = solidSvg(cylinder(g.GLAND[0], g.GLAND[1], 1.8, top, g.GLAND[2] - top, P, 20), { tone: "hi" });
    if (el.cl) el.cl.innerHTML = clampArm(g.CLAMPS[0], o.clamp);
    if (el.cr) el.cr.innerHTML = clampArm(g.CLAMPS[1], o.clamp);
    /* a turntable's stations: fixture, pins and part on each, turned by the index angle */
    if (el.dial) {
      var list = [], n2 = g.N;
      for (var s = 0; s < n2; s++) {
        var a = -Math.PI / 2 + s * Math.PI * 2 / n2 + o.dialA, c = [g.D[0] + Math.cos(a) * g.R_ST, g.D[1] + Math.sin(a) * g.R_ST];
        list.push(rbox(g, c, a + Math.PI / 2, g.PARTSZ[0] + 8, g.PARTSZ[1] + 8, g.DT, g.DT + 3, "mid"));
        list.push(rbox(g, c, a + Math.PI / 2, g.PARTSZ[0], g.PARTSZ[1], g.DT + 3, g.DT + 6, "hi"));
      }
      if (n2 === 2) list.push(rbox(g, g.D, o.dialA, g.R_DISC * 2 - 8, 3, g.DT, g.DT + 16, "lo"));
      list.sort(function (p, q2) { return p.d - q2.d; });
      el.dial.innerHTML = list.map(function (p) { return p.svg; }).join("");
    }
    /* marks on the part, the beam and the spot */
    var W = placer(dialPart ? [0, 0, 0] : o.off, dialPart ? o.marksA : 0);
    var m = o.marks ? marksPath(o.prog, W, fx && o.beam ? Math.max(0, o.prog - 0.07) : null) : { d: "", hot: "", at: [0, 0] };
    el.marks.innerHTML = (m.d ? '<path class="iso-line" data-tone="mid" style="stroke-width:1" d="' + m.d + '"/>' : "") + (m.hot ? '<path class="iso-line" data-tone="lit" style="stroke-width:1.4" d="' + m.hot + '"/>' : "");
    el.marks.style.opacity = (fade * o.marksFade).toFixed(3);
    var mv = o.beam ? moveAt(o.prog) : null, beamOn = !!(mv && mv.on), spot = null;
    if (o.beam) {
      spot = W(mv.at);
      var lens = [g.C[0] + mv.at[0] * 3, g.C[1] + mv.at[1] * 3, g.LENS_BOT + o.z];
      el.beam.setAttribute("d", beamOn ? segment(lens, spot, P) : "");
      var s2 = iso(spot, P);
      el.spot.innerHTML = '<circle cx="' + s2[0].toFixed(2) + '" cy="' + s2[1].toFixed(2) + '" r="2.4" class="iso-wire-end" style="fill:var(--anatomy-lit);opacity:' + (beamOn ? .35 : .12) + '"/><circle cx="' + s2[0].toFixed(2) + '" cy="' + s2[1].toFixed(2) + '" r="' + (beamOn ? 1 : 0.6) + '" style="fill:var(--anatomy-lit)"/>';
    } else { el.beam.setAttribute("d", ""); el.spot.innerHTML = ""; }
    effects(dt || 0, spot || [0, 0, 0], beamOn);
    /* the robot arm */
    if (el.robot && g.WAY) el.robot.innerHTML = robotSvg(g, o.wrist, o.grip);
    /* the light tower: bottom lamp while the cycle runs, middle (amber) on a stoppage, top while the laser emits */
    var T = g.TWR, lamp = function (i) { return solidSvg(cylinder(T.x, T.y, 4.5, T.seg[i] + 0.4, 7.8, P, 24), { tone: "hi", lit: true }); };
    var fault = live && live.fault;
    tower.innerHTML = (live && !fault ? lamp(0) : "") + (fault && fx ? lamp(1) : "") + (beamOn ? lamp(2) : "");
    /* the camera's ring light while it locates or grades; the focus sensor's two spots */
    var ringOn = o.cam && opts.cam, afOn = o.af && opts.af;
    cam.innerHTML = (ringOn ? '<path class="iso-line" data-tone="lit" style="stroke-width:1.2" d="' + K.ring(g.CAMRING[0], g.CAMRING[1], 5.4, g.CAMRING[2] + o.z, P, 32) + '"/>' : "") +
      (afOn ? g.AFDOTS.map(function (p) { var s3 = iso([p[0], p[1], p[2] + o.z], P); return '<circle cx="' + s3[0].toFixed(2) + '" cy="' + s3[1].toFixed(2) + '" r=".9" style="fill:var(--anatomy-lit)"/>'; }).join("") : "");
    /* the operator screen: the phase, and how far through it */
    var name = fault ? "STOPPED" : (ph ? ph.n : "").toUpperCase(), key = name + "|" + Math.round(u * 40);
    if (key !== lastKey) {
      lastKey = key;
      var Wd = g.hmiW, Hd = g.hmiH, bar = Math.max(0, Math.min(1, u)) * (Wd - 8);
      el.hmi.innerHTML = '<g transform="' + g.hmiMatrix + '"><text x="4" y="' + (Hd * 0.44).toFixed(2) + '" class="ws-hmi">' + name.slice(0, 14) + '</text>' +
        '<rect x="4" y="' + (Hd * 0.62).toFixed(2) + '" width="' + (Wd - 8) + '" height="2" class="ws-hmi-track"/><rect x="4" y="' + (Hd * 0.62).toFixed(2) + '" width="' + bar.toFixed(2) + '" height="2" class="ws-hmi-bar"/></g>';
    }
    var text = ph ? (live ? ph.n + " · " + (u * ph.real).toFixed(2) + " of " + ph.real.toFixed(2) + " s · cycle " + real.toFixed(2) + " s"
                          : "Preview · " + ph.n + " · " + ph.real.toFixed(2) + " s of a " + real.toFixed(2) + " s cycle") : "";
    if (readout && readout.textContent !== text) readout.textContent = text;
    stage.setAttribute("aria-valuetext", text);
  }
  function step(dt) {
    var lv = phasesNow();
    if (lv) { var ph = lv.phases[lv.i]; draw(ph.k, lv.u, ph, lv.real, lv, lv.fault || lv.paused ? 0 : dt); return; }
    var P0 = cfg.phases; if (!P0 || !P0.length) return;
    if (still.matches) { var pi = 0; for (var j = 0; j < P0.length; j++) if (P0[j].k === "PROCESS") pi = j; draw("PROCESS", 1, P0[pi], cfg.real, null, 0); return; }
    /* a shared clock keeps this figure and the 3D view on the same moment */
    if (st.paused > 0) st.paused -= dt; else if (cfg.clock) st.t = cfg.clock(); else st.t += dt;
    var tot = 0, i; for (i = 0; i < P0.length; i++) tot += P0[i].d;
    st.t = ((st.t % tot) + tot) % tot;
    var acc = 0; for (i = 0; i < P0.length; i++) { if (st.t < acc + P0[i].d) break; acc += P0[i].d; }
    i = Math.min(i, P0.length - 1); st.i = i;
    draw(P0[i].k, (st.t - acc) / P0[i].d, P0[i], cfg.real, null, st.paused > 0 ? 0 : dt);
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
  /* keyboard: step through the phases of the preview; Z for the close-up */
  stage.addEventListener("keydown", function (e) {
    if (e.key === "z" || e.key === "Z") { e.preventDefault(); setZoom(!zoom.on); return; }
    var P0 = cfg.phases; if (!P0 || phasesNow()) return;
    var acc = 0, i, starts = []; for (i = 0; i < P0.length; i++) { starts.push(acc); acc += P0[i].d; }
    if (e.key === "ArrowRight") st.i = (st.i + 1) % P0.length; else if (e.key === "ArrowLeft") st.i = (st.i - 1 + P0.length) % P0.length;
    else if (e.key === "Home") st.i = 0; else if (e.key === "End") st.i = P0.length - 1; else return;
    e.preventDefault(); st.t = starts[st.i] + P0[st.i].d * (P0[st.i].k === "PROCESS" ? 0.6 : 0.5); st.paused = 6;
    step(0); run();
  });
  var io = new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" });
  io.observe(stage);
  step(0);
  mountWS.stop = function () { stopped = true; if (frame) cancelAnimationFrame(frame); frame = 0; io.disconnect(); };
  mountWS.wake = function () { run(); };
  return { state: st, step: step, stop: mountWS.stop, variant: g.VAR };
}
WS.mount = mountWS; WS.pose = pose;
WS.geo = function () { return WS.figs.hand && WS.figs.hand.geo; };
`;

const KEYS = {
  hand: { title: "The workstation", raised: "The scan head on its Z carriage, the part and the clamps" },
  belt: { title: "Workstation on a conveyor", raised: "The scan head on its Z carriage, the part on the belt" },
  mag: { title: "Workstation, magazine-fed", raised: "The scan head, the part, the magazine's carriers" },
  tray: { title: "Workstation, tray-fed", raised: "The scan head, the part, the tray tower's drawer" },
  chute: { title: "Workstation, bowl-fed", raised: "The scan head, the part, the bowl feeder" },
  dial2: { title: "Workstation, two-station turntable", raised: "The scan head and the turntable's stations" },
  dial4: { title: "Workstation, rotary indexer", raised: "The scan head and the indexer's four stations" },
  arm: { title: "Workstation with robot loading", raised: "The scan head, the part, the robot arm" },
};
function plateOf(v, figure) {
  return `<div class="iso tealfig tealws">${k.plateHtml({
    fig: "Fig 2",
    title: KEYS[v].title,
    hint: "Start simulation to drive it · ← → · Z",
    readout: " ",
    keys: [
      { mark: "lit", label: "The beam and the spot, while the laser emits" },
      { mark: "raised", label: KEYS[v].raised },
    ],
    caption: " ",
    body: `<div class="iso-stage" tabindex="0" role="group" aria-roledescription="figure" aria-label="The workstation through one run cycle. Left and right arrows step through the phases; Z toggles a close-up of the work zone; the Start simulation button runs it live.">${figure}</div>`,
  })}</div>`;
}

const head = (name) => `/* Generated by tools/anatomy/workstation.mjs — do not edit. Anatomy kit (MIT): tools/anatomy/kit/LICENSE. ${name} Needs anatomy.js first. */\n`;
const out = {};
let failed = 0;
for (const v of VARIANTS) {
  const t0 = Date.now();
  const M = await import(`./ws-figure.mjs?v=${v}`);
  const reg = `window.TEALAnatomy.ws.add(${JSON.stringify(v)}, ${JSON.stringify(plateOf(v, M.figure))}, ${JSON.stringify(M.GEO)});\n`;
  if (v === "hand") out["anatomy-ws.js"] = head("Live code and the hand variant.") + `(function(){"use strict";\nif(!window.TEALAnatomy||!window.TEALAnatomy.kit) return;\n${LIVE}\n${reg}})();\n`;
  else out[`anatomy-ws-${v}.js`] = head(`The ${v} variant.`) + `(function(){"use strict";\nif(!window.TEALAnatomy||!window.TEALAnatomy.ws||!window.TEALAnatomy.ws.add) return;\n${reg}})();\n`;
  console.log(`${v.padEnd(6)} items ${M.R.items.length}, solids ${M.R.solids.length}, routes ${M.R.routes.length}, ${Math.round(Date.now() - t0)} ms`);
  if (AUDIT) {
    const before = process.exitCode;
    process.exitCode = 0;
    A.auditOrExit(M.R, M.P, {});
    if (process.exitCode) { failed++; console.log(`  ^ ${v}: audit failed`); }
    process.exitCode = before;
  }
}
if (CHECK) {
  const stale = Object.entries(out).filter(([f, js]) => { try { return readFileSync(join(ROOT, f), "utf8") !== js; } catch { return true; } }).map(([f]) => f);
  if (stale.length) { console.error("out of date: " + stale.join(", ") + " — run npm run anatomy"); process.exit(1); }
  console.log("anatomy-ws files current (" + Object.keys(out).length + ")");
} else {
  for (const [f, js] of Object.entries(out)) writeFileSync(join(ROOT, f), js);
  console.log("wrote " + Object.entries(out).map(([f, js]) => `${f} ${Math.round(js.length / 1024)} KB`).join(", "));
}
const pv = process.argv.indexOf("--preview");
if (pv > 0) {
  const dir = process.argv[pv + 1]; mkdirSync(dir, { recursive: true });
  const base = readFileSync(join(ROOT, "anatomy.js"), "utf8"), css = readFileSync(join(ROOT, "anatomy.css"), "utf8");
  const PH = [["HOME", "Home", 0.35], ["LOAD", "Load", 1.6], ["CLAMP", "Clamp", 0.35], ["LOCATE", "Locate", 0.55], ["FOCUS", "Auto-focus", 0.35], ["PROCESS", "Mark", 3.2], ["VERIFY", "Grade", 0.6], ["UNLOAD", "Unload", 1.4]]
    .map(([k2, n, d]) => ({ k: k2, n, d, real: d }));
  const extra = `.ws-hmi{font:600 5px ui-monospace,monospace;fill:var(--anatomy-hi)}.ws-hmi-track{fill:var(--anatomy-faint)}.ws-hmi-bar{fill:var(--anatomy-hi)}.iso-svg{overflow:hidden}.iso-stage{position:relative}.ws-zoom{position:absolute;top:6px;right:6px;font:600 11px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;padding:6px 10px;border-radius:6px;border:1px solid var(--anatomy-faint);background:var(--anatomy-card);color:var(--anatomy-text);cursor:pointer}.ws-spark{stroke:var(--anatomy-lit);stroke-width:.7;fill:none;stroke-linecap:round}.ws-smoke{fill:var(--anatomy-muted)}.ws-glow{fill:var(--anatomy-lit)}`;
  for (const v of VARIANTS) for (const theme of ["dark", "light"]) {
    const all = out["anatomy-ws.js"] + (v === "hand" ? "" : out[`anatomy-ws-${v}.js`]);
    const page = k.pageHtml({ title: "Workstation " + v, theme, body: `<div id="host"></div>`, width: 820,
      script: base + all + `\ndocument.documentElement.setAttribute("data-theme", "${theme}");\nvar segs=[];for(var i=0;i<10;i++){var y=-0.3+i*0.066;segs.push(i%2?[[0.3,y],[-0.3,y]]:[[-0.3,y],[0.3,y]]);}\nwindow.FIG = TEALAnatomy.ws.mount(document.getElementById("host"), { variant: "${v}", effects: true, fx: "spark", opts: { fume: 1, cam: 1, af: 1 }, segs: segs, phases: ${JSON.stringify(PH)}, real: 8.4, caption: "Preview page." });` });
    writeFileSync(join(dir, `ws-${v}${theme === "light" ? "-light" : ""}.html`), page.replace("<head>", `<head><style>${css}${extra}</style>`));
  }
  console.log("previews in " + dir);
}
if (AUDIT) { console.log(failed ? `audit failed in ${failed} variant(s)` : "audit passed in every variant"); if (failed) process.exitCode = 1; }
