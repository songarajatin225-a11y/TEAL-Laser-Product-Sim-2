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



// ---------------- model constants: TEAL dual-head CO2 PCB marker (inline, SMEMA) ----------------
// Envelope benchmarked to the LCB20C class: 1020 (flow) x 1650 (depth) x 1550 mm body, rail height 900 mm,
// conveyor in three sections 230 / 510 / 230 mm, PCB 50x50 to 510x460 mm. All TEAL values are concept, TBD.
const XH = 51, YH = 82.5;               // half length (flow) and half depth of the body
const RAIL_Y = 24;                       // inner face of the fixed (front) rail
const BELT_Z = 89.6;                     // belt top = board bottom (rail height 900 mm, scaled 896 to belt)
const SECT = [[-48.5, -25.5], [-25.5, 25.5], [25.5, 48.5]];
const PRESETS = {
  P1: { name: "Panel 300 × 200 mm", L: 30, W: 20, t: 0.16, cols: 3, rows: 2, fz: 0 },
  P2: { name: "Panel 450 × 350 mm", L: 45, W: 35, t: 0.20, cols: 4, rows: 3, fz: 0.04 },
};
const UPPER = { lensDx: 11, camDx: 18, lensZ: 101, rails: [36, -30] };
const LOWER = { lensDx: 11, camDx: 18, lensZ: 81 };
const MARK_T = 0.35;                     // s per code (vendor class figure: 0.3-0.4 s)

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
camera.position.set(-2300, -3600, 2500);
const controls = new T3.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 900);
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
axesHelper.position.set(-1300, -950, 1);
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
//                     MODEL: TEAL dual-head CO2 PCB marker
// =====================================================================
const MATX = {
  solder: std(0x1f6b45, 0.42, 0.05),          // green solder mask
  solderB: std(0x1b5e3d, 0.45, 0.05),
  silk: std(0xf2f2ee, 0.6, 0),
  copperPad: std(0xd9a65c, 0.3, 0.9),
  ic: std(0x1b1c1f, 0.5, 0.05),
  cap: std(0xb79a6c, 0.5, 0.1),
  frameTube: std(0xc9ced3, 0.35, 0.7),
  windowFrame: std(0x23262a, 0.5, 0.3),
  belt: std(0x2d3034, 0.8, 0),
  synrad: std(0x8f969c, 0.35, 0.6),
  fins: std(0x6b7378, 0.4, 0.7),
};
// ---------- base frame, cabinet, hood ----------
const gCab = G("cabinet");
for (const [x, y] of [[-46, -77], [46, -77], [-46, 77], [46, 77]]) { cylZ(gCab, x, y, 0, 1.4, 3.6, MAT.black); cylZ(gCab, x, y, 1.4, 6, 1, MAT.steel, { edges: false }); cyl(gCab, [x + 4, y, 2.2], [0, 1, 0], 1.6, 2.2, MAT.black, { seg: 18 }); }
box(gCab, [-XH, -YH, 6], [XH, YH, 8], MAT.aluDark);
// lower cabinet panels
box(gCab, [-XH, -YH, 8], [XH, -YH + 1, 80], MAT.powder);                     // back
for (const s of [-1, 1]) box(gCab, [s > 0 ? XH - 1 : -XH, -YH + 1, 8], [s > 0 ? XH : -XH + 1, YH - 1, 80], MAT.powder); // sides
// front lower doors (operator side, +y)
[[-49, 0.5], [0.5, 49]].forEach(([x0, x1]) => {
  box(gCab, [x0, YH - 1, 9], [x1, YH, 79], MAT.panel);
  box(gCab, [x0 + 3, YH, 52], [x0 + 4.4, YH + 1.2, 62], MAT.black);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) cyl(gCab, [x0 + 8 + c * 3.4, YH, 16 + r * 2.4], [0, 1, 0], 0.05, 0.5, MAT.black, { edges: false, shadow: false, seg: 8 });
  for (const z of [14, 74]) cyl(gCab, [x1 - 0.8, YH, z], [0, 0, 1], 3, 0.5, MAT.steel, { seg: 12 });
});
box(gCab, [-XH, YH - 1, 79], [XH, YH, 80.4], MAT.teal, { edges: false });
box(gCab, [-10, YH, 71], [10, YH + 0.3, 75], MAT.aluDark);
// upper hood
const gHood = G("hood");
box(gHood, [-XH, -YH, 80.4], [XH, -YH + 1, 150], MAT.powder);                // back panel
for (const s of [-1, 1]) {                                                   // side panels with SMEMA board opening
  const x0 = s > 0 ? XH - 1 : -XH, x1 = s > 0 ? XH : -XH + 1;
  box(gHood, [x0, -YH + 1, 80.4], [x1, -30, 150], MAT.powder);
  box(gHood, [x0, 30, 80.4], [x1, YH - 1, 150], MAT.powder);
  box(gHood, [x0, -30, 80.4], [x1, 30, 82.5], MAT.powder);
  box(gHood, [x0, -30, 97], [x1, 30, 150], MAT.powder);
  for (const [a, b] of [[[x0 - 0.3 * s, -30.6, 82.5], [x1 + 0.3 * s, -30, 97]], [[x0 - 0.3 * s, 30, 82.5], [x1 + 0.3 * s, 30.6, 97]], [[x0 - 0.3 * s, -30.6, 97], [x1 + 0.3 * s, 30.6, 97.6]]]) box(gHood, a.map((v, i) => (i === 0 ? Math.min(a[0], b[0]) : v)), b.map((v, i) => (i === 0 ? Math.max(a[0], b[0]) : v)), MAT.black, { edges: false });
}
// front: operator column, window frame, glass, nameplate
box(gHood, [-XH, YH - 1, 80.4], [-42, YH, 150], MAT.panel);
box(gHood, [42, YH - 1, 80.4], [XH, YH, 150], MAT.panel);
box(gHood, [-42, YH - 1, 80.4], [42, YH, 90], MAT.panel);
box(gHood, [-42, YH - 1, 146], [42, YH, 150], MAT.panel);
for (const [a, b] of [[[-42, YH - 1.2, 90], [42, YH + 0.4, 92]], [[-42, YH - 1.2, 144], [42, YH + 0.4, 146]], [[-42, YH - 1.2, 92], [-40, YH + 0.4, 144]], [[40, YH - 1.2, 92], [42, YH + 0.4, 144]]]) box(gHood, a, b, MATX.windowFrame);
{
  const glass = new T3.Mesh(new T3.PlaneGeometry(80, 52), MAT.glass); glass.rotation.x = Math.PI / 2; glass.position.set(0, YH - 0.5, 118); glass.renderOrder = 10; gHood.add(glass);
  box(gHood, [-38.5, YH + 0.4, 112], [-37.2, YH + 2.2, 124], MAT.alu);
  const c = document.createElement("canvas"); c.width = 512; c.height = 64; const x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, 512, 64); x.fillStyle = "#0e8a86"; x.font = "bold 38px Inter, Arial"; x.fillText("TEAL", 14, 46); x.fillStyle = "#3a4348"; x.font = "24px Inter, Arial"; x.fillText("LMS-PCB · dual-head CO₂", 132, 44);
  const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding;
  const plate = new T3.Mesh(new T3.PlaneGeometry(32, 4), new T3.MeshBasicMaterial({ map: t })); plate.rotation.x = Math.PI / 2; plate.scale.x = -1; plate.position.set(-20, YH + 0.05, 148); plate.rotation.y = Math.PI; gHood.add(plate);
}
// operator buttons on the left front column
lathe(gHood, [-46.5, YH, 138], [0, 1, 0], [[0, 0], [0, 1.6], [0.8, 1.6], [0.8, 1.0], [1.6, 1.0], [2.1, 1.7], [2.3, 0]], MAT.red);
box(gHood, [-48.4, YH, 135.6], [-44.6, YH + 0.3, 140.4], MAT.yellow, { edges: false });
[[0x36c46b, 128], [0xe5484d, 122], [0x0e8a86, 116]].forEach(([c, z]) => cyl(gHood, [-46.5, YH, z], [0, 1, 0], 0.9, 1.2, std(c, 0.4, 0), { seg: 18 }));
cyl(gHood, [-46.5, YH, 108], [0, 1, 0], 0.8, 1.0, MAT.steel, { seg: 18 });
// roof, exhaust port, stack light
box(gHood, [-XH, -YH, 150], [XH, YH, 153], MAT.powder);
cylZ(gHood, -20, -50, 153, 158, 6, MAT.aluDark);
cylZ(gHood, 40, 40, 153, 154.4, 2.6, MAT.aluDark); cylZ(gHood, 40, 40, 154.4, 166, 0.8, MAT.alu);
const lampG = cylZ(gHood, 40, 40, 166, 169, 2.1, MAT.lampG);
const lampA = cylZ(gHood, 40, 40, 169, 172, 2.1, MAT.lampA);
const lampR = cylZ(gHood, 40, 40, 172, 175, 2.1, MAT.lampR);
cylZ(gHood, 40, 40, 175, 176.4, 2.2, MAT.black);
// internal frame (square tubes) seen through the window
const gFrame = G("frame");
for (const [x, y] of [[-48, -79.5], [46, -79.5], [-48, 41], [46, 41]]) box(gFrame, [x, y, 8], [x + 2, y + 2, 150], MATX.frameTube);
for (const z of [78, 122]) { box(gFrame, [-48, -79.5, z], [48, -77.5, z + 2], MATX.frameTube); box(gFrame, [-48, 41, z], [48, 43, z + 2], MATX.frameTube); for (const x of [-48, 46]) box(gFrame, [x, -77.5, z], [x + 2, 41, z + 2], MATX.frameTube); }
box(gFrame, [-48, -77.5, 79.6], [48, -40, 80.4], MAT.alu);                  // electronics deck plate (rear)
// ---------- electronics in the lower bay ----------
const gElec = G("electronics");
box(gElec, [-40, -70, 8], [-8, -46, 30], MAT.black);                                         // industrial PC
for (let i = 0; i < 4; i++) box(gElec, [-38 + i * 7, -46, 26], [-33 + i * 7, -45.8, 28], MAT.aluDark, { edges: false });
box(gElec, [0, -72, 8], [26, -52, 26], MAT.powder);                                          // 48 V DC supply for the CO2 sources
for (let i = 0; i < 8; i++) box(gElec, [2 + i * 3, -52, 12], [3.4 + i * 3, -51.8, 22], MAT.black, { edges: false, shadow: false });
box(gElec, [30, -77, 10], [44, -60, 70], MAT.panel);                                         // servo / PLC panel
for (let i = 0; i < 5; i++) box(gElec, [31, -60, 20 + i * 9], [43, -59, 26 + i * 9], MAT.black);
// ---------- conveyor: fixed front rail, mobile rail, 3 belt sections, width adjust ----------
const gConv = G("conveyor");
function railBody(parent, yInner, side) {
  // side +1: rail sits at y >= yInner (fixed, front); -1: rail sits at y <= yInner (mobile, back)
  const y0 = side > 0 ? yInner : yInner - 1.6, y1 = side > 0 ? yInner + 1.6 : yInner;
  box(parent, [-48.5, y0, 83], [48.5, y1, 90], MAT.alu);
  box(parent, [-48.5, side > 0 ? yInner - 0.45 : yInner, 90], [48.5, side > 0 ? yInner + 1.6 : yInner + 0.45, 90.6], MAT.alu); // top lip over the board edge
  SECT.forEach(([a, b]) => {
    box(parent, [a + 0.6, side > 0 ? yInner - 0.6 : yInner, 88.9], [b - 0.6, side > 0 ? yInner : yInner + 0.6, BELT_Z], MATX.belt, { edges: false });
    for (const x of [a + 0.8, b - 0.8]) cyl(parent, [x, side > 0 ? yInner - 0.6 : yInner, 88.6], [0, 1, 0], 0.6, 0.7, MAT.steel, { seg: 14, edges: false });
    box(parent, [b - 3, side > 0 ? yInner + 1.6 : yInner - 3.4, 84], [b - 0.5, side > 0 ? yInner + 3.4 : yInner - 1.6, 88], MAT.black);   // section drive motor
  });
  for (const x of [-48.5, 48.5]) box(parent, [x - 0.4, y0 - 0.5, 81], [x + 0.4, y1 + 0.5, 83], MAT.aluDark);
}
railBody(gConv, RAIL_Y, 1);
const gMob = G("mobileRail", gConv);
railBody(gMob, RAIL_Y - PRESETS.P1.W, -1);
// width adjust: lead screws, guides and motor
for (const x of [-49.6, 49.6]) {
  cyl(gConv, [x, 26, 81.8], [0, -1, 0], 58, 0.5, MAT.steel, { edges: false, seg: 12 });
  box(gConv, [x - 1.2, -33, 79.6], [x + 1.2, 27, 80.6], MAT.aluDark);
  box(gConv, [x - 1.2, 25.6, 79.6], [x + 1.2, 27.4, 83], MAT.alu);
}
box(gConv, [-3, -36, 77], [3, -30, 83], MAT.black);
box(gConv, [-49.6, -33.6, 81.2], [49.6, -32.8, 82.4], MAT.rubber, { edges: false });
box(gConv, [-50.4, -34, 76], [50.4, -32, 79.6], MAT.aluDark);
// rail-mounted stoppers (standby + processing) and clamp bars (pressing plate)
const stopProc = box(gConv, [0, RAIL_Y - 1, 88.9], [1, RAIL_Y, 90], MAT.teal); stopProc.userData.y0 = stopProc.position.y;
const stopStby = box(gConv, [-26.5, RAIL_Y - 1, 88.9], [-25.5, RAIL_Y, 90], MAT.teal); stopStby.userData.y0 = stopStby.position.y;
const clampF = box(gConv, [-24.5, RAIL_Y - 1.4, 87.6], [24.5, RAIL_Y - 0.6, 88.8], MAT.teal);
const clampM = box(gMob, [-24.5, RAIL_Y - PRESETS.P1.W + 0.6, 87.6], [24.5, RAIL_Y - PRESETS.P1.W + 1.4, 88.8], MAT.teal);
// board sensors at section ends
for (const x of [-26.5, 24.5, 47.5]) box(gConv, [x, RAIL_Y + 1.6, 86], [x + 1, RAIL_Y + 2.6, 88], MAT.black);

// ---------- PCB panel builder ----------
function codeTex(seed, dark = "#f2f6f1") {
  const c = document.createElement("canvas"); c.width = c.height = 96; const x = c.getContext("2d");
  x.clearRect(0, 0, 96, 96); x.fillStyle = dark;
  const n = 14, s = 6;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const finder = i === 0 || j === n - 1, clock = (j === 0 && i % 2 === 0) || (i === n - 1 && j % 2 === 1);
    if (finder || clock || ((i * 11 + j * 7 + seed * 5 + i * j) % 7) < 3) x.fillRect(6 + i * s, 6 + j * s, s, s);
  }
  const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding; t.anisotropy = 8; return t;
}
const CODE_MAT = { co2: new T3.MeshBasicMaterial({ map: codeTex(1, "#eef3ec"), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), uv: new T3.MeshBasicMaterial({ map: codeTex(1, "#ffffff"), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }) };
let codeMat = CODE_MAT.co2;
function codesOf(P) {
  const top = [], bot = [];
  const px = (P.L - 2.4) / P.cols, py = (P.W - 2.4) / P.rows;
  for (let r = 0; r < P.rows; r++) for (let c = 0; c < P.cols; c++) {
    const cx = -P.L / 2 + 1.2 + px * (c + 0.5), cy = -P.W / 2 + 1.2 + py * (r + 0.5);
    top.push([cx - px * 0.28, cy + py * 0.24]); bot.push([cx + px * 0.25, cy - py * 0.22]);
  }
  top.push([P.L / 2 - 2.6, -P.W / 2 + 0.6]); // panel code on the breakaway rail
  return { top, bot, px, py };
}
function makeBoard(P) {
  const g = new T3.Group();
  const { top, bot, px, py } = codesOf(P);
  addMesh(g, new T3.BoxGeometry(P.L, P.W, P.t), MATX.solder, { edges: true }).position.z = P.t / 2;
  // v-score lines and breakaway rails (silk), fiducials, tooling holes
  const T = P.t;
  for (let c = 1; c < P.cols; c++) box(g, [-P.L / 2 + 1.2 + px * c - 0.04, -P.W / 2 + 1.2, T], [-P.L / 2 + 1.2 + px * c + 0.04, P.W / 2 - 1.2, T + 0.01], MATX.solderB, { edges: false, shadow: false });
  for (let r = 1; r < P.rows; r++) box(g, [-P.L / 2 + 1.2, -P.W / 2 + 1.2 + py * r - 0.04, T], [P.L / 2 - 1.2, -P.W / 2 + 1.2 + py * r + 0.04, T + 0.01], MATX.solderB, { edges: false, shadow: false });
  const fids = [[-P.L / 2 + 0.6, P.W / 2 - 0.6], [P.L / 2 - 0.6, -P.W / 2 + 2.2], [-P.L / 2 + 0.6, -P.W / 2 + 0.6]];
  const fidMats = fids.map(() => std(0xd9a65c, 0.3, 0.9, { emissive: 0x0e8a86, emissiveIntensity: 0 }));
  fids.forEach(([x, y], i) => { cylZ(g, x, y, T, T + 0.02, 0.18, fidMats[i], { edges: false, seg: 16 }); cylZ(g, x, y, -0.02, 0, 0.18, fidMats[i], { edges: false, seg: 16 }); });
  for (const [x, y] of [[-P.L / 2 + 0.6, 0], [P.L / 2 - 0.6, 0]]) cylZ(g, x, y, -0.005, T + 0.005, 0.2, MAT.black, { edges: false, seg: 14 });
  // components per sub-board (top: BGA/QFP, passives, connector; bottom: passives only)
  for (let r = 0; r < P.rows; r++) for (let c = 0; c < P.cols; c++) {
    const cx = -P.L / 2 + 1.2 + px * (c + 0.5), cy = -P.W / 2 + 1.2 + py * (r + 0.5);
    box(g, [cx - 1.4 + px * 0.12, cy - 1.4 - py * 0.1, T], [cx + 1.4 + px * 0.12, cy + 1.4 - py * 0.1, T + 0.18], MATX.ic, { r: 0.05 });
    box(g, [cx + px * 0.3 - 0.6, cy + py * 0.28 - 1.6, T], [cx + px * 0.3 + 0.6, cy + py * 0.28 + 1.6, T + 0.4], MAT.black, { r: 0.05 });
    for (let k = 0; k < 6; k++) box(g, [cx - px * 0.35 + k * 0.5, cy - py * 0.35, T], [cx - px * 0.35 + k * 0.5 + 0.2, cy - py * 0.35 + 0.1, T + 0.06], MATX.cap, { edges: false, shadow: false });
    for (let k = 0; k < 5; k++) box(g, [cx - px * 0.3 + k * 0.6, cy + py * 0.05, -0.06], [cx - px * 0.3 + k * 0.6 + 0.2, cy + py * 0.05 + 0.1, 0], MATX.cap, { edges: false, shadow: false });
  }
  // laser-mark sites: white silk boxes (pre-printed keep-out) + code decals shown when marked
  const topMarks = top.map(([x, y]) => { box(g, [x - 0.65, y - 0.65, T], [x + 0.65, y + 0.65, T + 0.003], MATX.silk, { edges: false, shadow: false }); const m = new T3.Mesh(new T3.PlaneGeometry(1.0, 1.0), codeMat); m.position.set(x, y, T + 0.006); m.visible = false; g.add(m); return m; });
  const botMarks = bot.map(([x, y]) => { box(g, [x - 0.65, y - 0.65, -0.003], [x + 0.65, y + 0.65, 0], MATX.silk, { edges: false, shadow: false }); const m = new T3.Mesh(new T3.PlaneGeometry(1.0, 1.0), codeMat); m.rotation.x = Math.PI; m.position.set(x, y, -0.006); m.visible = false; g.add(m); return m; });
  const frame = (sz) => { const s = new T3.Shape(); s.moveTo(-sz, -sz); s.lineTo(sz, -sz); s.lineTo(sz, sz); s.lineTo(-sz, sz); s.closePath(); const h = new T3.Path(); h.moveTo(-sz + 0.14, -sz + 0.14); h.lineTo(-sz + 0.14, sz - 0.14); h.lineTo(sz - 0.14, sz - 0.14); h.lineTo(sz - 0.14, -sz + 0.14); h.closePath(); s.holes.push(h); return new T3.ShapeGeometry(s); };
  const cur = new T3.Mesh(frame(0.8), new T3.MeshBasicMaterial({ color: 0x0e8a86, transparent: true, depthWrite: false, side: T3.DoubleSide })); cur.visible = false; g.add(cur);
  const bad = new T3.Mesh(frame(0.85), new T3.MeshBasicMaterial({ color: 0xe5484d, transparent: true, depthWrite: false, side: T3.DoubleSide })); bad.visible = false; g.add(bad);
  return { g, P, top, bot, topMarks, botMarks, fids, fidMats, cur, bad };
}
const gBoard = G("board");
const BOARDS = { P1: makeBoard(PRESETS.P1), P2: makeBoard(PRESETS.P2) };
Object.values(BOARDS).forEach((b) => { gBoard.add(b.g); b.g.visible = false; });

// ---------- upper XY gantry + laser head + vision ----------
const gUpper = G("upperHead");
for (const y of UPPER.rails) { box(gUpper, [-44, y - 2, 124], [44, y + 2, 127], MAT.aluDark); box(gUpper, [-43, y - 1, 127], [43, y + 1, 128.2], MAT.steel); for (const x of [-44, 42]) box(gUpper, [x, y - 2.4, 127], [x + 2, y + 2.4, 130], MAT.black); }
const gUX = G("upper.x", gUpper);
box(gUX, [-4, -32, 130], [4, 38, 135], MAT.alu);
for (const y of UPPER.rails) box(gUX, [-4.5, y - 2.4, 128.2], [4.5, y + 2.4, 130], MAT.aluDark);
box(gUX, [4, -31, 131], [4.6, 37, 133], MAT.steel);
box(gUX, [-4.6, -32, 135], [4.6, -26, 139], MAT.black);                      // Y servo
const gUY = G("upper.y", gUX);
box(gUY, [4.6, -5.5, 112], [6, 5.5, 136], MAT.alu);
const gUZ = G("upper.z", gUY);
box(gUZ, [6, -4.5, 104], [7.2, 4.5, 126], MAT.aluDark);
// CO2 source (sealed RF-excited tube, finned body) standing on the head
box(gUZ, [7.2, -4.5, 113], [16.6, 4.5, 141], MATX.synrad);
for (let i = 0; i < 9; i++) box(gUZ, [16.6, -4 + i * 1, 115], [17.4, -3.6 + i * 1, 139], MATX.fins, { edges: false });
box(gUZ, [7.6, -4, 141], [16.2, 4, 143], MAT.black);
cylZ(gUZ, 11.9, 0, 143, 143.4, 3.2, MAT.aluDark, { edges: false });
box(gUZ, [8, 4.5, 130], [10, 5.2, 134], MAT.yellow, { edges: false });
// galvo + f-theta (beam turns down into the scanner)
box(gUZ, [7.2, -4, 104], [15.2, 4, 112.4], MAT.powder);
cyl(gUZ, [15.2, -2, 109], [1, 0, 0], 2.4, 1.4, MAT.black);
cylZ(gUZ, 13, 2.6, 112.4, 115.4, 1.3, MAT.black);
lathe(gUZ, [UPPER.lensDx, 0, 104], [0, 0, -1], [[0, 0], [0, 2.8], [0.8, 2.8], [0.8, 2.3], [3, 2.3], [3, 0]], MAT.black);
cylZ(gUZ, UPPER.lensDx, 0, 100.9, 101.02, 1.9, MAT.lens, { edges: false });
// vision CCD with three-colour ring light
box(gUZ, [15.6, -2.2, 106], [20.4, 2.2, 118], MAT.black);
lathe(gUZ, [UPPER.camDx, 0, 106], [0, 0, -1], [[0, 0], [0, 1.6], [3, 1.6], [3, 0]], MAT.black);
const ringU = std(0xf4f6f6, 0.3, 0, { emissive: 0x0e8a86, emissiveIntensity: 0 });
ring(gUZ, [UPPER.camDx, 0, 101.8], [0, 0, 1], 1.7, 3.4, 1.2, ringU);
cable(gUY, [[6, 3, 135], [6, 3, 138], [3, 8, 140], [3, 30, 140]], 0.6, MAT.rubber, 3);

// ---------- lower XY gantry + laser head + vision (bottom-side marking) ----------
const gLower = G("lowerHead");
for (const y of UPPER.rails) { box(gLower, [-44, y - 2, 51], [44, y + 2, 54], MAT.aluDark); box(gLower, [-43, y - 1, 54], [43, y + 1, 55.2], MAT.steel); for (const x of [-44, 42]) box(gLower, [x, y - 2.4, 54], [x + 2, y + 2.4, 57], MAT.black); }
for (const [x, y] of [[-44, 36], [42, 36], [-44, -30], [42, -30]]) box(gLower, [x, y - 1.5, 8], [x + 2, y + 1.5, 51], MATX.frameTube);
const gLX = G("lower.x", gLower);
box(gLX, [-4, -32, 57], [4, 38, 62], MAT.alu);
for (const y of UPPER.rails) box(gLX, [-4.5, y - 2.4, 55.2], [4.5, y + 2.4, 57], MAT.aluDark);
box(gLX, [4, -31, 58], [4.6, 37, 60], MAT.steel);
const gLY = G("lower.y", gLX);
box(gLY, [4.6, -5.5, 52], [6, 5.5, 79], MAT.alu);
box(gLY, [6, -4.5, 66], [7.2, 4.5, 79], MAT.aluDark);
box(gLY, [7.2, -4.5, 38], [16.6, 4.5, 66], MATX.synrad);
for (let i = 0; i < 9; i++) box(gLY, [16.6, -4 + i * 1, 40], [17.4, -3.6 + i * 1, 64], MATX.fins, { edges: false });
box(gLY, [7.2, -4, 70.6], [15.2, 4, 78], MAT.powder);
box(gLY, [7.2, -3, 66], [15.2, 3, 70.6], MAT.aluDark);
lathe(gLY, [LOWER.lensDx, 0, 78], [0, 0, 1], [[0, 0], [0, 2.8], [0.8, 2.8], [0.8, 2.3], [3, 2.3], [3, 0]], MAT.black);
box(gLY, [15.6, -2.2, 70], [20.4, 2.2, 78], MAT.black);
lathe(gLY, [LOWER.camDx, 0, 78], [0, 0, 1], [[0, 0], [0, 1.6], [2.6, 1.6], [2.6, 0]], MAT.black);
const ringL = std(0xf4f6f6, 0.3, 0, { emissive: 0x0e8a86, emissiveIntensity: 0 });
ring(gLY, [LOWER.camDx, 0, 80.6], [0, 0, 1], 1.7, 3.4, 1.0, ringL);

// ---------- drag chains (instanced links, posed every frame) ----------
function makeChain(parent, C) {
  const len = C.Lp + Math.PI * C.R, n = Math.floor(len / C.pitch);
  const mesh = new T3.InstancedMesh(new T3.BoxGeometry(C.pitch * 0.9, C.y1 - C.y0, C.t * 2), MAT.rubber, n);
  mesh.castShadow = true; parent.add(mesh);
  const o = new T3.Object3D();
  return (xe) => {
    const xl = (xe + C.xf + C.Lp) / 2, zc = C.zl + C.R, zu = C.zl + 2 * C.R, low = xl - C.xf, arc = Math.PI * C.R, up = xl - xe, yc = (C.y0 + C.y1) / 2;
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) * C.pitch; let x, z, a;
      if (s < low) { x = C.xf + s; z = C.zl; a = 0; }
      else if (s < low + arc) { const t = (s - low) / C.R - Math.PI / 2; x = xl + C.R * Math.cos(t); z = zc + C.R * Math.sin(t); a = t + Math.PI / 2; }
      else if (s < low + arc + up) { x = xl - (s - low - arc); z = zu; a = Math.PI; }
      else { o.scale.set(0, 0, 0); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); continue; }
      o.position.set(x, yc, z); o.rotation.set(0, -a, 0); o.scale.set(1, 1, 1); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
}
box(gUpper, [-46, -37, 120.6], [24, -32.4, 121.6], MAT.aluDark);
box(gLower, [-46, -37, 47.6], [24, -32.4, 48.6], MAT.aluDark);
const chainU = makeChain(gUpper, { xf: -40, y0: -36.6, y1: -32.8, zl: 122.2, R: 3.2, t: 0.6, Lp: 64, pitch: 1.5 });
const chainL = makeChain(gLower, { xf: -40, y0: -36.6, y1: -32.8, zl: 49.2, R: 3.2, t: 0.6, Lp: 64, pitch: 1.5 });
box(gUX, [-1, -36.6, 128.6], [1, -32, 131], MAT.aluDark);
box(gLX, [-1, -36.6, 55.6], [1, -32, 58], MAT.aluDark);

// ---------- HMI on swing arm + keyboard (operation table) ----------
const hmiCanvas = document.createElement("canvas"); hmiCanvas.width = 512; hmiCanvas.height = 320;
const hmiTex = new T3.CanvasTexture(hmiCanvas); hmiTex.encoding = T3.sRGBEncoding;
{
  box(gHood, [44, YH, 121], [47, YH + 6, 124], MAT.alu);
  cylZ(gHood, 45.5, YH + 6.5, 104, 128, 0.7, MAT.alu, { edges: false });
  box(gHood, [44, YH + 7, 126], [47, YH + 9, 129], MAT.aluDark);
  box(gHood, [33, YH + 9, 118], [58, YH + 10.4, 135], MAT.black);
  const scr = new T3.Mesh(new T3.PlaneGeometry(23.6, 15.4), new T3.MeshBasicMaterial({ map: hmiTex }));
  scr.rotation.x = -Math.PI / 2; scr.rotation.z = Math.PI; scr.scale.x = -1; scr.position.set(45.5, YH + 10.42, 126.5); gHood.add(scr);
  box(gHood, [34, YH + 3, 104], [57, YH + 13, 105.2], MAT.aluDark);
}

// ---------- line integration: inline SMEMA stubs / offline destacker + stacker ----------
const gLine = G("lineInline");
function smemaStub(x0, x1, label) {
  const g = G(label, gLine);
  for (const [x, y] of [[x0 + 3, -14], [x1 - 3, -14], [x0 + 3, 30], [x1 - 3, 30]]) { box(g, [x - 1, y - 1, 0], [x + 1, y + 1, 83], MAT.aluDark); cylZ(g, x, y, 0, 0.8, 2, MAT.black); }
  box(g, [x0, -16, 76], [x1, 32, 78], MAT.powder);
  box(g, [x0, RAIL_Y, 83], [x1, RAIL_Y + 1.6, 90], MAT.alu);
  box(g, [x0, RAIL_Y - 0.6, 88.9], [x1, RAIL_Y, BELT_Z], MATX.belt, { edges: false });
  const mob = G("stubMob", g);
  box(mob, [x0, RAIL_Y - PRESETS.P1.W - 1.6, 83], [x1, RAIL_Y - PRESETS.P1.W, 90], MAT.alu);
  box(mob, [x0, RAIL_Y - PRESETS.P1.W, 88.9], [x1, RAIL_Y - PRESETS.P1.W + 0.6, BELT_Z], MATX.belt, { edges: false });
  box(g, [x0 + 2, 32, 82], [x0 + 8, 33, 86], MAT.black);
  return mob;
}
const stubMobs = [smemaStub(-100, -52, "upstream"), smemaStub(52, 100, "downstream")];
const gOff = G("lineOffline");
function pushUpModule(x0, x1, isIn) {
  const g = G(isIn ? "destacker" : "stacker", gOff);
  box(g, [x0, -26, 6], [x1, 40, 78], MAT.powder);
  for (const [x, y] of [[x0 + 4, -22], [x1 - 4, -22], [x0 + 4, 36], [x1 - 4, 36]]) { cylZ(g, x, y, 0, 1.4, 3, MAT.black); cylZ(g, x, y, 1.4, 6, 0.9, MAT.steel, { edges: false }); }
  box(g, [x0 + 2, 40, 12], [x1 - 2, 40.8, 74], MAT.panel);
  box(g, [x0, -26, 78], [x1, 40, 80], MAT.alu);
  const cx = (x0 + x1) / 2;
  for (const [a, b] of [[[x0, -26, 80], [x0 + 2, -24, 140]], [[x1 - 2, -26, 80], [x1, -24, 140]], [[x0, 38, 80], [x0 + 2, 40, 140]], [[x1 - 2, 38, 80], [x1, 40, 140]], [[x0, -26, 140], [x1, 40, 142]]]) box(g, a, b, MAT.alu);
  const glass = new T3.Mesh(new T3.PlaneGeometry(x1 - x0 - 4, 60), MAT.glass); glass.rotation.x = Math.PI / 2; glass.position.set(cx, 39.5, 110); glass.renderOrder = 10; g.add(glass);
  cylZ(g, cx, 7, 80, 84, 2, MAT.aluDark);
  const lift = G("lift", g);
  box(lift, [cx - 24, -12, -1], [cx + 24, 24, 0], MAT.alu);
  cylZ(lift, cx, 7, -30, -1, 1.2, MAT.steel, { edges: false });
  for (const [x, y] of [[cx - 24, -13], [cx + 23, -13], [cx - 24, 24], [cx + 23, 24]]) box(g, [x, y, 80], [x + 1, y + 1, 112], MAT.steel);
  const stack = [];
  for (let i = 0; i < 10; i++) { const s = new T3.Group(); lift.add(s); const b = addMesh(s, new T3.BoxGeometry(PRESETS.P1.L, PRESETS.P1.W, PRESETS.P1.t), MATX.solder, { edges: true }); b.position.set(cx, RAIL_Y - PRESETS.P1.W / 2, PRESETS.P1.t / 2); s.position.z = i * 0.24; stack.push(s); }
  let pusher = null;
  if (isIn) { pusher = G("pusher", g); box(pusher, [cx - 18, -14, 89.8], [cx - 17, 26, 90.6], MAT.teal); box(pusher, [cx - 18.5, -18, 89.4], [cx - 16.5, -14, 92], MAT.aluDark); box(g, [x0 + 3, -20, 88], [x1 - 3, -17, 90], MAT.alu); }
  return { g, lift, stack, pusher, cx };
}
const DESTACK = pushUpModule(-124, -52, true), STACK = pushUpModule(52, 124, false);

// ---------- external fume extractor (HEPA + chemical filter) ----------
const gFume = G("fumeExt");
box(gFume, [-50, -172, 4], [10, -97, 117], MAT.powder);
for (const [x, y] of [[-46, -168], [6, -168], [-46, -101], [6, -101]]) cyl(gFume, [x, y, 2], [0, 1, 0], 1.2, 2, MAT.black, { seg: 18 });
for (let j = 0; j < 10; j++) box(gFume, [-46 + j * 5, -97, 12], [-44 + j * 5, -96.8, 40], MAT.black, { edges: false, shadow: false });
box(gFume, [-44, -97, 90], [-28, -96.8, 104], MAT.black, { edges: false });
cylZ(gFume, -20, -134, 117, 121, 3.4, MAT.aluDark);
cable(gFume, [[-20, -50, 158], [-20, -50, 166], [-20, -90, 166], [-20, -134, 140], [-20, -134, 121]], 2.2, MAT.rubber, 10);

// ---------- beam, frustums ----------
function beamSet(color) {
  const core = new T3.Mesh(new T3.CylinderGeometry(0.16, 0.16, 1, 8), new T3.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  const glow = new T3.Mesh(new T3.CylinderGeometry(0.7, 0.7, 1, 12), new T3.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false }));
  const spot = new T3.Mesh(new T3.SphereGeometry(0.4, 14, 10), new T3.MeshBasicMaterial({ color: 0xffffff }));
  [core, glow, spot].forEach((m) => { m.visible = false; root.add(m); });
  return { core, glow, spot };
}
const BEAM_U = beamSet(0xe0602a), BEAM_L = beamSet(0xe0602a);
const fovU = new T3.LineSegments(new T3.BufferGeometry(), MAT.fov), fovL = new T3.LineSegments(new T3.BufferGeometry(), MAT.fov);
root.add(fovU); root.add(fovL);

const TREE = [
  { id: "cabinet", g: gCab, label: "Base cabinet, feet & castors", ex: [0, 0, -30] },
  { id: "hood", g: gHood, label: "Hood, window, operator panel, HMI", ex: [0, 40, 60] },
  { id: "frame", g: gFrame, label: "Welded tube frame", ex: [0, 0, 0] },
  { id: "electronics", g: gElec, label: "IPC, 48 V supply, servo/PLC panel", ex: [0, -40, -10] },
  { id: "conveyor", g: gConv, label: "3-section conveyor & width adjust", ex: [0, 20, 0] },
  { id: "board", g: gBoard, label: "PCB panel", ex: [0, 20, 6] },
  { id: "upperHead", g: gUpper, label: "Upper XY gantry · CO₂ head · CCD", ex: [0, 0, 30] },
  { id: "lowerHead", g: gLower, label: "Lower XY gantry · CO₂ head · CCD", ex: [0, 0, -30] },
  { id: "lineInline", g: gLine, label: "Inline: SMEMA up/downstream", ex: [0, 0, 0], cfg: "inline" },
  { id: "lineOffline", g: gOff, label: "Offline: push-up destacker / stacker", ex: [0, 0, 0], cfg: "offline" },
  { id: "fumeExt", g: gFume, label: "Fume extractor (HEPA + chemical)", ex: [0, -40, 0] },
];
const hidden = new Set();

// =====================================================================
//                        SIMULATION STATE MACHINE
// =====================================================================
let cfg = "inline", src = "co2", prod = "P1", lowerOn = true;
const S = {};
const PARK = { ugx: -34, ugy: 30, lgx: -34, lgy: 30 };
function resetState() {
  const P = PRESETS[prod];
  Object.assign(S, {
    phase: 0, info: "", lamp: "green",
    W: P.W, ufz: P.fz, bx: -95, bOn: false, lift: 0, clampZ: 0, stopS: 0, stopP: 0,
    ...PARK, ringU: 0, ringL: 0, fovU: null, fovL: null, beamU: null, beamL: null, fid: -1,
    tm: new Set(), bm: new Set(), tg: new Map(), bg: new Map(), cur: null, bad: null, ng: false,
    dN: 10, sN: 0, pushX: DESTACK.cx - 17, dLiftZ: BELT_Z - 9 * 0.24, sLiftZ: BELT_Z,
    boards: 0, codes: 0, pass: 0, fail: 0, cycleT: 0, lastCycle: 0,
  });
}
const STEPS = ["Load", "Index", "Clamp", "Fiducial align", "Mark", "Grade & verify", "Release", "Unload"];
const SRC = { co2: "CO₂ 10.6 µm", uv: "UV 355 nm" };
const BEAM_COL = { co2: 0xe0602a, uv: 0x7b4fe0 };
const NOTES = {
  co2: "CO₂ 10.6 µm on green solder mask: the usual PCB choice (benchmark class: HGTECH LCB20C, dual-head CO₂). The beam foams/ablates the mask to give a light, high-contrast 2D code; power is set to stop short of copper. Source power, spot, code size and speed to be confirmed by trials on customer panels.",
  uv: "UV 355 nm: finer spot and lower heat input, for very small codes, white/black masks, dense or thin/flex boards. Higher source cost; to be confirmed by trials.",
};
const GRADE = (k, bad) => (bad ? { g: "D", v: "1.6" } : (k * 7) % 11 === 3 ? { g: "B", v: "3.1" } : { g: "A", v: (3.5 + ((k * 13) % 5) / 10).toFixed(1) });
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
  if (s.tick) s.tick(u);
}
function endSeg(s) { applySeg(s, 1); if (s.end) s.end(); if (s.infoEnd !== undefined) S.info = typeof s.infoEnd === "function" ? s.infoEnd() : s.infoEnd; }
function advance(dt) {
  let left = dt, guard = 0;
  while (left > 0 && guard++ < 400) {
    if (!seg) { if (!queue.length) queue = cycle(); startSeg(queue.shift()); }
    const remain = seg.dur - segT;
    if (left >= remain) { left -= Math.max(0, remain); endSeg(seg); seg = null; }
    else { segT += left; applySeg(seg, seg.dur > 0 ? segT / seg.dur : 1); left = 0; }
  }
  S.cycleT += dt;
}
const B = () => BOARDS[prod];
const byC = () => RAIL_Y - PRESETS[prod].W / 2;                      // board centre y on the conveyor
const clampLift = () => 90 - BELT_Z - PRESETS[prod].t;                // lift until the top face meets the rail lips
const w2 = (p) => [S.bx + p[0], byC() + p[1]];                        // board-local -> machine xy
function changeoverSegs(next) {
  const P = PRESETS[next];
  return [SEG(0, 2.4, { W: P.W, ufz: P.fz, ...PARK }, { start: () => { S.lamp = "amber"; S.bOn = false; }, info: `Recipe changeover → ${P.name}: width axis drives the mobile rail on both lead screws; Z focus offset recalled from the recipe`, end: () => { S.lamp = "green"; } })];
}
function cycle() {
  const P = PRESETS[prod], b = B(), L = P.L;
  const stby = -25.5 - L / 2;
  const nT = b.top.length, nB = lowerOn ? b.bot.length : 0;
  const badKey = S.boards % 3 === 2 ? (lowerOn ? "b1" : "t2") : "";
  const q = [];
  // 01 Load
  if (cfg === "inline") {
    q.push(SEG(0, 0.6, {}, { start: () => { S.cycleT = 0; S.tm = new Set(); S.bm = new Set(); S.tg = new Map(); S.bg = new Map(); S.cur = null; S.bad = null; S.ng = false; S.bx = -95; S.bOn = true; S.lamp = "green"; }, info: "SMEMA handshake: upstream “board available”, marker “machine ready”" }));
    q.push(SEG(0, 1.5, { bx: stby, stopS: 1 }, { info: "Section 1 belts carry the panel in to the standby stop; entry sensor confirms" }));
  } else {
    q.push(SEG(0, 0.5, { pushX: DESTACK.cx - L / 2 }, { start: () => { S.cycleT = 0; S.tm = new Set(); S.bm = new Set(); S.tg = new Map(); S.bg = new Map(); S.cur = null; S.bad = null; S.ng = false; S.lamp = "green"; if (S.dN <= 0) { S.dN = 10; S.sN = 0; } }, info: "Push-up destacker: lift indexes the stack so the top panel sits at transfer height" }));
    q.push(SEG(0, 1.3, { bx: -50 + L / 2, stopS: 1 }, { start: () => { S.dN--; S.bx = DESTACK.cx; S.bOn = true; }, tick: () => { S.pushX = S.bx - L / 2; }, info: "Pusher slides the top panel onto the section-1 belts" }));
    q.push(SEG(0, 1.0, { bx: stby, pushX: DESTACK.cx - 17 }, { info: "Belts carry the panel to the standby stop; pusher returns" }));
  }
  // 02 Index
  q.push(SEG(1, 0.3, { stopP: 1 }, { info: "Processing stop raised" }));
  q.push(SEG(1, 1.1, { bx: 0, stopS: 0 }, { info: "Standby stop drops; section 2 indexes the panel to the processing stop" }));
  // 03 Clamp
  q.push(SEG(2, 0.7, () => ({ lift: clampLift(), clampZ: 0.8 + clampLift(), ufz: P.fz }), { info: "Clamp bars lift the panel against the rail lips: held flat, both faces open for marking" }));
  // 04 Fiducial align (upper and lower CCD in parallel)
  b.fids.forEach((f, i) => {
    q.push(SEG(3, 0.55, () => { const [x, y] = w2(f); return { ugx: x - UPPER.camDx, ugy: y, lgx: x - LOWER.camDx, lgy: y }; }, { info: `Fiducial ${i + 1}/3: upper and lower CCD move over the copper mark` }));
    q.push(SEG(3, 0.35, {}, { start: () => { S.fid = i; S.ringU = 1; S.ringL = lowerOn ? 1 : 0; S.fovU = w2(f); S.fovL = lowerOn ? w2(f) : null; }, end: () => { S.ringU = 0; S.ringL = 0; S.fovU = S.fovL = null; S.fid = -1; }, info: `Fiducial ${i + 1}/3: ring light on, pattern match`, infoEnd: `Fiducial ${i + 1}/3 found · Δx ${(0.02 * (i + 1)).toFixed(2)} Δy ${(-0.01 * (i + 2)).toFixed(2)} mm (simulated)` }));
  });
  q.push(SEG(3, 0.35, {}, { info: "Offset, rotation and scale applied to both mark jobs; Z height checked (simulated)" }));
  // 05 Mark (top and bottom simultaneously)
  const nM = Math.max(nT, nB);
  for (let k = 0; k < nM; k++) {
    q.push(SEG(4, 0.45, () => { const o = {}; if (k < nT) { const [x, y] = w2(b.top[k]); o.ugx = x - UPPER.lensDx; o.ugy = y; } if (k < nB) { const [x, y] = w2(b.bot[k]); o.lgx = x - LOWER.lensDx; o.lgy = y; } return o; }, { info: () => `Gantries move to code ${k + 1}/${nM}` }));
    q.push(SEG(4, 0.7, {}, {
      start: () => { S.beamU = k < nT ? b.top[k] : null; S.beamL = k < nB ? b.bot[k] : null; },
      end: () => { if (k < nT) { S.tm.add(k); S.codes++; } if (k < nB) { S.bm.add(k); S.codes++; } S.beamU = S.beamL = null; },
      info: () => `Marking ${k < nT ? (k === nT - 1 ? "panel code (top)" : `sub-board ${k + 1} (top)`) : ""}${k < nT && k < nB ? " + " : ""}${k < nB ? `sub-board ${k + 1} (bottom)` : ""} · 2D DataMatrix, serial from MES`,
    }));
  }
  // 06 Grade & verify (read back every code)
  for (let k = 0; k < nM; k++) {
    q.push(SEG(5, 0.4, () => { const o = {}; if (k < nT) { const [x, y] = w2(b.top[k]); o.ugx = x - UPPER.camDx; o.ugy = y; } if (k < nB) { const [x, y] = w2(b.bot[k]); o.lgx = x - LOWER.camDx; o.lgy = y; } return o; }, { info: () => `Read-back ${k + 1}/${nM}: CCD over the fresh code` }));
    q.push(SEG(5, 0.35, {}, {
      start: () => { S.ringU = k < nT ? 1 : 0; S.ringL = k < nB ? 1 : 0; S.fovU = k < nT ? w2(b.top[k]) : null; S.fovL = k < nB ? w2(b.bot[k]) : null; S.cur = k < nT ? ["t", k] : ["b", k]; },
      end: () => {
        S.ringU = S.ringL = 0; S.fovU = S.fovL = null;
        if (k < nT) { const g = GRADE(k, badKey === `t${k}`); S.tg.set(k, g); if (g.g === "D") { S.fail++; S.ng = true; S.bad = ["t", k]; S.lamp = "amber"; } else S.pass++; }
        if (k < nB) { const g = GRADE(k + 5, badKey === `b${k}`); S.bg.set(k, g); if (g.g === "D") { S.fail++; S.ng = true; S.bad = ["b", k]; S.lamp = "amber"; } else S.pass++; }
      },
      infoEnd: () => { const t = S.tg.get(k), bb = S.bg.get(k); return `Decode + ISO/IEC 15415 grade: ${t ? `top ${t.g} (${t.v})` : ""}${t && bb ? " · " : ""}${bb ? `bottom ${bb.g} (${bb.v})` : ""}${(t && t.g === "D") || (bb && bb.g === "D") ? " — below spec C → NG" : ""} (simulated)`; },
    }));
  }
  q.push(SEG(5, 0.6, {}, { start: () => { S.cur = null; }, info: () => (S.ng ? "MES: codes uploaded, duplicate check passed · NG sub-board flagged as X-out, bad-board signal set for downstream" : "MES: codes uploaded, duplicate check passed · all codes ≥ spec C") }));
  // 07 Release
  q.push(SEG(6, 0.6, { lift: 0, clampZ: 0, ...PARK }, { info: "Clamp bars drop, gantries park clear of the panel" }));
  q.push(SEG(6, 0.3, { stopP: 0 }, { info: "Processing stop drops" }));
  // 08 Unload
  if (cfg === "inline") {
    q.push(SEG(7, 1.5, { bx: 78 }, { info: () => `SMEMA: “board available” to downstream${S.ng ? " with bad-board flag" : ""}; section 3 hands the panel over`, end: () => { S.bOn = false; S.boards++; S.lastCycle = S.cycleT; } }));
  } else {
    q.push(SEG(7, 1.5, { bx: STACK.cx }, { info: "Section 3 feeds the panel into the stacker", end: () => { S.bOn = false; S.sN++; S.boards++; S.lastCycle = S.cycleT; } }));
    q.push(SEG(7, 0.5, {}, { info: () => `Stacker lift indexes down one pitch · ${S.sN} panels stacked` }));
  }
  return q;
}

// =====================================================================
//                          APPLY STATE TO MODEL
// =====================================================================
const p0 = (o) => (o.userData.p0 = o.position.clone());
[stopProc, stopStby, clampF, clampM].forEach(p0);
const tmpA = new T3.Vector3(), tmpB = new T3.Vector3(), upY = new T3.Vector3(0, 1, 0);
function placeBeam(Bm, a, b, on, t) {
  [Bm.core, Bm.glow, Bm.spot].forEach((m) => (m.visible = on));
  if (!on) return;
  tmpA.set(...a); tmpB.set(...b);
  const d = tmpB.clone().sub(tmpA), len = d.length();
  for (const m of [Bm.core, Bm.glow]) { m.position.copy(tmpA).addScaledVector(d, 0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(upY, d.normalize()); d.multiplyScalar(len); }
  Bm.spot.position.copy(tmpB); Bm.spot.scale.setScalar(0.7 + 0.3 * Math.sin(t * 60));
  Bm.glow.material.opacity = 0.12 + 0.06 * Math.sin(t * 45);
}
function fovGeom(L, cam, xy, zFace) {
  if (!xy) { L.visible = false; return; }
  const h = 1.6, pts = [], c = [[-h, -h], [h, -h], [h, h], [-h, h]];
  c.forEach(([dx, dy], i) => { pts.push(cam[0], cam[1], cam[2], xy[0] + dx, xy[1] + dy, zFace); const n = c[(i + 1) % 4]; pts.push(xy[0] + dx, xy[1] + dy, zFace, xy[0] + n[0], xy[1] + n[1], zFace); });
  L.geometry.setAttribute("position", new T3.Float32BufferAttribute(pts, 3)); L.geometry.computeBoundingSphere(); L.visible = $("#t-fov").checked;
}
let simT = 0;
function applyModel() {
  simT += 0.016;
  const P = PRESETS[prod], b = B();
  const dW = -(S.W - PRESETS.P1.W);
  gMob.position.y = dW; stubMobs.forEach((m) => (m.position.y = dW));
  stopStby.position.z = stopStby.userData.p0.z - 1.3 * (1 - S.stopS);
  stopProc.position.z = stopProc.userData.p0.z - 1.3 * (1 - S.stopP);
  stopProc.position.x = stopProc.userData.p0.x + P.L / 2;
  clampF.position.z = clampF.userData.p0.z + S.clampZ; clampM.position.z = clampM.userData.p0.z + S.clampZ;
  // board
  Object.entries(BOARDS).forEach(([k, bo]) => (bo.g.visible = k === prod && S.bOn));
  b.g.position.set(S.bx, byC(), BELT_Z + S.lift);
  b.topMarks.forEach((m, i) => (m.visible = S.tm.has(i)));
  b.botMarks.forEach((m, i) => (m.visible = S.bm.has(i)));
  b.fidMats.forEach((m, i) => (m.emissiveIntensity = S.fid === i ? 0.9 : 0));
  const frameAt = (fr, sel) => { fr.visible = !!sel; if (!sel) return; const [side, k] = sel; const p = side === "t" ? b.top[k] : b.bot[k]; fr.position.set(p[0], p[1], side === "t" ? P.t + 0.01 : -0.01); };
  frameAt(b.cur, S.cur); frameAt(b.bad, S.bad);
  // gantries
  gUX.position.x = S.ugx; gUY.position.y = S.ugy; gUZ.position.z = S.ufz;
  gLX.position.x = S.lgx; gLY.position.y = S.lgy;
  chainU(S.ugx); chainL(S.lgx);
  ringU.emissiveIntensity = S.ringU * 1.4; ringL.emissiveIntensity = S.ringL * 1.4;
  gLower.visible = lowerOn && !hidden.has("lowerHead");
  // beams + frustums (machine coords)
  const topZ = BELT_Z + S.lift + P.t, botZ = BELT_Z + S.lift;
  const scan = (k) => [Math.sin(simT * 31 + k) * 0.35, Math.cos(simT * 23 + k) * 0.35];
  if (S.beamU) { const [x, y] = w2(S.beamU), s = scan(0); placeBeam(BEAM_U, [S.ugx + UPPER.lensDx, S.ugy, 100.9 + S.ufz], [x + s[0], y + s[1], topZ + 0.02], true, simT); } else placeBeam(BEAM_U, 0, 0, false);
  if (S.beamL && lowerOn) { const [x, y] = w2(S.beamL), s = scan(2); placeBeam(BEAM_L, [S.lgx + LOWER.lensDx, S.lgy, 81], [x + s[0], y + s[1], botZ - 0.02], true, simT); } else placeBeam(BEAM_L, 0, 0, false);
  fovGeom(fovU, [S.ugx + UPPER.camDx, S.ugy, 101.8 + S.ufz], S.fovU, topZ);
  fovGeom(fovL, [S.lgx + LOWER.camDx, S.lgy, 80.6], S.fovL, botZ);
  // offline modules
  if (cfg === "offline") {
    const tD = BELT_Z - Math.max(0, S.dN - 1) * 0.24, tS = BELT_Z - S.sN * 0.24;
    S.dLiftZ += (tD - S.dLiftZ) * 0.15; S.sLiftZ += (tS - S.sLiftZ) * 0.15;
    DESTACK.lift.position.z = S.dLiftZ; STACK.lift.position.z = S.sLiftZ;
    const sx = P.L / PRESETS.P1.L, sy = P.W / PRESETS.P1.W;
    [[DESTACK, S.dN], [STACK, S.sN]].forEach(([M, n]) => M.stack.forEach((s, i) => { s.visible = i < n; const m = s.children[0]; m.scale.set(sx, sy, 1); m.position.y = RAIL_Y - P.W / 2; }));
    DESTACK.pusher.position.x = S.pushX - (DESTACK.cx - 17);
  }
  // stack light
  MAT.lampG.emissiveIntensity = S.lamp === "green" ? 1.6 : 0; MAT.lampA.emissiveIntensity = S.lamp === "amber" ? 1.6 : 0; MAT.lampR.emissiveIntensity = S.lamp === "red" ? 1.6 : 0;
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
  gLower.visible = lowerOn && !hidden.has("lowerHead");
  $$(".tree-row[data-cfg]").forEach((r) => r.classList.toggle("off", r.dataset.cfg !== cfg));
}
let explode = 0;
function applyExplode() { TREE.forEach((t) => t.g.position.set(t.ex[0] * explode, t.ex[1] * explode, t.ex[2] * explode)); }
$("#explode").addEventListener("input", (e) => { explode = Number(e.target.value) / 100; applyExplode(); });
const clipPlane = new T3.Plane(new T3.Vector3(0, 1, 0), 1000);
$("#section").addEventListener("input", (e) => {
  const v = Number(e.target.value);
  if (v >= 830) { renderer.clippingPlanes = []; $("#section-v").textContent = "off"; }
  else { clipPlane.constant = v; renderer.clippingPlanes = [clipPlane]; $("#section-v").textContent = `Y ${v} mm`; }
});
$("#t-edges").addEventListener("change", (e) => edgeLines.forEach((l) => (l.visible = e.target.checked)));
function setXray(on) {
  $("#t-xray").checked = on;
  for (const m of [MAT.powder, MAT.panel, MAT.wall]) { m.transparent = on; m.opacity = on ? 0.16 : 1; m.depthWrite = !on; m.needsUpdate = true; }
}
$("#t-xray").addEventListener("change", (e) => setXray(e.target.checked));
$("#t-grid").addEventListener("change", (e) => { grid.visible = e.target.checked; axesHelper.visible = e.target.checked; });
$("#t-labels").addEventListener("change", () => {});
const VIEWS = {
  iso: { p: [-2300, -3600, 2500], t: [0, 0, 900] },
  front: { p: [0, -6400, 1000], t: [0, 0, 950] },
  top: { p: [0, 1, 7000], t: [0, 0, 900] },
  right: { p: [5600, 0, 1050], t: [0, 0, 1000] },
  process: { p: [-350, -2650, 1900], t: [0, -140, 910] },
  upper: { p: [-480, -1800, 1700], t: [60, -140, 1100] },
  lower: { p: [-520, -2100, 520], t: [50, -140, 800], xray: true },
};
let camAnim = null;
function goView(name) {
  const v = VIEWS[name]; if (!v) return;
  camAnim = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new T3.Vector3(...v.p), t1: new T3.Vector3(...v.t) };
  if (v.xray) setXray(true); else if (name !== "process" && name !== "upper") setXray(false);
  $$("[data-view]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.view === name)));
}
$$("[data-view]").forEach((bt) => bt.addEventListener("click", () => goView(bt.dataset.view)));
function restart(pre = []) { resetState(); queue = [...pre]; seg = null; applyVisibility(); writeNote(); }
function setCfg(next) {
  cfg = next;
  $$("[data-cfg-btn]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.cfgBtn === cfg)));
  restart();
}
function setSrc(next) {
  src = next;
  $$("[data-src]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.src === src)));
  for (const Bm of [BEAM_U, BEAM_L]) { Bm.core.material.color.setHex(BEAM_COL[src]); Bm.glow.material.color.setHex(BEAM_COL[src]); }
  const mat = CODE_MAT[src];
  Object.values(BOARDS).forEach((bo) => [...bo.topMarks, ...bo.botMarks].forEach((m) => (m.material = mat)));
  writeNote();
}
function setProd(next) {
  if (next === prod) return;
  const pre = changeoverSegs(next);
  prod = next;
  $$("[data-prod]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.prod === prod)));
  const keep = { W: S.W, ufz: S.ufz, ugx: S.ugx, ugy: S.ugy, lgx: S.lgx, lgy: S.lgy, dN: S.dN, sN: S.sN };
  restart(pre); Object.assign(S, keep);
}
function setLower(on) {
  lowerOn = on; $("#lower").setAttribute("aria-pressed", String(on)); $("#lower").textContent = on ? "Bottom head: on" : "Bottom head: off";
  restart();
}
function writeNote() { $("#note").innerHTML = `<b>${SRC[src]} · ${cfg === "inline" ? "Inline · SMEMA between SMT/AOI and the next process" : "Offline · push-up destacker → marker → stacker"} · ${PRESETS[prod].name}${lowerOn ? " · top + bottom" : " · top only"}</b> — ${NOTES[src]}`; }
$$("[data-cfg-btn]").forEach((bt) => bt.addEventListener("click", () => setCfg(bt.dataset.cfgBtn)));
$$("[data-src]").forEach((bt) => bt.addEventListener("click", () => setSrc(bt.dataset.src)));
$$("[data-prod]").forEach((bt) => bt.addEventListener("click", () => setProd(bt.dataset.prod)));
$("#lower").addEventListener("click", () => setLower(!lowerOn));
let paused = false, speed = 1;
$("#play").addEventListener("click", () => { paused = !paused; $("#play").textContent = paused ? "Play" : "Pause"; $("#play").setAttribute("aria-pressed", String(paused)); });
$("#speed").addEventListener("input", (e) => { speed = [0.25, 0.5, 1, 2, 4][Number(e.target.value)]; $("#speed-v").textContent = `${speed}×`; });
function jumpTo(step) {
  S.W = PRESETS[prod].W; S.ufz = PRESETS[prod].fz; S.lamp = "green";
  queue = cycle(); seg = null;
  while (queue.length && queue[0].phase < step) { const s = queue.shift(); startSeg(s); endSeg(s); }
  seg = null;
}
$$("[data-step]").forEach((el, i) => el.addEventListener("click", () => jumpTo(i)));
$("#follow").addEventListener("change", () => {});

// DRO + HMI
const fmt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2).padStart(7, "0");
let hmiKey = "";
function drawHmi() {
  const b = B(), P = PRESETS[prod];
  const key = `${prod}|${cfg}|${lowerOn}|${S.phase}|${S.tm.size}|${S.bm.size}|${S.tg.size}|${S.bg.size}|${S.cur}|${S.bad}|${S.bOn}`;
  if (key === hmiKey) return; hmiKey = key;
  const c = hmiCanvas.getContext("2d");
  c.fillStyle = "#0f1d1d"; c.fillRect(0, 0, 512, 320);
  c.fillStyle = "#1d3a39"; c.fillRect(10, 10, 492, 34);
  c.fillStyle = "#3cc4bd"; c.font = "bold 17px monospace"; c.fillText(`TEAL LMS-PCB · ${P.name.replace("Panel ", "")} · ${STEPS[S.phase].toUpperCase()}`, 18, 33);
  STEPS.forEach((_, i) => { c.fillStyle = i === S.phase ? "#3cc4bd" : i < S.phase ? "#4f8f8a" : "#2c4b4a"; c.fillRect(18 + i * 60, 54, 52, 7); });
  const panel = (x0, label, side) => {
    const w = 150, h = w * P.W / P.L, y0 = 96;
    c.fillStyle = "#9fd6d3"; c.font = "13px monospace"; c.fillText(label, x0, 86);
    c.fillStyle = S.bOn ? "#1f5a40" : "#203232"; c.fillRect(x0, y0, w, h);
    const pts = side === "t" ? b.top : b.bot, marked = side === "t" ? S.tm : S.bm, gr = side === "t" ? S.tg : S.bg;
    if (side === "b" && !lowerOn) { c.fillStyle = "#6c8584"; c.fillText("bottom head off", x0 + 14, y0 + h / 2); return; }
    pts.forEach((p, k) => {
      const px = x0 + (p[0] / P.L + 0.5) * w, py = y0 + (0.5 - p[1] / P.W) * h, s = 12;
      const g = gr.get(k);
      c.fillStyle = g ? (g.g === "D" ? "#e5484d" : "#3cc4bd") : marked.has(k) ? "#e8efe9" : "#2f6d52";
      c.fillRect(px - s / 2, py - s / 2, s, s);
      if (S.cur && S.cur[0] === side && S.cur[1] === k) { c.strokeStyle = "#fff"; c.lineWidth = 2; c.strokeRect(px - s / 2 - 3, py - s / 2 - 3, s + 6, s + 6); }
    });
  };
  panel(26, "TOP", "t"); panel(196, "BOTTOM (mirror)", "b");
  c.fillStyle = "#9fd6d3"; c.font = "14px monospace";
  const nT = b.top.length, nB = lowerOn ? b.bot.length : 0;
  c.fillText(`MARKED ${S.tm.size + S.bm.size}/${nT + nB}`, 366, 104);
  c.fillText(`GRADED ${S.tg.size + S.bg.size}/${nT + nB}`, 366, 128);
  c.fillText(`NG     ${S.ng ? 1 : 0}`, 366, 152);
  c.fillText(`SPEC   ≥ C`, 366, 176);
  c.fillText(`SRC ${src === "co2" ? "CO2" : "UV"}`, 366, 200);
  c.fillText(`${cfg === "inline" ? "SMEMA" : "STACKER"}`, 366, 224);
  c.fillStyle = S.ng ? "#e5484d" : "#3cc4bd"; c.fillRect(18, 290, 476, 18);
  c.fillStyle = "#0f1d1d"; c.font = "bold 12px monospace"; c.fillText(S.ng ? "BAD-BOARD FLAG → DOWNSTREAM · X-OUT IN MES" : "GOOD BOARD · CODES IN MES", 26, 303);
  hmiTex.needsUpdate = true;
}
function updateDro() {
  const r = (v) => fmt(v * 10);
  $("#dro").innerHTML = [
    ["Panel X (conveyor)", S.bOn ? r(S.bx) : "—", S.bOn ? "mm" : ""], ["Rail width", r(S.W), "mm"],
    ["Upper head X / Y", `${r(S.ugx + UPPER.lensDx)} / ${r(S.ugy)}`, "mm (lens)"], ["Upper Z focus", r(S.ufz), "mm"],
    ["Lower head X / Y", lowerOn ? `${r(S.lgx + LOWER.lensDx)} / ${r(S.lgy)}` : "off", lowerOn ? "mm (lens)" : ""],
    ["Clamp lift", r(S.lift), "mm"],
    cfg === "offline" ? ["Destacker / stacker", `${S.dN} / ${S.sN}`, "panels"] : ["SMEMA", S.phase === 0 ? "BA ↔ MR" : S.phase === 7 ? "BA → down" : "idle", ""],
    ["Codes marked", String(S.codes), "total"], ["Graded P / F", `${S.pass} / ${S.fail}`, ""], ["Panels done", String(S.boards), ""],
    ["Cycle (sim)", `${S.cycleT.toFixed(1)} s`, S.lastCycle ? `last ${S.lastCycle.toFixed(1)} s` : ""],
  ].map(([k, v, u]) => `<div><span>${k}</span><b>${v}</b><i>${u}</i></div>`).join("");
  $("#readout").textContent = `${STEPS[S.phase]} · ${S.info}`;
  $$("[data-step]").forEach((el, i) => el.toggleAttribute("data-now", i === S.phase));
  $("#lamp").dataset.lamp = S.lamp;
}
// labels (projected HTML callouts), machine coords
const LABELS = [
  ["Upper XY gantry · CO₂ source", [12, 0, 146], null], ["Galvo + f-theta · CCD + ring light", [-14, 30, 108], null],
  ["Lower head (bottom-side marking)", [-22, 30, 44], null], ["3-section conveyor · fixed front rail", [-38, 26, 93], null],
  ["Width adjust (mobile rail, lead screws)", [44, -34, 84], null], ["Fume extractor (HEPA + chemical)", [-20, -134, 124], null],
  ["Stack light", [40, 40, 178], null], ["HMI", [45, 92, 137], null], ["Start / stop · E-stop", [-46, 84, 142], null],
  ["SMEMA in", [-76, 24, 93], "inline"], ["SMEMA out", [76, 24, 93], "inline"],
  ["Push-up destacker", [-88, 7, 145], "offline"], ["Stacker", [88, 7, 145], "offline"], ["IPC · 48 V PSU · servo / PLC", [-14, -60, 32], null],
];
const labelEls = LABELS.map(([t]) => { const d = document.createElement("div"); d.className = "lbl"; d.textContent = t; $("#labels").appendChild(d); return d; });
const DIMS = [
  { a: [-51, 98, 0], b: [51, 98, 0], text: "≈ 1020 (TBD)" },
  { a: [-100, 104, 0], b: [100, 104, 0], text: "≈ 2000 with SMEMA stubs (TBD)", cfg: "inline" },
  { a: [-124, 104, 0], b: [124, 104, 0], text: "≈ 2480 with destacker / stacker (TBD)", cfg: "offline" },
  { a: [58, -82.5, 0], b: [58, 82.5, 0], text: "≈ 1650 (TBD)" },
  { a: [-58, 82.5, 0], b: [-58, 82.5, 176.4], text: "≈ 1760 to stack light (TBD)" },
];
const dimGroup = new T3.Group(); root.add(dimGroup);
const dimEls = DIMS.map((d) => {
  const A = new T3.Vector3(...d.a), Bv = new T3.Vector3(...d.b);
  const g = new T3.BufferGeometry().setFromPoints([A, Bv]);
  const line = new T3.Line(g, new T3.LineBasicMaterial({ color: 0x0e8a86 })); dimGroup.add(line);
  const el = document.createElement("div"); el.className = "lbl dim"; el.textContent = d.text; $("#labels").appendChild(el);
  return { el, mid: A.clone().add(Bv).multiplyScalar(0.5), line, cfg: d.cfg };
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
  LABELS.forEach(([t, p, c], i) => place(labelEls[i], p, on && (!c || c === cfg) && (lowerOn || !t.startsWith("Lower"))));
  dimEls.forEach((d) => { const ok = on && (!d.cfg || d.cfg === cfg); d.line.visible = ok; place(d.el, [d.mid.x, d.mid.y, d.mid.z], ok); });
}

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
const MATNAME = new Map(Object.entries({ powder: "Powder-coated steel, RAL 9016", panel: "Powder-coated steel panel", wall: "Painted steel panel", alu: "Aluminium 6061-T6, clear anodised", aluDark: "Aluminium, dark anodised", steel: "Stainless steel 304", black: "Black anodised / painted", rubber: "Rubber / cable sheath", teal: "Anodised aluminium, TEAL teal", yellow: "Safety yellow", red: "Safety red", glass: "Laser-safety polycarbonate", lens: "Optical glass" }).map(([k, v]) => [MAT[k], v]));
MATNAME.set(MATX.solder, "FR-4 panel, green LPI solder mask"); MATNAME.set(MATX.synrad, "Sealed RF-excited CO₂ source housing"); MATNAME.set(MATX.fins, "Aluminium cooling fins"); MATNAME.set(MATX.belt, "Antistatic flat belt"); MATNAME.set(MATX.frameTube, "Steel square tube, powder-coated"); MATNAME.set(MATX.ic, "Component (IC package)"); MATNAME.set(MATX.windowFrame, "Window frame, black anodised");
const CODES = { cabinet: "CAB", hood: "HOD", frame: "FRM", electronics: "ELE", conveyor: "CNV", board: "PCB", upperHead: "UHD", lowerHead: "LHD", lineInline: "SMA", lineOffline: "STK", fumeExt: "FEX" };
let partSeq = 0;
function registerParts() {
  TREE.forEach((t) => t.g.traverse((o) => { if (o.isMesh && !o.userData.part) { o.userData.part = { tree: t, no: `TEAL-PCB-${CODES[t.id] || "GEN"}-${String(++partSeq).padStart(4, "0")}` }; } }));
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
  const dyn = new Set([gMob, gUX, gUY, gUZ, gLX, gLY, gBoard, stopProc, stopStby, clampF, clampM, ...stubMobs, DESTACK.lift, STACK.lift, DESTACK.pusher]);
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
const secOutline = new T3.LineSegments(new T3.EdgesGeometry(new T3.PlaneGeometry(2700, 2000)), new T3.LineBasicMaterial({ color: 0x0e8a86, transparent: true, opacity: 0.8 }));
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
  $("#section").addEventListener("input", (e) => { const on = Number(e.target.value) < 830; setSectionSides(on); secOutline.visible = on; secOutline.position.set(0, -Number(e.target.value), 1000); });
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
    const tgt = new T3.Vector3((S.ugx + UPPER.lensDx) * 10, -S.ugy * 10, 1000);
    const d = tgt.clone().sub(controls.target).multiplyScalar(0.06);
    controls.target.add(d); camera.position.add(d);
  }
  controls.update();
  renderFrame(dt);
  updateDro(); drawHmi(); placeLabels();
  requestAnimationFrame(frame);
}
const mq = matchMedia("(prefers-color-scheme: dark)");
function theme() {
  const dark = document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && mq.matches);
  scene.background = dark ? BG.dark : BG.light;
  grid.material.color && grid.material.color.setHex(dark ? 0x2c3439 : 0xd3d9dd);
}
mq.addEventListener("change", theme);
new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
theme();
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase();
  if (k === "1") setSrc("co2"); else if (k === "2") setSrc("uv");
  else if (k === "c") setProd(prod === "P1" ? "P2" : "P1");
  else if (k === " ") { $("#play").click(); e.preventDefault(); }
  else if (k === "f") goView("front"); else if (k === "t") goView("top"); else if (k === "r") goView("right"); else if (k === "i") goView("iso"); else if (k === "p") goView("process"); else if (k === "u") goView("upper"); else if (k === "l") goView("lower");
});
resetState(); applyVisibility(); setSrc("co2"); writeNote(); resize();
window.__sim = { S, step: (dt) => advance(dt), setCfg, setSrc, setProd, setLower, goView, jumpTo, set speed(v) { speed = v; }, get camera() { return camera; }, controls };
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
 const sim=window.__sim, canvas=renderer.domElement, KEY='pcb';
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
 last={status:'CONCEPT / NOT FOR FABRICATION',platform:"pcb",configuration:typeof cfg==='undefined'?'standalone':cfg,primary:{id:q('a').value,...info(a)},secondary:{id:q('b').value,...info(b)},visibleEnvelope:info(whole),aabbDistanceMm:distance,overlap,requiredClearanceMm:threshold,serviceZone:zone,section:q('axis').value,sectionPositionPercent:Number(q('cut').value),source:typeof src==='undefined'?null:src,notes:'Current visible pose; AABB overlap may be intentional. Hidden geometry excluded. No motion sweep, safety or tolerance certification.'};
 q('result').textContent='PRIMARY: '+(info(a)?.size.join(' × ')||'Not visible')+' mm\nSECONDARY: '+(info(b)?.size.join(' × ')||'Not visible')+' mm\nVISIBLE ENVELOPE: '+(info(whole)?.size.join(' × ')||'—')+' mm\n'+(distance===null?'Select two distinct visible modules.':overlap?'REVIEW — AABB overlap (may be intentional).':distance<threshold?'REVIEW — bounding-box gap '+distance.toFixed(1)+' mm below target.':'Bounding-box gap '+distance.toFixed(1)+' mm; not a validated clearance.')+'\nCyan: primary · green/amber: comparison · blue: service zone.';return last}
 function section(){if(q('axis').value==='off'){if(savedClip!==null){renderer.clippingPlanes=savedClip;savedClip=null}return}const b=bbox(root);if(b.isEmpty())return;if(savedClip===null)savedClip=origClip();const axis=q('axis').value.toLowerCase(),n=new T3.Vector3();n[axis]=-1;const pos=b.min[axis]+(b.max[axis]-b.min[axis])*Number(q('cut').value)/100;renderer.clippingPlanes=[new T3.Plane(n,pos)];}
 function close(){clean();picking=false;q('axis').value='off';section();host.style.display='none'}
 q('focus').onclick=()=>{sim.focus(q('a').value);scan()};q('iso').onclick=()=>{sim.isolate(q('a').value);scan()};q('all').onclick=()=>{sim.showAll();scan()};q('pick').onclick=()=>{picking=true;q('result').textContent='Click a visible component in the viewport.'};cv.addEventListener('click',e=>{if(!picking)return;const r=cv.getBoundingClientRect(),ray=new T3.Raycaster();ray.setFromCamera(new T3.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),controls.object);const h=ray.intersectObject(root,true).find(x=>x.object.isMesh&&visible(x.object)&&!x.object.material?.transparent&&renderer.clippingPlanes.every(p=>p.distanceToPoint(x.point)>=0));if(h){let o=h.object;while(o){const u=TREE.find(x=>x.g===o);if(u){q('a').value=u.id;picking=false;sim.highlight(u.id);scan();break}o=o.parent}}});
 for(const k of ['a','b','boxes','gap','side','depth','service'])q(k).onchange=scan;q('axis').onchange=section;q('cut').oninput=section;q('scan').onclick=scan;q('clear').onclick=()=>{clean();q('result').textContent='Overlays cleared. Refresh geometry to recalculate.'};q('close').onclick=close;q('export').onclick=()=>{const d=scan(),u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='TEAL-concept-3D-DFM.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};q('bom').onclick=()=>{try{window.parent.tealOpenDetailedBOM(q('a').value,typeof cfg==='undefined'?null:cfg,typeof src==='undefined'?null:src)}catch(e){q('result').textContent='Open Detailed BOM from Engineering Studio.'}};
 function open(){host.style.display='block';scan()}const launch=document.createElement('button');launch.textContent='Concept 3D DFM · V6';launch.style.cssText='position:absolute;right:12px;top:98px;z-index:32;background:#0e7773;color:white;border:1px solid #83c5c1;border-radius:6px;padding:7px 10px;font:bold 12px Arial;cursor:pointer';launch.onclick=()=>host.style.display==='none'?open():close();view.append(launch);sim.conceptDFM={open,scan,close};
})();


})();
}
