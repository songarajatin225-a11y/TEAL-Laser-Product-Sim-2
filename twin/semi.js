{/* TEAL laser marking system — CAD-style 3D simulator.
   World: 1 model unit = 10 mm (root is scaled x10, so the scene and every readout are in mm).
   x = material flow (left to right), y = front(+)/back(-), z = up. All dimensions are concept layout, TBD. */
(() => {
"use strict";
const T3 = THREE;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (u) => u * u * (3 - 2 * u);

// ---------------- model constants (shared with the isometric figure) ----------------
const TOP_Z = 82, NEST_TOP = 92.8, LATCH_Z = 96, LIFT_IN = LATCH_Z - NEST_TOP;
const TRAY = { w: 13.59, d: 32.26, h: 0.762 };
const PKG = 2.3, PITCH = 3.0;
const PKGS = [];
for (let r = 0; r < 10; r++) for (let c = 0; c < 4; c++) PKGS.push([(c - 1.5) * PITCH, (r - 4.5) * PITCH]);
const UNITS = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) UNITS.push([(c - 3.5) * 2.2 + 0.6, (r - 0.5) * 2.6]);
const IN_N = 6, OUT_N = 7;
const ST = { inX: -70, outX: 70, alignX: -36, markX: -4, visX: 22, pickX: 49.3 };
const STB = { inX: -54, outX: 54, alignX: -36, markX: -4, visX: 22 };
const STRIP = { w: 20, d: 6.6, h: 0.25, z: 100.0 };
const SLOTS = 8, SLOT_P = 1.2;
const padOf = (i) => STRIP.z - 1.2 - i * SLOT_P;
const GZ = STRIP.z - 92.85;
const HEADZ = { A: 0, B: 6.6 };
const CHAIN = { xf: -60, y0: -15, y1: -11, zl: 84, R: 3.5, t: 0.8, Lp: 130, pitch: 1.7 };
const PICK_REST_CUP = 107.5;
const LENS_Z = 112;

// ---------------- renderer, scene, camera ----------------
const view = $("#view");
const renderer = new T3.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T3.PCFSoftShadowMap;
renderer.outputEncoding = T3.sRGBEncoding;
renderer.toneMapping = T3.NoToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
view.appendChild(renderer.domElement);

const scene = new T3.Scene();
const pmrem = new T3.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new T3.RoomEnvironment(), 0.04).texture;
const bgColor = { light: 0xeef1f3, dark: 0x15191c };
function gradientTex(top, bottom) {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(1, bottom);
  x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding; return t;
}
const BG = { light: gradientTex("#fbfcfd", "#cfd8de"), dark: gradientTex("#222a2f", "#0b0e10") };
scene.background = BG.light;

let camera = new T3.PerspectiveCamera(32, 1, 10, 40000);
camera.up.set(0, 0, 1);
camera.position.set(-2700, -4700, 3000);
const controls = new T3.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 50, 950);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.screenSpacePanning = true;
controls.maxDistance = 12000;
controls.minDistance = 150;

scene.add(new T3.HemisphereLight(0xffffff, 0xb8c0c6, 0.55));
const sun = new T3.DirectionalLight(0xffffff, 1.25);
sun.position.set(-1600, -2600, 4200);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1600, right: 1600, top: 1600, bottom: -1600, near: 100, far: 9000 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 1.5;
scene.add(sun);
const fill = new T3.DirectionalLight(0xffffff, 0.35);
fill.position.set(2500, 1500, 1800);
scene.add(fill);

// floor + CAD grid (100 mm minor, 1 m major)
const floor = new T3.Mesh(new T3.PlaneGeometry(9000, 9000), new T3.ShadowMaterial({ opacity: 0.16 }));
floor.receiveShadow = true;
scene.add(floor);
const grid = new T3.GridHelper(6000, 60, 0x9aa4ab, 0xd3d9dd);
grid.rotation.x = Math.PI / 2;
grid.position.z = 0.5;
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(grid);
const axesHelper = new T3.AxesHelper(250);
axesHelper.position.set(-1150, -750, 1);
scene.add(axesHelper);

const root = new T3.Group();
root.scale.set(10, -10, 10); // model +y (front) maps to world -y so the material flow reads left to right on screen
scene.add(root);

// ---------------- materials ----------------
const std = (color, roughness = 0.55, metalness = 0.0, extra = {}) => new T3.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const MAT = {
  powder: std(0xf3f4f5, 0.62, 0.0),
  panel: std(0xe6e9eb, 0.6, 0.0),
  wall: std(0xdfe3e6, 0.7, 0.0),
  alu: std(0xc9ced3, 0.32, 0.75),
  aluDark: std(0x8e969d, 0.38, 0.7),
  steel: std(0xb4bac0, 0.25, 0.9),
  black: std(0x24272b, 0.55, 0.2),
  rubber: std(0x2a2d31, 0.85, 0.0),
  tray: std(0x2c2f34, 0.75, 0.0),
  emc: std(0x18191c, 0.45, 0.0),
  sub: std(0x2b5652, 0.55, 0.0),
  gold: std(0xc9a646, 0.3, 0.9),
  teal: std(0x0e8a86, 0.4, 0.15),
  tealGlow: std(0x0e8a86, 0.4, 0.0, { emissive: 0x000000 }),
  yellow: std(0xf2c200, 0.5, 0.0),
  red: std(0xd6332a, 0.45, 0.0),
  glass: new T3.MeshPhysicalMaterial({ color: 0xcfe9e7, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: T3.DoubleSide }),
  lens: new T3.MeshPhysicalMaterial({ color: 0x9bb7c9, roughness: 0.05, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.85 }),
  screen: new T3.MeshBasicMaterial({ color: 0x0f1d1d }),
  fov: new T3.LineBasicMaterial({ color: 0x0e8a86, transparent: true, opacity: 0.9 }),
};
const lamp = (c) => std(c, 0.35, 0, { emissive: c, emissiveIntensity: 0, transparent: true, opacity: 0.92 });
MAT.lampG = lamp(0x36c46b); MAT.lampA = lamp(0xf5a623); MAT.lampR = lamp(0xe5484d);
const EDGE = new T3.LineBasicMaterial({ color: 0x2a2f34, transparent: true, opacity: 0.45 });
const edgeLines = [];

// ---------------- geometry helpers ----------------
const groups = {};
function G(name, parent = root) { const g = new T3.Group(); g.name = name; parent.add(g); return g; }
function addMesh(parent, geom, mat, { edges = true, shadow = true, name = "" } = {}) {
  const m = new T3.Mesh(geom, mat);
  if (!geom.boundingBox) geom.computeBoundingBox();
  const sz = geom.boundingBox.getSize(new T3.Vector3());
  m.castShadow = shadow && Math.max(sz.x, sz.y, sz.z) > 2.5; m.receiveShadow = true; m.name = name;
  if (edges) {
    const e = new T3.LineSegments(new T3.EdgesGeometry(geom, 32), EDGE);
    e.raycast = () => {};
    m.add(e); edgeLines.push(e);
  }
  parent.add(m);
  return m;
}
const geoCache = new Map();
function box(parent, a, b, mat = MAT.panel, o = {}) {
  const w = b[0] - a[0], d = b[1] - a[1], h = b[2] - a[2], mn = Math.min(w, d, h);
  const r = o.r ?? Math.min(0.32, mn * 0.16);
  const key = `${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}|${r.toFixed(3)}`;
  let g = geoCache.get(key);
  if (!g) { g = mn > 0.5 && r > 0.05 ? new T3.RoundedBoxGeometry(w, d, h, 1, r) : new T3.BoxGeometry(w, d, h); geoCache.set(key, g); }
  const m = addMesh(parent, g, mat, o);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return m;
}
const Y = new T3.Vector3(0, 1, 0);
function orient(m, p0, dir) {
  m.quaternion.setFromUnitVectors(Y, new T3.Vector3(...dir).normalize());
  m.position.set(...p0);
}
function cyl(parent, p0, dir, len, r, mat, o = {}) {
  const g = new T3.CylinderGeometry(r, r, len, o.seg || 36);
  g.translate(0, len / 2, 0);
  const m = addMesh(parent, g, mat, o);
  orient(m, p0, dir);
  return m;
}
const cylZ = (parent, x, y, z0, z1, r, mat, o) => cyl(parent, [x, y, z0], [0, 0, 1], z1 - z0, r, mat, o);
function lathe(parent, p0, dir, profile, mat, o = {}) {
  const pts = profile.map(([s, r]) => new T3.Vector2(r, s));
  const g = new T3.LatheGeometry(pts, o.seg || 48);
  const m = addMesh(parent, g, mat, o);
  orient(m, p0, dir);
  return m;
}
function ring(parent, p0, dir, r0, r1, h, mat, o = {}) {
  const shape = new T3.Shape();
  shape.absarc(0, 0, r1, 0, Math.PI * 2, false);
  const hole = new T3.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); shape.holes.push(hole);
  const g = new T3.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: o.seg || 40 });
  const m = addMesh(parent, g, mat, o);
  m.quaternion.setFromUnitVectors(new T3.Vector3(0, 0, 1), new T3.Vector3(...dir).normalize());
  m.position.set(...p0);
  return m;
}
function sector(parent, cx, cy, z, r0, r1, a0, a1, h, mat) {
  const s = new T3.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  const g = new T3.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 16 });
  const m = addMesh(parent, g, mat, { edges: true });
  m.position.set(cx, cy, z);
  return m;
}
function tube(parent, pts, r, mat, o = {}) {
  const curve = new T3.CatmullRomCurve3(pts.map((p) => new T3.Vector3(...p)), false, "centripetal", 0.2);
  const g = new T3.TubeGeometry(curve, o.seg || 64, r, 14, false);
  return addMesh(parent, g, mat, { edges: false, ...o });
}
function filletPts(points, rad = 3, n = 6) {
  // round each interior corner of a polyline with a circular-ish arc so tubes bend like cable
  const V = (p) => new T3.Vector3(...p);
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = V(points[i - 1]), b = V(points[i]), c = V(points[i + 1]);
    const d1 = a.clone().sub(b), d2 = c.clone().sub(b);
    const r = Math.min(rad, d1.length() / 2, d2.length() / 2);
    const p1 = b.clone().add(d1.normalize().multiplyScalar(r)), p2 = b.clone().add(d2.normalize().multiplyScalar(r));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const q = p1.clone().multiplyScalar((1 - t) ** 2).add(b.clone().multiplyScalar(2 * t * (1 - t))).add(p2.clone().multiplyScalar(t * t));
      out.push([q.x, q.y, q.z]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
function cable(parent, points, r, mat, rad = 3) {
  const pts = filletPts(points, rad).map((p) => new T3.Vector3(...p));
  const path = new T3.CurvePath();
  for (let i = 0; i < pts.length - 1; i++) path.add(new T3.LineCurve3(pts[i], pts[i + 1]));
  const g = new T3.TubeGeometry(path, Math.max(32, pts.length * 4), r, 12, false);
  return addMesh(parent, g, mat, { edges: false });
}
// ring of bolt heads on a face
function bolts(parent, pts, normal, r = 0.35, mat = MAT.steel) {
  pts.forEach((p) => cyl(parent, p, normal, 0.25, r, mat, { edges: false, shadow: false, seg: 12 }));
}

// texture: laser mark (2D code + text rules), drawn once on a canvas
function markTexture(color = "#dfeceb") {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d");
  x.clearRect(0, 0, 128, 128);
  x.fillStyle = color;
  // data matrix: L finder + clock + pseudo data
  const n = 10, s = 4.2, ox = 10, oy = 14;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const finder = i === 0 || j === n - 1;
    const clock = (j === 0 && i % 2 === 0) || (i === n - 1 && j % 2 === 1);
    const data = ((i * 7 + j * 13 + i * j) % 5) < 2;
    if (finder || clock || (i > 0 && j < n - 1 && data)) x.fillRect(ox + i * s, oy + j * s, s, s);
  }
  x.fillRect(64, 18, 52, 6); x.fillRect(64, 32, 40, 6); x.fillRect(64, 46, 46, 6);
  x.fillRect(12, 72, 104, 7); x.fillRect(12, 88, 80, 7); x.fillRect(12, 104, 92, 7);
  const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding; t.anisotropy = 8;
  return t;
}
const MARK_TEX = { fiber: markTexture("#b9c2c6"), uv: markTexture("#eef7f6"), green: markTexture("#d4ecdb") };
const MARK_MAT = new T3.MeshBasicMaterial({ map: MARK_TEX.fiber, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const XMARK_MAT = new T3.MeshBasicMaterial({ color: 0xe5484d, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });

// =====================================================================
//                              MODEL
// =====================================================================
// ---------- cabinet (common) ----------
const gCab = G("cabinet");
box(gCab, [-95, -55, 6], [95, 44, 78], MAT.powder);
for (const [x, y] of [[-89, -49], [89, -49], [-89, 38], [89, 38]]) {
  cylZ(gCab, x, y, 0, 1.4, 4, MAT.black);
  cylZ(gCab, x, y, 1.4, 6, 1, MAT.steel, { edges: false });
}
box(gCab, [-94, 44, 6], [94, 44.5, 10.8], MAT.black, { edges: false });
[[-92, -34], [-30, 28], [32, 92]].forEach(([x0, x1]) => {
  box(gCab, [x0, 44, 12], [x1, 44.8, 74], MAT.panel);
  box(gCab, [x1 - 5.8, 44.8, 38], [x1 - 4.2, 46.2, 52], MAT.aluDark);
  cyl(gCab, [x1 - 5, 44.8, 34], [0, 1, 0], 0.6, 1, MAT.black, { seg: 20 });
  for (let j = 0; j < 8; j++) box(gCab, [x0 + 6 + j * 3, 44.8, 16], [x0 + 7.4 + j * 3, 45, 24], MAT.black, { edges: false, shadow: false });
  box(gCab, [x0 + 6, 44.8, 61], [x0 + 20, 45, 66], MAT.aluDark, { edges: false, shadow: false });
  bolts(gCab, [[x0 + 2, 44.8, 72], [x1 - 2, 44.8, 72], [x0 + 2, 44.8, 14], [x1 - 2, 44.8, 14]], [0, 1, 0]);
});
// main isolator on the electrical-bay door (red rotary handle on yellow plate)
box(gCab, [36, 44.8, 54], [46, 45.3, 66], MAT.yellow);
cyl(gCab, [41, 45.3, 60], [0, 1, 0], 1.4, 2.6, MAT.red);
box(gCab, [40.3, 46.7, 56.5], [41.7, 48, 63.5], MAT.red);
// tool nameplate
box(gCab, [-26, 44.8, 64], [-6, 45.1, 70], MAT.aluDark, { edges: true });
// table plate
box(gCab, [-97, -57, 78], [97, 45, 82], MAT.alu);
// e-stop
box(gCab, [81, 44.8, 71], [87, 45.6, 77], MAT.yellow);
lathe(gCab, [84, 45.6, 74], [0, 1, 0], [[0, 0], [0, 1.2], [1.2, 1.2], [1.2, 2.4], [2, 2.4], [2.4, 1.6], [2.5, 0]], MAT.red);

// ---------- enclosure (common) ----------
const gEnc = G("enclosure");
const post = (a, b) => box(gEnc, a, b, MAT.alu);
post([-96, -57, TOP_Z], [-93, -54, 161]); post([93, -57, TOP_Z], [96, -54, 161]);
post([-96, 41, TOP_Z], [-93, 44, 161]); post([93, 41, TOP_Z], [96, 44, 161]);
post([-96, -57, 161], [96, -54, 164]); post([-96, -54, 161], [-93, 44, 164]); post([93, -54, 161], [96, 44, 164]);
post([-93, 41, 82], [93, 44, 84.4]);
box(gEnc, [-93, -56, TOP_Z], [93, -54, 158], MAT.wall);
for (const [x0, x1] of [[-96, -94], [94, 96]]) {
  box(gEnc, [x0, -54, TOP_Z], [x1, -6, 158], MAT.wall); box(gEnc, [x0, 6, TOP_Z], [x1, 41, 158], MAT.wall);
  box(gEnc, [x0, -6, TOP_Z], [x1, 6, 97], MAT.wall); box(gEnc, [x0, -6, 104], [x1, 6, 158], MAT.wall);
}
box(gEnc, [-93, -54, 161], [93, -30, 162.2], MAT.wall);
// fan filter unit
box(gEnc, [-40, -52, 162.2], [30, -33, 169], MAT.powder);
for (let i = 0; i < 12; i++) box(gEnc, [-36 + i * 5.2, -49.5, 169], [-33.6 + i * 5.2, -35.5, 169.2], MAT.aluDark, { edges: false, shadow: false });
// stack light
cylZ(gEnc, 86, -46, 162.2, 163.6, 2.6, MAT.aluDark);
cylZ(gEnc, 86, -46, 163.6, 170, 0.8, MAT.alu);
const lampG = cylZ(gEnc, 86, -46, 170, 173, 2.1, MAT.lampG);
const lampA = cylZ(gEnc, 86, -46, 173, 176, 2.1, MAT.lampA);
cylZ(gEnc, 86, -46, 176, 179, 2.1, MAT.lampR);
cylZ(gEnc, 86, -46, 179, 180.4, 2.2, MAT.black);
// laser warning hazard strip and labels
box(gEnc, [-37, 44, 84.4], [37, 44.4, 86.2], MAT.yellow, { edges: false });
box(gEnc, [93.3, 44, 140], [95.7, 45.4, 145], MAT.yellow);
// glass (front doors + cutaway right end shown as glass too)
const gGlass = G("glass");
[[-93, -37], [-37, 37], [37, 93]].forEach(([x0, x1]) => {
  const m = new T3.Mesh(new T3.PlaneGeometry(x1 - x0, 158 - 84.4), MAT.glass);
  m.rotation.x = Math.PI / 2; m.position.set((x0 + x1) / 2, 43, (84.4 + 158) / 2); m.renderOrder = 10;
  gGlass.add(m);
  const e = new T3.LineSegments(new T3.EdgesGeometry(m.geometry), EDGE); m.add(e); edgeLines.push(e);
});
[[-93, -37], [-37, 37], [37, 93]].forEach(([x0, x1], i) => {
  for (const [a, b] of [[[x0, 43, 84.4], [x1, 44, 85.6]], [[x0, 43, 156.8], [x1, 44, 158]], [[x0, 43, 84.4], [x0 + 1.2, 44, 158]], [[x1 - 1.2, 43, 84.4], [x1, 44, 158]]]) box(gGlass, a, b, MAT.aluDark);
  const hx = i === 0 ? x1 - 3 : x0 + 3;
  box(gGlass, [hx - 0.7, 44, 112], [hx + 0.7, 45.6, 132], MAT.alu);
  for (const z of [92, 150]) cyl(gGlass, [i === 0 ? x0 + 0.6 : x1 - 0.6, 44, z], [0, 0, 1], 4, 0.6, MAT.steel, { seg: 14 });
  box(gGlass, [i === 0 ? x1 - 2.6 : x0 + 0.4, 44, 150], [i === 0 ? x1 - 0.4 : x0 + 2.6, 45.4, 154], MAT.yellow);
});
// external fume extractor unit (floor-standing, behind the machine)
const gFume = G("fumeExt", root);
box(gFume, [-44, -98, 4], [-8, -70, 74], MAT.powder);
for (const [x, y] of [[-40, -94], [-12, -94], [-40, -74], [-12, -74]]) { cyl(gFume, [x, y, 2], [0, 1, 0], 1.2, 2, MAT.black, { seg: 18 }); }
for (let j = 0; j < 8; j++) box(gFume, [-40 + j * 4, -70, 10], [-38.4 + j * 4, -69.8, 30], MAT.black, { edges: false, shadow: false });
box(gFume, [-38, -70, 56], [-26, -69.8, 66], MAT.black, { edges: false });
cyl(gFume, [-26, -84, 74], [0, 0, 1], 3, 3.4, MAT.aluDark);
cable(gFume, [[-26, -56.2, 98.6], [-26, -66, 98.6], [-26, -84, 92], [-26, -84, 77]], 1.8, MAT.rubber, 6);
// back wall utilities
const gUtil = G("utilities");
box(gUtil, [30, -54, 150], [92, -50, 153], MAT.aluDark);
box(gUtil, [58, -54, 112], [85, -51, 124], MAT.aluDark);
for (let i = 0; i < 6; i++) { box(gUtil, [60 + i * 3.2, -51, 113.5], [62.6 + i * 3.2, -48.4, 122.5], MAT.black); cyl(gUtil, [61.3 + i * 3.2, -48.4, 121], [0, 1, 0], 0.8, 0.5, MAT.teal, { seg: 12, edges: false }); }
cyl(gUtil, [81.4, -51, 118], [0, 1, 0], 1, 2, MAT.powder);
box(gUtil, [-88, -54, 103], [-86, -51, 108], MAT.aluDark); box(gUtil, [-50, -54, 103], [-48, -51, 108], MAT.aluDark);
box(gUtil, [-90, -51, 104], [-46, -49, 106.6], MAT.powder);
for (let i = 0; i < 14; i++) cyl(gUtil, [-87.5 + i * 3, -49, 105.3], [0, 1, 0], 0.5, 0.3, MAT.steel, { seg: 10, edges: false });
// fume extraction
cylZ(gUtil, -17, -19, TOP_Z, 96.6, 0.8, MAT.alu);
box(gUtil, [-20, -20, 96.6], [-14, -10, 100.6], MAT.aluDark);
cable(gUtil, [[-17, -20, 98.6], [-17, -23, 98.6], [-26, -29, 98.6], [-26, -52.6, 98.6]], 1.8, MAT.rubber, 4);
cyl(gUtil, [-26, -54, 98.6], [0, 1, 0], 1.4, 3.2, MAT.aluDark);
// laser source on its shelf
const gLaser = G("laser");
box(gLaser, [-88, -54, 121], [-50, -40, 123], MAT.aluDark);
for (const x of [-86, -54]) box(gLaser, [x, -54, 112], [x + 1.4, -46, 121], MAT.aluDark);
box(gLaser, [-86, -54, 123], [-52, -41, 143], MAT.powder);
for (let i = 0; i < 6; i++) box(gLaser, [-74 + i * 2.2, -41, 127], [-73 + i * 2.2, -40.8, 139], MAT.black, { edges: false, shadow: false });
for (const x of [-85, -53.6]) box(gLaser, [x - 0.6, -41, 128], [x + 0.6, -39.4, 138], MAT.alu);
cyl(gLaser, [-80, -41, 135], [0, 1, 0], 1.2, 1.2, MAT.steel);
const emitLed = cyl(gLaser, [-62, -41, 135], [0, 1, 0], 0.4, 0.7, std(0xf2c200, 0.4, 0, { emissive: 0xf2c200, emissiveIntensity: 0 }), { edges: false });
box(gLaser, [-68.5, -41, 126.6], [-63.5, -40.9, 131.6], MAT.yellow, { edges: false });
cyl(gLaser, [-52, -46, 136.4], [1, 0, 0], 1.2, 1.3, MAT.steel);

// columns
function column(parent, x0, x1, z1, motor) {
  box(parent, [x0 - 2, -54, TOP_Z], [x1 + 2, -41, TOP_Z + 1.4], MAT.aluDark);
  box(parent, [x0, -54, TOP_Z + 1.4], [x1, -44, z1], MAT.powder);
  if (motor) { const cx = (x0 + x1) / 2; cylZ(parent, cx, -49, z1, z1 + 9, 3.6, MAT.black); cylZ(parent, cx, -49, z1 + 9, z1 + 12, 3, MAT.aluDark); }
  else box(parent, [x0 - 0.4, -54, z1], [x1 + 0.4, -43.6, z1 + 1.2], MAT.aluDark);
}
column(gLaser, -12, 4, 146, true);
for (const x of [-11, 1]) box(gLaser, [x, -44, 100], [x + 2, -43, 145], MAT.steel);
const gHead = G("laser.head", gLaser); // Z axis (recipe focus offset)
box(gHead, [-11, -43, 124], [3, -41, 138], MAT.alu);
box(gHead, [-9, -41, 128], [1, -8, 134], MAT.powder);
for (const x of [-7, -1.8]) box(gHead, [x, -22, 134], [x + 0.8, -19, 136.4], MAT.aluDark);
lathe(gHead, [-4, -32, 136.4], [0, 1, 0], [[0, 0], [0, 1.4], [2, 1.4], [2, 2.2], [24, 2.2], [24, 0]], MAT.steel);
box(gHead, [-10, -8, 120], [2, 8, 138], MAT.powder);
cylZ(gHead, -1.6, 3, 138, 142.4, 1.8, MAT.black);
cyl(gHead, [2, -3, 127], [1, 0, 0], 4, 1.8, MAT.black);
box(gHead, [2, 2.5, 131], [4.4, 6.5, 135.5], MAT.aluDark);
box(gHead, [-7.5, 8, 132.5], [-3.5, 8.05, 136], MAT.yellow, { edges: false });
lathe(gHead, [-4, 0, 120], [0, 0, -1], [[0, 0], [0, 5.4], [1.4, 5.4], [1.4, 4.6], [6.2, 4.6], [6.2, 4.0], [8, 4.0], [8, 0]], MAT.black);
cylZ(gHead, -4, 0, 111.9, 112.05, 3.4, MAT.lens, { edges: false });
cable(gLaser, [[-4, -32, 136.4], [-4, -37, 136.4], [-44, -37, 136.4], [-44, -46, 136.4], [-50.8, -46, 136.4]], 0.7, std(0xf2c200, 0.5), 3);
const fibreLive = gLaser.children[gLaser.children.length - 1];

// pre-mark fiducial camera
const gAlign = G("align");
column(gAlign, -41, -31, 152, false);
const gAlignZ = G("align.z", gAlign);
{
  const X = ST.alignX;
  box(gAlignZ, [X - 2.5, -44, 144], [X + 2.5, 0, 147.4], MAT.powder);
  box(gAlignZ, [X - 2.6, -2.6, 132], [X + 2.6, 2.6, 144], MAT.black);
  lathe(gAlignZ, [X, 0, 132], [0, 0, -1], [[0, 0], [0, 2.2], [0.8, 2.2], [0.8, 1.9], [6, 1.9], [6, 0]], MAT.black);
  box(gAlignZ, [X - 2.4, -2.4, 121.4], [X + 2.4, 2.4, 126], MAT.aluDark);
  box(gAlignZ, [X + 2.4, -1.2, 122.4], [X + 4.4, 1.2, 125], MAT.aluDark);
  cable(gAlignZ, [[X + 2.6, 0.6, 140], [X + 4.4, 0.6, 140], [X + 4.4, -44, 140]], 0.45, MAT.rubber, 2);
}
const coaxMat = std(0xffffff, 0.3, 0, { emissive: 0x0e8a86, emissiveIntensity: 0 });
const coaxLens = cylZ(gAlignZ, ST.alignX, 0, 121.2, 121.4, 1.8, coaxMat, { edges: false });

// post-mark grader
const gGrader = G("grader");
column(gGrader, 17, 27, 152, false);
const gGraderZ = G("grader.z", gGrader);
box(gGraderZ, [19.5, -44, 140], [24.5, 0, 143.4], MAT.powder);
box(gGraderZ, [19, -3, 126], [25, 3, 140], MAT.powder);
lathe(gGraderZ, [22, 0, 126], [0, 0, -1], [[0, 0], [0, 2.8], [1, 2.8], [1, 2.4], [7, 2.4], [7, 2.6], [8, 2.6], [8, 0]], MAT.black);
cable(gGraderZ, [[25, 0.8, 134], [26.4, 0.8, 134], [26.4, -44, 134]], 0.5, MAT.rubber, 2);
const quadMats = [0, 1, 2, 3].map(() => std(0xf6f7f7, 0.35, 0, { emissive: 0x0e8a86, emissiveIntensity: 0 }));
quadMats.forEach((m, q) => sector(gGraderZ, 22, 0, 115.6, 2.6, 6.6, q * Math.PI / 2 + 0.04, (q + 1) * Math.PI / 2 - 0.04, 2.4, m));

// ---------- axis, shuttle, drag chain (common) ----------
const gAxis = G("axis");
box(gAxis, [-84, -9, TOP_Z], [84, 9, 85], MAT.alu);
for (const y of [-7, 5]) box(gAxis, [-83, y, 85], [83, y + 2, 86.5], MAT.steel);
box(gAxis, [-82, -3, 85], [82, 3, 85.5], MAT.black);
box(gAxis, [-82, 9, 83.2], [82, 9.4, 84.4], MAT.gold, { edges: false });
box(gAxis, [-88, -9, TOP_Z], [-84, 9, 88], MAT.aluDark); box(gAxis, [84, -9, TOP_Z], [88, 9, 88], MAT.aluDark);
cyl(gAxis, [-84, 0, 86.5], [1, 0, 0], 1.2, 1.4, MAT.rubber); cyl(gAxis, [84, 0, 86.5], [-1, 0, 0], 1.2, 1.4, MAT.rubber);
box(gAxis, [-64, -15.6, TOP_Z], [75.5, -10.4, 83.2], MAT.aluDark);
box(gAxis, [-64, -15.6, 83.2], [75.5, -15, 86], MAT.aluDark);
box(gAxis, [CHAIN.xf - 3, -15, 83.2], [CHAIN.xf, -11, 85.4], MAT.alu);

const gShuttle = G("shuttle");
const gCar = G("carriage", gShuttle); // x
box(gCar, [-10, -10, 86.5], [10, 10, 89], MAT.alu);
box(gCar, [-3, 10, 86.6], [3, 11.2, 88.4], MAT.black);
box(gCar, [-12.4, -12.4, 87], [-10, -7, 92.4], MAT.aluDark);
for (const x of [-7, 5]) box(gCar, [x, -10, 89], [x + 2, 10, 90], MAT.steel);
const gStage = G("stage", gCar); // y
box(gStage, [-9, -9, 90], [9, 9, 91.6], MAT.alu);
const liftStems = [];
const gNest = G("nest", gStage); // z lift
// drag chain links (instanced, posed every frame)
const chainLen = CHAIN.Lp + Math.PI * CHAIN.R;
const chainN = Math.floor(chainLen / CHAIN.pitch);
const chainMesh = new T3.InstancedMesh(new T3.BoxGeometry(CHAIN.pitch * 0.92, CHAIN.y1 - CHAIN.y0, CHAIN.t * 2), MAT.rubber, chainN);
chainMesh.castShadow = true; chainMesh.receiveShadow = true;
gAxis.add(chainMesh);

// ---------- Config A modules ----------
const gA = G("cfgA");
const gB = G("cfgB");
const nestA = G("nestA", gNest);
box(nestA, [-8.3, -17.2, 91.6], [8.3, 17.2, NEST_TOP], MAT.alu);
for (const [x, y] of [[-7.4, -12], [7.4, -12], [-7.4, 12], [7.4, 12]]) cylZ(nestA, x, y, NEST_TOP, NEST_TOP + 1, 0.45, MAT.steel, { seg: 16 });
for (const y of [-12, 12]) { const s = cylZ(gStage, 0, y, 91.6, 92.6, 0.9, MAT.steel, { seg: 20 }); s.visible = false; liftStems.push(s); }

// tray builder (chamfered JEDEC outline, pockets, packages)
function trayGeom() {
  const x0 = -TRAY.w / 2, x1 = TRAY.w / 2, y0 = -TRAY.d / 2, y1 = TRAY.d / 2, c = 1.1;
  const s = new T3.Shape();
  s.moveTo(x0 + c, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0 + c); s.closePath();
  PKGS.forEach(([px, py]) => { const h = new T3.Path(); h.moveTo(px - 1.35, py - 1.35); h.lineTo(px + 1.35, py - 1.35); h.lineTo(px + 1.35, py + 1.35); h.lineTo(px - 1.35, py + 1.35); h.closePath(); s.holes.push(h); });
  return new T3.ExtrudeGeometry(s, { depth: TRAY.h, bevelEnabled: false });
}
const TRAY_GEOM = trayGeom();
const TRAY_FLOOR = new T3.BoxGeometry(TRAY.w - 0.4, TRAY.d - 0.4, 0.15);
function makeTray(parent, z, { packages = false, marked = false } = {}) {
  const g = new T3.Group(); parent.add(g); g.position.z = z;
  addMesh(g, TRAY_GEOM, MAT.tray, { edges: true });
  const f = addMesh(g, TRAY_FLOOR, MAT.tray, { edges: false }); f.position.z = 0.18;
  let pk = null, mk = null;
  if (packages) {
    pk = new T3.InstancedMesh(new T3.BoxGeometry(PKG, PKG, 0.28), MAT.emc, PKGS.length);
    mk = new T3.InstancedMesh(new T3.PlaneGeometry(PKG * 0.82, PKG * 0.82), MARK_MAT, PKGS.length);
    pk.castShadow = true;
    const m4 = new T3.Matrix4();
    PKGS.forEach(([x, y], i) => { m4.makeTranslation(x, y, 0.33 + 0.14); pk.setMatrixAt(i, m4); m4.makeTranslation(x, y, 0.33 + 0.285); mk.setMatrixAt(i, m4); });
    g.add(pk); g.add(mk);
    mk.userData.on = PKGS.map(() => marked);
    pk.userData.on = PKGS.map(() => true);
    applyInst(mk); applyInst(pk);
  }
  return { g, pk, mk };
}
const _m4 = new T3.Matrix4(), _z = new T3.Matrix4().makeScale(0, 0, 0);
function applyInst(inst) {
  const z = inst === null ? 0 : 0;
  inst.userData.base = inst.userData.base || PKGS.map((_, i) => { const m = new T3.Matrix4(); inst.getMatrixAt(i, m); return m; });
  inst.userData.on.forEach((on, i) => inst.setMatrixAt(i, on ? inst.userData.base[i] : _z));
  inst.instanceMatrix.needsUpdate = true;
}
const payloadA = makeTray(nestA, NEST_TOP, { packages: true });
payloadA.g.position.z = NEST_TOP;
// fiducials on the tray
const fidMatA = [0, 1].map(() => std(0xd0d4d7, 0.3, 0.6, { emissive: 0x0e8a86, emissiveIntensity: 0 }));
[[-5.9, -15.3], [5.9, 15.3]].forEach(([x, y], i) => cylZ(payloadA.g, x, y, TRAY.h, TRAY.h + 0.06, 0.45, fidMatA[i], { edges: false }));
// inspection frames
const frameGeom = (() => { const s = new T3.Shape(); s.moveTo(-1.4, -1.4); s.lineTo(1.4, -1.4); s.lineTo(1.4, 1.4); s.lineTo(-1.4, 1.4); s.closePath(); const h = new T3.Path(); h.moveTo(-1.2, -1.2); h.lineTo(-1.2, 1.2); h.lineTo(1.2, 1.2); h.lineTo(1.2, -1.2); h.closePath(); s.holes.push(h); return new T3.ShapeGeometry(s); })();
const curFrame = new T3.Mesh(frameGeom, new T3.MeshBasicMaterial({ color: 0x0e8a86, transparent: true, depthWrite: false }));
const badFrame = new T3.Mesh(frameGeom, new T3.MeshBasicMaterial({ color: 0xe5484d, transparent: true, depthWrite: false }));
payloadA.g.add(curFrame); payloadA.g.add(badFrame);

// stackers
function stacker(cx, active) {
  const g = G(active ? "stacker.in" : "stacker.out", gA);
  const latches = { f: [], b: [] };
  for (const x of [cx - 7, cx + 5.5]) for (const s of [-1, 1]) {
    const y0 = s > 0 ? 17.6 : -19.1;
    box(g, [x, y0, TOP_Z], [x + 1.5, y0 + 1.5, 112], MAT.alu);
    const hy = s > 0 ? [16.6, 17.6] : [-17.6, -16.6];
    box(g, [x, hy[0], LATCH_Z - 0.8], [x + 1.5, hy[1], LATCH_Z + 2], MAT.aluDark);
    const ly = s > 0 ? [15.4, 16.6] : [-16.6, -15.4];
    const l = box(g, [x + 0.1, ly[0], LATCH_Z - 0.6], [x + 1.4, ly[1], LATCH_Z], active ? MAT.teal : MAT.steel);
    (s > 0 ? latches.f : latches.b).push(l);
    l.userData.y0 = l.position.y;
    if (active) cyl(g, [x + 0.75, s > 0 ? 19.1 : -19.1, LATCH_Z + 1.2], [0, s, 0], 3, 0.7, MAT.steel);
    else box(g, [x + 0.2, s > 0 ? 19.1 : -20, LATCH_Z + 0.4], [x + 1.3, s > 0 ? 20 : -19.1, LATCH_Z + 2], MAT.aluDark);
  }
  for (const s of [-1, 1]) box(g, [cx - 7, s > 0 ? 17.6 : -19.1, 112], [cx + 7, s > 0 ? 19.1 : -17.6, 113.4], MAT.alu);
  box(g, [cx - 7, -17.6, 112], [cx - 5.5, 17.6, 113.4], MAT.alu);
  box(g, [cx + 5.5, -17.6, 112], [cx + 7, 17.6, 113.4], MAT.alu);
  box(g, [cx - 1.5, 19.1, 106], [cx + 1.5, 20.3, 108], MAT.black);
  box(g, [cx - 0.5, 19.1, 108], [cx + 0.5, 19.6, 112], MAT.aluDark);
  const stack = new T3.Group(); g.add(stack); stack.position.set(cx, 0, 0);
  const trays = [];
  const n = active ? IN_N : OUT_N;
  for (let i = 0; i < n + 1; i++) trays.push(makeTray(stack, LATCH_Z + i * TRAY.h).g);
  const top = makeTray(stack, LATCH_Z, { packages: true, marked: !active });
  top.g.children[0].visible = false; top.g.children[1].visible = false; // only the packages ride on the top tray
  return { g, stack, trays, top, latches };
}
const SIN = stacker(ST.inX, true);
const SOUT = stacker(ST.outX, false);
// reject picker and bin
const gPick = G("picker", gA);
column(gPick, 42, 52, 140, false);
box(gPick, [43, -44, 128], [47, 18, 132], MAT.powder);
box(gPick, [47, -40, 129], [47.6, 16, 131], MAT.steel);
box(gPick, [43, 16, 126.6], [47.6, 18, 128], MAT.aluDark);
box(gPick, [43, -40.5, TOP_Z], [56, -24, 90], MAT.powder);
box(gPick, [44, -39.6, 90], [55, -24.9, 90.6], MAT.aluDark);
for (const [a, b] of [[[44, -39.6, 90.6], [55, -39, 92.6]], [[44, -39, 90.6], [44.6, -25.5, 92.6]], [[54.4, -39, 90.6], [55, -25.5, 92.6]], [[44, -25.5, 90.6], [55, -24.9, 92.6]]]) box(gPick, a, b, MAT.red);
const rejects = [];
for (let i = 0; i < 8; i++) { const m = box(gPick, [ST.pickX - 1.15, -36.5 + (i % 4) * 2.6 - 1.15, 90.6 + Math.floor(i / 4) * 0.28], [ST.pickX + 1.15, -36.5 + (i % 4) * 2.6 + 1.15, 90.88 + Math.floor(i / 4) * 0.28], MAT.emc, { edges: false }); m.visible = false; rejects.push(m); }
const gPickCar = G("picker.carriage", gPick);
box(gPickCar, [47.6, -3, 126.5], [51, 3, 133.5], MAT.alu);
cylZ(gPickCar, ST.pickX, 0, 118, 126.5, 1.5, MAT.steel);
const gRod = G("picker.rod", gPickCar);
cylZ(gRod, ST.pickX, 0, 108, 135, 0.55, MAT.steel, { seg: 18 });
cylZ(gRod, ST.pickX, 0, 107.5, 108, 1.0, MAT.rubber, { seg: 24 });
const held = box(gRod, [ST.pickX - 1.15, -1.15, 107.22], [ST.pickX + 1.15, 1.15, 107.5], MAT.emc, { edges: false });
held.visible = false;

// ---------- Config B: post-encapsulation molded-strip handling (bolt-on loader / unloader) ----------
// Molded leadframe strip (MAP-molded QFN style): copper leadframe with tooling holes on the side rails,
// four mold caps of EMC, 6 x 7 units per cap. Sizes are representative and TBD per customer strip drawing.
const LF = { w: 24, d: 7.0, t: 0.05, rail: 0.75 };
const CAP = { w: 5.2, d: 5.4, h: 0.08, gap: 0.5 };
const CAPX = [0, 1, 2, 3].map((i) => -((4 * CAP.w + 3 * CAP.gap) / 2) + CAP.w / 2 + i * (CAP.w + CAP.gap));
const SU = []; // strip units: [x, y, cap]
CAPX.forEach((cx, k) => { for (let c = 0; c < 6; c++) for (let r = 0; r < 7; r++) SU.push([cx + (c - 2.5) * 0.82, (r - 3) * 0.74, k]); });
const UPSTREAM_REJ = [9, 100]; // units flagged in the upstream strip map (die-attach / wire-bond inspection)
const BAD_SU = 57;             // unit that fails post-mark verification in this demo
const MAG = { len: 26, inner: 7.4, slots: 10, pitch: 1.0 };
const MZ0 = 99;                // platform top that puts slot 0 on the transfer plane (z 100)
const MZ_TOP = 130, MZ_BOT = 84;
const LOADX = -123, UNLOADX = 123; // magazine centres in the loader / unloader modules
const copper = std(0xc27b4f, 0.33, 0.85);
const MAGM = std(0x56626c, 0.45, 0.6), MAGS = std(0x3d464e, 0.5, 0.5);
const nestB = G("nestB", gNest);
box(nestB, [-7, -3.6, 91.6], [7, 3.6, STRIP.z - 1.2], MAT.alu);
box(nestB, [-12.5, -4.4, STRIP.z - 1.2], [12.5, 4.4, STRIP.z], MAT.alu);
for (const y of [-4.4, 3.7]) box(nestB, [-12.5, y, STRIP.z], [12.5, y + 0.7, STRIP.z + 0.6], MAT.steel);
for (const x of [-11.6, 11.6]) cylZ(nestB, x, -3.2, STRIP.z, STRIP.z + 0.5, 0.18, MAT.steel, { seg: 12, edges: false }); // tooling pins
function moldedStrip(parent, { marked = false, withMarks = true } = {}) {
  const g = new T3.Group(); parent.add(g);
  addMesh(g, new T3.BoxGeometry(LF.w, LF.d, LF.t), copper, { edges: true }).position.z = LF.t / 2;
  // tooling holes along both rails (dark discs)
  const holes = new T3.InstancedMesh(new T3.CylinderGeometry(0.16, 0.16, 0.02, 12).rotateX(Math.PI / 2), MAT.black, 24);
  const m4 = new T3.Matrix4(); let n = 0;
  for (let i = 0; i < 12; i++) for (const y of [-3.15, 3.15]) { m4.makeTranslation(-11.2 + i * 2.04, y, LF.t + 0.006); holes.setMatrixAt(n++, m4); }
  g.add(holes);
  CAPX.forEach((cx) => {
    const cap = addMesh(g, new T3.BoxGeometry(CAP.w, CAP.d, CAP.h), MAT.emc, { edges: true });
    cap.position.set(cx, 0, LF.t + CAP.h / 2);
    const gate = addMesh(g, new T3.BoxGeometry(0.5, 0.3, 0.04), MAT.emc, { edges: false }); gate.position.set(cx - CAP.w / 2 + 0.4, CAP.d / 2 + 0.15, LF.t + 0.02);
  });
  // upstream strip ID (2D code on the rail, pre-existing)
  const id = new T3.Mesh(new T3.PlaneGeometry(0.9, 0.9), new T3.MeshBasicMaterial({ map: markTexture("#2a1d12"), transparent: true, depthWrite: false })); id.position.set(-11.4, -2.4, LF.t + 0.003); g.add(id);
  let mk = null;
  if (withMarks) {
    mk = new T3.InstancedMesh(new T3.PlaneGeometry(0.6, 0.55), MARK_MAT, SU.length);
    SU.forEach(([x, y], i) => { m4.makeTranslation(x, y, LF.t + CAP.h + 0.004); mk.setMatrixAt(i, m4); });
    g.add(mk);
    mk.userData.on = SU.map((_, i) => marked && !UPSTREAM_REJ.includes(i)); applyInstN(mk, SU.length);
  }
  return { g, mk };
}
function applyInstN(inst, n) {
  inst.userData.base = inst.userData.base || Array.from({ length: n }, (_, i) => { const m = new T3.Matrix4(); inst.getMatrixAt(i, m); return m; });
  inst.userData.on.forEach((on, i) => inst.setMatrixAt(i, on ? inst.userData.base[i] : _z));
  inst.instanceMatrix.needsUpdate = true;
}
// strip on the nest (follows the stage)
const gPayloadB = G("payloadB", gStage);
const payloadB = moldedStrip(gPayloadB);
payloadB.g.position.z = STRIP.z;
const fidMatB = [0, 1].map(() => std(0xd8dcdf, 0.25, 0.8, { emissive: 0x0e8a86, emissiveIntensity: 0 }));
[[-11.4, 3.15], [11.4, -3.15]].forEach(([x, y], i) => { const m = cylZ(payloadB.g, x, y, LF.t, LF.t + 0.02, 0.3, fidMatB[i], { edges: false }); });
const xMat = new T3.MeshBasicMaterial({ color: 0xe5484d, transparent: true, depthWrite: false });
const xMarks = UPSTREAM_REJ.concat([BAD_SU]).map((i) => { const g = new T3.Group(); const a = new T3.Mesh(new T3.PlaneGeometry(0.7, 0.09), XMARK_MAT); const b = a.clone(); a.rotation.z = 0.8; b.rotation.z = -0.8; g.add(a, b); g.position.set(SU[i][0], SU[i][1], LF.t + CAP.h + 0.006); g.visible = false; payloadB.g.add(g); return { i, g }; });
const unitFrame = (() => { const s = new T3.Shape(); s.moveTo(-0.42, -0.39); s.lineTo(0.42, -0.39); s.lineTo(0.42, 0.39); s.lineTo(-0.42, 0.39); s.closePath(); const h = new T3.Path(); h.moveTo(-0.34, -0.31); h.lineTo(-0.34, 0.31); h.lineTo(0.34, 0.31); h.lineTo(0.34, -0.31); h.closePath(); s.holes.push(h); return new T3.ShapeGeometry(s); })();
const curFrameB = new T3.Mesh(unitFrame, curFrame.material); payloadB.g.add(curFrameB);
const badFrameB = new T3.Mesh(unitFrame, badFrame.material); payloadB.g.add(badFrameB);
// travelling strip (world space) used while a strip is between magazine, track and nest
const travel = moldedStrip(gB, { withMarks: true });
travel.g.visible = false;

// --- bolt-on module frame (cabinet, table, enclosure, light curtains) ---
function moduleFrame(x0, x1, side) {
  const m = G(side > 0 ? "unloader" : "loader", gB);
  box(m, [x0, -45, 6], [x1, 35, 78], MAT.powder);
  for (const [x, y] of [[x0 + 5, -40], [x1 - 5, -40], [x0 + 5, 30], [x1 - 5, 30]]) { cylZ(m, x, y, 0, 1.4, 3.4, MAT.black); cylZ(m, x, y, 1.4, 6, 0.9, MAT.steel, { edges: false }); }
  box(m, [x0 + 3, 35, 12], [x1 - 3, 35.8, 74], MAT.panel);
  box(m, [x1 - 9, 35.8, 38], [x1 - 7.4, 37.2, 52], MAT.aluDark);
  for (let j = 0; j < 6; j++) box(m, [x0 + 8 + j * 3, 35.8, 16], [x0 + 9.4 + j * 3, 36, 24], MAT.black, { edges: false, shadow: false });
  box(m, [x0 - 1, -46, 78], [x1 + 1, 36, 82], MAT.alu);
  const pst = (a, b) => box(m, a, b, MAT.alu);
  const xo = side > 0 ? x1 - 3 : x0, xi = side > 0 ? x0 : x1 - 3;
  pst([xo, -46, 82], [xo + 3, -43, 158]); pst([xo, 33, 82], [xo + 3, 36, 158]);
  pst([xi, -46, 82], [xi + 3, -43, 158]); pst([xi, 33, 82], [xi + 3, 36, 158]);
  pst([x0, -46, 158], [x1, -43, 161]); pst([x0, 33, 158], [x1, 36, 161]);
  pst([xo, -43, 158], [xo + 3, 33, 161]);
  box(m, [x0 + 3, -45, 82], [x1 - 3, -43, 158], MAT.wall);
  { // outer end: polycarbonate window in a frame so the magazine buffer stays visible
    const xw = side > 0 ? x1 - 1 : x0 + 1;
    const p = new T3.Mesh(new T3.PlaneGeometry(76, 72), MAT.glass); p.rotation.set(Math.PI / 2, Math.PI / 2, 0); p.position.set(xw, -5, 121); p.renderOrder = 10; m.add(p);
    box(m, [xw - 0.6, -43, 82], [xw + 0.6, 33, 85], MAT.aluDark); box(m, [xw - 0.6, -43, 155], [xw + 0.6, 33, 158], MAT.aluDark);
    box(m, [xw - 0.6, -43, 85], [xw + 0.6, -41.5, 155], MAT.aluDark); box(m, [xw - 0.6, 31.5, 85], [xw + 0.6, 33, 155], MAT.aluDark);
  }
  box(m, [x0, -43, 159], [x1, 33, 160.4], MAT.wall);
  box(m, [x0 + 3, 33.6, 144], [x1 - 3, 34.2, 158], MAT.panel);
  // safety light curtain at the operator opening
  for (const x of [x0 + 3.6, x1 - 5.4]) {
    box(m, [x, 34.4, 86], [x + 1.8, 36.4, 143], MAT.black);
    for (let k = 0; k < 18; k++) box(m, [x + 0.5, 36.4, 89 + k * 3], [x + 1.3, 36.5, 89.6 + k * 3], MAT.red, { edges: false, shadow: false });
  }
  box(m, [x0 + 3, 35.8, 64], [x0 + 11, 36, 68], MAT.aluDark, { edges: false });
  return m;
}
const gLoader = moduleFrame(-153, -99, -1);
const gUnloader = moduleFrame(99, 153, 1);
// FRL, gland plate and main air inlet on the loader's outer end
box(gLoader, [-153.6, -32, 40], [-153, -10, 66], MAT.panel);
for (const y of [-27, -19]) { box(gLoader, [-158.8, y - 2.6, 56], [-153.6, y + 2.6, 62], MAT.aluDark); lathe(gLoader, [-156.2, y, 56], [0, 0, -1], [[0, 0], [0, 2.2], [6, 2.2], [8, 1.6], [9, 0.6], [9, 0]], MAT.lens); }
cyl(gLoader, [-158.8, -19, 59], [-1, 0, 0], 0.8, 1.8, MAT.powder);
box(gLoader, [-153.5, 0, 14], [-153, 18, 22], MAT.aluDark);
for (const y of [3, 7, 11, 15]) cyl(gLoader, [-153.5, y, 18], [-1, 0, 0], 1.2, 1.1, MAT.black, { seg: 16 });

// --- magazine (strip magazine with slotted side plates, handle, open ends) ---
function magazineMesh(parent, fullCount) {
  const g = new T3.Group(); parent.add(g);
  const L = MAG.len / 2, w = MAG.inner / 2, H = 1 + MAG.slots * MAG.pitch + 0.6;
  box(g, [-L, -w - 0.9, 0], [L, w + 0.9, 0.8], MAGM);            // bottom plate
  box(g, [-L, -w - 0.9, H], [L, w + 0.9, H + 0.8], MAGM);        // top plate
  for (const s of [-1, 1]) {
    const y0 = s > 0 ? w : -w - 0.9;
    if (s < 0) box(g, [-L, y0, 0.8], [L, y0 + 0.9, H], MAGS);           // rear side plate (solid)
    else { // front side plate with windows so the strips can be seen and counted
      for (const x of [-L, -L / 3 - 1, L / 3 - 1, L - 2]) box(g, [x, y0, 0.8], [x + 2, y0 + 0.9, H], MAGS);
      box(g, [-L, y0, 0.8], [L, y0 + 0.9, 1.4], MAGS); box(g, [-L, y0, H - 0.6], [L, y0 + 0.9, H], MAGS);
    }
    for (let i = 0; i < MAG.slots; i++) box(g, [-L, s > 0 ? w - 0.35 : -w, 1 + i * MAG.pitch - 0.12], [L, s > 0 ? w : -w + 0.35, 1 + i * MAG.pitch], MAT.alu, { edges: false, shadow: false });
    for (const x of [-L + 2, L - 2]) for (const z of [2, H - 1.2]) cyl(g, [x, s > 0 ? w + 0.9 : -w - 0.9, z], [0, s, 0], 0.2, 0.35, MAT.steel, { edges: false, shadow: false, seg: 10 });
  }
  box(g, [-6, -0.7, H + 0.8], [6, 0.7, H + 2.2], MAT.black);       // handle
  for (const x of [-6, 5]) box(g, [x, -0.7, H + 0.8], [x + 1, 0.7, H + 2.2], MAT.aluDark);
  const strips = [];
  for (let i = 0; i < MAG.slots; i++) { const s = moldedStrip(g, { withMarks: true, marked: false }); s.g.position.z = 1 + i * MAG.pitch; s.g.visible = i < fullCount; strips.push(s); }
  return { g, strips };
}
function elevatorUnit(m, cx) {
  box(m, [cx - 8, -18, 82], [cx + 8, -9, 83.4], MAT.aluDark);
  box(m, [cx - 6, -17, 83.4], [cx + 6, -11, 150], MAT.powder);
  cylZ(m, cx, -14, 150, 156, 2.6, MAT.black);
  for (const x of [cx - 5, cx + 3]) box(m, [x, -11, 86], [x + 2, -10.2, 148], MAT.steel);
  const car = G("elev.car", m);
  box(car, [cx - 5.5, -10.2, -5], [cx + 5.5, -9.2, 1.2], MAT.alu);
  box(car, [cx - 13.5, -9.2, -0.8], [cx + 13.5, 5.6, 0], MAT.alu);
  for (const x of [cx - 12.6, cx + 11.4]) box(car, [x, 5.6, -0.8], [x + 1.2, 6.4, 1.6], MAT.teal); // clamp jaws
  return car;
}
const carIn = elevatorUnit(gLoader, LOADX), carOut = elevatorUnit(gUnloader, UNLOADX);
const magCur = magazineMesh(carIn, MAG.slots); magCur.g.position.set(LOADX, 0, 0);
const magOut = magazineMesh(carOut, 0); magOut.g.position.set(UNLOADX, 0, 0);
magOut.strips.forEach((s) => (s.mk.userData.on = SU.map((_, i) => !UPSTREAM_REJ.includes(i)), applyInstN(s.mk, SU.length)));
// magazine buffer conveyors: top = full magazines in, bottom = empties out (loader); mirrored on the unloader
function conveyor(m, cx, zTop) {
  for (const x of [cx - 12, cx + 9.6]) {
    box(m, [x, 6, zTop - 1.6], [x + 2.4, 34, zTop - 0.3], MAT.alu);
    box(m, [x + 0.3, 6, zTop - 0.3], [x + 2.1, 34, zTop], MAT.rubber, { edges: false });
    for (const y of [6.6, 33.4]) cyl(m, [x - 0.2, y, zTop - 0.9], [1, 0, 0], 2.8, 0.7, MAT.steel, { edges: false, seg: 16 });
    if (zTop > 90) for (const y of [8, 32]) box(m, [x + 0.6, y - 0.6, 82], [x + 1.8, y + 0.6, zTop - 1.6], MAT.aluDark);
  }
  box(m, [cx + 12, 8, zTop - 2.8], [cx + 15, 12, zTop - 0.6], MAT.black); // drive motor
}
conveyor(gLoader, LOADX, MZ_TOP); conveyor(gLoader, LOADX, MZ_BOT);
conveyor(gUnloader, UNLOADX, MZ_TOP); conveyor(gUnloader, UNLOADX, MZ_BOT);
const topQ = [magazineMesh(gLoader, MAG.slots), magazineMesh(gLoader, MAG.slots)];
const botQ = [magazineMesh(gLoader, 0), magazineMesh(gLoader, 0)];
topQ.forEach((q, i) => q.g.position.set(LOADX, 13 + i * 12.5, MZ_TOP));
botQ.forEach((q, i) => q.g.position.set(LOADX, 13 + i * 12.5, MZ_BOT));
const uTop = magazineMesh(gUnloader, MAG.slots); uTop.g.position.set(UNLOADX, 13, MZ_TOP);
uTop.strips.forEach((s) => (s.mk.userData.on = SU.map((_, i) => !UPSTREAM_REJ.includes(i)), applyInstN(s.mk, SU.length)));
const uBot = [magazineMesh(gUnloader, 0), magazineMesh(gUnloader, 0)]; uBot.forEach((q, i) => q.g.position.set(UNLOADX, 13 + i * 12.5, MZ_BOT));

// --- strip pusher (rodless cylinder behind the loader magazine) ---
box(gLoader, [-147, -1.2, 82], [-145, 1.2, 98.4], MAT.aluDark);
box(gLoader, [-149.5, -1.6, 98.4], [-138.2, 1.6, 99.6], MAT.alu);
for (const x of [-150.3, -138.2]) box(gLoader, [x, -2, 98.2], [x + 0.8, 2, 100], MAT.aluDark);
const pusher = G("pusher", gLoader);
box(pusher, [-1.6, -1.6, 99.6], [1.6, 1.6, 100.2], MAT.alu);
box(pusher, [1.0, -1.8, 100.0], [1.4, 1.8, 100.6], MAT.teal);
// --- input / output belt tracks (through the wall openings) ---
function track(x0, x1) {
  for (const s of [-1, 1]) {
    const y0 = s > 0 ? 3.6 : -4.6;
    box(gB, [x0, y0, 98.6], [x1, y0 + 1, 99.7], MAT.alu);
    box(gB, [x0, s > 0 ? 3.55 : -3.95, 99.7], [x1, s > 0 ? 3.95 : -3.55, 100], MAT.rubber, { edges: false });
    box(gB, [x0, s > 0 ? 3.95 : -4.6, 99.7], [x1, s > 0 ? 4.6 : -3.95, 100.7], MAT.alu);
  }
  for (const x of [x0 + 2, x1 - 3]) box(gB, [x, -5, 82], [x + 1.2, 5, 98.6], MAT.aluDark);
  cyl(gB, [x0 + 0.6, -5.2, 98.2], [0, 1, 0], 10.4, 0.5, MAT.steel, { edges: false });
  box(gB, [(x0 + x1) / 2 - 2, -7.6, 93], [(x0 + x1) / 2 + 2, -4.6, 97.6], MAT.black);
  box(gB, [x1 - 1, -1, 100], [x1 - 0.4, 1, 100.6], MAT.aluDark);
}
track(-109.5, -67); track(67, 109.5);
// --- strip grippers inside the main machine (track -> nest, nest -> track) ---
function gripper(x0, x1, home) {
  box(gB, [x0, 12, TOP_Z], [x1, 15, 85.4], MAT.alu);
  box(gB, [x0 - 1.2, 11.6, TOP_Z], [x0, 15.4, 86.4], MAT.aluDark); box(gB, [x1, 11.6, TOP_Z], [x1 + 1.2, 15.4, 86.4], MAT.aluDark);
  const car = G("grip", gB);
  box(car, [home - 2.5, 11.8, 85.4], [home + 2.5, 15.2, 88], MAT.alu);
  box(car, [home - 0.8, 12, 88], [home + 0.8, 13.6, 95.6 + GZ], MAT.alu);
  box(car, [home - 0.8, -2, 95.6 + GZ], [home + 0.8, 13.6, 96.6 + GZ], MAT.powder);
  cyl(car, [home, 12.8, 95.6 + GZ], [0, 0, 1], 1.0, 0.5, MAT.steel, { edges: false });
  const jaw = G("jaw", car);
  box(jaw, [home - 0.6, -2.2, 93.4 + GZ], [home + 0.6, 2.2, 95.6 + GZ], MAT.teal);
  return { car, jaw, home };
}
const GIN = gripper(-72, -35, -40), GOUT = gripper(35, 74, 40);
const MIN = { g: carIn, strips: magCur.strips }, MOUT = { g: carOut, strips: magOut.strips };

// ---------- HMI with live map (front, on a swing arm off the left door post) ----------
const hmiCanvas = document.createElement("canvas"); hmiCanvas.width = 512; hmiCanvas.height = 320;
const hmiTex = new T3.CanvasTexture(hmiCanvas); hmiTex.encoding = T3.sRGBEncoding;
{
  box(gEnc, [-93, 44, 128], [-88, 47, 130], MAT.alu);
  box(gEnc, [-89, 47, 126], [-86, 49, 132], MAT.aluDark);
  box(gEnc, [-90, 49, 116], [-64, 50.6, 135], MAT.black);
  const scr = new T3.Mesh(new T3.PlaneGeometry(24.4, 17.4), new T3.MeshBasicMaterial({ map: hmiTex }));
  scr.rotation.x = -Math.PI / 2; scr.rotation.z = Math.PI; scr.rotation.order = "XYZ";
  scr.position.set(-77, 50.62, 125.5); gEnc.add(scr);
  window.__hmiScr = scr;
  box(gEnc, [-88, 44, 106], [-66, 52, 107.4], MAT.aluDark);
  cylZ(gEnc, -87, 48, 106, 128, 0.6, MAT.alu, { edges: false });
}

// ---------- beam, scan field, camera frustums ----------
const beamMat = new T3.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.9 });
const beam = new T3.Mesh(new T3.CylinderGeometry(0.12, 0.12, 1, 8), beamMat);
const beamGlow = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.5, 1, 12), new T3.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.18, depthWrite: false }));
const spot = new T3.Mesh(new T3.SphereGeometry(0.55, 16, 12), new T3.MeshBasicMaterial({ color: 0xffffff }));
const spotLight = new T3.PointLight(0xff6040, 0, 600, 2);
[beam, beamGlow, spot].forEach((m) => { m.visible = false; root.add(m); });
scene.add(spotLight);
const fovLines = new T3.LineSegments(new T3.BufferGeometry(), MAT.fov);
root.add(fovLines);

// ---------- exploded view vectors & tree ----------
const TREE = [
  { id: "cabinet", g: gCab, label: "Base cabinet & services", ex: [0, 0, -40] },
  { id: "enclosure", g: gEnc, label: "Enclosure, FFU, stack light, HMI", ex: [0, 0, 70] },
  { id: "glass", g: gGlass, label: "Laser-safety glass", ex: [0, 70, 30] },
  { id: "utilities", g: gUtil, label: "Fume, ionizer, valve terminal", ex: [0, -30, 20] },
  { id: "axis", g: gAxis, label: "Linear-motor axis & drag chain", ex: [0, 0, 0] },
  { id: "shuttle", g: gShuttle, label: "Shuttle, Y stage & nest", ex: [0, 0, 18] },
  { id: "laser", g: gLaser, label: "Laser source, Z column & scan head", ex: [0, -20, 40] },
  { id: "align", g: gAlign, label: "Pre-mark fiducial camera", ex: [0, -20, 40] },
  { id: "grader", g: gGrader, label: "Post-mark 2D grader", ex: [0, -20, 40] },
  { id: "cfgA", g: gA, label: "Post-singulation: tray stackers & reject picker", ex: [0, 25, 12], cfg: "A" },
  { id: "cfgB", g: gB, label: "Post-encapsulation: magazine loader/unloader, tracks, grippers", ex: [0, 25, 12], cfg: "B" },
  { id: "fumeExt", g: gFume, label: "Fume extractor unit", ex: [0, -40, 0] },
];
const hidden = new Set();

// =====================================================================
//                        SIMULATION STATE MACHINE
// =====================================================================
let cfg = "B", src = "fiber";
const S = {};
function resetState() {
  Object.assign(S, {
    sx: cfg === "A" ? ST.inX : STB.inX, sy: 0, lift: 0, inLatch: 0, outLatch: 0, inDrop: 0, outPush: 0,
    inN: 0, outN: 0, refill: 1, refillOn: false, coax: 0, quad: -1,
    cy: 0, rod: 0, held: false, rejects: 0, ring: 0, beam: false, bp: [0, 0, 0], fov: null, fovKind: "",
    payload: false, marks: new Set(), checks: new Set(), cur: -1, bad: -1, removed: new Set(), xm: new Set(), fid: -1,
    nextIn: 0, outCount: 0, gin: -40, gout: 40, jawIn: 1, jawOut: 1, stripDX: 0, linkIn: false, linkOut: false,
    lamp: "green", phase: 0, info: "", headZ: HEADZ[cfg], pz: MZ_TOP, pzOut: MZ0, magLoaded: false, magY: 0, inY: 0, qShift: 0, topN: 2, botN: 0, clamp: 0, push: -137.5, trav: -123, travOn: false, slotNow: -1, qPend: 0, grade: "", cycleT: 0, lastCycle: 0, units: 0, pass: 0, fail: 0,
  });
}
const STEPS = { A: ["Load", "Index", "Transfer", "Fiducial align", "Mark", "Grade & verify", "Sort", "Unload"], B: ["Magazine load", "Index slot", "Push & extract", "Fiducial align", "Mark", "Grade & verify", "Map", "Unload"] };
const SRC = { fiber: "Fiber 1064 nm", uv: "UV 355 nm", green: "Green 532 nm" };
const BEAM_COL = { fiber: 0xc0392b, uv: 0x7b4fe0, green: 0x1fa54a };
const GRADE = (i, bad) => (i === bad ? { g: "D", v: (1.4 + (i % 3) * 0.1).toFixed(1) } : { g: (i * 7) % 11 === 3 ? "B" : "A", v: ((i * 7) % 11 === 3 ? 3.2 : 3.5 + ((i * 13) % 5) / 10).toFixed(1) });
const NOTES = {
  A: { fiber: "Fiber 1064 nm on EMC mold compound: usual starting point for package marking (good contrast, lower source cost). Check depth and heat-affected zone on thin packages. To be confirmed by trials.", uv: "UV 355 nm on packages: finer spot, lower heat input; for thin/small packages, light or heat-sensitive materials and very small codes. Higher cost. To be confirmed by trials.", green: "Green 532 nm on packages: option where the compound or a metal lid absorbs better in the visible. Not a default; validate by trial." },
  B: { fiber: "Fiber 1064 nm on EMC mold caps (post-mold, post-cure strips): the usual production choice — good contrast on black mold compound at high speed. Set depth to keep clear of wire loops and die (mold-cap thickness and wire-loop height are customer inputs). To be confirmed by trials.", uv: "UV 355 nm on mold caps: finer, lower-HAZ marks for thin mold caps, very small units or where mark depth must stay shallow over the die. Higher source cost; to be confirmed by trials.", green: "Green 532 nm on mold caps: option for specific compounds or the copper rail ID; not a default. Validate contrast and depth by trial." },
};
let queue = [], seg = null, segT = 0;
const SEG = (phase, dur, to = {}, o = {}) => ({ phase, dur, to, ...o });
function startSeg(s) {
  seg = s; segT = 0;
  if (s.start) s.start();
  s._to = typeof s.to === "function" ? s.to() : s.to;
  s._from = {}; for (const k of Object.keys(s._to)) s._from[k] = S[k];
  S.phase = s.phase;
  if (s.info !== undefined) S.info = typeof s.info === "function" ? s.info() : s.info;
}
function applySeg(s, u) {
  const e = ease(u);
  for (const k of Object.keys(s._to)) S[k] = s._from[k] + (s._to[k] - s._from[k]) * e;
  if (S.linkIn) S.stripDX = S.gin + 0.6 - 10 - S.sx;
  if (S.linkOut) S.stripDX = S.gout + 0.6 + 10 - S.sx;
  if (s.tick) s.tick(u);
}
function endSeg(s) { applySeg(s, 1); if (s.end) s.end(); if (s.infoEnd !== undefined) S.info = typeof s.infoEnd === "function" ? s.infoEnd() : s.infoEnd; }
function advance(dt) {
  let left = dt, guard = 0;
  while (left > 0 && guard++ < 400) {
    if (!seg) { if (!queue.length) queue = cfg === "A" ? cycleA() : cycleB(); startSeg(queue.shift()); }
    const remain = seg.dur - segT;
    if (left >= remain) { left -= Math.max(0, remain); endSeg(seg); seg = null; }
    else { segT += left; applySeg(seg, seg.dur > 0 ? segT / seg.dur : 1); left = 0; }
  }
  S.cycleT += dt;
}
const FIELDS_A = [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9]];
const BAD_A = 26;
const pkgWorld = (i) => [S.sx + PKGS[i][0], S.sy + PKGS[i][1], NEST_TOP + TRAY.h + 0.3 + S.lift];
function cycleA() {
  const q = [], h = TRAY.h;
  if (S.inN === 0) {
    q.push(SEG(0, 0.7, {}, { start() { S.lamp = "amber"; }, info: "input empty · stack light amber · operator opens load door" }));
    q.push(SEG(0, 0.01, {}, { end() { S.outN = 0; S.rejects = 0; S.refillOn = true; S.refill = 0; } }));
    q.push(SEG(0, 2.6, { refill: 1 }, { info: () => `operator loads JEDEC trays into input cassette · ${Math.min(IN_N, Math.floor(S.refill * IN_N))} of ${IN_N}` }));
    q.push(SEG(0, 0.6, {}, { info: "stack-present sensor made · door closed · recipe & lot ID checked", start() { S.refillOn = false; S.inN = IN_N; S.lamp = "green"; } }));
  } else q.push(SEG(0, 0.5, {}, { start() { S.lamp = "green"; }, info: () => `input ${S.inN} trays · output ${S.outN}` }));
  q.push(SEG(1, 1.3, { sx: ST.inX, sy: 0 }, { info: "shuttle X to input stacker", start() { S.cycleT = 0; } }));
  q.push(SEG(1, 0.6, { lift: LIFT_IN }, { info: "nest lifts to stack bottom" }));
  q.push(SEG(1, 0.35, { inLatch: 1 }, { info: "separator latches open" }));
  q.push(SEG(1, 0.5, { lift: LIFT_IN - h, inDrop: -h }, { info: "stack lowered one tray pitch (7.62 mm)" }));
  q.push(SEG(1, 0.35, { inLatch: 0 }, { info: "latches close under next tray", end() { S.inN -= 1; S.inDrop = 0; S.payload = true; S.marks = new Set(); S.checks = new Set(); S.removed = new Set(); S.bad = -1; S.cur = -1; } }));
  q.push(SEG(1, 0.6, { lift: 0 }, { info: "tray seated on locating pins · vacuum on" }));
  q.push(SEG(2, 1.4, { sx: ST.alignX + 5.9, sy: 15.3 }, { info: "tray to pre-mark fiducial camera" }));
  q.push(SEG(3, 0.3, { coax: 1 }, { info: "coaxial light on", start() { S.fov = "align"; } }));
  q.push(SEG(3, 0.6, {}, { info: "fiducial 1 found · Δx Δy measured", start() { S.fid = 0; } }));
  q.push(SEG(3, 0.9, { sx: ST.alignX - 5.9, sy: -15.3 }, { info: "to fiducial 2", start() { S.fid = -1; } }));
  q.push(SEG(3, 0.6, {}, { info: "fiducial 2 found · offset & θ correction sent to scan head", start() { S.fid = 1; } }));
  q.push(SEG(3, 0.3, { coax: 0 }, { end() { S.fid = -1; S.fov = null; } }));
  FIELDS_A.forEach((rows, f) => {
    const fc = (PKGS[rows[0] * 4][1] + PKGS[rows[rows.length - 1] * 4][1]) / 2;
    q.push(SEG(4, f === 0 ? 1.5 : 0.55, { sx: ST.markX, sy: -fc }, { info: `stage to scan field ${f + 1} of 3`, start() { S.beam = false; S.fov = "laser"; } }));
    rows.forEach((r) => { for (let c = 0; c < 4; c++) { const i = r * 4 + c;
      q.push(SEG(4, 0.05, {}, { start() { S.beam = true; S.bp = pkgWorld(i); }, info: () => `${SRC[src]} · package ${i + 1} of 40` }));
      q.push(SEG(4, 0.11, {}, { tick() { S.bp = pkgWorld(i); }, end() { S.marks.add(i); S.units++; } })); } });
    q.push(SEG(4, 0.05, {}, { end() { S.beam = false; } }));
  });
  q.push(SEG(4, 0.01, {}, { end() { S.fov = null; } }));
  FIELDS_A.forEach((rows, f) => {
    const fc = (PKGS[rows[0] * 4][1] + PKGS[rows[rows.length - 1] * 4][1]) / 2;
    q.push(SEG(5, f === 0 ? 1.2 : 0.45, { sx: ST.visX, sy: -fc }, { info: `to post-mark grader · field ${f + 1}`, start() { S.ring = 1; S.fov = "grader"; } }));
    rows.forEach((r) => { for (let c = 0; c < 4; c++) { const i = r * 4 + c; const G2 = GRADE(i, BAD_A);
      q.push(SEG(5, i === BAD_A ? 0.9 : 0.12, {}, { start() { S.cur = i; S.grade = G2.g; }, tick(u) { S.quad = Math.min(3, Math.floor(u * 4)); },
        info: () => (i === BAD_A ? `package ${i + 1} · 2D grade ${G2.g} (${G2.v}) below spec C · OCV pass` : `package ${i + 1} · 2D grade ${G2.g} (${G2.v}) · OCR/OCV pass`),
        end() { S.quad = -1; S.checks.add(i); if (i === BAD_A) { S.bad = i; S.fail++; } else S.pass++; } })); } });
  });
  q.push(SEG(5, 0.5, { ring: 0 }, { info: "39 pass · 1 fail (grade D) · grades & images to MES", start() { S.cur = -1; S.fov = null; } }));
  const [bx, by] = PKGS[BAD_A];
  const pkgTop = NEST_TOP + h - 0.1 + 0.28 + 0.2;
  q.push(SEG(6, 1.1, { sx: ST.pickX - bx, sy: 0 }, { info: `package ${BAD_A + 1} under reject picker` }));
  q.push(SEG(6, 0.55, { cy: by }, { info: "picker Y over failed package" }));
  q.push(SEG(6, 0.5, { rod: PICK_REST_CUP - pkgTop }, { info: "nozzle down" }));
  q.push(SEG(6, 0.25, {}, { info: "vacuum on · package held", end() { S.held = true; S.removed.add(BAD_A); } }));
  q.push(SEG(6, 0.5, { rod: 0 }, { info: "lifting" }));
  q.push(SEG(6, 0.9, () => ({ cy: -36.5 + (S.rejects % 4) * 2.6 }), { info: "to reject bin" }));
  q.push(SEG(6, 0.5, () => ({ rod: PICK_REST_CUP - 93.2 }), { info: "placing in reject bin" }));
  q.push(SEG(6, 0.25, {}, { info: () => `rejected · bin ${S.rejects + 1}`, end() { S.held = false; S.rejects += 1; } }));
  q.push(SEG(6, 0.5, { rod: 0 }, {}));
  q.push(SEG(6, 0.6, { cy: 0 }, { info: "picker home · empty pocket logged" }));
  q.push(SEG(7, 1.5, { sx: ST.outX, sy: 0 }, { info: "tray to output stacker" }));
  q.push(SEG(7, 0.9, { lift: LIFT_IN + 0.8 }, { info: "pushing tray up past spring latches", tick() { const touch = LIFT_IN - h; S.outPush = S.outN > 0 ? Math.max(0, S.lift - touch) : 0; const z = NEST_TOP + S.lift + h; S.outLatch = z > LATCH_Z - 0.05 && S.lift < LIFT_IN + 0.15 ? 1 : 0; } }));
  q.push(SEG(7, 0.25, { outLatch: 0 }, { info: "latches snap back" }));
  q.push(SEG(7, 0.45, { lift: LIFT_IN }, { info: "tray rests on latches", tick() { S.outPush = S.outN > 0 ? Math.max(0, S.lift - (LIFT_IN - h)) : 0; }, end() { S.outN += 1; S.outPush = 0; S.payload = false; } }));
  q.push(SEG(7, 0.6, { lift: 0 }, { info: () => `output ${S.outN} trays · tray record written`, end() { S.lastCycle = S.cycleT; } }));
  return q;
}
const FIELDS_B = [-5.65, 5.65];
const suWorld = (i) => [S.sx + SU[i][0], S.sy + SU[i][1], STRIP.z + LF.t + CAP.h + 0.1];
function cycleB() {
  const q = [];
  const top = STRIP.z + LF.t + CAP.h;
  if (S.nextIn >= MAG.slots || !S.magLoaded) {
    // magazine exchange in the loader: eject the empty, take the next full magazine from the buffer
    if (S.magLoaded) {
      q.push(SEG(0, 0.6, {}, { start() { S.lamp = "green"; }, info: "input magazine empty · exchange from buffer" }));
      q.push(SEG(0, 1.2, { pz: MZ_BOT }, { info: "elevator down to empty-magazine conveyor" }));
      q.push(SEG(0, 0.25, { clamp: 0 }, { info: "clamp open" }));
      q.push(SEG(0, 1.0, { magY: 13 }, { info: "empty magazine conveyed out", end() { S.magLoaded = false; S.magY = 0; S.botN = Math.min(2, S.botN + 1); } }));
    }
    if (S.topN === 0) q.push(SEG(0, 1.6, {}, { start() { S.lamp = "amber"; }, info: "buffer empty · amber · operator loads full magazines", end() { S.topN = 2; S.botN = 0; S.lamp = "green"; } }));
    q.push(SEG(0, 1.0, { pz: MZ_TOP }, { info: "elevator up to full-magazine conveyor" }));
    q.push(SEG(0, 1.1, { inY: 1 }, { info: "full magazine conveyed onto elevator", end() { S.inY = 0; S.magLoaded = true; S.nextIn = 0; S.topN -= 1; S.qPend = S.topN > 0 ? 1 : 0; S.qShift = 0; } }));
    q.push(SEG(0, 0.25, { clamp: 1 }, { info: "magazine clamped · presence & slot-map sensors made" }));
    q.push(SEG(0, 0.5, { qShift: 1 }, { info: "buffer advances", end() { S.qShift = 0; S.qPend = 0; } }));
  } else q.push(SEG(0, 0.5, {}, { start() { S.lamp = "green"; }, info: () => `input magazine ${MAG.slots - S.nextIn} of ${MAG.slots} strips` }));
  q.push(SEG(1, 1.3, () => ({ sx: STB.inX, sy: 0, pz: MZ0 - S.nextIn }), { info: () => `elevator indexes slot ${S.nextIn + 1} to the transfer plane`, start() { S.cycleT = 0; } }));
  q.push(SEG(2, 0.01, {}, { end() { S.trav = -123; S.travOn = true; magCur.strips[S.nextIn].g.visible = false; S.marks = new Set(); S.checks = new Set(); S.xm = new Set(); S.bad = -1; S.cur = -1; S.slotNow = S.nextIn; } }));
  q.push(SEG(2, 0.5, { push: -135.4 }, { info: "pusher to strip edge" }));
  q.push(SEG(2, 1.0, { push: -121.4, trav: -109 }, { info: "strip pushed out of magazine onto belt track" }));
  q.push(SEG(2, 0.4, { push: -137.5 }, { info: "pusher retracts" }));
  q.push(SEG(2, 1.4, { trav: -79 }, { info: "belt track carries strip through the wall to the end stop", end() { S.nextIn += 1; } }));
  q.push(SEG(2, 0.6, { gin: -67.6 }, { info: "gripper to strip leading edge" }));
  q.push(SEG(2, 0.25, { jawIn: 0 }, { info: "jaw closed" }));
  q.push(SEG(2, 1.2, { gin: -42.6, trav: -54 }, { info: "strip drawn onto work holder" }));
  q.push(SEG(2, 0.3, { jawIn: 1 }, { info: "tooling pins engaged · vacuum on", end() { S.travOn = false; S.payload = true; } }));
  q.push(SEG(2, 0.4, { gin: -40 }, {}));
  q.push(SEG(3, 1.3, { sx: STB.alignX + 11.4, sy: -3.15 }, { info: "strip to pre-mark camera" }));
  q.push(SEG(3, 0.3, { coax: 1 }, { info: "coaxial light on", start() { S.fov = "align"; } }));
  q.push(SEG(3, 0.6, {}, { info: "fiducial 1 found · strip ID read (upstream 2D code)", start() { S.fid = 0; } }));
  q.push(SEG(3, 0.6, {}, { info: "strip map downloaded from MES · 2 upstream rejects to skip-mark" }));
  q.push(SEG(3, 1.0, { sx: STB.alignX - 11.4, sy: 3.15 }, { info: "to fiducial 2", start() { S.fid = -1; } }));
  q.push(SEG(3, 0.6, {}, { info: "fiducial 2 found · offset, θ and strip stretch corrected", start() { S.fid = 1; } }));
  q.push(SEG(3, 0.3, { coax: 0, sy: 0 }, { end() { S.fid = -1; S.fov = null; } }));
  FIELDS_B.forEach((fc, f) => {
    q.push(SEG(4, f === 0 ? 1.4 : 0.6, { sx: STB.markX - fc, sy: 0 }, { info: `scan field ${f + 1} of 2 (two mold caps)`, start() { S.beam = false; S.fov = "laser"; } }));
    SU.forEach(([x], i) => {
      if ((x < 0) !== (fc < 0)) return;
      const rej = UPSTREAM_REJ.includes(i);
      q.push(SEG(4, rej ? 0.12 : 0.028, {}, { start() { S.beam = true; S.bp = suWorld(i); }, info: () => (rej ? `unit ${i + 1}: upstream reject → reject mark (X)` : `${SRC[src]} · unit ${i + 1} of ${SU.length}`), end() { if (rej) S.xm.add(i); else S.marks.add(i); S.units++; } }));
    });
    q.push(SEG(4, 0.05, {}, { end() { S.beam = false; } }));
  });
  q.push(SEG(4, 0.01, {}, { end() { S.fov = null; } }));
  FIELDS_B.forEach((fc, f) => {
    q.push(SEG(5, f === 0 ? 1.2 : 0.5, { sx: STB.visX - fc, sy: 0 }, { info: `to post-mark grader · field ${f + 1}`, start() { S.ring = 1; S.fov = "grader"; } }));
    SU.forEach(([x], i) => {
      if ((x < 0) !== (fc < 0) || UPSTREAM_REJ.includes(i)) return;
      const G2 = GRADE(i, BAD_SU);
      q.push(SEG(5, i === BAD_SU ? 0.9 : 0.022, {}, { start() { S.cur = i; S.grade = G2.g; }, tick(u) { S.quad = Math.min(3, Math.floor(u * 4)); },
        info: () => (i === BAD_SU ? `unit ${i + 1} · OCV mismatch (broken character) · grade ${G2.g}` : `unit ${i + 1} · OCV pass · mark position OK`),
        end() { S.quad = -1; S.checks.add(i); if (i === BAD_SU) { S.bad = i; S.fail++; } else S.pass++; } }));
    });
  });
  q.push(SEG(5, 0.4, { ring: 0 }, { info: () => `${SU.length - 3} pass · 1 fail · 2 upstream rejects · strip map to MES`, start() { S.cur = -1; S.fov = null; } }));
  const bfc = SU[BAD_SU][0] < 0 ? -5.65 : 5.65;
  q.push(SEG(6, 1.1, { sx: STB.markX - bfc, sy: 0 }, { info: `unit ${BAD_SU + 1} back under the scan head` }));
  q.push(SEG(6, 0.05, {}, { start() { S.beam = true; S.bp = suWorld(BAD_SU); }, info: "laser reject mark (X) on the failed unit" }));
  q.push(SEG(6, 0.35, {}, { end() { S.xm.add(BAD_SU); S.beam = false; } }));
  q.push(SEG(6, 0.5, {}, { info: "strip map updated: 3 rejects for downstream singulation sort" }));
  q.push(SEG(7, 1.5, () => ({ sx: STB.outX, sy: 0, pzOut: MZ0 - S.outCount }), { info: () => `output elevator to slot ${S.outCount + 1}` }));
  q.push(SEG(7, 0.5, { gout: 41.4 }, { info: "gripper behind strip trailing edge" }));
  q.push(SEG(7, 0.25, { jawOut: 0 }, { end() { S.payload = false; S.travOn = true; S.trav = 54; } }));
  q.push(SEG(7, 1.1, { gout: 65.4, trav: 78 }, { info: "strip pushed onto output belt track" }));
  q.push(SEG(7, 0.25, { jawOut: 1 }, {}));
  q.push(SEG(7, 1.6, { trav: 123, gout: 40 }, { info: "belt feeds strip into output magazine slot", end() { S.travOn = false; S.outCount += 1; } }));
  q.push(SEG(7, 0.5, {}, { info: () => `slot ${S.outCount} filled · strip & slot record written`, end() { S.lastCycle = S.cycleT; if (S.outCount >= MAG.slots) S.outCount = 0; } }));
  return q;
}

// =====================================================================
//                          APPLY STATE TO MODEL
// =====================================================================
const markState = { key: "" };
function posChain(sx) {
  const C = CHAIN, xl = (sx + C.xf + C.Lp) / 2, zc = C.zl + C.R, zu = C.zl + 2 * C.R, xe = sx - 11.4;
  const low = xl - C.xf, arc = Math.PI * C.R, up = xl - xe;
  const obj = new T3.Object3D();
  const yc = (C.y0 + C.y1) / 2;
  for (let i = 0; i < chainN; i++) {
    let s = (i + 0.5) * CHAIN.pitch, x, z, a;
    if (s < low) { x = C.xf + s; z = C.zl; a = 0; }
    else if (s < low + arc) { const t = (s - low) / C.R - Math.PI / 2; x = xl + C.R * Math.cos(t); z = zc + C.R * Math.sin(t); a = t + Math.PI / 2; }
    else if (s < low + arc + up) { x = xl - (s - low - arc); z = zu; a = Math.PI; }
    else { obj.scale.set(0, 0, 0); obj.updateMatrix(); chainMesh.setMatrixAt(i, obj.matrix); continue; }
    obj.position.set(x, yc, z); obj.rotation.set(0, -a, 0); obj.scale.set(1, 1, 1); obj.updateMatrix();
    chainMesh.setMatrixAt(i, obj.matrix);
  }
  chainMesh.instanceMatrix.needsUpdate = true;
}
const tmpV = new T3.Vector3();
function applyModel() {
  gCar.position.x = S.sx;
  gStage.position.y = S.sy;
  gNest.position.z = S.lift;
  liftStems.forEach((m) => { m.visible = S.lift > 0.05 && cfg === "A"; m.scale.set(1, Math.max(0.01, S.lift), 1); });
  posChain(S.sx);
  gHead.position.z += (S.headZ - gHead.position.z) * 0.2;
  gAlignZ.position.z = gHead.position.z; gGraderZ.position.z = gHead.position.z;
  if (cfg === "A") {
    payloadA.g.visible = S.payload;
    const pk = payloadA.pk, mk = payloadA.mk;
    const key = [...S.marks].join(",") + "|" + [...S.removed].join(",");
    if (key !== markState.key) { markState.key = key; pk.userData.on = PKGS.map((_, i) => !S.removed.has(i)); mk.userData.on = PKGS.map((_, i) => S.marks.has(i) && !S.removed.has(i)); applyInst(pk); applyInst(mk); }
    if (S.cur >= 0) { curFrame.visible = true; curFrame.position.set(PKGS[S.cur][0], PKGS[S.cur][1], TRAY.h + 0.65); } else curFrame.visible = false;
    if (S.bad >= 0 && !S.removed.has(S.bad)) { badFrame.visible = true; badFrame.position.set(PKGS[S.bad][0], PKGS[S.bad][1], TRAY.h + 0.66); } else badFrame.visible = false;
    fidMatA.forEach((m, i) => (m.emissiveIntensity = S.fid === i ? 1.4 : 0));
    // stacks
    SIN.latches.f.forEach((l) => (l.position.y = l.userData.y0 + S.inLatch));
    SIN.latches.b.forEach((l) => (l.position.y = l.userData.y0 - S.inLatch));
    SOUT.latches.f.forEach((l) => (l.position.y = l.userData.y0 + 0.9 * S.outLatch));
    SOUT.latches.b.forEach((l) => (l.position.y = l.userData.y0 - 0.9 * S.outLatch));
    if (S.refillOn) {
      const kk = S.refill * IN_N, n = Math.floor(kk), fr = kk - n;
      SIN.trays.forEach((t, i) => { t.visible = i < n || (i === n && n < IN_N); t.position.z = LATCH_Z + i * TRAY.h + (i === n ? (1 - ease(fr)) * 14 : 0); });
      const nn = Math.min(IN_N - 1, n), ff = n >= IN_N ? 1 : fr;
      SIN.top.g.visible = true; SIN.top.g.position.z = LATCH_Z + nn * TRAY.h + (1 - ease(ff)) * 14;
    } else {
      SIN.trays.forEach((t, i) => { t.visible = i < S.inN; t.position.z = LATCH_Z + i * TRAY.h; });
      SIN.top.g.visible = S.inN > 0; SIN.top.g.position.z = LATCH_Z + (S.inN - 1) * TRAY.h;
    }
    SIN.stack.position.z = S.inDrop;
    SOUT.trays.forEach((t, i) => (t.visible = i < S.outN));
    SOUT.stack.position.z = S.outPush;
    SOUT.top.g.visible = S.outN > 0; SOUT.top.g.position.z = LATCH_Z + (S.outN - 1) * TRAY.h;
    gPickCar.position.y = S.cy;
    gRod.position.z = -S.rod;
    held.visible = S.held;
    rejects.forEach((m, i) => (m.visible = i < S.rejects));
  } else {
    gPayloadB.visible = S.payload;
    const key = [...S.marks].length + "|" + [...S.xm].join(",");
    if (key !== markState.key) { markState.key = key; payloadB.mk.userData.on = SU.map((_, i) => S.marks.has(i)); applyInstN(payloadB.mk, SU.length); }
    xMarks.forEach((x) => (x.g.visible = S.xm.has(x.i)));
    if (S.cur >= 0) { curFrameB.visible = true; curFrameB.position.set(SU[S.cur][0], SU[S.cur][1], LF.t + CAP.h + 0.01); } else curFrameB.visible = false;
    if (S.bad >= 0 && !S.xm.has(S.bad)) { badFrameB.visible = true; badFrameB.position.set(SU[S.bad][0], SU[S.bad][1], LF.t + CAP.h + 0.012); } else badFrameB.visible = false;
    fidMatB.forEach((m, i) => (m.emissiveIntensity = S.fid === i ? 1.4 : 0));
    // loader elevator + magazine exchange
    carIn.position.z = S.pz;
    magCur.g.visible = S.magLoaded || S.magY > 0;
    magCur.g.position.y = S.magY;
    magCur.strips.forEach((s, i) => (s.g.visible = S.magLoaded && i >= S.nextIn && !(S.travOn && i === S.slotNow && S.trav < -110)));
    if (S.magLoaded) magCur.strips.forEach((s, i) => { if (i === S.slotNow && S.travOn) s.g.visible = false; });
    topQ.forEach((q2, i) => { q2.g.visible = i < S.topN; q2.g.position.y = S.inY > 0 && i === 0 ? 13 - 13 * S.inY : 13 + i * 12.5 + (S.qPend ? (1 - S.qShift) * 12.5 : 0); });
    botQ.forEach((q2, i) => (q2.g.visible = i < S.botN));
    pusher.position.x = S.push + 1.4;
    carOut.position.z = S.pzOut;
    magOut.strips.forEach((s, i) => (s.g.visible = i < S.outCount));
    // travelling strip in world space
    travel.g.visible = S.travOn;
    if (S.travOn) {
      const onNestOut = S.trav >= 54;
      travel.g.position.set(S.trav, 0, STRIP.z);
      travel.mk.userData.on = SU.map((_, i) => onNestOut && S.marks.has(i)); 
      if (travel.userData !== (onNestOut ? 1 : 0)) { travel.userData = onNestOut ? 1 : 0; applyInstN(travel.mk, SU.length); }
    }
    GIN.car.position.x = S.gin - GIN.home; GIN.jaw.position.z = S.jawIn * 1.6;
    GOUT.car.position.x = S.gout - GOUT.home; GOUT.jaw.position.z = S.jawOut * 1.6;
  }
  // lights
  coaxMat.emissiveIntensity = S.coax * 2.2;
  quadMats.forEach((m, q) => (m.emissiveIntensity = S.ring > 0.5 ? (S.quad === q ? 2.4 : 0.25) : 0));
  MAT.lampG.emissiveIntensity = S.lamp === "green" ? 1.6 : 0;
  MAT.lampA.emissiveIntensity = S.lamp === "amber" ? 1.6 : 0;
  emitLed.material.emissiveIntensity = S.beam ? 2 : 0;
  // beam
  const showBeam = S.beam;
  [beam, beamGlow, spot].forEach((m) => (m.visible = showBeam));
  spotLight.intensity = showBeam ? 1.2 : 0;
  if (showBeam) {
    const a = new T3.Vector3(-4, 0, LENS_Z + gHead.position.z), b = new T3.Vector3(...S.bp);
    const d = b.clone().sub(a), L = d.length();
    for (const m of [beam, beamGlow]) { m.position.copy(a.clone().add(b).multiplyScalar(0.5)); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(Y, d.normalize()); }
    spot.position.copy(b);
    tmpV.set(b.x * 10, -b.y * 10, b.z * 10 + 20); spotLight.position.copy(tmpV);
  }
  // camera frustums / scan field
  if (S.fov) {
    const surf = cfg === "A" ? NEST_TOP + TRAY.h + 0.4 : STRIP.z + STRIP.h + 0.1;
    let apex, cx, hw, hh;
    if (S.fov === "align") { apex = [ST.alignX, 0, 121.4 + gHead.position.z]; cx = ST.alignX; hw = 2.6; hh = 2.6; }
    else if (S.fov === "grader") { apex = [22, 0, 118 + gHead.position.z]; cx = 22; hw = 5.5; hh = 5.5; }
    else { apex = [-4, 0, LENS_Z + gHead.position.z]; cx = -4; hw = 5.5; hh = 5.5; }
    const c = [[cx - hw, -hh], [cx + hw, -hh], [cx + hw, hh], [cx - hw, hh]].map(([x, y]) => [x, y, surf]);
    const pts = [];
    for (let i = 0; i < 4; i++) { pts.push(...c[i], ...c[(i + 1) % 4]); pts.push(...apex, ...c[i]); }
    fovLines.geometry.setAttribute("position", new T3.Float32BufferAttribute(pts, 3));
    fovLines.visible = $("#t-fov").checked;
  } else fovLines.visible = false;
}

// =====================================================================
//                       UI: tree, views, DRO, HMI
// =====================================================================
const treeEl = $("#tree");
TREE.forEach((t) => {
  const row = document.createElement("label");
  row.className = "tree-row"; row.dataset.id = t.id; if (t.cfg) row.dataset.cfg = t.cfg;
  row.innerHTML = `<input type="checkbox" checked><span class="sw"></span><span>${t.label}</span>`;
  row.querySelector("input").addEventListener("change", (e) => { if (e.target.checked) hidden.delete(t.id); else hidden.add(t.id); applyVisibility(); });
  treeEl.appendChild(row);
});
function applyVisibility() {
  TREE.forEach((t) => (t.g.visible = !hidden.has(t.id) && (!t.cfg || t.cfg === cfg)));
  nestA.visible = cfg === "A"; nestB.visible = cfg === "B"; gPayloadB.visible = cfg === "B" && S.payload;
  $$(".tree-row[data-cfg]").forEach((r) => r.classList.toggle("off", r.dataset.cfg !== cfg));
}
let explode = 0;
function applyExplode() { TREE.forEach((t) => t.g.position.set(t.ex[0] * explode, t.ex[1] * explode, t.ex[2] * explode)); }
$("#explode").addEventListener("input", (e) => { explode = Number(e.target.value) / 100; applyExplode(); });
const clipPlane = new T3.Plane(new T3.Vector3(0, 1, 0), 1000);
$("#section").addEventListener("input", (e) => {
  const v = Number(e.target.value);
  if (v >= 460) { renderer.clippingPlanes = []; $("#section-v").textContent = "off"; }
  else { clipPlane.constant = v; renderer.clippingPlanes = [clipPlane]; $("#section-v").textContent = `Y ${v} mm`; }
});
$("#t-edges").addEventListener("change", (e) => edgeLines.forEach((l) => (l.visible = e.target.checked)));
$("#t-xray").addEventListener("change", (e) => {
  for (const m of [MAT.powder, MAT.panel, MAT.wall]) { m.transparent = e.target.checked; m.opacity = e.target.checked ? 0.18 : 1; m.depthWrite = !e.target.checked; m.needsUpdate = true; }
});
$("#t-grid").addEventListener("change", (e) => { grid.visible = e.target.checked; axesHelper.visible = e.target.checked; });
$("#t-labels").addEventListener("change", () => {});
// standard views
const VIEWS = {
  iso: { p: [-2700, -4700, 3000], t: [0, 50, 950] },
  front: { p: [0, -7400, 1050], t: [0, 0, 1050] },
  top: { p: [0, 1, 8600], t: [0, 50, 900] },
  loader: { p: [-1650, -2250, 1350], t: [-1230, 0, 1060] },
  right: { p: [5200, 0, 1100], t: [0, 50, 1100] },
  process: { p: [-650, -2350, 1850], t: [-80, 20, 960] },
  head: { p: [-560, -1150, 1420], t: [-20, 0, 1010] },
};
let camAnim = null;
function goView(name) {
  const v = VIEWS[name]; if (!v) return;
  camAnim = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new T3.Vector3(...v.p), t1: new T3.Vector3(...v.t) };
  $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
}
$$("[data-view]").forEach((b) => b.addEventListener("click", () => goView(b.dataset.view)));
// config / source / play
function setCfg(next) {
  cfg = next;
  $$("[data-cfg-btn]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cfgBtn === cfg)));
  $$("[data-step]").forEach((el, i) => (el.querySelector("b").textContent = STEPS[cfg][i]));
  resetState(); queue = []; seg = null; markState.key = "";
  applyVisibility(); writeNote();
}
function setSrc(next) {
  src = next;
  $$("[data-src]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.src === src)));
  beamMat.color.setHex(BEAM_COL[src]); beamGlow.material.color.setHex(BEAM_COL[src]); spotLight.color.setHex(BEAM_COL[src]);
  MARK_MAT.map = MARK_TEX[src]; MARK_MAT.needsUpdate = true;
  writeNote();
}
function writeNote() { $("#note").innerHTML = `<b>${SRC[src]} · ${cfg === "A" ? "post-singulation · JEDEC tray / EMC packages" : "post-encapsulation · molded strips in magazines"}</b> — ${NOTES[cfg][src]}`; }
$$("[data-cfg-btn]").forEach((b) => b.addEventListener("click", () => setCfg(b.dataset.cfgBtn)));
$$("[data-src]").forEach((b) => b.addEventListener("click", () => setSrc(b.dataset.src)));
let paused = false, speed = 1;
$("#play").addEventListener("click", () => { paused = !paused; $("#play").textContent = paused ? "Play" : "Pause"; $("#play").setAttribute("aria-pressed", String(paused)); });
$("#speed").addEventListener("input", (e) => { speed = [0.25, 0.5, 1, 2, 4][Number(e.target.value)]; $("#speed-v").textContent = `${speed}×`; });
function jumpTo(step) {
  queue = cfg === "A" ? cycleA() : cycleB(); seg = null;
  while (queue.length && queue[0].phase < step) { const s = queue.shift(); startSeg(s); endSeg(s); }
  seg = null;
}
$$("[data-step]").forEach((el, i) => el.addEventListener("click", () => jumpTo(i)));
$("#follow").addEventListener("change", () => {});
$("#exchange").addEventListener("click", () => { if (cfg !== "B") setCfg("B"); S.nextIn = MAG.slots; queue = []; seg = null; });

// DRO + HMI
const fmt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2).padStart(7, "0");
let hmiKey = "";
function drawHmi() {
  const n = cfg === "A" ? PKGS.length : SU.length;
  const key = `${cfg}|${S.phase}|${S.marks.size}|${S.checks.size}|${S.bad}|${S.removed.size}|${S.xm.size}|${S.cur}`;
  if (key === hmiKey) return; hmiKey = key;
  const c = hmiCanvas.getContext("2d");
  c.fillStyle = "#0f1d1d"; c.fillRect(0, 0, 512, 320);
  c.fillStyle = "#1d3a39"; c.fillRect(10, 10, 492, 34);
  c.fillStyle = "#3cc4bd"; c.font = "bold 18px monospace"; c.fillText(`TEAL LMS  ·  ${cfg === "A" ? "JEDEC TRAY" : "MOLDED STRIP"}  ·  ${STEPS[cfg][S.phase].toUpperCase()}`, 18, 34);
  STEPS[cfg].forEach((_, i) => { c.fillStyle = i === S.phase ? "#3cc4bd" : i < S.phase ? "#4f8f8a" : "#2c4b4a"; c.fillRect(18 + i * 60, 56, 52, 8); });
  const cw = cfg === "A" ? 32 : 14, ch = cfg === "A" ? 40 : 26, x0 = cfg === "A" ? 160 : 150, y0 = 86;
  for (let i = 0; i < n; i++) {
    const gx = cfg === "A" ? Math.floor(i / 4) : SU[i][2] * 6 + Math.floor((i % 42) / 7) + SU[i][2] * 0.5, gy = cfg === "A" ? i % 4 : i % 7;
    let f = "#25403f";
    if (S.marks.has(i)) f = "#4f8f8a";
    if (S.checks.has(i)) f = "#3cc4bd";
    if (i === S.bad && S.checks.has(i)) f = "#e5484d";
    if (S.removed.has(i) || S.xm.has(i)) f = "#7a2c2f";
    if (cfg === "B" && UPSTREAM_REJ.includes(i) && !S.xm.has(i)) f = "#5b3a2a";
    c.fillStyle = f; c.fillRect(x0 + gx * cw, y0 + gy * ch, cw - 5, ch - 5);
    if (i === S.cur) { c.strokeStyle = "#fff"; c.lineWidth = 2; c.strokeRect(x0 + gx * cw - 1, y0 + gy * ch - 1, cw - 3, ch - 3); }
  }
  c.fillStyle = "#9fd6d3"; c.font = "15px monospace";
  c.fillText(`MARKED ${S.marks.size - (S.marks.has("code") ? 1 : 0)}/${n}`, 18, 110);
  c.fillText(`GRADED ${S.checks.size}/${n}`, 18, 135);
  c.fillText(`FAIL   ${S.bad >= 0 && S.checks.has(S.bad) ? 1 : 0}`, 18, 160);
  c.fillText(`SPEC   ≥ C`, 18, 185);
  c.fillText(`SRC ${src.toUpperCase()}`, 18, 210);
  hmiTex.needsUpdate = true;
}
function updateDro() {
  const r = (v) => fmt(v * 10);
  $("#dro").innerHTML = [
    ["X shuttle", r(S.sx), "mm"], ["Y stage", r(S.sy), "mm"], ["Z nest lift", r(S.lift), "mm"], ["Z scan head", r(gHead.position.z), "mm"],
    cfg === "A" ? ["Picker Y", r(S.cy), "mm"] : ["Loader elevator Z", r(S.pz), "mm"],
    cfg === "A" ? ["Picker Z", r(-S.rod), "mm"] : ["Strip X (in transfer)", S.travOn ? r(S.trav) : "on nest", S.travOn ? "mm" : ""],
    cfg === "A" ? ["Input / output", `${S.inN} / ${S.outN}`, "trays"] : ["Slot in / out", `${Math.min(MAG.slots, S.nextIn)} / ${S.outCount}`, `buffer ${S.topN} full · ${S.botN} empty`],
    ["Galvo target", S.beam ? `${((S.bp[0] + 4) * 10).toFixed(1)}, ${(S.bp[1] * 10).toFixed(1)}` : "—", S.beam ? "mm from lens axis" : ""],
    ["Marked total", String(S.units), "units"], ["Graded P / F", `${S.pass} / ${S.fail}`, ""],
    ["Cycle (sim)", `${S.cycleT.toFixed(1)} s`, S.lastCycle ? `last ${S.lastCycle.toFixed(1)} s` : ""],
  ].map(([k, v, u]) => `<div><span>${k}</span><b>${v}</b><i>${u}</i></div>`).join("");
  $("#readout").textContent = `${STEPS[cfg][S.phase]} · ${S.info}`;
  $$("[data-step]").forEach((el, i) => el.toggleAttribute("data-now", i === S.phase));
  $("#lamp").dataset.lamp = S.lamp;
}

// labels (projected HTML callouts)
const LABELS = [
  ["Input tray stacker", [-70, 20, 116], "A"], ["Magazine loader · buffer conveyors", [-126, 20, 162], "B"], ["Strip pusher", [-144, 0, 103], "B"], ["Input belt track", [-90, 6, 102], "B"],
  ["Magazine unloader", [126, 20, 162], "B"], ["Fume extractor", [-26, -84, 78], null], ["Pre-mark fiducial camera", [-36, 0, 150], null], ["Galvo scan head + f-theta", [-4, 8, 142], null],
  ["Post-mark 2D grader", [22, 0, 146], null], ["Reject picker", [49, 18, 134], "A"], ["Output tray stacker", [70, 20, 116], "A"],
  ["Linear-motor shuttle + Y stage", [0, 12, 89], null], ["Laser source", [-69, -41, 145], null], ["FFU (HEPA)", [-5, -42, 170], null],
  ["HMI", [-77, 50, 137], null], ["Main isolator", [41, 46, 67], null], ["Air prep · comms", [-156, -20, 67], "B"],
];
const labelEls = LABELS.map(([t]) => { const d = document.createElement("div"); d.className = "lbl"; d.textContent = t; $("#labels").appendChild(d); return d; });
const DIMS = [
  { a: [-97, 52, 0], b: [97, 52, 0], text: "≈ 1940 (TBD)", cfg: "A" },
  { a: [-159, 58, 0], b: [153, 58, 0], text: "≈ 3120 with loader/unloader (TBD)", cfg: "B" },
  { a: [104, -57, 0], b: [104, 45, 0], text: "≈ 1020 (TBD)" },
  { a: [-104, 45, 0], b: [-104, 45, 180.4], text: "≈ 1804 (TBD)", cfg: "A" },
  { a: [-162, 36, 0], b: [-162, 36, 180.4], text: "≈ 1804 (TBD)", cfg: "B" },
];
const dimGroup = new T3.Group(); root.add(dimGroup);
const dimEls = DIMS.map((d) => {
  const A = new T3.Vector3(...d.a), B = new T3.Vector3(...d.b);
  const g = new T3.BufferGeometry().setFromPoints([A, B]);
  dimGroup.add(new T3.Line(g, new T3.LineBasicMaterial({ color: 0x0e8a86 })));
  const el = document.createElement("div"); el.className = "lbl dim"; el.textContent = d.text; $("#labels").appendChild(el);
  return { el, mid: A.clone().add(B).multiplyScalar(0.5), line: dimGroup.children[dimGroup.children.length - 1], cfg: d.cfg };
});
const projV = new T3.Vector3();
function placeLabels() {
  const on = $("#t-labels").checked, w = view.clientWidth, h = view.clientHeight;
  dimGroup.visible = on;
  const place = (el, p, show) => {
    if (!show) { el.style.display = "none"; return; }
    projV.set(p[0] * 10, -p[1] * 10, p[2] * 10).project(camera);
    if (projV.z > 1) { el.style.display = "none"; return; }
    el.style.display = ""; el.style.transform = `translate(${((projV.x + 1) / 2 * w).toFixed(1)}px, ${((1 - projV.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
  };
  LABELS.forEach(([, p, c], i) => place(labelEls[i], p, on && (!c || c === cfg)));
  dimEls.forEach((d) => { const ok = on && (!d.cfg || d.cfg === cfg); d.line.visible = ok; place(d.el, [d.mid.x, d.mid.y, d.mid.z], ok); });
}

// =====================================================================
//                               LOOP
// =====================================================================
// =====================================================================
//              CAD WORKSTATION LAYER: post FX, selection, view cube, ortho
// =====================================================================
let composer = null, renderPass, saoPass, outlinePass, finalPass, aoOn = true;
const camPersp = camera;
const camOrtho = new T3.OrthographicCamera(-1, 1, 1, -1, 10, 40000);
camOrtho.up.set(0, 0, 1);
let activeCam = camPersp;
const ACES_GAMMA = {
  uniforms: { tDiffuse: { value: null }, exposure: { value: 0.52 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure; varying vec2 vUv;
    vec3 aces(vec3 x){ const float a=2.51; const float b=0.03; const float c=2.43; const float d=0.59; const float e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
    vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
    void main(){ vec4 t = texture2D(tDiffuse, vUv); gl_FragColor = vec4(toSRGB(aces(t.rgb*exposure)), 1.0); }`,
};
// part registry (for selection / properties)
const MATNAME = new Map(Object.entries({ powder: "Powder-coated steel, RAL 9016", panel: "Powder-coated steel panel", wall: "Painted steel panel", alu: "Aluminium 6061-T6, clear anodised", aluDark: "Aluminium, dark anodised", steel: "Stainless steel 304", black: "Black anodised / painted", rubber: "Rubber / cable sheath", tray: "Conductive JEDEC tray (carbon-loaded)", emc: "Epoxy mold compound", sub: "Substrate", gold: "Encoder scale (glass/steel)", teal: "Anodised aluminium, TEAL teal", yellow: "Safety yellow", red: "Safety red", glass: "Laser-safety polycarbonate", lens: "Optical glass" }).map(([k, v]) => [MAT[k], v]));
MATNAME.set(MAGM, "Aluminium strip magazine, hard anodised"); MATNAME.set(MAGS, "Aluminium side plate, hard anodised"); MATNAME.set(copper, "Copper leadframe (C194 / C7025)");
const CODES = { cabinet: "CAB", enclosure: "ENC", glass: "GLS", utilities: "UTL", axis: "AXS", shuttle: "SHT", laser: "LSR", align: "PAC", grader: "GRD", cfgA: "TRY", cfgB: "MAG", fumeExt: "FEX" };
let partSeq = 0;
function registerParts() {
  TREE.forEach((t) => t.g.traverse((o) => { if (o.isMesh && !o.userData.part) { o.userData.part = { tree: t, no: `TEAL-LMS-${CODES[t.id] || "GEN"}-${String(++partSeq).padStart(4, "0")}` }; } }));
}
function shapeName(o) {
  const ty = o.geometry && o.geometry.type;
  if (o.isInstancedMesh) return "Instanced feature set";
  if (ty === "RoundedBoxGeometry" || ty === "BoxGeometry") return "Machined plate / block";
  if (ty === "LatheGeometry") return "Turned part";
  if (ty === "CylinderGeometry") return "Cylindrical part";
  if (ty === "TubeGeometry") return "Cable / hose run";
  if (ty === "ExtrudeGeometry") return "Profiled part";
  return "Part";
}
// edge merging: static edge lines of each subsystem become one draw call
function mergeStaticEdges() {
  const dyn = new Set([gCar, gPickCar, carIn, carOut, pusher, GIN.car, GOUT.car, gHead, gAlignZ, gGraderZ, SIN.stack, SOUT.stack, travel.g, ...topQ.map((q) => q.g), ...botQ.map((q) => q.g), ...SIN.latches.f, ...SIN.latches.b, ...SOUT.latches.f, ...SOUT.latches.b]);
  root.updateMatrixWorld(true);
  let merged = 0, before = edgeLines.length;
  TREE.forEach((t) => {
    const pos = [];
    const inv = new T3.Matrix4().copy(t.g.matrixWorld).invert();
    const keep = [];
    edgeLines.forEach((e) => {
      let o = e.parent, isDyn = false, inTree = false;
      while (o) { if (dyn.has(o)) isDyn = true; if (o === t.g) { inTree = true; break; } o = o.parent; }
      if (!inTree || isDyn) return;
      const m = new T3.Matrix4().multiplyMatrices(inv, e.matrixWorld);
      const a = e.geometry.attributes.position, v = new T3.Vector3();
      for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); }
      keep.push(e);
    });
    if (!keep.length) return;
    keep.forEach((e) => { e.parent.remove(e); e.geometry.dispose(); });
    const g = new T3.BufferGeometry(); g.setAttribute("position", new T3.Float32BufferAttribute(pos, 3));
    const ls = new T3.LineSegments(g, EDGE); ls.raycast = () => {}; ls.userData.merged = true; t.g.add(ls);
    for (const e of keep) edgeLines.splice(edgeLines.indexOf(e), 1);
    edgeLines.push(ls); merged += keep.length;
  });
  return { before, after: edgeLines.length, merged };
}
// selection + hover
const ray = new T3.Raycaster();
const ptr = new T3.Vector2();
let selected = null, hoverObj = null, downAt = null;
const tip = document.createElement("div"); tip.className = "tip"; view.appendChild(tip);
function visibleChain(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, activeCam);
  if (renderer.clippingPlanes.length) ray.ray; // clipped parts are filtered below
  const hits = ray.intersectObject(root, true).filter((h) => h.object.isMesh && h.object.material !== MAT.glass && visibleChain(h.object) && (!renderer.clippingPlanes.length || renderer.clippingPlanes[0].distanceToPoint(h.point) >= 0));
  return hits.length ? hits[0].object : null;
}
function describe(o) {
  const p = o.userData.part || {};
  const b = new T3.Box3().setFromObject(o).getSize(new T3.Vector3());
  return { title: o.name || shapeName(o), sub: p.tree ? p.tree.label : "—", mat: MATNAME.get(o.material) || "—", env: `${b.x.toFixed(0)} × ${b.y.toFixed(0)} × ${b.z.toFixed(0)}`, no: p.no || "—" };
}
function showSel(o) {
  selected = o;
  outlinePass && (outlinePass.selectedObjects = o ? [o] : []);
  const el = $("#sel");
  if (!o) { el.innerHTML = `<p class="muted">Click any part in the viewport to inspect it.</p>`; return; }
  const d = describe(o);
  el.innerHTML = `<div class="sel-t">${d.title}</div><dl><dt>Part no.</dt><dd>${d.no}</dd><dt>Subsystem</dt><dd>${d.sub}</dd><dt>Material</dt><dd>${d.mat}</dd><dt>Envelope</dt><dd>${d.env} mm</dd></dl><div class="sel-b"><button id="iso-sub">Isolate subsystem</button><button id="sel-clear">Clear</button></div>`;
  $("#iso-sub").onclick = () => { const t = o.userData.part && o.userData.part.tree; if (!t) return; TREE.forEach((x) => { if (x !== t) hidden.add(x.id); else hidden.delete(x.id); }); syncTree(); applyVisibility(); };
  $("#sel-clear").onclick = () => { TREE.forEach((x) => hidden.delete(x.id)); syncTree(); applyVisibility(); showSel(null); };
}
function syncTree() { $$(".tree-row").forEach((r) => (r.querySelector("input").checked = !hidden.has(r.dataset.id))); }
// view cube (rendered in the top-right corner of the same canvas)
const cubeScene = new T3.Scene();
const cubeCam = new T3.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 20); cubeCam.up.set(0, 0, 1);
const faceTex = (label) => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); x.fillStyle = "#f3f6f7"; x.fillRect(0, 0, 128, 128); x.strokeStyle = "#0e8a86"; x.lineWidth = 6; x.strokeRect(3, 3, 122, 122); x.fillStyle = "#24343a"; x.font = "bold 24px Inter, Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(label, 64, 64); const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding; return t; };
// BoxGeometry face order: +x, -x, +y, -y, +z, -z. World front is -y (the model is mirrored in y).
const CUBE_FACES = [["RIGHT", [1, 0, 0]], ["LEFT", [-1, 0, 0]], ["BACK", [0, 1, 0]], ["FRONT", [0, -1, 0]], ["TOP", [0, 0, 1]], ["BOTTOM", [0, 0, -1]]];
const cube = new T3.Mesh(new T3.BoxGeometry(2, 2, 2), CUBE_FACES.map(([l]) => new T3.MeshBasicMaterial({ map: faceTex(l) })));
CUBE_FACES.forEach(([l], i) => { if (l === "BACK" || l === "TOP" || l === "BOTTOM") { cube.material[i].map.center.set(0.5, 0.5); } });
cube.material[2].map.rotation = Math.PI; cube.material[4].map.rotation = Math.PI; cube.material[5].map.rotation = 0;
cubeScene.add(cube);
cubeScene.add(new T3.LineSegments(new T3.EdgesGeometry(cube.geometry), new T3.LineBasicMaterial({ color: 0x0e8a86 })));
const CUBE_PX = 104, CUBE_PAD = 10;
function cubeRect() { const w = view.clientWidth; return { x: w - CUBE_PX - CUBE_PAD, y: CUBE_PAD, s: CUBE_PX }; }
function cubeHit(ev) {
  const r = renderer.domElement.getBoundingClientRect(), c = cubeRect();
  const lx = ev.clientX - r.left - c.x, ly = ev.clientY - r.top - c.y;
  if (lx < 0 || ly < 0 || lx > c.s || ly > c.s) return null;
  ray.setFromCamera(new T3.Vector2((lx / c.s) * 2 - 1, -(ly / c.s) * 2 + 1), cubeCam);
  const h = ray.intersectObject(cube)[0];
  return h ? CUBE_FACES[h.face.materialIndex] : "miss";
}
function viewDir(dir, label) {
  const dist = activeCam.position.distanceTo(controls.target);
  const t = controls.target.clone();
  const up = Math.abs(dir[2]) > 0.9 ? [0, dir[2] > 0 ? 1 : -1, 0] : [0, 0, 1];
  camAnim = { t: 0, p0: activeCam.position.clone(), t0: controls.target.clone(), p1: t.clone().add(new T3.Vector3(...dir).multiplyScalar(dist)), t1: t };
  $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", "false"));
}
// orthographic / perspective
function setOrtho(on) {
  const from = activeCam, to = on ? camOrtho : camPersp;
  if (from === to) return;
  const dist = from.position.distanceTo(controls.target);
  if (on) {
    const h = 2 * dist * Math.tan(T3.MathUtils.degToRad(camPersp.fov / 2)), a = view.clientWidth / view.clientHeight;
    Object.assign(camOrtho, { left: -h * a / 2, right: h * a / 2, top: h / 2, bottom: -h / 2, zoom: 1 });
  }
  to.position.copy(from.position); to.quaternion.copy(from.quaternion); to.updateProjectionMatrix();
  activeCam = to; camera = to; controls.object = to;
  if (renderPass) { renderPass.camera = to; saoPass.camera = to; outlinePass.renderCamera = to; }
  $("#ortho").setAttribute("aria-pressed", String(on)); $("#ortho").textContent = on ? "Orthographic" : "Perspective";
}
// section plane outline
const secOutline = new T3.LineSegments(new T3.EdgesGeometry(new T3.PlaneGeometry(3300, 1900)), new T3.LineBasicMaterial({ color: 0x0e8a86, transparent: true, opacity: 0.8 }));
secOutline.rotation.x = Math.PI / 2; secOutline.visible = false; scene.add(secOutline);
function setSectionSides(on) { scene.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.material !== MAT.glass) { o.material.side = on ? T3.DoubleSide : T3.FrontSide; o.material.needsUpdate = true; } }); }
let frames = 0, slow = 0;
function CAD_INIT() {
  registerParts();
  const st = mergeStaticEdges();
  console.info("edges merged", st);
  const w = view.clientWidth || 800, h = view.clientHeight || 600;
  const rt = new T3.WebGLRenderTarget(w, h, { samples: 4, type: T3.HalfFloatType });
  composer = new T3.EffectComposer(renderer, rt);
  renderPass = new T3.RenderPass(scene, camera);
  composer.addPass(renderPass);
  saoPass = new T3.SAOPass(scene, camera, false, true);
  Object.assign(saoPass.params, { saoBias: 0.5, saoIntensity: 0.0022, saoScale: 900, saoKernelRadius: 30, saoMinResolution: 0, saoBlur: true, saoBlurRadius: 8, saoBlurStdDev: 4, saoBlurDepthCutoff: 0.01 });
  composer.addPass(saoPass); window.__sao = saoPass;
  outlinePass = new T3.OutlinePass(new T3.Vector2(w, h), scene, camera);
  Object.assign(outlinePass, { edgeStrength: 5, edgeGlow: 0, edgeThickness: 1.4, pulsePeriod: 0 });
  outlinePass.visibleEdgeColor.set(0x0e8a86); outlinePass.hiddenEdgeColor.set(0x7fc8c5);
  composer.addPass(outlinePass);
  finalPass = new T3.ShaderPass(ACES_GAMMA);
  composer.addPass(finalPass); window.__fin = finalPass;
  cadResize();
  showSel(null);
  const cv = renderer.domElement;
  cv.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; const c = cubeHit(e); if (c && c !== "miss") { viewDir(c[1], c[0]); downAt = null; e.stopPropagation(); } }, true);
  cv.addEventListener("pointerup", (e) => { if (!downAt) return; const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null; if (moved < 4 && e.button === 0) showSel(pick(e)); });
  let hoverT = 0;
  cv.addEventListener("pointermove", (e) => {
    const now = performance.now(); if (downAt || now - hoverT < 70) return; hoverT = now;
    if (cubeHit(e)) { tip.style.display = "none"; cv.style.cursor = "pointer"; return; }
    const o = pick(e); hoverObj = o; cv.style.cursor = o ? "pointer" : "";
    if (o) { const d = describe(o); tip.textContent = `${d.title} · ${d.sub}`; const r = cv.getBoundingClientRect(); tip.style.display = ""; tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 12}px)`; } else tip.style.display = "none";
  });
  cv.addEventListener("pointerleave", () => (tip.style.display = "none"));
  $("#ortho").addEventListener("click", () => setOrtho(activeCam === camPersp));
  $("#t-ao").addEventListener("change", (e) => { aoOn = e.target.checked; saoPass.enabled = aoOn; });
  $("#section").addEventListener("input", (e) => { const on = Number(e.target.value) < 460; setSectionSides(on); secOutline.visible = on; secOutline.position.set(0, -Number(e.target.value), 1000); });
}
function cadResize() {
  const w = view.clientWidth, h = view.clientHeight;
  if (!composer || !w || !h) return;
  composer.setSize(w, h); outlinePass.setSize(w, h);
  if (activeCam === camOrtho) { const a = w / h, hh = camOrtho.top - camOrtho.bottom; camOrtho.left = -hh * a / 2; camOrtho.right = hh * a / 2; camOrtho.updateProjectionMatrix(); }
}
function renderFrame(dt) {
  // automatic quality: drop ambient occlusion if the frame rate stays low
  frames++; if (dt > 1 / 26) slow++; else slow = Math.max(0, slow - 1);
  if (slow > 90 && aoOn) { aoOn = false; saoPass.enabled = false; $("#t-ao").checked = false; $("#perf").textContent = "AO turned off to keep the frame rate up"; }
  composer.render();
  // view cube
  const c = cubeRect(), H = view.clientHeight;
  const d = activeCam.position.clone().sub(controls.target).normalize().multiplyScalar(6);
  cubeCam.position.copy(d); cubeCam.up.copy(activeCam.up); cubeCam.lookAt(0, 0, 0);
  renderer.autoClear = false; renderer.clearDepth();
  renderer.setScissorTest(true); renderer.setScissor(c.x, H - c.y - c.s, c.s, c.s); renderer.setViewport(c.x, H - c.y - c.s, c.s, c.s);
  const prevClip = renderer.clippingPlanes; renderer.clippingPlanes = [];
  renderer.render(cubeScene, cubeCam);
  renderer.clippingPlanes = prevClip;
  renderer.setScissorTest(false); renderer.setViewport(0, 0, view.clientWidth, H); renderer.autoClear = true;
}

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false); camPersp.aspect = w / h; camPersp.updateProjectionMatrix(); cadResize();
}
new ResizeObserver(resize).observe(view);
let last = 0;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
  if (!paused) advance(dt * speed);
  applyModel();
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt / 0.8); const e = ease(camAnim.t);
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
    if (camAnim.t >= 1) camAnim = null;
  } else if ($("#follow").checked) {
    const tx = S.sx * 10;
    const tgt = new T3.Vector3(tx, -S.sy * 5, 1000);
    const d = tgt.clone().sub(controls.target).multiplyScalar(0.06);
    controls.target.add(d); camera.position.add(d);
  }
  controls.update();
  renderFrame(dt);
  updateDro(); drawHmi(); placeLabels();
  requestAnimationFrame(frame);
}
// theme
const mq = matchMedia("(prefers-color-scheme: dark)");
function theme() {
  const dark = document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && mq.matches);
  scene.background = dark ? BG.dark : BG.light;
  grid.material.color && grid.material.color.setHex(dark ? 0x2c3439 : 0xd3d9dd);
}
mq.addEventListener("change", theme);
new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
theme();
// keyboard
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase();
  if (k === "a") setCfg("A"); else if (k === "b") setCfg("B");
  else if (k === "1") setSrc("fiber"); else if (k === "2") setSrc("uv"); else if (k === "3") setSrc("green");
  else if (k === " ") { $("#play").click(); e.preventDefault(); }
  else if (k === "f") goView("front"); else if (k === "t") goView("top"); else if (k === "r") goView("right"); else if (k === "i") goView("iso"); else if (k === "p") goView("process"); else if (k === "h") goView("head"); else if (k === "l") goView("loader");
});
resetState(); applyVisibility(); setSrc("fiber"); writeNote(); resize();
window.__dbg = { topQ, botQ, magCur, carIn, gLoader }; window.__sim = { S, setCfg, setSrc, goView, jumpTo, set speed(v) { speed = v; }, camera, controls };
CAD_INIT();
requestAnimationFrame(frame);

// ===================== portal bridge + realism pass (injected) =====================
(function realism() {
  const cv = (w, h, fn) => { const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h); const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; return t; };
  // orange-peel powder coat: soft blotchy noise as bump + roughness
  const peel = cv(256, 256, (x, w, h) => { x.fillStyle = "#808080"; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const r = 1 + Math.random() * 3.2, v = 110 + Math.random() * 40; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, 7); x.fill(); } });
  // brushed aluminium: fine directional streaks
  const brush = cv(512, 64, (x, w, h) => { x.fillStyle = "#8a8a8a"; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 0.5) { const v = 110 + Math.random() * 60; x.fillStyle = `rgba(${v},${v},${v},0.5)`; x.fillRect(0, y, w, 0.5); } for (let i = 0; i < 260; i++) { const v = 90 + Math.random() * 90; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 160, 0.6); } });
  for (const m of [MAT.powder, MAT.panel, MAT.wall]) if (m) { m.bumpMap = peel; m.bumpScale = 0.35; m.roughnessMap = peel; m.roughness = Math.min(1, m.roughness + 0.08); m.needsUpdate = true; }
  for (const m of [MAT.alu, MAT.aluDark, MAT.steel]) if (m) { m.roughnessMap = brush; m.bumpMap = brush; m.bumpScale = 0.12; m.needsUpdate = true; }
  if (MAT.black) { MAT.black.roughnessMap = peel; MAT.black.needsUpdate = true; }
  // factory floor: epoxy with fine aggregate, radial fade, safety tape around the footprint
  root.updateMatrixWorld(true);
  const bb = new T3.Box3().setFromObject(root);
  const epoxy = cv(512, 512, (x, w, h) => { x.fillStyle = "#b9bec1"; x.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 160 + Math.random() * 60; x.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; x.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); } x.strokeStyle = "rgba(120,126,130,0.35)"; x.lineWidth = 2; x.strokeRect(0, 0, w, h); });
  epoxy.repeat.set(9, 9); epoxy.encoding = T3.sRGBEncoding;
  const fade = cv(256, 256, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.5); g.addColorStop(0, "#fff"); g.addColorStop(1, "#000"); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  fade.wrapS = fade.wrapT = T3.ClampToEdgeWrapping;
  const fl = new T3.Mesh(new T3.PlaneGeometry(9000, 9000), new T3.MeshStandardMaterial({ map: epoxy, alphaMap: fade, transparent: true, roughness: 0.55, metalness: 0.0, depthWrite: false }));
  const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
  fl.position.set(cx, cy, -1.2); fl.receiveShadow = true; fl.renderOrder = -2; scene.add(fl);
  const tape = cv(256, 16, (x, w, h) => { x.fillStyle = "#f2c200"; x.fillRect(0, 0, w, h); x.fillStyle = "#1d1f22"; for (let i = -16; i < w; i += 32) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 16, 0); x.lineTo(i + 32, 0); x.lineTo(i + 16, h); x.fill(); } });
  tape.encoding = T3.sRGBEncoding;
  const pad = 320, x0 = bb.min.x - pad, x1 = bb.max.x + pad, y0 = bb.min.y - pad, y1 = bb.max.y + pad, tw = 50;
  const tapeMat = (len) => { const t = tape.clone(); t.needsUpdate = true; t.repeat.set(len / 400, 1); return new T3.MeshStandardMaterial({ map: t, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }); };
  for (const [ax, ay, bx, by] of [[x0, y0, x1, y0], [x0, y1, x1, y1], [x0, y0, x0, y1], [x1, y0, x1, y1]]) {
    const len = Math.hypot(bx - ax, by - ay) + tw;
    const m = new T3.Mesh(new T3.PlaneGeometry(len, tw), tapeMat(len)); m.position.set((ax + bx) / 2, (ay + by) / 2, -0.6); if (ax === bx) m.rotation.z = Math.PI / 2; m.receiveShadow = true; scene.add(m);
  }
  // crisper, better-fitted shadows
  const sz = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) * 0.75 + 400;
  Object.assign(sun.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(4096, 4096); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  sun.shadow.radius = 3; sun.shadow.normalBias = 0.6;
  if (typeof grid !== "undefined") { grid.material.transparent = true; grid.material.opacity = 0.35; }
})();

(function twinBridge() {
  const sim = window.__sim;
  sim.steps = () => (Array.isArray(STEPS) ? STEPS : STEPS[cfg]);
  const setPlay = (p) => { paused = p; const b = $("#play"); if (b) { b.textContent = p ? "Play" : "Pause"; b.setAttribute("aria-pressed", String(p)); } };
  sim.isPaused = () => paused;
  sim.start = () => { if (sim._alarm) return false; setPlay(false); return true; };
  sim.pause = () => setPlay(true);
  sim.stop = () => { setPlay(true); try { queue = []; seg = null; } catch (e) {} };
  sim.reset = () => { sim._alarm = null; resetState(); try { queue = []; seg = null; } catch (e) {} applyVisibility(); try { writeNote(); } catch (e) {} setPlay(true); };
  sim.step = (dt) => advance(dt);
  sim.setSpeed = (v) => { speed = v; };
  sim.fault = (text) => { sim._alarm = text; S.lamp = "red"; S.info = "ALARM · " + text; setPlay(true); };
  sim.clearFault = () => { sim._alarm = null; S.lamp = "green"; S.info = "Alarm acknowledged and reset — press Start to resume"; };
  sim.showOnly = (ids) => { hidden.clear(); if (ids && ids.length) TREE.forEach((t) => { if (!ids.includes(t.id)) hidden.add(t.id); }); applyVisibility(); try { syncTree(); } catch (e) {} };
  // machine envelope + maintenance access zones (concept visualisation, assumed clearances)
  const bbOf = () => { const b = new T3.Box3(); TREE.forEach((t) => { if (t.g.visible) b.expandByObject(t.g); }); return b; };
  const label = (text) => { const c = document.createElement("canvas"); c.width = 512; c.height = 64; const x = c.getContext("2d"); x.font = "600 30px Inter, Arial"; const w = x.measureText(text).width + 28; x.fillStyle = "rgba(255,255,255,0.92)"; x.fillRect(0, 6, w, 52); x.strokeStyle = "#0e8a86"; x.lineWidth = 3; x.strokeRect(0, 6, w, 52); x.fillStyle = "#0b6f6c"; x.fillText(text, 14, 42); const t = new T3.CanvasTexture(c); const s = new T3.Sprite(new T3.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(512 * 1.1, 64 * 1.1, 1); s.center.set(0, 0.5); s.renderOrder = 20; return s; };
  let envG = null, accG = null;
  sim.envelope = (on) => {
    if (envG) { scene.remove(envG); envG = null; }
    if (!on) return;
    const b = bbOf(); envG = new T3.Group();
    const box = new T3.Box3Helper(b, 0x0e8a86); box.material.depthTest = false; box.material.transparent = true; box.material.opacity = 0.9; envG.add(box);
    const s = b.getSize(new T3.Vector3());
    const l = label(`Envelope ≈ ${Math.round(s.x)} × ${Math.round(s.y)} × ${Math.round(s.z)} mm (model, not validated)`); l.position.set(b.min.x, b.min.y, b.max.z + 60); envG.add(l);
    scene.add(envG);
  };
  sim.access = (on, depth = 800) => {
    if (accG) { scene.remove(accG); accG = null; }
    if (!on) return;
    const b = bbOf(); accG = new T3.Group();
    const mat = new T3.MeshBasicMaterial({ color: 0x2f8a5b, transparent: true, opacity: 0.12, depthWrite: false });
    const edge = new T3.LineBasicMaterial({ color: 0x2f8a5b });
    const zone = (x0, y0, x1, y1, txt) => { const g = new T3.BoxGeometry(x1 - x0, y1 - y0, 1900); const m = new T3.Mesh(g, mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 950); accG.add(m); const e = new T3.LineSegments(new T3.EdgesGeometry(g), edge); e.position.copy(m.position); accG.add(e); const l = label(txt); l.position.set(x0, (y0 + y1) / 2, 1960); accG.add(l); };
    zone(b.min.x, b.min.y - depth, b.max.x, b.min.y, `Operator / maintenance access · ${depth} mm assumed`);
    zone(b.min.x, b.max.y, b.max.x, b.max.y + depth * 0.75, `Rear service access · ${Math.round(depth * 0.75)} mm assumed`);
    scene.add(accG);
  };
  // standard views from the current machine bounding box
  sim.view = (name) => {
    const b = bbOf(), c = b.getCenter(new T3.Vector3()), s = b.getSize(new T3.Vector3()), r = Math.max(s.x, s.y, s.z) * 1.9;
    const D = { front: [0, -1, 0.12], rear: [0, 1, 0.12], left: [-1, 0, 0.12], right: [1, 0, 0.12], top: [0, -0.0001, 1], iso: [-0.62, -0.95, 0.62] }[name] || [-0.62, -0.95, 0.62];
    const d = new T3.Vector3(...D).normalize();
    const cam = controls.object;
    camAnim = { t: 0, p0: cam.position.clone(), t0: controls.target.clone(), p1: c.clone().addScaledVector(d, r), t1: c };
  };
})();
(function portalBridge() {
  const sim = window.__sim || (window.__sim = {});
  sim.parts = TREE.map((t) => ({ id: t.id, label: t.label, cfg: t.cfg || null }));
  const findT = (id) => TREE.find((t) => t.id === id);
  const ensureCfg = (t) => { if (!t || !t.cfg || typeof setCfg !== "function") return; const list = [].concat(t.cfg); if (!list.includes(typeof cfg !== "undefined" ? cfg : list[0])) setCfg(list[0]); };
  const outline = (objs) => { try { outlinePass && (outlinePass.selectedObjects = objs); } catch (e) {} };
  sim.isolate = (id) => {
    const t = findT(id); hidden.clear();
    if (t) { ensureCfg(t); TREE.forEach((x) => { if (x !== t) hidden.add(x.id); }); }
    applyVisibility(); try { syncTree(); } catch (e) {}
  };
  sim.showAll = () => { hidden.clear(); applyVisibility(); try { syncTree(); } catch (e) {} outline([]); };
  sim.focus = (id) => {
    const t = findT(id); if (!t) return; ensureCfg(t);
    if (hidden.has(id)) { hidden.delete(id); applyVisibility(); try { syncTree(); } catch (e) {} }
    t.g.updateMatrixWorld(true);
    const b = new T3.Box3().setFromObject(t.g); if (b.isEmpty()) return;
    const c = b.getCenter(new T3.Vector3()), s = b.getSize(new T3.Vector3()).length();
    const cam = controls.object, dir = cam.position.clone().sub(controls.target).normalize();
    camAnim = { t: 0, p0: cam.position.clone(), t0: controls.target.clone(), p1: c.clone().addScaledVector(dir, Math.max(450, s * 1.35)), t1: c };
    outline([t.g]);
  };
  sim.highlight = (id) => { const t = findT(id); outline(t ? [t.g] : []); };
  try { window.parent && window.parent.postMessage({ type: "teal-sim-ready" }, "*"); } catch (e) {}
})();


(function buildReview(){
 const sim=window.__sim, canvas=renderer.domElement;
 const toolbar=document.createElement('div'); toolbar.style.cssText='position:absolute;left:12px;bottom:70px;z-index:20;max-width:calc(100% - 24px);display:flex;flex-wrap:wrap;gap:5px;padding:7px;background:#17272de8;color:white;border-radius:8px;font:12px Arial';
 const status=document.createElement('span'); status.style.cssText='width:100%;color:#d9e9e9';status.textContent='Concept geometry • dimensions not released';
 function button(name,fn){const b=document.createElement('button');b.textContent=name;b.style.cssText='background:#30454d;color:white;border:1px solid #60767b;border-radius:4px;padding:5px 8px;cursor:pointer';b.onclick=fn;toolbar.appendChild(b);return b;}
 const orig=new Map(); Object.values(MAT).forEach(m=>{if(m&&m.isMaterial)orig.set(m,{color:m.color?.clone(),roughness:m.roughness,metalness:m.metalness,opacity:m.opacity});});
 const oldTone=renderer.toneMapping, oldExp=renderer.toneMappingExposure, oldEdge=EDGE.opacity;
 let realistic=false;
 function style(on){realistic=on;renderer.toneMapping=on?T3.ACESFilmicToneMapping:oldTone;renderer.toneMappingExposure=on?1.27:oldExp;EDGE.opacity=on?.13:oldEdge;
 for(const [m,v] of orig){if(v.color)m.color.copy(v.color);if(v.roughness!==undefined)m.roughness=v.roughness;if(v.metalness!==undefined)m.metalness=v.metalness;m.opacity=v.opacity;m.needsUpdate=true;}
 if(on){for(const k of ['powder','panel','wall'])if(MAT[k]){MAT[k].color.setHex(k==='wall'?0xe1dfd6:0xf4f0e5);MAT[k].roughness=.46;}for(const k of ['alu','aluDark','steel'])if(MAT[k]){MAT[k].roughness=.28;MAT[k].metalness=.83;}}
 status.textContent=on?'Studio finish • eggshell white / metallic hardware (illustrative)':'CAD finish • original materials';}
 button('Studio / CAD',()=>style(!realistic));style(true);
 let measuring=false,points=[],marks=new T3.Group();scene.add(marks);const ray=new T3.Raycaster();
 function clear(){while(marks.children.length){const o=marks.children[0];marks.remove(o);o.geometry?.dispose();o.material?.dispose();}points=[];}
 button('Measure 2 points',()=>{clear();measuring=true;sim.pause();status.textContent='Click two visible model surfaces • approximate mm';});
 button('Clear measure',()=>{clear();measuring=false;status.textContent='Measurement cleared';});
 canvas.addEventListener('click',e=>{if(!measuring)return;const b=canvas.getBoundingClientRect();ray.setFromCamera(new T3.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),controls.object);const hit=ray.intersectObject(root,true).find(h=>{let o=h.object; if(!o.isMesh||o.material?.transparent)return false;while(o){if(!o.visible)return false;o=o.parent;}return true;});if(!hit)return;points.push(hit.point.clone());const dot=new T3.Mesh(new T3.SphereGeometry(8,12,8),new T3.MeshBasicMaterial({color:0xffb000,depthTest:false}));dot.position.copy(hit.point);marks.add(dot);if(points.length===2){marks.add(new T3.Line(new T3.BufferGeometry().setFromPoints(points),new T3.LineBasicMaterial({color:0xffb000,depthTest:false})));status.textContent='Approx. model distance: '+points[0].distanceTo(points[1]).toFixed(1)+' mm • not a manufacturing dimension';measuring=false;}});
 function download(n,d){const a=document.createElement('a');a.href=d;a.download=n;a.click();}
 button('PNG',()=>{renderer.render(scene,controls.object);download('TEAL-concept-view.png',canvas.toDataURL('image/png'));});
 button('Module sizes CSV',()=>{root.updateMatrixWorld(true);const rows=[['Module','X envelope mm','Y envelope mm','Z envelope mm','Status']];for(const t of TREE){if(!t.g.visible)continue;const b=new T3.Box3().setFromObject(t.g);if(b.isEmpty())continue;const s=b.getSize(new T3.Vector3());rows.push([t.label,s.x.toFixed(1),s.y.toFixed(1),s.z.toFixed(1),'Concept AABB; current pose']);}const u=URL.createObjectURL(new Blob([rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')],{type:'text/csv'}));download('TEAL-concept-envelopes.csv',u);setTimeout(()=>URL.revokeObjectURL(u),1000);});
 button('Full screen',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.().catch(()=>{status.textContent='Fullscreen unavailable';});});
 toolbar.appendChild(status);view.appendChild(toolbar);
})();

(function precisionStudio(){
 'use strict';
 const sim=window.__sim, canvas=renderer.domElement, KEY='semi';
 const byId=id=>TREE.find(t=>t.id===id)?.g;
 const skin=Object.assign(new T3.Group(),{name:'V4 visual details'}); // per-module decorations follow original transforms
 const details=[];
 function detail(id){const p=byId(id);if(!p)return null;const g=new T3.Group();g.name='Illustrative finishing details';g.userData.visualOnly=true;p.add(g);details.push(g);return g;}
 const metal=new T3.MeshStandardMaterial({color:0xa6afb5,metalness:.9,roughness:.28});
 const dark=new T3.MeshStandardMaterial({color:0x20272b,roughness:.65,metalness:.12});
 const teal=new T3.MeshStandardMaterial({color:0x087f7b,roughness:.36,metalness:.14});
 function patch(g,a,b,mat){return box(g,a,b,mat,{edges:false,shadow:false,r:.06});}
 function label(g,at,w,h,headline,sub,kind='brand',side=false){
  if(!g)return;const c=document.createElement('canvas');c.width=1024;c.height=256;const x=c.getContext('2d');
  const warn=kind==='warning';x.fillStyle=warn?'#f3c840':kind==='dark'?'#28383e':'#f5f3ec';x.fillRect(0,0,1024,256);x.strokeStyle=warn?'#252525':'#93a1a3';x.lineWidth=5;x.strokeRect(4,4,1016,248);
  x.fillStyle=warn?'#242424':kind==='dark'?'#e6f2ef':'#087f7b';x.fillRect(0,0,22,256);x.font='bold 100px Arial';x.fillText(headline,52,119);x.font='42px Arial';x.fillText(sub,55,194);
  const tex=new T3.CanvasTexture(c);tex.encoding=T3.sRGBEncoding;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const m=new T3.Mesh(new T3.PlaneGeometry(w,h),new T3.MeshBasicMaterial({map:tex,side:T3.DoubleSide,toneMapped:false}));m.rotation.x=Math.PI/2;if(side)m.rotation.z=Math.PI/2;m.position.set(...at);g.add(m);return m;
 }
 // Front-facing decals are on known existing enclosure faces, not free-floating labels.
 const specs={semi:{base:'cabinet',body:'enclosure',brand:[-16,45.25,67],wh:[19,5.4],warn:[0,44.65,85.3],ww:[28,1.7]},pcb:{base:'cabinet',body:'hood',brand:[0,82.9,73],wh:[19,3.7],warn:[-46.5,82.9,138],ww:[3.5,4.4]},fiber:{base:'baseL',body:'enclosure',brand:[-36,37.75,69],wh:[23,5.2],warn:[-65,37.9,130],ww:[6,6]},mw:{base:'base',body:'upper',brand:[0,32.78,57],wh:[24,6],warn:[0,33.05,119],ww:[16,2.5]}}[KEY];
 const baseG=detail(specs.base),bodyG=detail(specs.body);
 label(baseG,specs.brand,...specs.wh,'TEAL',({semi:'LMS · SEMICONDUCTOR',pcb:'LMS · PCB',fiber:'FLM · 25 W',mw:'MICRO WELD'})[KEY]);
 label(bodyG,specs.warn,...specs.ww,'LASER','CONCEPT GUARD','warning');
 // Add service-panel fasteners only to thin sheet-metal panels on the cabinet and enclosure.
 for(const id of [specs.base,specs.body]){
  const p=byId(id),g=detail(id);if(!p||!g)continue;
  const panels=p.children.filter(m=>m.isMesh&&[MAT.panel,MAT.powder,MAT.wall].includes(m.material));let n=0;
  for(const m of panels){if(n>=24)break;const b=m.geometry.boundingBox|| (m.geometry.computeBoundingBox(),m.geometry.boundingBox),sz=b.getSize(new T3.Vector3());if(sz.y>1.35||sz.x<12||sz.z<12)continue;
   const x0=m.position.x+b.min.x,x1=m.position.x+b.max.x,z0=m.position.z+b.min.z,z1=m.position.z+b.max.z,y=m.position.y+b.max.y;
   // Avoid putting fasteners on rear-facing panels: front panel normals point toward model +Y.
   if(y<0)continue;const inset=Math.min(1.1,sz.x/10,sz.z/10);
   for(const xx of [x0+inset,x1-inset])for(const zz of [z0+inset,z1-inset]){
    cyl(g,[xx,y+.025,zz],[0,1,0],.11,.38,metal,{edges:false,shadow:false,seg:12});
    patch(g,[xx-.18,y+.137,zz-.035],[xx+.18,y+.16,zz+.035],dark);
   }n++;
  }
 }
 // Add small terminal blocks, port bezels, ferrules and labelled service faces on existing electronics.
 function terminalRow(g,x,y,z,count,step){if(!g)return;for(let i=0;i<count;i++){
   const a=x+i*step;patch(g,[a,y,z],[a+step*.78,y+.55,z+1.05],i%5===0?teal:dark);cyl(g,[a+step*.39,y+.56,z+.52],[0,1,0],.1,.19,metal,{edges:false,shadow:false,seg:10});
 }}
 if(KEY==='pcb'){const g=detail('electronics');for(let i=0;i<5;i++){terminalRow(g,31.4,-58.95,20.4+i*9,8,1.35);label(g,[37,-58.92,24.9+i*9],7,1.15,'DRIVE '+(i+1),'I/O · CONCEPT','dark');}}
 if(KEY==='fiber'){const g=detail('ctlInside');terminalRow(g,12,14.4,110,12,1.1);label(g,[36,20.4,101],15,2.5,'FIBER SOURCE','REFERENCE MODULE','dark');}
 if(KEY==='mw'){const g=detail('bay');for(let i=0;i<5;i++)terminalRow(g,15.3,-14.9,14.3+i*9,8,1.4);label(g,[-8,-5.65,21],16,1.5,'FIBER SOURCE','REFERENCE MODULE','dark');}
 if(KEY==='semi'){const g=detail('laser');label(g,[-80,-39.8,140.5],9,2.3,'LASER','SOURCE MODULE');const u=detail('utilities');terminalRow(u,60,-48.35,114,10,2.1);}
 // Photography-style floor contact shadow and rim illumination; no external assets.
 const floorExtras=new T3.Group();scene.add(floorExtras);
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=256;const sx=shadowCanvas.getContext('2d');const radial=sx.createRadialGradient(128,128,12,128,128,126);radial.addColorStop(0,'rgba(20,30,37,.30)');radial.addColorStop(.46,'rgba(20,30,37,.19)');radial.addColorStop(1,'rgba(20,30,37,0)');sx.fillStyle=radial;sx.fillRect(0,0,256,256);
 const bb=new T3.Box3().setFromObject(root),bs=bb.getSize(new T3.Vector3()),bc=bb.getCenter(new T3.Vector3());
 const contact=new T3.Mesh(new T3.PlaneGeometry(bs.x*1.32,bs.y*1.35),new T3.MeshBasicMaterial({map:new T3.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contact.position.set(bc.x,bc.y,-.3);contact.renderOrder=-1;floorExtras.add(contact);
 const rim=new T3.DirectionalLight(0xe0edff,.75);rim.position.set(1300,2300,2800);scene.add(rim);
 const soft=new T3.DirectionalLight(0xfff3df,.35);soft.position.set(-2300,900,1700);scene.add(soft);
 const original={sun:sun.intensity,fill:fill.intensity,edge:EDGE.opacity,env:scene.environment,exposure:renderer.toneMappingExposure};
 function profile(mode){
  const photo=mode==='photo';const technical=mode==='technical';const gridOn=!photo;const ck=document.getElementById('t-grid');if(ck){ck.checked=gridOn;ck.dispatchEvent(new Event('change'));}else{grid.visible=gridOn;axesHelper.visible=gridOn;}
  const edges=document.getElementById('t-edges');if(edges){edges.checked=!photo;edges.dispatchEvent(new Event('change'));}
  rim.visible=!technical;soft.visible=!technical;floorExtras.visible=!technical;sun.intensity=photo?1.55:original.sun;fill.intensity=photo?.48:original.fill;EDGE.opacity=photo?.07:technical?.55:.22;
  renderer.toneMappingExposure=photo?1.02:technical?1:1.08;renderer.toneMapping=technical?T3.NoToneMapping:T3.ACESFilmicToneMapping;
  for(const k of ['powder','panel','wall'])if(MAT[k]){MAT[k].color.setHex(technical?0xe5e8ea:k==='wall'?0xe1ded4:0xf4f1e9);MAT[k].roughness=photo?.43:.6;MAT[k].bumpScale=photo?.065:.12;MAT[k].needsUpdate=true;}
  for(const k of ['alu','aluDark','steel'])if(MAT[k]){MAT[k].metalness=.8;MAT[k].roughness=photo?.31:.42;MAT[k].bumpScale=.035;MAT[k].needsUpdate=true;}
 }
 // Local STL reference import in world millimetres (Z up), independent from conceptual motion.
 let ref=null,refName='',refUnits=1,rawGeo=null;
 const review=document.createElement('div');review.style.cssText='position:absolute;right:12px;top:96px;width:min(340px,calc(100% - 24px));max-height:65%;overflow:auto;z-index:35;background:#14262ef5;color:#e9f1f2;border:1px solid #45616b;border-radius:10px;padding:14px;box-shadow:0 10px 32px #0004;font:12px/1.5 Arial;display:none';
 review.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px">Precision build review</b><button id="v4close">Close</button></div><p style="color:#c6d9dd">Concept geometry · NOT FOR FABRICATION. STL references are local, static and not linked to motion or BOM.</p><div class="v4label">Appearance</div><select id="v4profile"><option value="photo">Product photography</option><option value="technical">Technical CAD</option><option value="review">Engineering review</option></select><label style="display:block;margin:8px 0"><input id="v4detail" type="checkbox" checked> Illustrative finishing details</label><div class="v4label">Module review</div><select id="v4module"></select><div style="display:flex;gap:5px;margin:7px 0"><button id="v4focus">Focus</button><button id="v4isolate">Isolate</button><button id="v4all">Show all</button></div><div id="v4bounds" style="color:#a8ded9"></div><hr><div class="v4label">Import actual reference mesh (STL)</div><input id="v4file" type="file" accept=".stl"><label>Source unit <select id="v4units"><option value="1">mm</option><option value="10">cm</option><option value="25.4">inch</option><option value="1000">m</option></select></label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:8px 0">${['X','Y','Z'].map(k=>`<label>${k} offset mm<input id="v4${k}" type="number" value="0" step="10" style="width:100%;box-sizing:border-box"></label>`).join('')}</div><label>Yaw (deg) <input type="number" id="v4yaw" value="0" step="15" style="width:70px"></label><label style="display:block"><input type="checkbox" id="v4ghost"> Transparent reference</label><div style="display:flex;flex-wrap:wrap;gap:5px;margin:7px 0"><button id="v4fit">Fit reference</button><button id="v4remove">Remove</button><button id="v4check">Envelope screen</button></div><div id="v4result" style="white-space:pre-wrap;color:#a8ded9">No reference imported.</div><hr><button id="v4export">Export review JSON</button><p style="font-size:11px;color:#d2b980">Bounding-box screening is conservative; it is not a collision, tolerance, or safety validation.</p>`;
 const style=document.createElement('style');style.textContent='.v4label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#a6c8ce;margin:10px 0 4px}#v4review button,#v4review select,#v4review input[type=number]{background:#293e47;color:#eef5f5;border:1px solid #57717a;border-radius:4px;padding:5px;font:12px Arial}#v4review select{max-width:100%}#v4review hr{border:0;border-top:1px solid #42616a;margin:12px 0}';document.head.append(style);review.id='v4review';view.append(review);
 const q=id=>review.querySelector('#v4'+id),result=t=>q('result').textContent=t;
 for(const t of TREE){const o=document.createElement('option');o.value=t.id;o.textContent=t.label;q('module').append(o);}
 function visible(o){for(let x=o;x;x=x.parent)if(!x.visible)return false;return true;}
 function bounds(o){o.updateWorldMatrix(true,true);const b=new T3.Box3();o.traverse(m=>{if(!m.isMesh||!visible(m))return;for(let a=m;a&&a!==o;a=a.parent)if(a.userData.visualOnly)return;const g=m.geometry;if(!g.boundingBox)g.computeBoundingBox();b.union(g.boundingBox.clone().applyMatrix4(m.matrixWorld));});return b;}
 const fmt=b=>b.isEmpty()?'Not visible':b.getSize(new T3.Vector3()).toArray().map(x=>x.toFixed(1)).join(' × ')+' mm';
 function showBounds(){const g=byId(q('module').value);q('bounds').textContent='Current-pose AABB: '+fmt(bounds(g))+' · approximate';}
 q('module').onchange=showBounds;q('focus').onclick=()=>{sim.focus(q('module').value);showBounds()};q('isolate').onclick=()=>{sim.isolate(q('module').value);showBounds()};q('all').onclick=()=>{sim.showAll();showBounds()};q('profile').onchange=()=>profile(q('profile').value);q('detail').onchange=()=>details.forEach(g=>g.visible=q('detail').checked);q('close').onclick=()=>review.style.display='none';
 function remove(){if(ref){scene.remove(ref);ref.geometry.dispose();ref.material.dispose();ref=null;}rawGeo=null;refName='';q('file').value='';result('No reference imported.');}
 function transform(){if(!ref)return;refUnits=Number(q('units').value);ref.scale.setScalar(refUnits);ref.position.set(...['X','Y','Z'].map(k=>Number(q(k).value)||0));ref.rotation.z=(Number(q('yaw').value)||0)*Math.PI/180;ref.material.transparent=q('ghost').checked;ref.material.opacity=q('ghost').checked?.36:1;ref.material.depthWrite=!q('ghost').checked;ref.material.needsUpdate=true;ref.updateMatrixWorld(true);result(refName+'\nReference AABB: '+fmt(bounds(ref))+'\nWorld coordinates: mm, Z up.');}
 for(const k of ['units','X','Y','Z','yaw','ghost'])q(k).oninput=transform;
 function parseSTL(buf){const v=new DataView(buf),n=buf.byteLength>=84?v.getUint32(80,true):0;let arr;if(n>0&&84+n*50===buf.byteLength){if(n>500000)throw Error('Limit: 500,000 triangles');arr=new Float32Array(n*9);for(let i=0;i<n;i++)for(let j=0;j<9;j++)arr[i*9+j]=v.getFloat32(84+i*50+12+j*4,true);}else{const s=new TextDecoder().decode(buf),a=[];const re=/\bvertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;let m;while((m=re.exec(s))){a.push(+m[1],+m[2],+m[3]);if(a.length>4500000)throw Error('Limit: 500,000 triangles');}if(!a.length||a.length%9)throw Error('Invalid STL geometry');arr=new Float32Array(a);}if(!arr.every(Number.isFinite))throw Error('Non-finite coordinates');const g=new T3.BufferGeometry();g.setAttribute('position',new T3.BufferAttribute(arr,3));g.computeVertexNormals();g.computeBoundingBox();return g;}
 q('file').onchange=async()=>{const f=q('file').files[0];if(!f)return;try{if(f.size>45*1024*1024)throw Error('45 MB file limit');const geo=parseSTL(await f.arrayBuffer());if(ref){scene.remove(ref);ref.geometry.dispose();ref.material.dispose();}rawGeo=geo;refName=f.name;ref=new T3.Mesh(geo,new T3.MeshStandardMaterial({color:0x4ca7b1,roughness:.4,metalness:.35,side:T3.DoubleSide}));ref.castShadow=true;ref.receiveShadow=true;scene.add(ref);transform();}catch(e){result('Import failed: '+e.message);}};
 q('remove').onclick=remove;q('fit').onclick=()=>{if(!ref)return;const b=bounds(ref),c=b.getCenter(new T3.Vector3()),size=b.getSize(new T3.Vector3()).length();const cam=controls.object,d=cam.position.clone().sub(controls.target).normalize();camAnim={t:0,p0:cam.position.clone(),t0:controls.target.clone(),p1:c.clone().addScaledVector(d,Math.max(100,size*1.5)),t1:c};};
 function screen(){if(!ref)return null;const b=bounds(ref),hits=TREE.filter(t=>visible(t.g)).map(t=>({id:t.id,label:t.label,box:bounds(t.g)})).filter(t=>!t.box.isEmpty()&&b.intersectsBox(t.box));return hits.map(t=>({id:t.id,label:t.label}));}
 q('check').onclick=()=>{const h=screen();if(h===null){result('Import a reference mesh first.');return;}result((h.length?'Potential AABB overlaps:\n'+h.map(x=>'• '+x.label).join('\n'):'No AABB overlap with visible concept modules at this pose.')+'\nNot a collision or clearance certification.');};
 q('export').onclick=()=>{const d={platform:KEY,revision:'V5',timestamp:new Date().toISOString(),status:'CONCEPT — NOT FOR FABRICATION',modules:TREE.filter(t=>visible(t.g)).map(t=>({id:t.id,label:t.label,approximateAABBmm:fmt(bounds(t.g))})),reference:ref?{file:refName,unitsToMm:refUnits,offsetMm:ref.position.toArray(),yawDegrees:ref.rotation.z*180/Math.PI,worldAABBmm:fmt(bounds(ref)),possibleOverlap:screen()}:null};const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));a.href=u;a.download='TEAL-'+KEY+'-build-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 const launch=document.createElement('button');launch.textContent='Precision review · V5';launch.style.cssText='position:absolute;right:12px;top:65px;z-index:31;background:#086f6b;color:#fff;border:1px solid #78b9b6;border-radius:6px;padding:8px 12px;font:bold 12px Arial;cursor:pointer';launch.onclick=()=>{review.style.display=review.style.display==='none'?'block':'none';showBounds();};view.append(launch);
 profile('photo');sim.precisionReview={parseSTL,screen,profile,showBounds};
})();
(function conceptDFM(){
 const sim=window.__sim,cv=renderer.domElement,overlay=new T3.Group();scene.add(overlay);overlay.name='Concept DFM review overlays';
 const host=document.createElement('div');host.style.cssText='position:absolute;left:12px;top:104px;width:min(350px,calc(100% - 24px));max-height:68%;overflow:auto;z-index:36;background:#14262ef5;color:#edf4f5;padding:12px;border:1px solid #53737c;border-radius:9px;display:none;font:12px/1.5 Arial';
 host.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px">Concept 3D DFM</b><button data-d="close">Close</button></div><p>Paused-pose envelope screening, not collision certification or fabrication dimensions.</p><label>Primary module <select data-d="a"></select></label><label>Comparison module <select data-d="b"></select></label><div class="d6row"><button data-d="focus">Focus</button><button data-d="iso">Isolate</button><button data-d="all">Show all</button><button data-d="pick">Pick in 3D</button></div><label><input type="checkbox" data-d="boxes" checked> Module bounding envelopes</label><label>Required clearance (mm) <input data-d="gap" type="number" min="0" value="50"></label><label>Service zone side <select data-d="side"><option value="front">Front (world −Y)</option><option value="rear">Rear (+Y)</option><option value="left">Left (−X)</option><option value="right">Right (+X)</option></select></label><label>Service zone depth (mm) <input data-d="depth" type="number" min="0" value="600"></label><label><input type="checkbox" data-d="service"> Show conceptual access zone</label><label>Section axis <select data-d="axis"><option value="off">Off</option><option>X</option><option>Y</option><option>Z</option></select></label><label>Section position <input data-d="cut" type="range" min="0" max="100" value="50"></label><div class="d6row"><button data-d="scan">Refresh geometry</button><button data-d="clear">Clear overlays</button><button data-d="export">Export DFM JSON</button><button data-d="bom">Detailed BOM</button></div><pre data-d="result" style="white-space:pre-wrap;margin:8px 0 0;color:#d8eeee"></pre>`;
 const css=document.createElement('style');css.textContent='.d6row{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}#dfm6panel label{display:block;margin:5px 0}#dfm6panel select,#dfm6panel input[type=number],#dfm6panel button{background:#29414b;color:#fff;border:1px solid #597681;border-radius:4px;padding:5px;max-width:100%;font:12px Arial}#dfm6panel select{display:block;width:100%}#dfm6panel input[type=number]{width:90px}';document.head.append(css);host.id='dfm6panel';view.append(host);
 const q=k=>host.querySelector('[data-d="'+k+'"]');const t=id=>TREE.find(v=>v.id===id);for(const item of TREE){for(const k of ['a','b']){const o=document.createElement('option');o.value=item.id;o.textContent=item.label;q(k).append(o)}}q('b').selectedIndex=Math.min(1,TREE.length-1);
 const origClip=()=>renderer.clippingPlanes.slice();let savedClip=null,picking=false,last=null;
 function visible(o){for(let a=o;a;a=a.parent)if(!a.visible)return false;return true}
 function bbox(g){const b=new T3.Box3();if(!g)return b;g.updateWorldMatrix(true,true);g.traverse(o=>{if(!o.isMesh||!visible(o))return;for(let a=o;a&&a!==g;a=a.parent)if(a.userData.visualOnly)return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});return b}
 function clean(){while(overlay.children.length){const o=overlay.children[0];overlay.remove(o);o.geometry?.dispose();o.material?.dispose();}}
 function draw(b,color){if(b.isEmpty())return;const h=new T3.Box3Helper(b,color);h.material.depthTest=false;h.renderOrder=99;overlay.add(h)}
 const v3=v=>v.toArray().map(n=>Math.round(n*10)/10);const info=b=>b.isEmpty()?null:{min:v3(b.min),max:v3(b.max),size:v3(b.getSize(new T3.Vector3()))};
 function scan(){sim.pause();clean();const a=bbox(t(q('a').value)?.g),b=bbox(t(q('b').value)?.g),whole=new T3.Box3();for(const u of TREE)whole.union(bbox(u.g));const threshold=Math.max(0,Number(q('gap').value)||0);let distance=null,overlap=false;if(!a.isEmpty()&&!b.isEmpty()&&q('a').value!==q('b').value){const sep=['x','y','z'].map(k=>Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k]));distance=Math.hypot(...sep);overlap=a.intersectsBox(b)}if(q('boxes').checked){draw(a,0x36c4cb);draw(b,overlap||distance!==null&&distance<threshold?0xf3a54b:0x8bd778)}let zone=null;if(q('service').checked&&!whole.isEmpty()){const z=whole.clone(),d=Math.max(0,Number(q('depth').value)||0),side=q('side').value;z.min.z=0;z.max.z=Math.max(0,whole.max.z);if(side==='front'){z.max.y=whole.min.y;z.min.y=z.max.y-d}else if(side==='rear'){z.min.y=whole.max.y;z.max.y=z.min.y+d}else if(side==='left'){z.max.x=whole.min.x;z.min.x=z.max.x-d}else{z.min.x=whole.max.x;z.max.x=z.min.x+d}draw(z,0x51a6ef);zone=info(z)}
 last={status:'CONCEPT / NOT FOR FABRICATION',platform:"semi",configuration:typeof cfg==='undefined'?'standalone':cfg,primary:{id:q('a').value,...info(a)},secondary:{id:q('b').value,...info(b)},visibleEnvelope:info(whole),aabbDistanceMm:distance,overlap,requiredClearanceMm:threshold,serviceZone:zone,section:q('axis').value,sectionPositionPercent:Number(q('cut').value),source:typeof src==='undefined'?null:src,notes:'Current visible pose; AABB overlap may be intentional. Hidden geometry excluded. No motion sweep, safety or tolerance certification.'};
 q('result').textContent='PRIMARY: '+(info(a)?.size.join(' × ')||'Not visible')+' mm\nSECONDARY: '+(info(b)?.size.join(' × ')||'Not visible')+' mm\nVISIBLE ENVELOPE: '+(info(whole)?.size.join(' × ')||'—')+' mm\n'+(distance===null?'Select two distinct visible modules.':overlap?'REVIEW — AABB overlap (may be intentional).':distance<threshold?'REVIEW — bounding-box gap '+distance.toFixed(1)+' mm below target.':'Bounding-box gap '+distance.toFixed(1)+' mm; not a validated clearance.')+'\nCyan: primary · green/amber: comparison · blue: service zone.';return last}
 function section(){if(q('axis').value==='off'){if(savedClip!==null){renderer.clippingPlanes=savedClip;savedClip=null}return}const b=bbox(root);if(b.isEmpty())return;if(savedClip===null)savedClip=origClip();const axis=q('axis').value.toLowerCase(),n=new T3.Vector3();n[axis]=-1;const pos=b.min[axis]+(b.max[axis]-b.min[axis])*Number(q('cut').value)/100;renderer.clippingPlanes=[new T3.Plane(n,pos)];}
 function close(){clean();picking=false;q('axis').value='off';section();host.style.display='none'}
 q('focus').onclick=()=>{sim.focus(q('a').value);scan()};q('iso').onclick=()=>{sim.isolate(q('a').value);scan()};q('all').onclick=()=>{sim.showAll();scan()};q('pick').onclick=()=>{picking=true;q('result').textContent='Click a visible component in the viewport.'};cv.addEventListener('click',e=>{if(!picking)return;const r=cv.getBoundingClientRect(),ray=new T3.Raycaster();ray.setFromCamera(new T3.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),controls.object);const h=ray.intersectObject(root,true).find(x=>x.object.isMesh&&visible(x.object)&&!x.object.material?.transparent&&renderer.clippingPlanes.every(p=>p.distanceToPoint(x.point)>=0));if(h){let o=h.object;while(o){const u=TREE.find(x=>x.g===o);if(u){q('a').value=u.id;picking=false;sim.highlight(u.id);scan();break}o=o.parent}}});
 for(const k of ['a','b','boxes','gap','side','depth','service'])q(k).onchange=scan;q('axis').onchange=section;q('cut').oninput=section;q('scan').onclick=scan;q('clear').onclick=()=>{clean();q('result').textContent='Overlays cleared. Refresh geometry to recalculate.'};q('close').onclick=close;q('export').onclick=()=>{const d=scan(),u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='TEAL-concept-3D-DFM.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};q('bom').onclick=()=>{try{window.parent.tealOpenDetailedBOM(q('a').value,typeof cfg==='undefined'?null:cfg,typeof src==='undefined'?null:src)}catch(e){q('result').textContent='Open Detailed BOM from Engineering Studio.'}};
 function open(){host.style.display='block';scan()}const launch=document.createElement('button');launch.textContent='Concept 3D DFM · V6';launch.style.cssText='position:absolute;right:12px;top:98px;z-index:32;background:#0e7773;color:white;border:1px solid #83c5c1;border-radius:6px;padding:7px 10px;font:bold 12px Arial;cursor:pointer';launch.onclick=()=>host.style.display==='none'?open():close();view.append(launch);sim.conceptDFM={open,scan,close};
})();


})();
}
