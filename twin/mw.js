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
camera.position.set(-1700, -2400, 1750);
const controls = new T3.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 850);
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
Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 100, far: 9000 });
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
axesHelper.position.set(-500, -500, 1);
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
//          MODEL: TEAL compact laser micro-welding workstation
// =====================================================================
const X0 = -30, X1 = 30, YD = 32.5;
const HX = -2, HY = -2;                 // fixed beam axis (head nozzle)
const IX = -14, IY = -2;                // post-weld inspection camera axis
const LOADP = [-2, 12];                 // stage position for loading (fixture centre)
const FIX_Z = 88;                       // fixture top
const TIP0 = 90.5;                      // nozzle tip height at head Z = 0
const PARTS = {
  tab: { name: "Ni tab → Cu busbar (lap)", top: 0.33, clampZ: 0.3, clampR: 1.6 },
  can: { name: "SS sensor can (lid seam)", top: 1.22, clampZ: 0.2, clampR: 1.75 },
};
const MATX = {
  copper: std(0xc8784a, 0.28, 0.95), coneCu: std(0xd08a5c, 0.22, 1.0), nickel: std(0xb9bec2, 0.34, 0.92), ss: std(0xc3c8cc, 0.3, 0.95),
  smoke: new T3.MeshPhysicalMaterial({ color: 0x1b2024, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.72 }),
  fixture: std(0x8b939a, 0.36, 0.8), chain: std(0xf2b705, 0.5, 0.05), led: std(0xfff2d8, 0.4, 0, { emissive: 0xffe9c2, emissiveIntensity: 1.4 }),
  bowl: new T3.MeshPhysicalMaterial({ color: 0xe8eef0, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
  screenBezel: std(0x17191c, 0.4, 0.3),
};
function louver(g, x0, x1, z0, z1) {
  box(g, [x0, YD, z0], [x1, YD + 0.3, z1], MAT.black);
  for (let z = z0 + 0.8; z < z1 - 0.5; z += 1.1) box(g, [x0 + 0.5, YD + 0.3, z], [x1 - 0.5, YD + 0.9, z + 0.45], MATX.screenBezel, { edges: false });
}

// ---------- lower cabinet ----------
const gBase = G("base");
for (const [x, y] of [[-26, -28.5], [26, -28.5], [-26, 28.5], [26, 28.5]]) {
  cylZ(gBase, x, y, 0, 1.2, 3.3, MAT.black); cylZ(gBase, x, y, 1.2, 1.8, 2.6, MAT.steel); cylZ(gBase, x, y, 1.8, 5, 0.9, MAT.steel, { edges: false }); cylZ(gBase, x, y, 3, 3.8, 1.7, MAT.steel, { seg: 6 });
}
box(gBase, [X0, -YD, 5], [X1, YD, 7], MAT.aluDark);
box(gBase, [X0, -YD, 7], [X1, -YD + 1, 70], MAT.powder);
box(gBase, [X0, -YD + 1, 7], [X0 + 1, YD, 70], MAT.powder);
box(gBase, [X1 - 1, -YD + 1, 7], [X1, YD, 70], MAT.powder);
box(gBase, [X0 + 1, YD - 1, 7], [X1 - 1, YD, 70], MAT.powder);
box(gBase, [X0 + 2.5, YD, 9.5], [X1 - 2.5, YD + 0.2, 67.5], MAT.panel);
louver(gBase, -26, -17, 50, 60); louver(gBase, 13, 22, 12, 21);
// shield-gas flowmeter (rotameter)
box(gBase, [-25, YD, 17], [-21.6, YD + 0.8, 37], MAT.black);
const flowTube = cyl(gBase, [-23.3, YD + 1.1, 18.5], [0, 0, 1], 17, 0.6, MATX.bowl, { edges: false, seg: 18 });
const flowFloat = new T3.Mesh(new T3.SphereGeometry(0.45, 14, 10), std(0x0e8a86, 0.4, 0.2)); flowFloat.position.set(-23.3, YD + 1.1, 19.5); gBase.add(flowFloat);
for (let z = 20; z < 35; z += 1.5) box(gBase, [-22.6, YD + 0.8, z], [-22, YD + 0.9, z + 0.1], MAT.powder, { edges: false, shadow: false });
// isolator
box(gBase, [13, YD, 38], [21, YD + 0.4, 46], MAT.yellow);
lathe(gBase, [17, YD + 0.4, 42], [0, 1, 0], [[0, 0], [0, 2.4], [0.7, 2.4], [0.7, 1.1], [1.6, 1.1], [1.6, 0]], MAT.red);
box(gBase, [16.4, YD + 1.6, 38.6], [17.6, YD + 2.6, 45.4], MAT.red, { edges: false });
// pneumatics plate (teal) with FRL, regulator, gauge and gas solenoid valves
const gPneu = G("pneumatics");
box(gPneu, [-10, YD + 0.2, 15], [10, YD + 0.6, 47], MAT.teal);
for (const [x, z] of [[-9, 16], [9, 16], [-9, 46], [9, 46]]) cyl(gPneu, [x, YD + 0.6, z], [0, 1, 0], 0.3, 0.35, MAT.steel, { edges: false, seg: 10 });
box(gPneu, [-1.4, YD + 0.6, 33], [1.4, YD + 3.2, 39], MAT.alu);                         // regulator body
cyl(gPneu, [0, YD + 0.6, 41.5], [0, 1, 0], 2.4, 1.6, MAT.steel);                         // gauge
cyl(gPneu, [0, YD + 3, 41.5], [0, 1, 0], 0.1, 1.35, MAT.powder, { edges: false });
cylZ(gPneu, 0, YD + 1.9, 39, 40, 1.1, MAT.black);
box(gPneu, [-4, YD + 0.6, 30.4], [4, YD + 3, 33], MAT.steel);                             // cross manifold
for (const s of [-1, 1]) { box(gPneu, [s * 4, YD + 0.8, 30.8], [s * 6.6, YD + 2.8, 32.6], MAT.alu); cyl(gPneu, [s * 6.6, YD + 1.8, 31.7], [s, 0, 0], 1.2, 0.5, MAT.black); box(gPneu, [s * 4.4, YD + 3, 31.2], [s * 6.2, YD + 4.4, 32.2], MAT.black); }
lathe(gPneu, [0, YD + 1.9, 30.4], [0, 0, -1], [[0, 0.9], [0.6, 1.2], [5, 1.0], [6.4, 0.5], [6.6, 0]], MATX.bowl);  // filter bowl
cylZ(gPneu, 0, YD + 1.9, 22, 23.8, 0.5, MAT.steel, { edges: false });
cable(gPneu, [[-7.2, YD + 1.8, 31.7], [-8.6, YD + 1.8, 31.7], [-8.6, YD + 1.8, 46], [-8.6, YD - 1, 47]], 0.25, std(0x2f6fd6, 0.5, 0), 1);
cable(gPneu, [[7.2, YD + 1.8, 31.7], [8.6, YD + 1.8, 31.7], [8.6, YD + 1.8, 46], [8.6, YD - 1, 47]], 0.25, std(0x2f6fd6, 0.5, 0), 1);
// lower bay internals: fiber laser source, PLC / servo drives, gas solenoid
const gBay = G("bay");
box(gBay, [-26, -30, 8], [10, -6, 22], MAT.black);
for (let i = 0; i < 8; i++) box(gBay, [-24 + i * 4, -6, 11], [-22 + i * 4, -5.7, 19], MAT.aluDark, { edges: false });
box(gBay, [-26, -30, 22.5], [10, -6, 24], MAT.teal, { edges: false });
box(gBay, [14, -30, 8], [28, -16, 62], MAT.panel);
for (let i = 0; i < 5; i++) box(gBay, [15, -16, 14 + i * 9], [27, -15, 20 + i * 9], MAT.black);
cable(gBay, [[8, -18, 22], [8, -26, 40], [8, -29, 66], [8, -29, 80]], 0.5, MAT.rubber, 4);   // process fiber up the back

// ---------- mid frame: consumables drawer, module knobs ----------
const gMid = G("mid");
box(gMid, [X0, -YD, 70], [X1, YD, 78], MAT.powder);
box(gMid, [-13, YD, 71], [13, YD + 0.7, 76.6], MAT.panel);
box(gMid, [-3, YD + 0.7, 73], [3, YD + 1.2, 74.6], MAT.black);
for (const x of [-24, 24]) { cylZ(gMid, x, YD - 2.5, 78, 79, 2, MAT.aluDark); cylZ(gMid, x, YD - 2.5, 79, 82.4, 1.5, MAT.teal); cylZ(gMid, x, YD - 2.5, 82.4, 83.4, 1.8, MAT.teal); }

// ---------- upper process module ----------
const gUp = G("upper");
box(gUp, [X0, -YD, 78], [X1, -YD + 1, 160], MAT.powder);
box(gUp, [X0, -YD + 1, 78], [X0 + 1, YD, 160], MAT.powder);
box(gUp, [X1 - 1, -YD + 1, 78], [X1, -YD + 2, 160], MAT.powder);
box(gUp, [X1 - 1, YD - 2, 78], [X1, YD, 160], MAT.powder);
box(gUp, [X1 - 1, -YD + 2, 78], [X1, YD - 2, 80], MAT.powder);
box(gUp, [X1 - 1, -YD + 2, 158], [X1, YD - 2, 160], MAT.powder);
box(gUp, [X0, -YD, 160], [X1, YD, 162], MAT.powder);
box(gUp, [X0 + 1, -YD + 1, 120], [X1 - 1, YD - 2, 121], MAT.wall);                        // process ceiling
box(gUp, [X0 + 1, -YD + 1, 78], [X1 - 1, YD - 1, 80], MAT.alu);                          // process floor
// front fascia with window opening, HMI and controls
box(gUp, [X0, YD - 1, 78], [-22, YD, 160], MAT.powder);
box(gUp, [22, YD - 1, 78], [X1, YD, 160], MAT.powder);
box(gUp, [-22, YD - 1, 78], [22, YD, 84], MAT.powder);
box(gUp, [-22, YD - 1, 116], [22, YD, 160], MAT.powder);
for (const [a, b] of [[[-23, YD, 83], [23, YD + 0.5, 84.2]], [[-23, YD, 115.8], [23, YD + 0.5, 117]], [[-23, YD, 84.2], [-21.8, YD + 0.5, 115.8]], [[21.8, YD, 84.2], [23, YD + 0.5, 115.8]]]) box(gUp, a, b, MATX.screenBezel);
const hmiCanvas = document.createElement("canvas"); hmiCanvas.width = 512; hmiCanvas.height = 300;
const hmiTex = new T3.CanvasTexture(hmiCanvas); hmiTex.encoding = T3.sRGBEncoding;
box(gUp, [-15, YD, 121], [15, YD + 0.8, 141], MATX.screenBezel);
{ const s = new T3.Mesh(new T3.PlaneGeometry(27.6, 17.6), new T3.MeshBasicMaterial({ map: hmiTex })); s.rotation.x = Math.PI / 2; s.rotation.y = Math.PI; s.scale.x = -1; s.position.set(0, YD + 0.82, 131); gUp.add(s); }
cyl(gUp, [-24.5, YD, 128.5], [0, 1, 0], 0.6, 2, MAT.yellow, { seg: 24 });
lathe(gUp, [-24.5, YD + 0.6, 128.5], [0, 1, 0], [[0, 0], [0, 1.0], [0.6, 1.0], [1.2, 1.5], [1.6, 0]], MAT.red);
cyl(gUp, [-24.5, YD, 135.5], [0, 1, 0], 0.4, 0.9, MAT.black, { seg: 16 });
cyl(gUp, [-24.5, YD + 0.4, 135.5], [0, 1, 0], 0.3, 0.6, std(0x2f8bd6, 0.3, 0, { emissive: 0x2f8bd6, emissiveIntensity: 0.6 }), { seg: 16, edges: false });
{ const c = document.createElement("canvas"); c.width = 256; c.height = 64; const t = c.getContext("2d"); t.fillStyle = "#f3f4f5"; t.fillRect(0, 0, 256, 64); t.fillStyle = "#0e8a86"; t.fillRect(8, 8, 16, 7); t.fillRect(28, 8, 16, 7); t.fillRect(14, 15, 7, 42); t.fillRect(31, 15, 7, 42); t.fillStyle = "#5e5d5b"; t.font = "bold 44px Arial"; t.fillText("TEAL", 60, 50);
  const tex = new T3.CanvasTexture(c); tex.encoding = T3.sRGBEncoding; const m = new T3.Mesh(new T3.PlaneGeometry(13, 3.25), new T3.MeshBasicMaterial({ map: tex })); m.rotation.x = Math.PI / 2; m.rotation.y = Math.PI; m.scale.x = -1; m.position.set(20, YD + 0.06, 152); gUp.add(m); }
// roof: stack light (front-left) and exhaust port (right)
cylZ(gUp, -22, 22, 162, 163.4, 2.2, MAT.black); cylZ(gUp, -22, 22, 163.4, 167, 0.7, MAT.black);
const lampG = cylZ(gUp, -22, 22, 167, 170, 1.7, MAT.lampG), lampA = cylZ(gUp, -22, 22, 170, 173, 1.7, MAT.lampA), lampR = cylZ(gUp, -22, 22, 173, 176, 1.7, MAT.lampR);
cylZ(gUp, -22, 22, 176, 177.2, 1.8, MAT.black);
cylZ(gUp, 16, 4, 162, 163, 3.6, MAT.steel); cylZ(gUp, 16, 4, 163, 166.4, 2.6, MAT.steel); cylZ(gUp, 16, 4, 166.4, 167.2, 3.4, MAT.steel);
// right side: two smoked maintenance doors with hinges and handles
const gSide = G("sideDoors");
for (const [y0, y1] of [[-YD + 2, -0.4], [0.4, YD - 2]]) {
  box(gSide, [X1 - 0.2, y0, 80.4], [X1 + 0.5, y1, 157.6], MATX.smoke);
  const yh = y0 < 0 ? y0 + 1.2 : y1 - 1.2;
  for (const z of [92, 146]) box(gSide, [X1 + 0.5, yh - 1, z - 3], [X1 + 1.6, yh + 1, z + 3], MAT.black);
  const yg = y0 < 0 ? y1 - 2.5 : y0 + 2.5;
  box(gSide, [X1 + 0.5, yg - 1, 114], [X1 + 2, yg + 1, 124], MAT.black);
}

// ---------- front lift door (slides up behind the fascia) ----------
const gDoor = G("door");
for (const [a, b] of [[[-22, YD - 2, 84], [22, YD - 1.4, 85]], [[-22, YD - 2, 115], [22, YD - 1.4, 116]], [[-22, YD - 2, 85], [-21, YD - 1.4, 115]], [[21, YD - 2, 85], [22, YD - 1.4, 115]]]) box(gDoor, a, b, MAT.aluDark);
{ const g = new T3.Mesh(new T3.PlaneGeometry(42, 30), MAT.glass); g.rotation.x = Math.PI / 2; g.position.set(0, YD - 1.7, 100); g.renderOrder = 10; gDoor.add(g); }
for (const x of [-23.4, 22.4]) box(gUp, [x, YD - 2.4, 84], [x + 1, YD - 1.2, 152], MAT.aluDark);   // door guides

// ---------- process chamber: XY stage, fixture, swing clamps ----------
const gStage = G("stage");
box(gStage, [-24, -14, 80], [8, 18, 81.5], MAT.aluDark);
for (const x of [-20, 4]) box(gStage, [x - 1, -14, 81.5], [x + 1, 18, 82.5], MAT.steel);
box(gStage, [-12, -16, 80], [-4, -14, 84], MAT.black);                                   // Y servo
box(gStage, [-22, 18, 80], [6, 18.6, 82.6], MAT.black, { edges: false });
const gY = new T3.Group(); gStage.add(gY);
box(gY, [-22, -5, 82.5], [6, 5, 84], MAT.alu);
for (const y of [-3, 3]) box(gY, [-24, y - 0.7, 84], [8, y + 0.7, 85], MAT.steel);
box(gY, [6, -4, 82.5], [9, 4, 86], MAT.black);                                             // X servo
const gX = new T3.Group(); gY.add(gX);
box(gX, [-5, -5, 85], [5, 5, 86.5], MAT.alu);
box(gX, [-4.6, -4, 86.5], [4.6, 4, FIX_Z], MATX.fixture);
for (const [x, y] of [[-3.8, -3.2], [3.8, 3.2]]) cylZ(gX, x, y, FIX_Z, FIX_Z + 0.5, 0.25, MAT.steel, { edges: false, seg: 12 });
const CLAMPS = [-1, 1].map((s) => {
  cylZ(gX, s * 3.6, 0, 86.5, FIX_Z + 0.2, 0.7, MAT.black);
  box(gX, [s * 3.6 - 1, -1.2, 86.5], [s * 3.6 + 1, 1.2, 87.6], MAT.aluDark);
  const arm = new T3.Group(); arm.position.set(s * 3.6, 0, FIX_Z); gX.add(arm);
  const len = 3.6 - 1.6;
  const bar = box(arm, [-0.3, -0.35, 0.3], [0.3, 0.35, 0.6], MAT.teal); bar.scale.x = 1;
  const a = box(arm, [Math.min(0, -s * len), -0.35, 0.3], [Math.max(0, -s * len), 0.35, 0.6], MAT.teal);
  const pad = box(arm, [-s * len - 0.3, -0.3, 0.1], [-s * len + 0.3, 0.3, 0.3], MAT.black);
  return { arm, s, a, pad };
});

// ---------- Z axis + welding head (coaxial camera, copper gas nozzle) ----------
const gZax = G("zaxis");
box(gZax, [10, -7, 80], [16, 3, 120], MAT.aluDark);
box(gZax, [9.2, -5, 82], [10, 1, 118], MAT.steel);
box(gZax, [10, -7, 118], [16, 3, 120], MAT.black);
const gZ = new T3.Group(); gZax.add(gZ);
box(gZ, [7.6, -5.5, 94], [9.2, 1.5, 106], MAT.alu);                                      // carriage
box(gZ, [-1.5, -4.2, 99], [7.6, 0.2, 102], MAT.aluDark);                                 // arm
box(gZ, [-5, -5, 96], [1, 1, 106], MAT.head || std(0x2e3338, 0.42, 0.35));               // focusing module
box(gZ, [-5.1, -5.1, 103.5], [1.1, 1.1, 104.5], MAT.teal, { edges: false });
box(gZ, [-4.4, -4.4, 106], [0.4, 0.4, 109.5], MAT.black);                                  // coaxial CCD module
cyl(gZ, [-2, -2, 109.5], [0, 0, 1], 3, 1.1, MAT.black);
cyl(gZ, [1, -2, 102.5], [1, 0, 0], 2, 0.9, MAT.steel);                                    // fibre connector
lathe(gZ, [HX, HY, 96], [0, 0, -1], [[0, 2.4], [0.4, 2.4], [0.4, 2.1], [4.8, 0.7], [5.5, 0.45], [5.5, 0.2]], MATX.coneCu, { seg: 48 });   // copper gas cone
cyl(gZ, [-5, -3, 98], [-1, 0, 0], 1.2, 0.35, MAT.steel, { edges: false, seg: 10 });        // shield-gas inlet
cable(gZ, [[-6.2, -3, 98], [-7.5, -3, 98], [-7.5, -3, 104], [-7, -6, 108]], 0.3, std(0x2f6fd6, 0.5, 0), 1);
box(gZ, [1, -0.6, 97.4], [3, 1.4, 99.4], MAT.black);                                       // laser height sensor
const ringC = std(0xf4f6f6, 0.3, 0, { emissive: 0x0e8a86, emissiveIntensity: 0 });
box(gZ, [9.2, -4, 101], [21, -1.2, 103], MAT.aluDark);                                     // chain bracket
cable(gZ, [[3, -2, 102.5], [6, -2, 104], [12, -2.6, 106], [19, -2.6, 103]], 0.5, MAT.rubber, 2);
// vertical cable carrier
const CH = { x0: 16.6, y0: -4, y1: -1.2, zf: 82, Lp: 34, R: 2, pitch: 1.2, t: 0.6 };
const chainN = Math.floor((CH.Lp + Math.PI * CH.R) / CH.pitch);
const chainMesh = new T3.InstancedMesh(new T3.BoxGeometry(CH.t * 2, CH.y1 - CH.y0, CH.pitch * 0.88), MATX.chain, chainN); chainMesh.castShadow = true; gZax.add(chainMesh);
box(gZax, [16.2, -4.4, 80], [17.2, -0.8, 83], MAT.aluDark);
const chObj = new T3.Object3D();
function posChain(ze) {
  const C = CH, zl = (ze + C.zf + C.Lp) / 2, low = zl - C.zf, arc = Math.PI * C.R, up = zl - ze, yc = (C.y0 + C.y1) / 2;
  for (let i = 0; i < chainN; i++) {
    const s = (i + 0.5) * C.pitch; let hx, hz, a;
    if (s < low) { hx = C.zf + s; hz = 0; a = 0; }
    else if (s < low + arc) { const t = (s - low) / C.R - Math.PI / 2; hx = zl + C.R * Math.cos(t); hz = C.R + C.R * Math.sin(t); a = t + Math.PI / 2; }
    else if (s < low + arc + up) { hx = zl - (s - low - arc); hz = 2 * C.R; a = Math.PI; }
    else { chObj.scale.set(0, 0, 0); chObj.updateMatrix(); chainMesh.setMatrixAt(i, chObj.matrix); continue; }
    chObj.position.set(C.x0 + hz, yc, hx); chObj.rotation.set(0, a, 0); chObj.scale.set(1, 1, 1); chObj.updateMatrix(); chainMesh.setMatrixAt(i, chObj.matrix);
  }
  chainMesh.instanceMatrix.needsUpdate = true;
}

// ---------- vision: post-weld inspection camera, LED bar, fume nozzle ----------
const gVis = G("vision");
cylZ(gVis, IX, IY, 112, 120, 0.4, MAT.alu, { edges: false });
box(gVis, [IX - 2, IY - 2, 104], [IX + 2, IY + 2, 112], MAT.black);
box(gVis, [IX - 2.1, IY - 2.1, 108.6], [IX + 2.1, IY + 2.1, 109.4], MAT.teal, { edges: false });
cylZ(gVis, IX, IY, 102.6, 104, 1.1, MAT.black);
const ringI = std(0xf4f6f6, 0.3, 0, { emissive: 0xffffff, emissiveIntensity: 0 });
ring(gVis, [IX, IY, 101.6], [0, 0, 1], 1.3, 2.8, 0.8, ringI);
box(gVis, [-21, 22, 117.4], [-7, 24, 118.6], MAT.aluDark); box(gVis, [-20.6, 22.4, 117.1], [-7.4, 23.6, 117.4], MATX.led, { edges: false });
const ledLight = new T3.PointLight(0xffe2b8, 0.6, 400, 2); ledLight.position.set(-140, -230, 1150); scene.add(ledLight);
const gFume = G("fume");
cable(gFume, [[-26, -20, 119], [-26, -20, 96], [-22, -8, 94], [-16, -4, 93]], 0.9, MAT.teal, 4);
lathe(gFume, [-16, -4, 93], [1, 0.15, -0.12], [[0, 0.9], [1.6, 1.3], [2.6, 2.3], [2.8, 2.3]], MAT.teal);
cylZ(gFume, 16, 4, 120, 162, 1.8, MAT.aluDark, { edges: false });                            // extraction duct to roof port

// ---------- parts ----------
function makePart() {
  const g = new T3.Group(); root.add(g);
  const tab = new T3.Group(), can = new T3.Group(); g.add(tab); g.add(can);
  box(tab, [-2.1, -1.3, 0], [2.1, 1.3, 0.3], MATX.copper, { r: 0.04 });
  box(tab, [-0.8, -1.2, 0.3], [0.8, 1.3, 0.33], MATX.nickel, { r: 0.005 });
  box(tab, [-0.8, 1.3, 0.12], [0.8, 2.4, 0.15], MATX.nickel, { r: 0.005 });
  box(tab, [-0.8, 1.27, 0.12], [0.8, 1.33, 0.33], MATX.nickel, { edges: false });
  for (const x of [-1.6, 1.6]) cylZ(tab, x, 0, -0.01, 0.31, 0.25, MAT.black, { edges: false, seg: 16 });
  cylZ(can, 0, 0, 0, 0.2, 2.0, MATX.ss, { seg: 64 });
  cylZ(can, 0, 0, 0.2, 1.2, 1.5, MATX.ss, { seg: 64 });
  cylZ(can, 0, 0, 1.18, 1.22, 1.44, std(0xd5d9dc, 0.25, 0.95), { seg: 64, edges: false });
  cylZ(can, 0, 0, 1.22, 1.3, 0.3, MATX.ss, { seg: 24 });
  // weld beads (instanced, revealed progressively)
  const beads = {};
  const mkBeads = (key, grp, pts, r, z) => {
    const geo = new T3.CylinderGeometry(r * 0.8, r, 0.02, 16); geo.rotateX(Math.PI / 2);
    const m = new T3.InstancedMesh(geo, new T3.MeshStandardMaterial({ roughness: 0.35, metalness: 0.8 }), pts.length);
    const o = new T3.Object3D(); pts.forEach((p, i) => { o.position.set(p[0], p[1], z); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, new T3.Color(0xb0b0b0)); });
    m.count = 0; grp.add(m); beads[key] = { m, pts, z, born: new Float32Array(pts.length) };
  };
  mkBeads("tab_qcw", tab, WELD.tab_qcw.pts, 0.1, 0.338);
  mkBeads("tab_cw", tab, WELD.tab_cw.pts, 0.055, 0.338);
  mkBeads("tab_wob", tab, WELD.tab_wob.pts, 0.1, 0.338);
  mkBeads("can_qcw", can, WELD.can_qcw.pts, 0.1, 1.228);
  mkBeads("can_cw", can, WELD.can_cw.pts, 0.055, 1.228);
  mkBeads("can_wob", can, WELD.can_wob.pts, 0.1, 1.228);
  const ngFrame = new T3.Mesh(new T3.RingGeometry(2.3, 2.45, 48), new T3.MeshBasicMaterial({ color: 0xe5484d, side: T3.DoubleSide })); ngFrame.position.z = 1.4; ngFrame.visible = false; g.add(ngFrame);
  return { g, tab, can, beads, ngFrame };
}
// weld paths (part-local xy). QCW = discrete spots; CW = continuous bead with wobble
const WELD = (() => {
  const tq = []; for (const y of [-0.6, 0, 0.6]) for (const x of [-0.45, 0, 0.45]) tq.push([x, y]);
  const tc = [], stitches = []; for (const x of [-0.45, 0, 0.45]) { const s = tc.length; for (let k = 0; k <= 28; k++) tc.push([x, -0.7 + 1.4 * k / 28]); stitches.push([s, tc.length - 1]); }
  const cq = []; for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; cq.push([Math.cos(a) * 1.47, Math.sin(a) * 1.47]); }
  const cc = []; for (let k = 0; k <= 160; k++) { const a = (k / 160) * Math.PI * 2; cc.push([Math.cos(a) * 1.47, Math.sin(a) * 1.47]); }
  return { tab_qcw: { pts: tq, spots: true }, tab_cw: { pts: tc, stitches }, tab_wob: { pts: tc, stitches }, can_qcw: { pts: cq, spots: true }, can_cw: { pts: cc, stitches: [[0, cc.length - 1]] }, can_wob: { pts: cc, stitches: [[0, cc.length - 1]] } };
})();
const PART = makePart();

// ---------- beam, gas, sensor beams, frusta ----------
const BEAM = (() => {
  const core = new T3.Mesh(new T3.CylinderGeometry(0.05, 0.05, 1, 8), new T3.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.9 }));
  const glow = new T3.Mesh(new T3.SphereGeometry(0.22, 16, 12), new T3.MeshBasicMaterial({ color: 0xfff1c8 }));
  const halo = new T3.Mesh(new T3.SphereGeometry(0.6, 16, 12), new T3.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.28, depthWrite: false }));
  const light = new T3.PointLight(0xffa050, 0, 250, 2);
  [core, glow, halo].forEach((m) => { m.visible = false; root.add(m); }); root.add(light);
  return { core, glow, halo, light };
})();
// melt pool (elongated for CW) and fume plume particles
const MELT = new T3.Mesh(new T3.CircleGeometry(0.11, 28), new T3.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.95, depthWrite: false }));
const MELT2 = new T3.Mesh(new T3.CircleGeometry(0.2, 28), new T3.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.35, depthWrite: false }));
MELT.visible = MELT2.visible = false; root.add(MELT2); root.add(MELT);
const FUME_N = 70, fumeGeo = new T3.BufferGeometry(), fumePos = new Float32Array(FUME_N * 3), fumeAge = new Float32Array(FUME_N).map(() => Math.random());
fumeGeo.setAttribute("position", new T3.BufferAttribute(fumePos, 3));
const FUME = new T3.Points(fumeGeo, new T3.PointsMaterial({ color: 0xb8bcc0, size: 0.35, transparent: true, opacity: 0.45, depthWrite: false }));
FUME.visible = false; root.add(FUME);
const GAS = new T3.Mesh(new T3.CylinderGeometry(0.35, 1.1, 1, 24, 1, true), new T3.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0, depthWrite: false, side: T3.DoubleSide }));
root.add(GAS);
const HSENS = (() => { const m = new T3.Mesh(new T3.CylinderGeometry(0.04, 0.04, 1, 6), new T3.MeshBasicMaterial({ color: 0xff3b2f })); const d = new T3.Mesh(new T3.SphereGeometry(0.12, 10, 8), new T3.MeshBasicMaterial({ color: 0xff3b2f })); m.visible = d.visible = false; root.add(m); root.add(d); return { m, d }; })();
const fovC = new T3.LineSegments(new T3.BufferGeometry(), MAT.fov), fovI = new T3.LineSegments(new T3.BufferGeometry(), MAT.fov);
root.add(fovC); root.add(fovI);

const TREE = [
  { id: "base", g: gBase, label: "Base cabinet, levelling feet, isolator, gas flowmeter", ex: [0, 0, -30] },
  { id: "pneumatics", g: gPneu, label: "Pneumatics / shield-gas panel", ex: [0, 25, -30] },
  { id: "bay", g: gBay, label: "Fiber laser source, PLC & drives", ex: [0, -30, -30] },
  { id: "mid", g: gMid, label: "Consumables drawer, module frame", ex: [0, 0, -10] },
  { id: "upper", g: gUp, label: "Process module, HMI, stack light", ex: [0, 0, 30] },
  { id: "sideDoors", g: gSide, label: "Smoked maintenance doors", ex: [25, 0, 30] },
  { id: "door", g: gDoor, label: "Front lift door, laser-safe window", ex: [0, 30, 30] },
  { id: "stage", g: gStage, label: "XY stage, fixture, swing clamps", ex: [0, 0, 0] },
  { id: "zaxis", g: gZax, label: "Z axis, welding head, coaxial CCD, gas cone", ex: [20, 0, 15] },
  { id: "vision", g: gVis, label: "Post-weld inspection camera, LED bar", ex: [-20, 0, 15] },
  { id: "fume", g: gFume, label: "Fume nozzle & extraction duct", ex: [-15, -15, 10] },
];
const hidden = new Set();

// =====================================================================
//                        SIMULATION STATE MACHINE
// =====================================================================
let src = "qcw", prod = "tab";
const S = {};
function resetState() {
  Object.assign(S, {
    phase: 0, info: "", lamp: "green",
    door: 1, sx: LOADP[0], sy: LOADP[1], hz: 8, clamp: 0, gas: 0, emit: 0, beam: false, bead: 0,
    ppos: null, pOn: false, res: null, vis: null, meas: null, hsOn: false, fovC: false, fovI: false, ringC: 0, ringI: 0,
    serial: 0, parts: 0, ok: 0, ng: 0, log: [], cycleT: 0, lastCycle: 0, simT: 0,
  });
  Object.values(PART.beads).forEach((b) => (b.m.count = 0));
}
const STEPS = ["Load & clamp", "Recipe select", "Pre-weld seam find", "Height & focus", "Interlock & gas purge", "Laser weld", "Post-weld inspect", "OK/NG · log · unload"];
const SRC = { qcw: "Fiber · QCW pulsed (spot welds)", cw: "Fiber · single-mode CW (seam)", wob: "Fiber · single-mode CW + wobble (seam)" };
const WOBP = { a: 0.05, f: 6 };       // wobble amplitude (model units = 10 mm) and visual frequency (slowed for viewing)
const NOTES = {
  qcw: "QCW pulsed fiber: discrete, overlapping spot welds with low heat input. The usual choice for thin Ni / Cu tabs, foils and heat-sensitive assemblies. Pulse energy, width, spot size and overlap to be set by weld trials.",
  cw: "Single-mode CW fiber without wobble: narrow continuous seam, highest speed, needs tight fit-up. Power and speed to be set by weld trials.",
  wob: "Single-mode CW fiber with beam wobble: the spot oscillates around the path, giving a wider, more gap-tolerant bead. Used for hermetic sensor cans and stitch welds on tabs. Power, speed and wobble amplitude / frequency to be set by weld trials.",
};
const JOB = { tab: { qcw: "WPS-TAB-QCW-01", cw: "WPS-TAB-CW-02", wob: "WPS-TAB-WOB-03" }, can: { qcw: "WPS-CAN-QCW-04", cw: "WPS-CAN-CW-05", wob: "WPS-CAN-WOB-06" } };
const key = () => `${prod}_${src}`;
const RESULT = (sn) => (sn % 4 === 0 ? { ok: false, why: "bead width below window on 1 weld (simulated)", w: "0.38" } : { ok: true, why: "bead present, width and position in window, no spatter", w: (0.62 + (sn % 3) * 0.04).toFixed(2) });
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
  if (s.tick) s.tick(u, e);
}
function endSeg(s) { applySeg(s, 1); if (s.end) s.end(); if (s.infoEnd !== undefined) S.info = typeof s.infoEnd === "function" ? s.infoEnd() : s.infoEnd; }
function advance(dt) {
  let left = dt, guard = 0;
  while (left > 0 && guard++ < 600) {
    if (!seg) { if (!queue.length) queue = cycle(); startSeg(queue.shift()); }
    const remain = seg.dur - segT;
    if (left >= remain) { left -= Math.max(0, remain); endSeg(seg); seg = null; }
    else { segT += left; applySeg(seg, seg.dur > 0 ? segT / seg.dur : 1); left = 0; }
  }
  S.cycleT += dt; S.simT += dt;
}
function along(pts, u) {
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(...pts[i].map((v, k) => v - pts[i - 1][k])); L.push(d); tot += d; }
  let t = u * tot;
  for (let i = 0; i < L.length; i++) { if (t <= L[i] || i === L.length - 1) { const f = L[i] ? Math.min(1, t / L[i]) : 1; return pts[i].map((v, k) => v + (pts[i + 1][k] - v) * f); } t -= L[i]; }
  return pts[pts.length - 1];
}
const surf = () => FIX_Z + PARTS[prod].top;
const hzWeld = () => surf() + 0.6 - TIP0;
function cycle() {
  const W = WELD[key()], P = PARTS[prod], q = [];
  const bd = () => PART.beads[key()];
  // 01 Load & clamp
  q.push(SEG(0, 0.6, { door: 1, sx: LOADP[0], sy: LOADP[1], hz: 8 }, { start: () => { S.cycleT = 0; S.lamp = "green"; S.vis = null; S.meas = null; S.res = null; S.bead = 0; Object.values(PART.beads).forEach((b) => (b.m.count = 0)); S.serial++; }, info: "Front lift door open · stage at the load position" }));
  const inPath = [[LOADP[0], 48, 100], [LOADP[0], 30, 100], [LOADP[0], LOADP[1], 92], [LOADP[0], LOADP[1], FIX_Z]];
  q.push(SEG(0, 1.3, {}, { start: () => { S.pOn = true; S.ppos = inPath[0]; }, tick: (u, e) => { S.ppos = along(inPath, e); }, end: () => { S.ppos = null; }, info: () => `Operator places ${P.name} on the fixture locators` }));
  q.push(SEG(0, 0.5, { clamp: 1 }, { info: "Pneumatic swing clamps close on the part" }));
  q.push(SEG(0, 0.8, { door: 0 }, { info: "Lift door closes; door switch made" }));
  // 02 Recipe
  q.push(SEG(1, 0.8, {}, { info: () => `Recipe ${JOB[prod][src]} loaded (HMI / part barcode / MES) · SN ${String(S.serial).padStart(6, "0")}` }));
  // 03 Pre-weld seam / fiducial find with the coaxial CCD through the head
  q.push(SEG(2, 1.0, { sx: HX, sy: HY }, { info: "XY stage brings the joint under the welding head" }));
  q.push(SEG(2, 0.4, {}, { start: () => { S.fovC = true; S.ringC = 1; }, info: "Coaxial CCD (through the head optics) images the joint / part edges" }));
  q.push(SEG(2, 0.6, {}, { end: () => { const sn = S.serial; S.vis = { dx: (0.02 + (sn % 3) * 0.02).toFixed(2), dy: (-0.01 - (sn % 2) * 0.02).toFixed(2), dt: (0.1 + (sn % 4) * 0.1).toFixed(1) }; S.fovC = false; S.ringC = 0; }, info: "Pattern match on the joint features", infoEnd: () => `Weld path corrected: ΔX ${S.vis.dx} · ΔY ${S.vis.dy} mm · Δθ ${S.vis.dt}° (simulated)` }));
  // 04 Height & focus
  q.push(SEG(3, 0.6, {}, { start: () => { S.hsOn = true; }, end: () => { S.meas = surf(); S.hsOn = false; }, info: "Laser triangulation sensor on the head measures the part surface", infoEnd: () => `Surface at ${((surf() - FIX_Z) * 10).toFixed(1)} mm above the fixture` }));
  q.push(SEG(3, 0.8, () => ({ hz: hzWeld() }), { info: "Z axis lowers the head: nozzle stand-off and focal position set from the recipe" }));
  // 05 Interlock & shield-gas purge
  q.push(SEG(4, 1.0, { gas: 1, emit: 1 }, { info: "Door locked, E-stop healthy, extraction on, shield gas purging through the copper cone → laser ready" }));
  // 06 Weld: the stage traces the path under the fixed beam
  const to = (p) => ({ sx: HX - p[0], sy: HY - p[1] });
  if (W.spots) {
    W.pts.forEach((p, i) => {
      q.push(SEG(5, i === 0 ? 0.3 : 0.18, to(p), { info: () => `Spot ${i + 1}/${W.pts.length}: stage positions the next spot` }));
      q.push(SEG(5, 0.16, {}, { start: () => { S.beam = true; }, end: () => { S.beam = false; S.bead = i + 1; bd().born[i] = S.simT; }, info: () => `QCW pulse · spot ${i + 1}/${W.pts.length}` }));
    });
  } else {
    W.stitches.forEach(([a, b], k) => {
      q.push(SEG(5, 0.35, to(W.pts[a]), { info: () => (W.stitches.length > 1 ? `Stitch ${k + 1}/${W.stitches.length}: move to start` : "Move to seam start") }));
      const pts = W.pts.slice(a, b + 1);
      q.push(SEG(5, W.stitches.length > 1 ? 0.9 : 3.2, {}, {
        start: () => { S.beam = true; },
        tick: (u) => { const p = along(pts, u); S.sx = HX - p[0]; S.sy = HY - p[1]; const n = Math.floor(a + u * (b - a + 1)); for (let i = Math.floor(S.bead); i < n; i++) bd().born[i] = S.simT; S.bead = Math.max(S.bead, n); },
        end: () => { S.beam = false; for (let i = Math.floor(S.bead); i <= b; i++) bd().born[i] = S.simT; S.bead = b + 1; },
        info: () => `${src === "wob" ? "CW + wobble" : "CW"} ${W.stitches.length > 1 ? `stitch ${k + 1}/${W.stitches.length}` : "circular lid seam"} · constant speed under the fixed beam`,
      }));
    });
  }
  q.push(SEG(5, 0.4, { gas: 0, emit: 0 }, { end: () => { S.parts++; }, info: "Post-flow of shield gas, laser off" }));
  // 07 Post-weld inspection camera
  q.push(SEG(6, 0.6, { hz: 3 }, { info: "Head retracts" }));
  q.push(SEG(6, 1.0, { sx: IX, sy: IY }, { info: "XY stage moves the part under the post-weld inspection camera" }));
  q.push(SEG(6, 0.5, {}, { start: () => { S.fovI = true; S.ringI = 1; }, info: "Ring light + camera image every weld" }));
  q.push(SEG(6, 0.7, {}, {
    end: () => { S.fovI = false; S.ringI = 0; S.res = RESULT(S.serial); if (S.res.ok) S.ok++; else { S.ng++; S.lamp = "amber"; } S.log.unshift({ sn: S.serial, job: JOB[prod][src], ok: S.res.ok, w: S.res.w }); S.log.length = Math.min(S.log.length, 6); },
    info: "Check presence, bead width, position and spatter against the recipe window",
    infoEnd: () => `${S.res.ok ? "OK" : "NG"} — ${S.res.why} · mean bead width ${S.res.w} mm`,
  }));
  // 08 OK/NG, log, unload
  q.push(SEG(7, 0.5, {}, { info: () => `Logged SN ${String(S.serial).padStart(6, "0")} · ${JOB[prod][src]} · ${S.res.ok ? "OK" : "NG"} · weld parameters + images → MES` }));
  q.push(SEG(7, 1.0, { sx: LOADP[0], sy: LOADP[1], hz: 8 }, { info: "Stage returns to the load position" }));
  q.push(SEG(7, 0.7, { door: 1 }, { info: "Door unlocks and opens" }));
  q.push(SEG(7, 0.4, { clamp: 0 }, { info: "Clamps swing clear" }));
  const outPath = [[LOADP[0], LOADP[1], FIX_Z], [LOADP[0], LOADP[1], 92], [LOADP[0], 30, 100], [LOADP[0], 48, 100]];
  q.push(SEG(7, 1.2, {}, { start: () => { S.ppos = outPath[0]; }, tick: (u, e) => { S.ppos = along(outPath, e); }, end: () => { S.pOn = false; S.ppos = null; S.lastCycle = S.cycleT; }, info: () => (S.res.ok ? "Operator removes the OK part" : "Operator removes the NG part to quarantine (red-tag)") }));
  return q;
}

// =====================================================================
//                          APPLY STATE TO MODEL
// =====================================================================
const upY = new T3.Vector3(0, 1, 0), vA = new T3.Vector3(), vB = new T3.Vector3();
function stretch(m, a, b) { vA.set(...a); vB.set(...b); const d = vB.clone().sub(vA), len = d.length(); m.position.copy(vA).addScaledVector(d, 0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(upY, d.normalize()); }
function frustum(L, eye, c, h, on) {
  if (!on) { L.visible = false; return; }
  const pts = [], k = [[-h, -h], [h, -h], [h, h], [-h, h]];
  k.forEach(([dx, dy], i) => { const n = k[(i + 1) % 4]; pts.push(...eye, c[0] + dx, c[1] + dy, c[2], c[0] + dx, c[1] + dy, c[2], c[0] + n[0], c[1] + n[1], c[2]); });
  L.geometry.setAttribute("position", new T3.Float32BufferAttribute(pts, 3)); L.geometry.computeBoundingSphere(); L.visible = $("#t-fov").checked;
}
const cTmp = new T3.Color(), cHot = new T3.Color(0xfff0c0), cWarm = new T3.Color(0xff7a2a), cCool = new T3.Color(0xc9a36a), cBlue = new T3.Color(0x8f9db0);
function applyModel() {
  const P = PARTS[prod];
  gDoor.position.z = 33 * S.door;
  gY.position.y = S.sy; gX.position.x = S.sx;
  gZ.position.z = S.hz; posChain(103 + S.hz);
  CLAMPS.forEach((c) => { c.arm.rotation.z = c.s * (1 - S.clamp) * 1.4; const L = 3.6 - P.clampR; c.a.scale.x = L / 2; c.a.position.x = -c.s * L / 2; c.pad.position.x = -c.s * L; c.arm.position.z = FIX_Z + P.clampZ - 0.1; });
  // part
  PART.g.visible = S.pOn; PART.tab.visible = prod === "tab"; PART.can.visible = prod === "can";
  if (S.ppos) PART.g.position.set(...S.ppos); else PART.g.position.set(S.sx, S.sy, FIX_Z);
  PART.ngFrame.visible = !!(S.res && !S.res.ok);
  for (const [k, b] of Object.entries(PART.beads)) {
    const on = k === key(); b.m.count = on ? Math.min(b.pts.length, Math.floor(S.bead)) : 0;
    if (on) { for (let i = 0; i < b.m.count; i++) { const age = S.simT - b.born[i]; if (age < 0.15) cTmp.copy(cHot); else if (age < 1.2) cTmp.copy(cWarm).lerp(cCool, (age - 0.15) / 1.05); else cTmp.copy(cCool).lerp(cBlue, Math.min(1, (age - 1.2) / 3) * 0.4); b.m.setColorAt(i, cTmp); } if (b.m.instanceColor) b.m.instanceColor.needsUpdate = true; }
  }
  // beam, gas, sensors
  const sZ = surf(), tip = TIP0 + S.hz;
  if (S.beam) {
    const flick = 0.8 + 0.4 * Math.sin(S.simT * 80);
    const w = src === "wob" ? [WOBP.a * Math.cos(S.simT * WOBP.f * 6.283), WOBP.a * Math.sin(S.simT * WOBP.f * 6.283)] : [0, 0];
    stretch(BEAM.core, [HX, HY, tip + 0.2], [HX + w[0], HY + w[1], sZ + 0.01]); BEAM.glow.position.set(HX + w[0], HY + w[1], sZ + 0.03); BEAM.halo.position.copy(BEAM.glow.position); BEAM.halo.scale.setScalar(flick * 0.7);
    const cwM = src !== "qcw"; MELT.visible = MELT2.visible = true;
    const dx = S.sx - (applyModel._px ?? S.sx), dy = S.sy - (applyModel._py ?? S.sy), ang = Math.atan2(-dy, -dx);
    for (const m of [MELT, MELT2]) { m.position.set(HX + w[0] * 0.5, HY + w[1] * 0.5, sZ + 0.02 + (m === MELT ? 0.004 : 0)); m.rotation.z = ang; m.scale.set(cwM ? (src === "wob" ? 2.3 : 1.7) : 1, cwM ? (src === "wob" ? 1.5 : 0.8) : 1, 1); }
    BEAM.light.position.set(HX, HY, sZ + 0.4); BEAM.light.intensity = 2.2 * flick;
    [BEAM.core, BEAM.glow, BEAM.halo].forEach((m) => (m.visible = true));
  } else { [BEAM.core, BEAM.glow, BEAM.halo].forEach((m) => (m.visible = false)); BEAM.light.intensity = 0; MELT.visible = MELT2.visible = false; }
  applyModel._px = S.sx; applyModel._py = S.sy;
  // fume plume: rises from the weld and is drawn toward the extraction nozzle while extraction runs
  FUME.visible = S.gas > 0.05 || S.beam;
  if (FUME.visible) { for (let i = 0; i < FUME_N; i++) { fumeAge[i] += 0.012 + (i % 5) * 0.002; if (fumeAge[i] > 1) fumeAge[i] = S.beam ? 0 : 1; const a = fumeAge[i]; const k = i * 12.9898; fumePos[i * 3] = HX + (-16 - HX) * a * 0.85 + Math.sin(k) * 0.25 * a; fumePos[i * 3 + 1] = HY + (-4 - HY) * a * 0.85 + Math.cos(k) * 0.25 * a; fumePos[i * 3 + 2] = sZ + 0.2 + a * 4 + Math.sin(k * 3) * 0.3 * a; } fumeGeo.attributes.position.needsUpdate = true; FUME.material.opacity = 0.4 * Math.min(1, S.gas + (S.beam ? 0.5 : 0)); }
  GAS.visible = S.gas > 0.02; if (GAS.visible) { stretch(GAS, [HX, HY, tip], [HX, HY, sZ]); GAS.quaternion.multiply(new T3.Quaternion().setFromAxisAngle(new T3.Vector3(1, 0, 0), Math.PI)); GAS.material.opacity = 0.18 * S.gas * (0.8 + 0.2 * Math.sin(S.simT * 20)); }
  flowFloat.position.z = 19.5 + 12 * S.gas;
  if (S.hsOn) { const a = [2, 0.4, 97.4 + S.hz], b = [HX + 0.2, HY + 0.2, sZ + 0.01]; stretch(HSENS.m, a, b); HSENS.d.position.set(...b); HSENS.m.visible = HSENS.d.visible = true; } else HSENS.m.visible = HSENS.d.visible = false;
  frustum(fovC, [HX, HY, tip], [S.sx, S.sy, sZ], 2.2, S.fovC);
  frustum(fovI, [IX, IY, 101.6], [IX, IY, sZ], 2.6, S.fovI);
  ringI.emissiveIntensity = S.ringI * 1.6;
  MAT.lampG.emissiveIntensity = S.lamp === "green" ? 1.6 : 0; MAT.lampA.emissiveIntensity = S.lamp === "amber" || (S.emit > 0.5 && S.lamp !== "red") ? 1.6 : 0; MAT.lampR.emissiveIntensity = S.lamp === "red" ? 1.6 : 0;
}

// =====================================================================
//                       UI: tree, views, DRO, HMI
// =====================================================================
const treeEl = $("#tree");
TREE.forEach((t) => {
  const row = document.createElement("label");
  row.className = "tree-row"; row.dataset.id = t.id;
  row.innerHTML = `<input type="checkbox" checked><span class="sw"></span><span>${t.label}</span>`;
  row.querySelector("input").addEventListener("change", (e) => { if (e.target.checked) hidden.delete(t.id); else hidden.add(t.id); applyVisibility(); });
  treeEl.appendChild(row);
});
function applyVisibility() { TREE.forEach((t) => (t.g.visible = !hidden.has(t.id))); }
let explode = 0;
function applyExplode() { TREE.forEach((t) => t.g.position.set(t.ex[0] * explode, t.ex[1] * explode, t.ex[2] * explode)); }
$("#explode").addEventListener("input", (e) => { explode = Number(e.target.value) / 100; applyExplode(); });
const clipPlane = new T3.Plane(new T3.Vector3(0, 1, 0), 1000);
$("#section").addEventListener("input", (e) => {
  const v = Number(e.target.value);
  if (v >= 330) { renderer.clippingPlanes = []; $("#section-v").textContent = "off"; }
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
  iso: { p: [-1700, -2400, 1750], t: [0, 0, 850] },
  front: { p: [0, -4300, 900], t: [0, 0, 880] },
  top: { p: [0, 1, 4600], t: [0, 0, 850] },
  right: { p: [3900, 0, 950], t: [0, 0, 900] },
  process: { p: [-60, -980, 1020], t: [-30, 30, 960] },
  weld: { p: [-70, -190, 930], t: [-20, 20, 892] },
  cabinet: { p: [-500, -1500, 500], t: [0, -300, 380] },
};
let camAnim = null;
function goView(name) {
  const v = VIEWS[name]; if (!v) return;
  camAnim = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new T3.Vector3(...v.p), t1: new T3.Vector3(...v.t) };
  $$("[data-view]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.view === name)));
}
$$("[data-view]").forEach((bt) => bt.addEventListener("click", () => goView(bt.dataset.view)));
function restart() { resetState(); queue = []; seg = null; applyVisibility(); writeNote(); }
function setSrc(next) { src = next; $$("[data-src]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.src === src))); restart(); }
function setProd(next) { prod = next; $$("[data-prod]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.prod === prod))); restart(); }
function setCfg() {}
function setWobble(a, f) { WOBP.a = a; WOBP.f = f; }
function writeNote() { $("#note").innerHTML = `<b>${SRC[src]} · ${PARTS[prod].name} · recipe ${JOB[prod][src]}</b> — ${NOTES[src]}`; }
$$("[data-src]").forEach((bt) => bt.addEventListener("click", () => setSrc(bt.dataset.src)));
$$("[data-prod]").forEach((bt) => bt.addEventListener("click", () => setProd(bt.dataset.prod)));
let paused = false, speed = 1;
$("#play").addEventListener("click", () => { paused = !paused; $("#play").textContent = paused ? "Play" : "Pause"; $("#play").setAttribute("aria-pressed", String(paused)); });
$("#speed").addEventListener("input", (e) => { speed = [0.25, 0.5, 1, 2, 4][Number(e.target.value)]; $("#speed-v").textContent = `${speed}×`; });
function jumpTo(step) {
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
  const W = WELD[key()], n = W.pts.length, done = Math.min(n, Math.floor(S.bead));
  const k = `${prod}|${src}|${S.phase}|${done}|${S.log.length}|${S.log[0] && S.log[0].sn}|${!!S.vis}|${!!S.res}`;
  if (k === hmiKey) return; hmiKey = k;
  const c = hmiCanvas.getContext("2d");
  c.fillStyle = "#0f1d1d"; c.fillRect(0, 0, 512, 300);
  c.fillStyle = "#1d3a39"; c.fillRect(10, 10, 492, 32);
  c.fillStyle = "#3cc4bd"; c.font = "bold 16px monospace"; c.fillText(`TEAL µWELD · ${JOB[prod][src]} · ${STEPS[S.phase].toUpperCase()}`, 18, 32);
  STEPS.forEach((_, i) => { c.fillStyle = i === S.phase ? "#3cc4bd" : i < S.phase ? "#4f8f8a" : "#2c4b4a"; c.fillRect(18 + i * 60, 50, 52, 6); });
  // weld map
  c.fillStyle = "#1a3030"; c.fillRect(18, 66, 190, 150);
  const cx = 113, cy = 141, sc = prod === "tab" ? 52 : 44;
  if (prod === "tab") { c.fillStyle = "#8a5a3a"; c.fillRect(cx - 2.1 * sc / 1.4, cy - 1.3 * sc / 1.4, 4.2 * sc / 1.4, 2.6 * sc / 1.4); c.fillStyle = "#9aa1a6"; c.fillRect(cx - 0.8 * sc, cy - 1.2 * sc, 1.6 * sc, 2.5 * sc); }
  else { c.fillStyle = "#9aa1a6"; c.beginPath(); c.arc(cx, cy, 1.5 * sc, 0, Math.PI * 2); c.fill(); }
  W.pts.forEach((p, i) => { c.fillStyle = i < done ? (S.res && !S.res.ok && i === 4 ? "#e5484d" : "#f0b45a") : "#34514f"; c.beginPath(); c.arc(cx + p[0] * sc, cy - p[1] * sc, W.spots ? 4 : 2.2, 0, Math.PI * 2); c.fill(); });
  c.fillStyle = "#9fd6d3"; c.font = "13px monospace";
  [
    `SN     ${String(S.serial).padStart(6, "0")}`,
    `WELDS  ${done}/${n}`,
    `SEAM   ${S.vis ? `${S.vis.dx}/${S.vis.dy}/${S.vis.dt}°` : "—"}`,
    `HEIGHT ${S.meas ? ((S.meas - FIX_Z) * 10).toFixed(1) + " mm" : "—"}`,
    `GAS    ${S.gas > 0.5 ? "FLOW" : "OFF"}`,
    `OK ${S.ok}   NG ${S.ng}`,
  ].forEach((t, i) => c.fillText(t, 226, 80 + i * 22));
  c.fillStyle = "#4f8f8a"; c.fillText("LOG  SN      RECIPE          RESULT", 18, 236);
  S.log.slice(0, 3).forEach((l, i) => { c.fillStyle = l.ok ? "#9fd6d3" : "#e5484d"; c.fillText(`     ${String(l.sn).padStart(6, "0")}  ${l.job}  ${l.ok ? "OK" : "NG"}`, 18, 255 + i * 16); });
  hmiTex.needsUpdate = true;
}
function updateDro() {
  const r = (v) => fmt(v * 10), W = WELD[key()];
  $("#dro").innerHTML = [
    ["Stage X / Y", `${r(S.sx - HX)} / ${r(S.sy - HY)}`, "mm from beam axis"],
    ["Head Z", r(S.hz), "mm"], ["Nozzle stand-off", r(TIP0 + S.hz - surf()), "mm"],
    ["Measured surface", S.meas ? r(S.meas - FIX_Z) : "—", S.meas ? "mm" : ""],
    ["Seam correction", S.vis ? `${S.vis.dx} / ${S.vis.dy}` : "—", S.vis ? `mm · Δθ ${S.vis.dt}°` : ""],
    ["Shield gas", S.gas > 0.5 ? "flowing" : S.gas > 0.02 ? "ramping" : "off", ""],
    ["Weld progress", `${Math.min(W.pts.length, Math.floor(S.bead))} / ${W.pts.length}`, W.spots ? "spots" : "bead points"],
    ["Parts welded", String(S.parts), ""], ["OK / NG", `${S.ok} / ${S.ng}`, ""],
    ["Cycle (sim)", `${S.cycleT.toFixed(1)} s`, S.lastCycle ? `last ${S.lastCycle.toFixed(1)} s` : ""],
  ].map(([k, v, u]) => `<div><span>${k}</span><b>${v}</b><i>${u}</i></div>`).join("");
  $("#readout").textContent = `${STEPS[S.phase]} · ${S.info}`;
  $$("[data-step]").forEach((el, i) => el.toggleAttribute("data-now", i === S.phase));
  $("#lamp").dataset.lamp = S.lamp;
}
const LABELS = [
  ["Welding head · coaxial CCD (pre-weld)", [HX, -6, 112], null], ["Copper shield-gas cone", [HX - 3, HY, 94], null],
  ["Post-weld inspection camera", [IX, IY, 114], null], ["XY stage · fixture · swing clamps", [-10, 12, 87], null],
  ["Z axis · cable carrier", [16, -2, 122], null], ["Fume nozzle", [-18, -4, 97], null], ["Touch HMI", [0, YD, 143], null],
  ["E-stop", [-24.5, YD, 131], null], ["Stack light", [-22, 22, 179], null], ["Exhaust port", [16, 4, 169], null],
  ["Consumables drawer", [0, YD, 78], null], ["Shield-gas / pneumatics panel", [0, YD, 49], null], ["Gas flowmeter", [-23, YD, 39], null],
  ["Main isolator", [17, YD, 48], null], ["Smoked maintenance doors", [X1, 0, 160], null],
];
const labelEls = LABELS.map(([t]) => { const d = document.createElement("div"); d.className = "lbl"; d.textContent = t; $("#labels").appendChild(d); return d; });
const DIMS = [
  { a: [X0, YD + 8, 0], b: [X1, YD + 8, 0], text: "≈ 600 (TBD)" },
  { a: [X1 + 8, -YD, 0], b: [X1 + 8, YD, 0], text: "≈ 650 (TBD)" },
  { a: [X0 - 6, YD, 0], b: [X0 - 6, YD, 177], text: "≈ 1770 to stack light (TBD)" },
];
const dimGroup = new T3.Group(); root.add(dimGroup);
const dimEls = DIMS.map((d) => {
  const A = new T3.Vector3(...d.a), Bv = new T3.Vector3(...d.b);
  const line = new T3.Line(new T3.BufferGeometry().setFromPoints([A, Bv]), new T3.LineBasicMaterial({ color: 0x0e8a86 })); dimGroup.add(line);
  const el = document.createElement("div"); el.className = "lbl dim"; el.textContent = d.text; $("#labels").appendChild(el);
  return { el, mid: A.clone().add(Bv).multiplyScalar(0.5), line };
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
  LABELS.forEach(([, p], i) => place(labelEls[i], p, on));
  dimEls.forEach((d) => { d.line.visible = on; place(d.el, [d.mid.x, d.mid.y, d.mid.z], on); });
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
MATNAME.set(MATX.copper, "Workpiece: Cu busbar"); MATNAME.set(MATX.nickel, "Workpiece: Ni tab"); MATNAME.set(MATX.ss, "Workpiece: SS 304 can"); MATNAME.set(MATX.coneCu, "Copper shield-gas cone"); MATNAME.set(MATX.smoke, "Smoked polycarbonate (laser-safe)"); MATNAME.set(MATX.fixture, "Fixture plate, hard-anodised"); MATNAME.set(MATX.chain, "Cable carrier, polyamide");
const CODES = { base: "BAS", pneumatics: "PNU", bay: "BAY", mid: "MID", upper: "UPM", sideDoors: "SDR", door: "DOR", stage: "XYS", zaxis: "ZAX", vision: "VIS", fume: "FUM" };
let partSeq = 0;
function registerParts() {
  TREE.forEach((t) => t.g.traverse((o) => { if (o.isMesh && !o.userData.part) { o.userData.part = { tree: t, no: `TEAL-MW-${CODES[t.id] || "GEN"}-${String(++partSeq).padStart(4, "0")}` }; } }));
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
  const dyn = new Set([gDoor, gY, gX, gZ, PART.g, ...CLAMPS.map((c) => c.arm)]);
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
const secOutline = new T3.LineSegments(new T3.EdgesGeometry(new T3.PlaneGeometry(1000, 1900)), new T3.LineBasicMaterial({ color: 0x0e8a86, transparent: true, opacity: 0.8 }));
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
  $("#section").addEventListener("input", (e) => { const on = Number(e.target.value) < 330; setSectionSides(on); secOutline.visible = on; secOutline.position.set(0, -Number(e.target.value), 1000); });
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
    const tgt = new T3.Vector3(HX * 10, -HY * 10, 900);
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
  if (k === "1") setSrc("qcw"); else if (k === "2") setSrc("cw");
  else if (k === "c") setProd(prod === "tab" ? "can" : "tab");
  else if (k === " ") { $("#play").click(); e.preventDefault(); }
  else if (k === "f") goView("front"); else if (k === "t") goView("top"); else if (k === "r") goView("right"); else if (k === "i") goView("iso"); else if (k === "p") goView("process"); else if (k === "w") goView("weld"); else if (k === "g") goView("cabinet");
});
resetState(); applyVisibility(); setSrc("qcw"); writeNote(); resize();
window.__sim = { S, step: (dt) => advance(dt), setWobble, setCfg, setSrc, setProd, goView, jumpTo, set speed(v) { speed = v; }, get camera() { return camera; }, controls };
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
 const sim=window.__sim, canvas=renderer.domElement, KEY='mw';
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
 last={status:'CONCEPT / NOT FOR FABRICATION',platform:"mw",configuration:typeof cfg==='undefined'?'standalone':cfg,primary:{id:q('a').value,...info(a)},secondary:{id:q('b').value,...info(b)},visibleEnvelope:info(whole),aabbDistanceMm:distance,overlap,requiredClearanceMm:threshold,serviceZone:zone,section:q('axis').value,sectionPositionPercent:Number(q('cut').value),source:typeof src==='undefined'?null:src,notes:'Current visible pose; AABB overlap may be intentional. Hidden geometry excluded. No motion sweep, safety or tolerance certification.'};
 q('result').textContent='PRIMARY: '+(info(a)?.size.join(' × ')||'Not visible')+' mm\nSECONDARY: '+(info(b)?.size.join(' × ')||'Not visible')+' mm\nVISIBLE ENVELOPE: '+(info(whole)?.size.join(' × ')||'—')+' mm\n'+(distance===null?'Select two distinct visible modules.':overlap?'REVIEW — AABB overlap (may be intentional).':distance<threshold?'REVIEW — bounding-box gap '+distance.toFixed(1)+' mm below target.':'Bounding-box gap '+distance.toFixed(1)+' mm; not a validated clearance.')+'\nCyan: primary · green/amber: comparison · blue: service zone.';return last}
 function section(){if(q('axis').value==='off'){if(savedClip!==null){renderer.clippingPlanes=savedClip;savedClip=null}return}const b=bbox(root);if(b.isEmpty())return;if(savedClip===null)savedClip=origClip();const axis=q('axis').value.toLowerCase(),n=new T3.Vector3();n[axis]=-1;const pos=b.min[axis]+(b.max[axis]-b.min[axis])*Number(q('cut').value)/100;renderer.clippingPlanes=[new T3.Plane(n,pos)];}
 function close(){clean();picking=false;q('axis').value='off';section();host.style.display='none'}
 q('focus').onclick=()=>{sim.focus(q('a').value);scan()};q('iso').onclick=()=>{sim.isolate(q('a').value);scan()};q('all').onclick=()=>{sim.showAll();scan()};q('pick').onclick=()=>{picking=true;q('result').textContent='Click a visible component in the viewport.'};cv.addEventListener('click',e=>{if(!picking)return;const r=cv.getBoundingClientRect(),ray=new T3.Raycaster();ray.setFromCamera(new T3.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),controls.object);const h=ray.intersectObject(root,true).find(x=>x.object.isMesh&&visible(x.object)&&!x.object.material?.transparent&&renderer.clippingPlanes.every(p=>p.distanceToPoint(x.point)>=0));if(h){let o=h.object;while(o){const u=TREE.find(x=>x.g===o);if(u){q('a').value=u.id;picking=false;sim.highlight(u.id);scan();break}o=o.parent}}});
 for(const k of ['a','b','boxes','gap','side','depth','service'])q(k).onchange=scan;q('axis').onchange=section;q('cut').oninput=section;q('scan').onclick=scan;q('clear').onclick=()=>{clean();q('result').textContent='Overlays cleared. Refresh geometry to recalculate.'};q('close').onclick=close;q('export').onclick=()=>{const d=scan(),u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='TEAL-concept-3D-DFM.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};q('bom').onclick=()=>{try{window.parent.tealOpenDetailedBOM(q('a').value,typeof cfg==='undefined'?null:cfg,typeof src==='undefined'?null:src)}catch(e){q('result').textContent='Open Detailed BOM from Engineering Studio.'}};
 function open(){host.style.display='block';scan()}const launch=document.createElement('button');launch.textContent='Concept 3D DFM · V6';launch.style.cssText='position:absolute;right:12px;top:98px;z-index:32;background:#0e7773;color:white;border:1px solid #83c5c1;border-radius:6px;padding:7px 10px;font:bold 12px Arial;cursor:pointer';launch.onclick=()=>host.style.display==='none'?open():close();view.append(launch);sim.conceptDFM={open,scan,close};
})();


})();
}
