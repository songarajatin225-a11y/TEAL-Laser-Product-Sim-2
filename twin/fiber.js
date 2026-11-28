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
camera.position.set(-2500, -3300, 2300);
const controls = new T3.OrbitControls(camera, renderer.domElement);
controls.target.set(-80, 0, 950);
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
Object.assign(sun.shadow.camera, { left: -1400, right: 1400, top: 1400, bottom: -1400, near: 100, far: 9000 });
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
axesHelper.position.set(-1100, -800, 1);
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
//        MODEL: TEAL 25 W fiber laser marking system (XYZ head)
// =====================================================================
const HX = -35, HY = -6;            // marking-field centre (machine xy)
const HB = 107.8;                   // scan-head nose (bottom) height
const WDZ = HB - 18.9;              // nominal focal plane: 189 mm working distance
const ZR = 2.1;                     // ±21 mm Z compensation (42 mm range)
const FIELD = 12.5;                 // 125 × 125 mm field
const NEST_Z = 86;
const PARTS = {
  flange: { name: "Steel flange Ø100 × 12 mm", h: 1.2, mark: [0, 2.6], mw: 4.2, mh: 1.6 },
  housing: { name: "Al housing 80 × 60 × 45 mm", h: 4.5, mark: [0, 0.4], mw: 4.6, mh: 1.8 },
};
const MATX = {
  window: std(0x101317, 0.15, 0.4, { transparent: true, opacity: 0.55 }),
  dark: std(0x1a1d21, 0.5, 0.2),
  steelPart: std(0xa9b0b6, 0.32, 0.95),
  aluPart: std(0xd2d7dc, 0.38, 0.8),
  head: std(0x2e3338, 0.42, 0.35),
  fixture: std(0x6d767d, 0.4, 0.75),
  label: std(0xf2c200, 0.5, 0),
};
const LX0 = -70, LX1 = 0, RX0 = 4, RX1 = 60, YD = 37.5;

function feet(g, x0, x1) {
  for (const [x, y] of [[x0 + 4, -YD + 4], [x1 - 4, -YD + 4], [x0 + 4, YD - 4], [x1 - 4, YD - 4]]) {
    cylZ(g, x, y, 0, 1.2, 2.6, MAT.black); cylZ(g, x, y, 1.2, 6, 0.8, MAT.steel, { edges: false }); cylZ(g, x, y, 4.2, 5, 1.5, MAT.steel, { seg: 6 });
  }
  box(g, [x0, -YD, 6], [x1, YD, 8], MAT.aluDark);
}
function logoPlate(g, x, z, w) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const t = c.getContext("2d");
  t.fillStyle = "#f3f4f5"; t.fillRect(0, 0, 256, 64);
  t.fillStyle = "#0e8a86"; t.fillRect(8, 10, 14, 6); t.fillRect(26, 10, 14, 6); t.fillRect(13, 16, 6, 38); t.fillRect(29, 16, 6, 38);
  t.fillStyle = "#5e5d5b"; t.font = "bold 44px Arial"; t.fillText("TEAL", 56, 50);
  const tex = new T3.CanvasTexture(c); tex.encoding = T3.sRGBEncoding;
  const m = new T3.Mesh(new T3.PlaneGeometry(w, w / 4), new T3.MeshBasicMaterial({ map: tex }));
  m.rotation.x = Math.PI / 2; m.rotation.y = Math.PI; m.scale.x = -1; m.position.set(x, YD + 0.06, z); g.add(m);
}
function warnLabel(g, x, z, s = 2, y = YD) {
  box(g, [x - s / 2, y, z - s / 2], [x + s / 2, y + 0.06, z + s / 2], MATX.label, { edges: false, shadow: false });
  box(g, [x - s * 0.18, y + 0.06, z - s * 0.3], [x + s * 0.18, y + 0.1, z + s * 0.2], MAT.black, { edges: false, shadow: false });
}
function louver(g, x0, x1, z0, z1) {
  box(g, [x0, YD, z0], [x1, YD + 0.3, z1], MAT.panel);
  for (let z = z0 + 1; z < z1 - 0.5; z += 1.1) box(g, [x0 + 0.8, YD + 0.3, z], [x1 - 0.8, YD + 0.8, z + 0.4], MAT.wall, { edges: false });
}

// ---------- LEFT: marking cabinet (lower bay + laser-safe chamber) ----------
const gBase = G("baseL");
feet(gBase, LX0, LX1);
box(gBase, [LX0, -YD, 8], [LX1, -YD + 1, 80], MAT.powder);
box(gBase, [LX0, -YD + 1, 8], [LX0 + 1, YD, 80], MAT.powder);
box(gBase, [LX1 - 1, -YD + 1, 8], [LX1, YD, 80], MAT.powder);
box(gBase, [LX0 + 1, YD - 1, 9], [LX1 - 1, YD, 79], MAT.panel);                        // lower front door
box(gBase, [LX0 + 3, YD, 46], [LX0 + 4.2, YD + 1, 58], MAT.black);                      // door handle
louver(gBase, LX0 + 14, LX0 + 28, 50, 60);
lathe(gBase, [LX0 + 40, YD, 27], [0, 1, 0], [[0, 0], [0, 2.4], [0.6, 2.4], [0.6, 1.2], [2.2, 1.2], [2.2, 0]], MAT.red);   // main isolator
box(gBase, [LX0 + 36.6, YD, 23.6], [LX0 + 43.4, YD + 0.4, 30.4], MAT.yellow, { edges: false });
box(gBase, [LX0 + 39.4, YD + 2.2, 26.2], [LX0 + 40.6, YD + 3.4, 31], MAT.red, { edges: false });
warnLabel(gBase, LX0 + 40, 17, 3); warnLabel(gBase, LX0 + 52, 62, 2.4);
box(gBase, [LX0, -YD, 80], [LX1, YD, 82], MAT.alu);                                    // chamber floor / deck plate
// lower-bay content: fiber-source module & extraction fan
const gBay = G("bay");
box(gBay, [LX0 + 6, -30, 8], [LX0 + 40, 10, 22], MAT.black);
for (let i = 0; i < 6; i++) box(gBay, [LX0 + 8 + i * 5, 10, 12], [LX0 + 11 + i * 5, 10.3, 20], MAT.aluDark, { edges: false });
box(gBay, [LX0 + 46, -30, 8], [LX0 + 64, -6, 36], MAT.powder);

// chamber enclosure
const gEnc = G("enclosure");
box(gEnc, [LX0, -YD, 82], [LX1, -YD + 1, 165], MAT.powder);
const OPEN = { y0: -20, y1: 8, z0: 82, z1: 97 };                                          // side openings for the inline conveyor
const gSideCov = G("sideCovers");
for (const [x0, x1] of [[LX0, LX0 + 1], [LX1 - 1, LX1]]) {
  box(gEnc, [x0, -YD + 1, 82], [x1, OPEN.y0, 165], MAT.powder);
  box(gEnc, [x0, OPEN.y1, 82], [x1, YD, 165], MAT.powder);
  box(gEnc, [x0, OPEN.y0, OPEN.z1], [x1, OPEN.y1, 165], MAT.powder);
  const o = x0 < -10 ? -0.3 : 0.3;
  box(gSideCov, [Math.min(x0, x0 + o), OPEN.y0 - 0.6, OPEN.z0], [Math.max(x1, x1 + o), OPEN.y1 + 0.6, OPEN.z1 + 0.6], MAT.panel);
}
box(gEnc, [LX0, -YD, 165], [LX1, YD, 168], MAT.powder);
box(gEnc, [LX0, YD - 1, 82], [LX0 + 10, YD, 165], MAT.panel);                          // operator column
box(gEnc, [LX1 - 12, YD - 1, 82], [LX1, YD, 165], MAT.panel);
box(gEnc, [LX0 + 10, YD - 1, 150], [LX1 - 12, YD, 165], MAT.panel);
box(gEnc, [LX0 + 10, YD - 1, 82], [LX1 - 12, YD, 90], MAT.panel);
logoPlate(gEnc, LX0 + 9, 161, 12);
// door rails (vertical lift door) and counterweight covers
for (const x of [LX0 + 9.6, LX1 - 12.6]) box(gEnc, [x - 0.5, YD, 88], [x + 0.9, YD + 1.6, 183], MAT.alu);
box(gEnc, [LX0 + 9.1, YD, 181.6], [LX1 - 11.7, YD + 1.6, 183], MAT.alu);
// operator column: lamps, buttons, E-stop, key switch
[[0x36c46b, 157], [0xe5484d, 153], [0xf5a623, 149], [0xf3f4f5, 145], [0x2f6fd6, 141]].forEach(([c, z]) => { cyl(gEnc, [LX0 + 5, YD, z], [0, 1, 0], 0.6, 1.1, MAT.black, { seg: 18 }); cyl(gEnc, [LX0 + 5, YD + 0.6, z], [0, 1, 0], 0.7, 0.9, std(c, 0.35, 0, { emissive: c, emissiveIntensity: c === 0x36c46b ? 0.8 : 0.1 }), { seg: 18, edges: false }); });
box(gEnc, [LX0 + 1.8, YD, 126.6], [LX0 + 8.2, YD + 0.3, 133.4], MAT.yellow, { edges: false });
lathe(gEnc, [LX0 + 5, YD + 0.3, 130], [0, 1, 0], [[0, 0], [0, 1.2], [1.2, 1.2], [1.2, 0.8], [2.2, 0.8], [2.8, 2.2], [3.2, 0]], MAT.red);
cyl(gEnc, [LX0 + 5, YD, 120], [0, 1, 0], 0.8, 1.2, MAT.steel, { seg: 18 });
box(gEnc, [LX0 + 4.7, YD + 0.8, 119.2], [LX0 + 5.3, YD + 1.4, 120.8], MAT.black, { edges: false });
warnLabel(gEnc, LX0 + 5, 112, 3); warnLabel(gEnc, LX1 - 6, 156, 3);
// fume-extraction outlet on the roof
cylZ(gEnc, -20, -26, 168, 172, 3.2, MAT.aluDark);
// stack light at the right-hand top corner
cylZ(gEnc, -5, 4, 168, 169.4, 2.4, MAT.aluDark); cylZ(gEnc, -5, 4, 169.4, 178, 0.7, MAT.alu);
const lamps = { g: cylZ(gEnc, -5, 4, 178, 181, 1.9, MAT.lampG), a: cylZ(gEnc, -5, 4, 181, 184, 1.9, MAT.lampA), r: cylZ(gEnc, -5, 4, 184, 187, 1.9, MAT.lampR) };
cylZ(gEnc, -5, 4, 187, 188.4, 2, MAT.black);
cylZ(gEnc, -5, 4, 188.4, 190, 1.6, MAT.powder);                                         // buzzer
// light curtain (shown in the rotary configuration)
const gCurtain = G("curtain", gEnc);
for (const x of [LX0 + 10.6, LX1 - 13.4]) { box(gCurtain, [x, YD - 0.6, 90], [x + 1.8, YD + 1.2, 128], MAT.black); for (let z = 92; z < 127; z += 1.6) box(gCurtain, [x + (x < -40 ? 1.8 : -0.05), YD - 0.4, z], [x + (x < -40 ? 1.85 : 0), YD + 1, z + 0.4], MAT.red, { edges: false, shadow: false }); }

// vertical lift door with laser-protective window and handle bar
const gDoor = G("door");
box(gDoor, [LX0 + 10, YD + 1.6, 90], [LX1 - 12, YD + 2.4, 92], MAT.panel);
box(gDoor, [LX0 + 10, YD + 1.6, 147], [LX1 - 12, YD + 2.4, 150], MAT.panel);
box(gDoor, [LX0 + 10, YD + 1.6, 92], [LX0 + 16, YD + 2.4, 147], MAT.panel);
box(gDoor, [LX1 - 18, YD + 1.6, 92], [LX1 - 12, YD + 2.4, 147], MAT.panel);
box(gDoor, [LX0 + 16, YD + 1.6, 92], [LX1 - 18, YD + 2.4, 108], MAT.panel);
{ const w = new T3.Mesh(new T3.PlaneGeometry(LX1 - 18 - (LX0 + 16), 147 - 108), MATX.window); w.rotation.x = Math.PI / 2; w.position.set((LX0 + 16 + LX1 - 18) / 2, YD + 2, 127.5); w.renderOrder = 10; gDoor.add(w); }
box(gDoor, [LX0 + 15.4, YD + 1.5, 107.4], [LX1 - 17.4, YD + 2.5, 108.2], MAT.black, { edges: false });
box(gDoor, [LX0 + 15.4, YD + 1.5, 147], [LX1 - 17.4, YD + 2.5, 147.6], MAT.black, { edges: false });
for (const x of [LX0 + 15, LX1 - 18.4]) box(gDoor, [x, YD + 1.5, 107.4], [x + 0.6, YD + 2.5, 147.6], MAT.black, { edges: false });
cyl(gDoor, [LX0 + 14, YD + 4.6, 100], [1, 0, 0], LX1 - 26 - LX0 - 2, 0.55, MAT.black);
for (const x of [LX0 + 15, LX1 - 15]) cyl(gDoor, [x, YD + 2.4, 100], [0, 1, 0], 2.4, 0.5, MAT.black);

// ---------- XYZ scan head on a manual Z column ----------
const gHead = G("head");
box(gHead, [HX - 7, -YD + 1, 82], [HX + 7, -YD + 4, 166 - 1], MAT.aluDark);                 // column
box(gHead, [HX - 4, -YD + 4, 84], [HX + 4, -YD + 5, 164], MAT.steel);                     // linear guide
box(gHead, [HX - 6, -YD + 1, 82], [HX + 6, -YD + 10, 84], MAT.alu);
cyl(gHead, [HX, -YD + 6.6, 165], [0, 0, -1], 6, 1.2, MAT.black);                           // manual Z crank housing
cyl(gHead, [HX, -YD + 6.6, 166.4], [0, 0, 1], 1.0, 0.4, MAT.steel, { edges: false });
box(gHead, [HX - 6, -YD + 5, 118], [HX + 6, -YD + 10, 140], MAT.alu);                    // carriage
box(gHead, [HX - 5, -YD + 10, 124], [HX + 5, -26, 134], MAT.aluDark);                    // arm
box(gHead, [HX - 11, -26, HB + 4], [HX + 11, 2, HB + 26], MATX.head, { r: 0.8 });         // scan head body (galvo + Z module)
box(gHead, [HX - 11.2, -24, HB + 18], [HX + 11.2, 0, HB + 24], MAT.black, { edges: false });
box(gHead, [HX - 9, -24, HB], [HX + 9, 0, HB + 4], MAT.black, { r: 0.6 });
cylZ(gHead, HX, HY, HB - 0.6, HB, 3.2, MAT.black);                                          // protection window holder
cylZ(gHead, HX, HY, HB - 0.65, HB - 0.55, 2.6, MAT.lens, { edges: false });
cylZ(gHead, HX + 5.6, HY, HB - 0.4, HB, 0.7, MAT.black, { edges: false });                  // distance-sensor window
cylZ(gHead, HX - 5.6, HY, HB - 0.4, HB, 0.7, MAT.black, { edges: false });                  // coaxial camera port
box(gHead, [HX - 9, 2, HB + 10], [HX - 3, 3.2, HB + 14], MAT.teal, { edges: false });
const headLed = std(0x36c46b, 0.3, 0, { emissive: 0x36c46b, emissiveIntensity: 0.6 }); box(gHead, [HX + 6, 2, HB + 20], [HX + 8, 2.3, HB + 21], headLed, { edges: false });
const emitLed = std(0xf5a623, 0.3, 0, { emissive: 0xf5a623, emissiveIntensity: 0 }); box(gHead, [HX + 3, 2, HB + 20], [HX + 5, 2.3, HB + 21], emitLed, { edges: false });
cable(gHead, [[HX, -26, HB + 18], [HX, -32, HB + 18], [HX, -34, 150], [LX1 - 1, -34, 150]], 0.9, MAT.rubber, 4);   // head cable (≈ 4.3 m) to controller
// dedicated vision: pre-mark fiducial camera and post-mark grade verifier (each hung from the roof)
const gVision = G("vision");
function makeCam(label, light) {
  const pv = new T3.Group(); pv.name = label; gVision.add(pv);
  box(pv, [-2.4, -2.4, 1.6], [2.4, 2.4, 9], MAT.black);
  box(pv, [-2.5, -2.5, 6.6], [2.5, 2.5, 7.4], MAT.teal, { edges: false });
  cylZ(pv, 0, 0, 0.2, 1.6, 1.3, MAT.black);
  cyl(pv, [1.2, 2.4, 7.8], [0, 1, 0], 1.2, 0.5, MAT.aluDark, { edges: false, seg: 12 });
  const lm = std(0xf4f6f6, 0.3, 0, { emissive: light, emissiveIntensity: 0 });
  ring(pv, [0, 0, -0.6], [0, 0, 1], 1.5, 3.2, 0.8, lm);
  const rod = new T3.Mesh(new T3.CylinderGeometry(0.45, 0.45, 1, 12), MAT.alu); rod.castShadow = true; gVision.add(rod);
  const clamp = box(gVision, [-1.2, -1.2, 164], [1.2, 1.2, 165], MAT.aluDark);
  return { pv, lm, rod, clamp };
}
const CAM_PRE = makeCam("Pre-mark fiducial camera", 0x0e8a86), CAM_VER = makeCam("Post-mark grade verifier", 0xf4f6f6);
const CAM_POSE = {
  station: { pre: [HX - 16, HY + 3, 116], ver: [HX + 16, HY + 3, 116], tPre: [HX, HY, 88], tVer: [HX, HY, 88] },
  inline: { pre: [-58, HY, 112], ver: [-12, HY, 112], tPre: [-58, HY, 88], tVer: [-12, HY, 88] },
};
// fume nozzle on a segmented hose
const gFumeIn = G("fumeNozzle");
cable(gFumeIn, [[-20, -26, 165], [-20, -26, 150], [-16, -18, 120], [-18, -10, 100], [-24, -8, 95]], 1.4, MAT.rubber, 6);
cyl(gFumeIn, [-24, -8, 95], [-1, 0.1, -0.5], 3, 1.8, MAT.aluDark);

// ---------- work holding: fixture nest (door mode) / 2-station rotary indexer ----------
function nestMesh(parent, x, y) {
  const g = new T3.Group(); g.position.set(x, y, 0); parent.add(g);
  box(g, [-6, -5, 84], [6, 5, NEST_Z], MATX.fixture);
  for (const [px, py] of [[-4.6, -3.6], [4.6, 3.6]]) cylZ(g, px, py, NEST_Z, NEST_Z + 0.8, 0.35, MAT.steel, { edges: false, seg: 14 });
  for (const [a, b] of [[[-5.6, -4.6, NEST_Z], [-4.2, 4.6, NEST_Z + 1.2]], [[-5.6, -4.6, NEST_Z], [5.6, -3.4, NEST_Z + 1.2]]]) box(g, a, b, MAT.teal);
  const sensor = std(0x24272b, 0.4, 0, { emissive: 0x36c46b, emissiveIntensity: 0 });
  box(g, [5, 3, NEST_Z], [6, 4.4, NEST_Z + 1.2], sensor);
  return { g, sensor };
}
const gFix = G("fixture");
box(gFix, [HX - 8, HY - 7, 82], [HX + 8, HY + 7, 84], MAT.alu);
const NEST_FIX = nestMesh(gFix, HX, HY);
const gRot = G("rotary");
const RC = [HX, HY + 14];
cylZ(gRot, RC[0], RC[1], 82, 84, 7, MAT.aluDark);
const gTable = new T3.Group(); gTable.position.set(RC[0], RC[1], 0); gRot.add(gTable);
cylZ(gTable, 0, 0, 84, 84.8, 19.5, MAT.alu, { seg: 72 });
box(gTable, [-19, -0.4, 84.8], [19, 0.4, 118], MAT.powder);                                // centre shield
box(gTable, [-19, -0.5, 117.4], [19, 0.5, 118.4], MAT.aluDark);
const NEST_ROT = [nestMesh(gTable, 0, -14), nestMesh(gTable, 0, 14)];
// OK tray + lockable NG bin on a side shelf
const gShelf = G("shelf");
box(gShelf, [LX0 - 18, 8, 78], [LX0, 36, 80], MAT.alu);
for (const y of [9, 35]) box(gShelf, [LX0 - 1.5, y - 1, 64], [LX0, y, 80], MAT.aluDark);
box(gShelf, [LX0 - 17, 22, 80], [LX0 - 2, 35, 84], MAT.teal);                                 // OK tray
box(gShelf, [LX0 - 16, 23, 80.5], [LX0 - 3, 34, 84.1], MAT.black, { edges: false });
box(gShelf, [LX0 - 17, 9, 80], [LX0 - 2, 20, 90], MAT.red);                                    // NG bin
box(gShelf, [LX0 - 17.2, 8.8, 90], [LX0 - 1.8, 20.2, 90.6], MAT.black);
box(gShelf, [LX0 - 13, 13.5, 90.6], [LX0 - 6, 15.5, 90.9], MATX.dark, { edges: false });
box(gShelf, [LX0 - 3, 20, 86], [LX0 - 2.4, 20.4, 88], MAT.yellow, { edges: false });
const OK_AT = [LX0 - 9.5, 28.5, 84.2], NG_AT = [LX0 - 9.5, 14.5, 91];


// ---------- inline pallet conveyor (twin-strand belt) through the chamber ----------
const BELT = 83, CX0 = -112, CX1 = 46;
const gConv = G("conveyor");
for (const [y0, y1] of [[-15.2, -14.2], [2.2, 3.2]]) { box(gConv, [CX0, y0, 79.4], [CX1, y1, 86.4], MAT.alu); }
for (const [y0, y1] of [[-14, -11.6], [-0.4, 2]]) {
  box(gConv, [CX0 + 1, y0, 82.3], [CX1 - 1, y1, BELT], MATX.dark, { edges: false });
  for (const x of [CX0 + 1, CX1 - 1]) cyl(gConv, [x, y0, 82.1], [0, 1, 0], y1 - y0, 0.55, MAT.steel, { edges: false, seg: 14 });
}
box(gConv, [CX0, -14.2, 79.4], [CX1, 2.2, 80.2], MAT.aluDark);
for (const x of [CX0 + 4, -78, 6, CX1 - 4]) for (const y of [-14.7, 2.7]) { box(gConv, [x - 1, y - 0.8, 0], [x + 1, y + 0.8, 79.4], MAT.aluDark); cylZ(gConv, x, y, 0, 0.8, 1.6, MAT.black); }
box(gConv, [CX0 + 2, 3.2, 74], [CX0 + 9, 9, 80], MAT.black);                                     // drive motor
const STOPS = [-51, HX + 7, -5];
const stopMeshes = STOPS.map((x) => box(gConv, [x, HY - 1, 81.2], [x + 1, HY + 1, 82.6], MAT.teal));
stopMeshes.forEach((m) => (m.userData.z0 = m.position.z));
cylZ(gConv, HX, HY, 80.2, 82, 2.4, MAT.aluDark);                                                 // lift & locate unit
for (const s of [-1, 1]) cylZ(gConv, HX + s * 5, HY + s * 6, 80.2, 82, 0.5, MAT.steel, { edges: false, seg: 12 });
for (const x of [-60, -37, -14]) box(gConv, [x, 3.2, 83], [x + 1.4, 4.4, 85], MAT.black);       // pallet presence sensors
box(gConv, [-56, 3.2, 84], [-53, 4.4, 86.4], MAT.aluDark);                                     // RFID read head at the pre-mark stop
// labyrinth tunnels and pneumatic shutters at the side openings
const gTunnel = G("tunnels");
for (const [x0, x1] of [[LX0 - 8, LX0], [LX1, LX1 + 8]]) {
  box(gTunnel, [x0, OPEN.y0 - 1, OPEN.z1], [x1, OPEN.y1 + 1, OPEN.z1 + 1], MAT.powder);
  box(gTunnel, [x0, OPEN.y0 - 1, OPEN.z0], [x1, OPEN.y0, OPEN.z1], MAT.powder);
  box(gTunnel, [x0, OPEN.y1, OPEN.z0], [x1, OPEN.y1 + 1, OPEN.z1], MAT.powder);
  box(gTunnel, [x0 + (x0 < -10 ? 0 : 7.4), OPEN.y0 - 1, OPEN.z0 + 9], [x0 + (x0 < -10 ? 0.6 : 8), OPEN.y1 + 1, OPEN.z1], MAT.black, { edges: false });   // brush curtain
}
const SHUT = [LX0 + 1, LX1 - 1.6].map((x) => { const g = new T3.Group(); gTunnel.add(g); box(g, [x, OPEN.y0, OPEN.z0], [x + 0.6, OPEN.y1, OPEN.z1], MAT.aluDark); box(g, [x - 0.2, OPEN.y0 + 12, OPEN.z1 + 6], [x + 0.8, OPEN.y0 + 16, OPEN.z1 + 16], MAT.steel); return g; });
for (const x of [LX0 + 1, LX1 - 1.6]) box(gTunnel, [x - 0.4, OPEN.y0 + 11, OPEN.z1 + 16], [x + 1, OPEN.y0 + 17, OPEN.z1 + 26], MAT.black);   // shutter cylinders
// fixture pallet (rides on the belts; nest top at the same height as the static fixture)
const gPallet = G("pallet");
box(gPallet, [-7, -8, BELT], [7, 8, 84], MAT.aluDark);
const NEST_PAL = nestMesh(gPallet, 0, 0);
box(gPallet, [-7, 8, 83.2], [-4, 8.4, 83.8], MAT.black, { edges: false });                     // RFID tag
const palFlag = box(gPallet, [6, -8, 84], [7, -6, 86.6], MAT.red); palFlag.visible = false;

// ---------- parts (two carriers; flange / housing geometry) ----------
let ART = "dm";                     // artwork: dm | qr | text | logo | serial
function markTex(serial, col) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 192; const x = c.getContext("2d");
  x.clearRect(0, 0, 512, 192); x.fillStyle = col;
  const sn = `SN ${String(serial).padStart(6, "0")}`;
  const dm = (ox, oy, n, s) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const finder = i === 0 || j === n - 1, clock = (j === 0 && i % 2 === 0) || (i === n - 1 && j % 2 === 1); if (finder || clock || ((i * 13 + j * 7 + serial * 11 + i * j) % 7) < 3) x.fillRect(ox + i * s, oy + j * s, s, s); } };
  const qr = (ox, oy, n, s) => { const fin = (fx, fy) => { x.fillRect(ox + fx * s, oy + fy * s, 7 * s, 7 * s); x.clearRect(ox + (fx + 1) * s, oy + (fy + 1) * s, 5 * s, 5 * s); x.fillRect(ox + (fx + 2) * s, oy + (fy + 2) * s, 3 * s, 3 * s); }; fin(0, 0); fin(n - 7, 0); fin(0, n - 7); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if ((i < 8 && j < 8) || (i > n - 9 && j < 8) || (i < 8 && j > n - 9)) continue; if (((i * 17 + j * 5 + serial * 3 + i * j) % 5) < 2) x.fillRect(ox + i * s, oy + j * s, s, s); } };
  if (ART === "dm") { dm(12, 16, 16, 10); x.font = "bold 46px Arial"; x.fillText("TEAL", 200, 70); x.font = "32px monospace"; x.fillText(sn, 200, 118); x.fillText("P/N 25W-FL-01", 200, 160); }
  else if (ART === "qr") { qr(12, 12, 21, 8); x.font = "bold 40px Arial"; x.fillText("TEAL", 210, 70); x.font = "30px monospace"; x.fillText(sn, 210, 116); x.fillText("teal.example/ID", 210, 156); }
  else if (ART === "text") { x.font = "bold 54px Arial"; x.fillText("TEAL · LOT 26-11", 14, 72); x.font = "40px monospace"; x.fillText(sn + "  MADE IN INDIA", 14, 136); }
  else if (ART === "logo") { const L = (ox, oy, k) => { x.fillRect(ox, oy, 40 * k, 14 * k); x.fillRect(ox + 46 * k, oy, 40 * k, 14 * k); x.fillRect(ox + 13 * k, oy + 14 * k, 14 * k, 80 * k); x.fillRect(ox + 59 * k, oy + 14 * k, 14 * k, 80 * k); }; L(20, 30, 1.45); x.font = "bold 84px Arial"; x.fillText("TEAL", 170, 120); x.font = "28px monospace"; x.fillText(sn, 172, 168); }
  else { x.font = "bold 92px monospace"; x.fillText(String(serial).padStart(6, "0"), 30, 130); x.font = "26px monospace"; x.fillText("SERIAL", 34, 172); }
  const t = new T3.CanvasTexture(c); t.encoding = T3.sRGBEncoding; t.anisotropy = 8; return t;
}
function makePart() {
  const g = new T3.Group(); root.add(g);
  const fl = new T3.Group(), ho = new T3.Group(); g.add(fl); g.add(ho);
  // flange: disc with bore and bolt circle (sits on the nest top)
  lathe(fl, [0, 0, 0], [0, 0, 1], [[0, 1.5], [0, 5], [PARTS.flange.h, 5], [PARTS.flange.h, 1.5], [0, 1.5]], MATX.steelPart, { seg: 64 });
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; cylZ(fl, Math.cos(a) * 3.7, Math.sin(a) * 3.7, -0.01, PARTS.flange.h + 0.01, 0.4, MAT.black, { edges: false, seg: 14 }); }
  box(fl, [-0.4, -5.1, 0], [0.4, -4.4, PARTS.flange.h + 0.01], MAT.black, { edges: false });   // orientation notch (vision feature)
  // housing: machined block with pocket ribs and boss
  box(ho, [-4, -3, 0], [4, 3, PARTS.housing.h - 0.6], MATX.aluPart, { r: 0.25 });
  box(ho, [-3.6, -2.6, PARTS.housing.h - 0.6], [3.6, 2.6, PARTS.housing.h], MATX.aluPart, { r: 0.15 });
  for (const [x, y] of [[-3.1, -2.1], [3.1, -2.1], [-3.1, 2.1], [3.1, 2.1]]) cylZ(ho, x, y, PARTS.housing.h - 0.1, PARTS.housing.h + 0.01, 0.3, MAT.black, { edges: false, seg: 12 });
  cyl(ho, [4, 0, 2], [1, 0, 0], 0.6, 1.2, MATX.aluPart);
  const mk = {};
  for (const [k, grp] of [["flange", fl], ["housing", ho]]) {
    const P = PARTS[k];
    const mat = new T3.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, clippingPlanes: [new T3.Plane(new T3.Vector3(-1, 0, 0), 0)] });
    const m = new T3.Mesh(new T3.PlaneGeometry(P.mw, P.mh), mat); m.position.set(P.mark[0], P.mark[1], P.h + 0.005); m.visible = false; grp.add(m);
    const fr = new T3.Mesh(new T3.EdgesGeometry(new T3.PlaneGeometry(P.mw + 0.5, P.mh + 0.5)), new T3.LineBasicMaterial({ color: 0xe5484d })); fr.position.copy(m.position); fr.visible = false; grp.add(fr);
    mk[k] = { m, mat, fr };
  }
  return { g, fl, ho, mk, serial: -1 };
}
const PART = [makePart(), makePart()];

// ---------- RIGHT: controller cabinet ----------
const gCtl = G("controller");
feet(gCtl, RX0, RX1);
box(gCtl, [RX0, -YD, 8], [RX1, -YD + 1, 170], MAT.powder);
box(gCtl, [RX0, -YD + 1, 8], [RX0 + 1, YD, 170], MAT.powder);
box(gCtl, [RX1 - 1, -YD + 1, 8], [RX1, YD, 170], MAT.powder);
box(gCtl, [RX0, -YD, 170], [RX1, YD, 172], MAT.powder);
box(gCtl, [RX0 + 1, YD - 1, 9], [RX1 - 1, YD, 79], MAT.panel);
box(gCtl, [RX0 + 1, YD - 1, 81], [RX1 - 1, YD, 169], MAT.panel);
box(gCtl, [RX0 + 1, YD - 1, 79], [RX1 - 1, YD, 81], MAT.wall, { edges: false });
{ const w = new T3.Mesh(new T3.PlaneGeometry(22, 34), MATX.window); w.rotation.x = Math.PI / 2; w.position.set(RX0 + 30, YD + 0.05, 132); w.renderOrder = 10; gCtl.add(w);
  box(gCtl, [RX0 + 18.6, YD, 114.6], [RX0 + 41.4, YD + 0.4, 115.2], MAT.black, { edges: false }); box(gCtl, [RX0 + 18.6, YD, 148.8], [RX0 + 41.4, YD + 0.4, 149.4], MAT.black, { edges: false });
  for (const x of [RX0 + 18.6, RX0 + 40.8]) box(gCtl, [x, YD, 114.6], [x + 0.6, YD + 0.4, 149.4], MAT.black, { edges: false }); }
const laserKey = std(0xe5484d, 0.35, 0, { emissive: 0xe5484d, emissiveIntensity: 0 });
ring(gCtl, [RX0 + 30, YD, 132], [0, 1, 0], 1.6, 2.6, 0.4, MAT.powder); cyl(gCtl, [RX0 + 30, YD, 132], [0, 1, 0], 0.5, 1.6, laserKey, { seg: 24 });
box(gCtl, [RX0 + 48, YD, 112], [RX0 + 49.4, YD + 1.2, 124], MAT.black);
box(gCtl, [RX0 + 48, YD, 46], [RX0 + 49.4, YD + 1.2, 58], MAT.black);
louver(gCtl, RX0 + 30, RX0 + 46, 50, 60);
box(gCtl, [RX0 + 8, YD, 50], [RX0 + 9.2, YD + 0.4, 60], MAT.alu);
logoPlate(gCtl, RX0 + 7, 166, 10); warnLabel(gCtl, RX0 + 47, 154, 2.4); warnLabel(gCtl, RX0 + 47, 66, 2.4);
// inside: laser marking controller (fiber source + galvo/Z driver), IPC, PSU
const gCtlIn = G("ctlInside");
box(gCtlIn, [RX0 + 6, -30, 84], [RX1 - 6, 20, 104], MAT.black);
for (let i = 0; i < 10; i++) box(gCtlIn, [RX0 + 8 + i * 4, 20, 90], [RX0 + 10 + i * 4, 20.3, 100], MAT.aluDark, { edges: false });
box(gCtlIn, [RX0 + 6, -30, 108], [RX1 - 6, 14, 122], MAT.powder);
box(gCtlIn, [RX0 + 8, 14, 112], [RX0 + 20, 14.3, 118], MAT.black, { edges: false });
box(gCtlIn, [RX0 + 6, -30, 126], [RX0 + 30, 0, 160], MAT.panel);
for (let i = 0; i < 8; i++) box(gCtlIn, [RX0 + 7 + i * 2.8, 0, 134], [RX0 + 9 + i * 2.8, 1, 152], MAT.aluDark, { edges: false });
box(gCtlIn, [RX0 + 6, -30, 10], [RX1 - 6, 10, 40], MAT.powder);
cable(gCtlIn, [[RX0 + 1, -34, 150], [RX0 + 12, -34, 150], [RX0 + 12, -28, 104]], 0.9, MAT.rubber, 3);
const gBridge = G("bridge");
box(gBridge, [LX1, -36, 146], [RX0, -32, 154], MAT.aluDark);                                // cable bridge between cabinets

// ---------- HMI on a swing arm + keyboard tray ----------
const hmiCanvas = document.createElement("canvas"); hmiCanvas.width = 512; hmiCanvas.height = 320;
const hmiTex = new T3.CanvasTexture(hmiCanvas); hmiTex.encoding = T3.sRGBEncoding;
const gHmi = G("hmi");
box(gHmi, [RX0, YD, 124], [RX0 + 3, YD + 5, 128], MAT.alu);
cylZ(gHmi, RX0 + 1.5, YD + 5.5, 114, 130, 0.7, MAT.alu, { edges: false });
box(gHmi, [-1, YD + 4, 128], [RX0 + 2, YD + 7, 130], MAT.aluDark);
box(gHmi, [-12, YD + 7, 120], [14, YD + 8.4, 139], MAT.black);
{ const s = new T3.Mesh(new T3.PlaneGeometry(24.6, 17.2), new T3.MeshBasicMaterial({ map: hmiTex })); s.rotation.x = -Math.PI / 2; s.rotation.z = Math.PI; s.scale.x = -1; s.position.set(1, YD + 8.42, 129.5); gHmi.add(s); }
box(gHmi, [-11, YD + 2, 112], [13, YD + 12, 113], MAT.aluDark);
box(gHmi, [-9, YD + 4, 113], [9, YD + 10, 113.6], MAT.black);
box(gHmi, [10, YD + 6, 113], [12, YD + 9, 113.6], MAT.black);

// ---------- external fume extractor ----------
const gFume = G("fumeExt");
box(gFume, [-68, -80, 4], [-36, -48, 92], MAT.powder);
for (const [x, y] of [[-65, -77], [-39, -77], [-65, -51], [-39, -51]]) cyl(gFume, [x, y, 2], [0, 1, 0], 1, 2, MAT.black, { seg: 16 });
for (let j = 0; j < 6; j++) box(gFume, [-64 + j * 4, -48, 14], [-62 + j * 4, -47.8, 36], MAT.black, { edges: false, shadow: false });
box(gFume, [-62, -48, 76], [-50, -47.8, 86], MAT.black, { edges: false });
cylZ(gFume, -52, -64, 92, 95, 3, MAT.aluDark);
cable(gFume, [[-20, -26, 172], [-20, -26, 178], [-20, -64, 178], [-52, -64, 110], [-52, -64, 95]], 2, MAT.rubber, 10);

// ---------- beam, pointer lasers, focus marker, scan field, camera frusta ----------
const BEAM = (() => {
  const core = new T3.Mesh(new T3.CylinderGeometry(0.1, 0.1, 1, 8), new T3.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.9 }));
  const cone = new T3.Mesh(new T3.CylinderGeometry(0.06, 1.2, 1, 24, 1, true), new T3.MeshBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.12, depthWrite: false, side: T3.DoubleSide }));
  const spot = new T3.Mesh(new T3.SphereGeometry(0.28, 14, 10), new T3.MeshBasicMaterial({ color: 0xffffff }));
  const light = new T3.PointLight(0xff8040, 0, 300, 2);
  [core, cone, spot].forEach((m) => { m.visible = false; root.add(m); }); root.add(light);
  return { core, cone, spot, light };
})();
const DIST = (() => {
  const m = new T3.Mesh(new T3.CylinderGeometry(0.06, 0.06, 1, 6), new T3.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.85 }));
  const dot = new T3.Mesh(new T3.SphereGeometry(0.25, 12, 8), new T3.MeshBasicMaterial({ color: 0xff3b2f }));
  [m, dot].forEach((o) => { o.visible = false; root.add(o); });
  return { m, dot };
})();
const fieldBox = new T3.LineSegments(new T3.EdgesGeometry(new T3.BoxGeometry(FIELD, FIELD, 2 * ZR)), new T3.LineDashedMaterial({ color: 0x0e8a86, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.85 }));
fieldBox.computeLineDistances(); fieldBox.position.set(HX, HY, WDZ); root.add(fieldBox);
const focusRing = new T3.Mesh(new T3.RingGeometry(0.5, 0.75, 32), new T3.MeshBasicMaterial({ color: 0x0e8a86, side: T3.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }));
focusRing.renderOrder = 12; root.add(focusRing);
const fovHead = new T3.LineSegments(new T3.BufferGeometry(), MAT.fov), fovReader = new T3.LineSegments(new T3.BufferGeometry(), MAT.fov);
root.add(fovHead); root.add(fovReader);

const TREE = [
  { id: "baseL", g: gBase, label: "Marking cabinet base, feet, isolator", ex: [0, 0, -30] },
  { id: "bay", g: gBay, label: "Lower bay: source module, fan", ex: [0, 0, -50] },
  { id: "enclosure", g: gEnc, label: "Laser-safe chamber, operator panel, stack light", ex: [0, 0, 40] },
  { id: "door", g: gDoor, label: "Vertical lift door, OD window", ex: [0, 40, 40], cfg: ["door", "inline"] },
  { id: "sideCovers", g: gSideCov, label: "Side cover plates", ex: [0, 0, 0], cfg: ["door", "rotary"] },
  { id: "head", g: gHead, label: "XYZ scan head on Z column", ex: [0, 0, 20] },
  { id: "vision", g: gVision, label: "Pre-mark fiducial camera · post-mark grade verifier", ex: [0, 0, 30] },
  { id: "fumeNozzle", g: gFumeIn, label: "Fume nozzle & duct", ex: [20, -10, 30] },
  { id: "fixture", g: gFix, label: "Fixture nest (door load)", ex: [0, 0, 0], cfg: "door" },
  { id: "rotary", g: gRot, label: "2-station rotary indexer", ex: [0, 0, 0], cfg: "rotary" },
  { id: "shelf", g: gShelf, label: "OK tray · lockable NG bin", ex: [-20, 10, 0], cfg: ["door", "rotary"] },
  { id: "conveyor", g: gConv, label: "Inline pallet conveyor · stops · lift & locate", ex: [0, 20, 0], cfg: "inline" },
  { id: "tunnels", g: gTunnel, label: "Entry / exit tunnels · laser shutters", ex: [0, 20, 20], cfg: "inline" },
  { id: "pallet", g: gPallet, label: "Fixture pallet", ex: [0, 0, 0], cfg: "inline" },
  { id: "controller", g: gCtl, label: "Controller cabinet", ex: [40, 0, 0], move: true },
  { id: "bridge", g: gBridge, label: "Head-cable bridge", ex: [20, 0, 0], cfg: ["door", "rotary"] },
  { id: "ctlInside", g: gCtlIn, label: "Laser controller, IPC, PSU", ex: [40, 0, 20], move: true },
  { id: "hmi", g: gHmi, label: "HMI monitor & keyboard", ex: [0, 40, 0], hmi: true },
  { id: "fumeExt", g: gFume, label: "Fume extractor", ex: [0, -40, 0] },
];
const hidden = new Set();

// =====================================================================
//                        SIMULATION STATE MACHINE
// =====================================================================
let cfg = "door", src = "qs", prod = "flange";
const S = {};
function resetState() {
  Object.assign(S, {
    phase: 0, info: "", lamp: "green",
    door: cfg === "door" ? 1 : 0, tab: 0, px: -108, plift: 0, shut: 0, palOn: false, palNG: false, fz: WDZ, meas: null, vis: null, distOn: false, fovH: false, fovR: false, ringR: 0, ringP: 0, emit: 0, beam: false, spot: [HX, HY, WDZ],
    ppos: [null, null], pVis: [false, cfg === "rotary"], nestOf: [0, 1], rev: [0, 0], res: [null, null], sensor: 0,
    serial: 0, parts: 0, ok: 0, ng: 0, log: [], cycleT: 0, lastCycle: 0,
  });
  if (cfg === "rotary") { S.door = 1; S.serial = 1; S.res[1] = { serial: 1, marked: false }; setPartSerial(1, 1); }
}
const STEPS = ["Load & detect", "Recipe select", "Pre-mark fiducial", "Distance & Z focus", "Safety interlock", "XYZ mark", "Grade & verify", "OK/NG · log · unload"];
const SRC = { qs: "25 W Yb fiber · Q-switched", mopa: "25 W Yb fiber · MOPA" };
const NOTES = {
  qs: "Q-switched pulses: the usual choice for engraved / deep marks and frosted marks on aluminium; good general-purpose contrast on steel. Pulse format, frequency and parameters to be frozen after source selection and sample trials.",
  mopa: "MOPA (tunable pulse width): for dark annealed marks on stainless steel, black marks on anodised aluminium and fine, low-heat codes. Final choice to be confirmed by sample trials on customer parts.",
};
const JOB = { flange: "FLG-DM-01", housing: "HSG-DM-02" };
const markCol = () => (prod === "housing" ? (src === "qs" ? "#f4f6f7" : "#16181a") : (src === "qs" ? "#3b4146" : "#0f1113"));
const GRADE = (sn) => (sn % 4 === 0 ? { g: "D", v: "1.5", ok: false } : sn % 5 === 2 ? { g: "B", v: "3.1", ok: true } : { g: "A", v: (3.5 + (sn % 4) / 10).toFixed(1), ok: true });
function setPartSerial(i, sn) {
  const P = PART[i]; P.serial = sn;
  for (const k of ["flange", "housing"]) { const t = P.mk[k]; if (t.mat.map) t.mat.map.dispose(); t.mat.map = markTex(sn, src === "qs" ? (k === "housing" ? "#6c757b" : "#4a5157") : (k === "housing" ? "#16181a" : "#0d0f11")); t.mat.needsUpdate = true; }
}
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
  while (left > 0 && guard++ < 400) {
    if (!seg) { if (!queue.length) queue = cycle(); startSeg(queue.shift()); }
    const remain = seg.dur - segT;
    if (left >= remain) { left -= Math.max(0, remain); endSeg(seg); seg = null; }
    else { segT += left; applySeg(seg, seg.dur > 0 ? segT / seg.dur : 1); left = 0; }
  }
  S.cycleT += dt;
}
// ---- geometry of stations ----
function nestPose(n) {             // machine pose of a nest (x, y, z, rz)
  if (cfg === "door") return [HX, HY, NEST_Z, 0];
  if (cfg === "inline") return [S.px, HY, NEST_Z + S.plift, 0];
  const ly = n === 0 ? -14 : 14, c = Math.cos(S.tab), s = Math.sin(S.tab);
  return [RC[0] - ly * s, RC[1] + ly * c, NEST_Z, S.tab];
}
const markNest = () => (cfg !== "rotary" ? 0 : Math.round(S.tab / Math.PI) % 2);
const partAt = (n) => S.nestOf.indexOf(n);
function partPose(i) { if (S.ppos[i]) return [...S.ppos[i], cfg !== "rotary" ? 0 : S.tab]; return nestPose(S.nestOf[i]); }
function toMachine(pose, lx, ly, lz) { const c = Math.cos(pose[3]), s = Math.sin(pose[3]); return [pose[0] + lx * c - ly * s, pose[1] + lx * s + ly * c, pose[2] + lz]; }
function along(pts, u) {
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); L.push(d); tot += d; }
  let t = u * tot;
  for (let i = 0; i < L.length; i++) { if (t <= L[i] || i === L.length - 1) { const f = L[i] ? Math.min(1, t / L[i]) : 1; return pts[i].map((v, k) => v + (pts[i + 1][k] - v) * f); } t -= L[i]; }
  return pts[pts.length - 1];
}
function loadPath(n) { const [x, y] = nestPose(n); return [[x, 62, 101], [x, 32, 101], [x, y, 96], [x, y, NEST_Z]]; }
function unloadPath(n, ok) { const [x, y] = nestPose(n); const B = ok ? OK_AT : NG_AT; return [[x, y, NEST_Z], [x, y, 96], [x, 32, 101], [x, 52, 101], [B[0], B[1] + 6, 98], [B[0], B[1], B[2]]]; }
function moveSeg(phase, dur, i, pts, o = {}) {
  return SEG(phase, dur, {}, { ...o, start: () => { S.pVis[i] = true; S.ppos[i] = pts()[0]; if (o.start0) o.start0(); const p = pts(); o._p = p; }, tick: (u, e) => { S.ppos[i] = along(o._p || pts(), e); }, end: () => { if (o.end0) o.end0(); } });
}
// ---- the cycle ----
function cycle() {
  const P = PARTS[prod];
  const q = [];
  const surf = () => NEST_Z + S.plift + P.h;
  let mi = 0;                                   // part index at the marking station (resolved at run time)
  const MI = () => partAt(markNest());
  if (cfg === "door") {
    q.push(SEG(0, 0.5, { door: 1 }, { start: () => { S.cycleT = 0; S.lamp = "green"; S.vis = null; S.meas = null; S.rev[0] = 0; S.res[0] = null; }, info: "Door open · operator loads the part into the fixture nest" }));
    q.push(moveSeg(0, 1.4, 0, () => loadPath(0), { start0: () => { S.serial++; setPartSerial(0, S.serial); S.res[0] = { serial: S.serial, marked: false }; S.nestOf[0] = 0; }, end0: () => { S.ppos[0] = null; } }));
    q.push(SEG(0, 0.9, { door: 0 }, { info: "Lift door closes on its rails" }));
  } else {
    q.push(SEG(0, 1.5, { tab: 0 }, {
      start: () => { S.cycleT = 0; S.lamp = "green"; S.vis = null; S.meas = null; const t0 = S.tab; S._t0 = t0; },
      to: () => ({ tab: S.tab + Math.PI }),
      info: "Rotary indexer turns 180°: freshly loaded part into the marking station, shield closes the laser side",
      end: () => { S.tab = Math.round(S.tab / Math.PI) * Math.PI; },
    }));
  }
  q.push(SEG(0, 0.4, { sensor: 1 }, { info: "Part-presence sensor confirms the part is seated in the nest" }));
  q.push(SEG(1, 0.8, {}, { info: () => `Recipe: job ${JOB[prod]} selected (HMI / barcode input / MES) · ${P.name}` }));
  if (cfg === "inline") return cycleInline(q, P, surf, MI);
  q.push(SEG(2, 0.4, {}, { start: () => { S.fovH = true; S.ringP = 1; }, info: "Pre-mark fiducial camera + ring light capture the part features / fiducials" }));
  q.push(SEG(2, 0.6, {}, { end: () => { S.ringP = 0; const i = MI(), sn = S.res[i] ? S.res[i].serial : 0; S.vis = { dx: (0.04 + (sn % 3) * 0.03).toFixed(2), dy: (-0.02 - (sn % 2) * 0.03).toFixed(2), dt: (0.3 + (sn % 4) * 0.2).toFixed(1) }; S.fovH = false; }, info: "Pattern match on the bore / edge features", infoEnd: () => `Position correction sent to the controller: ΔX ${S.vis.dx} · ΔY ${S.vis.dy} mm · Δθ ${S.vis.dt}° (simulated)` }));
  q.push(SEG(3, 0.6, {}, { start: () => { S.distOn = true; }, info: "683 nm distance sensor measures the part surface height" }));
  q.push(SEG(3, 0.8, () => ({ fz: surf() }), { end: () => { S.meas = surf(); S.distOn = false; }, info: "Z compensation moves the focal plane onto the surface (no mechanical axis moves)", infoEnd: () => `Height ${((surf() - NEST_Z) * 10).toFixed(1)} mm · focus offset ${((surf() - WDZ) * 10 >= 0 ? "+" : "−")}${Math.abs((surf() - WDZ) * 10).toFixed(1)} mm within ±21 mm range` }));
  q.push(SEG(4, 0.8, { emit: 1 }, { info: () => (cfg === "door" ? "Interlocks: door closed, E-stop healthy, extraction running, laser ready → emission enabled" : "Interlocks: shield in place, light curtain healthy, E-stop, extraction running, laser ready → emission enabled") }));
  q.push(SEG(5, 3.2, {}, {
    start: () => { S.beam = true; mi = MI(); },
    tick: (u) => { S.rev[mi] = u; },
    end: () => { S.beam = false; S.rev[mi] = 1; if (S.res[mi]) S.res[mi].marked = true; S.parts++; S.emit = 0; },
    info: () => `XYZ marking: Data Matrix ECC200 + text “SN ${String(S.res[MI()] ? S.res[MI()].serial : 0).padStart(6, "0")}” · ${src === "qs" ? "Q-switched" : "MOPA"} pulse set`,
  }));
  q.push(SEG(6, 0.5, {}, { start: () => { S.ringR = 1; S.fovR = true; }, info: "Post-mark grade verifier + ring light image the fresh mark" }));
  q.push(SEG(6, 0.7, {}, {
    end: () => { S.ringR = 0; S.fovR = false; const i = MI(); const g = GRADE(S.res[i].serial); Object.assign(S.res[i], g); if (g.ok) S.ok++; else { S.ng++; S.lamp = "amber"; } S.log.unshift({ sn: S.res[i].serial, job: JOB[prod], g: g.g, ok: g.ok }); S.log.length = Math.min(S.log.length, 6); },
    info: "Decode, grade (ISO/IEC 15415) and check mark presence / position",
    infoEnd: () => { const r = S.res[MI()]; return `Grade ${r.g} (${r.v}) · position within window · ${r.ok ? "OK" : "below spec C → NG"} (simulated)`; },
  }));
  if (cfg === "door") {
    q.push(SEG(7, 0.8, { door: 1, sensor: 0 }, { info: () => `Logged SN ${S.res[0].serial} · job ${JOB[prod]} · ${S.res[0].ok ? "OK" : "NG"} · door opens` }));
    q.push(moveSeg(7, 1.4, 0, () => unloadPath(0, S.res[0].ok), { start0: () => { S.info = S.res[0].ok ? "OK part released to the OK tray" : "NG part segregated into the lockable NG bin"; }, end0: () => { S.pVis[0] = false; S.lastCycle = S.cycleT; S.fz = WDZ; } }));
  } else {
    q.push(SEG(7, 0.5, { sensor: 0 }, { info: () => { const r = S.res[MI()]; return `Logged SN ${r.serial} · job ${JOB[prod]} · ${r.ok ? "OK" : "NG"} · result travels with the part to the front station`; } }));
    // operator station (front): unload the part marked last cycle, then load a raw part
    let fi = -1;
    const mv = SEG(7, 1.3, {}, {}); q.push(mv);
    mv.start = () => { fi = partAt(1 - markNest()); const ok = fi >= 0 && S.res[fi] && S.res[fi].marked; mv._ok = ok; if (!ok) { S.info = "Front station: empty nest, ready to load"; return; } const pts = unloadPath(1 - markNest(), S.res[fi].ok); mv._p = pts; S.ppos[fi] = pts[0]; S.info = `Front station (light curtain): operator removes SN ${S.res[fi].serial} → ${S.res[fi].ok ? "OK tray" : "NG bin"}`; };
    mv.tick = (u, e) => { if (mv._ok) S.ppos[fi] = along(mv._p, e); };
    mv.end = () => { if (mv._ok) { S.pVis[fi] = false; S.ppos[fi] = null; } };
    const ld = SEG(7, 1.3, {}, {});
    ld.start = () => { const n = 1 - markNest(); const i = partAt(n); ld._i = i; S.serial++; setPartSerial(i, S.serial); S.res[i] = { serial: S.serial, marked: false }; S.rev[i] = 0; S.pVis[i] = true; ld._p = loadPath(n); S.ppos[i] = ld._p[0]; S.info = `Operator loads raw part SN ${S.serial} at the front station`; };
    ld.tick = (u, e) => { S.ppos[ld._i] = along(ld._p, e); };
    ld.end = () => { S.ppos[ld._i] = null; S.lastCycle = S.cycleT; S.fz = WDZ; };
    q.push(ld);
  }
  return q;
}


function visEnd(MI) { const i = MI(), sn = S.res[i] ? S.res[i].serial : 0; S.vis = { dx: (0.04 + (sn % 3) * 0.03).toFixed(2), dy: (-0.02 - (sn % 2) * 0.03).toFixed(2), dt: (0.3 + (sn % 4) * 0.2).toFixed(1) }; }
function gradeEnd(MI) { const i = MI(); const g = GRADE(S.res[i].serial); Object.assign(S.res[i], g); if (g.ok) S.ok++; else { S.ng++; S.lamp = "amber"; S.palNG = true; } S.log.unshift({ sn: S.res[i].serial, job: JOB[prod], g: g.g, ok: g.ok }); S.log.length = Math.min(S.log.length, 6); }
function cycleInline(q, P, surf, MI) {
  // 01 Load: q already holds nothing for inline; build from scratch
  q.length = 0;
  q.push(SEG(0, 0.5, {}, { start: () => { S.cycleT = 0; S.lamp = "green"; S.vis = null; S.meas = null; S.palNG = false; S.px = -108; S.plift = 0; S.palOn = true; S.pVis[0] = true; S.ppos[0] = null; S.nestOf[0] = 0; S.rev[0] = 0; S.serial++; setPartSerial(0, S.serial); S.res[0] = { serial: S.serial, marked: false }; }, info: "SMEMA handshake with upstream: pallet with part available, marker ready" }));
  q.push(SEG(0, 1.8, { px: -58 }, { info: "Belts convey the pallet through the entry tunnel to the pre-mark stop" }));
  q.push(SEG(0, 0.4, { sensor: 1 }, { info: "Pallet-presence sensor confirms the stop position" }));
  q.push(SEG(1, 0.8, {}, { info: () => `RFID tag / part barcode read at the stop → job ${JOB[prod]} · ${P.name}` }));
  q.push(SEG(2, 0.45, {}, { start: () => { S.fovH = true; S.ringP = 1; }, info: "Pre-mark fiducial station: camera + ring light image the part fiducials" }));
  q.push(SEG(2, 0.65, {}, { end: () => { S.fovH = false; S.ringP = 0; visEnd(MI); }, info: "Pattern match → X, Y, θ offsets for the mark job", infoEnd: () => `Pre-mark correction stored for SN ${S.res[0].serial}: ΔX ${S.vis.dx} · ΔY ${S.vis.dy} mm · Δθ ${S.vis.dt}° (simulated)` }));
  q.push(SEG(3, 1.2, { px: HX, sensor: 0 }, { info: "Stop drops; belts index the pallet to the marking station" }));
  q.push(SEG(3, 0.5, { plift: 0.4 }, { info: "Lift & locate: pallet raised off the belts onto locating pins" }));
  q.push(SEG(3, 0.6, {}, { start: () => { S.distOn = true; }, info: "683 nm distance sensor measures the part surface height" }));
  q.push(SEG(3, 0.8, () => ({ fz: surf() }), { end: () => { S.meas = surf(); S.distOn = false; }, info: "Z compensation moves the focal plane onto the surface", infoEnd: () => `Height ${((surf() - NEST_Z - S.plift) * 10).toFixed(1)} mm · focus offset ${((surf() - WDZ) * 10 >= 0 ? "+" : "−")}${Math.abs((surf() - WDZ) * 10).toFixed(1)} mm within ±21 mm range` }));
  q.push(SEG(4, 0.8, { shut: 1, emit: 1 }, { info: "Entry / exit shutters close, door interlocked, E-stop, extraction, laser ready → emission enabled" }));
  let mi = 0;
  q.push(SEG(5, 3.2, {}, { start: () => { S.beam = true; mi = MI(); }, tick: (u) => { S.rev[mi] = u; }, end: () => { S.beam = false; S.rev[mi] = 1; S.res[mi].marked = true; S.parts++; S.emit = 0; }, info: () => `XYZ marking with the pre-mark correction applied: Data Matrix ECC200 + “SN ${String(S.res[0].serial).padStart(6, "0")}” · ${src === "qs" ? "Q-switched" : "MOPA"}` }));
  q.push(SEG(6, 0.5, { shut: 0, plift: 0 }, { info: "Shutters open, pallet lowered onto the belts" }));
  q.push(SEG(6, 1.1, { px: -12 }, { info: "Belts index the pallet to the post-mark grade verifier" }));
  q.push(SEG(6, 0.5, {}, { start: () => { S.ringR = 1; S.fovR = true; }, info: "Grade verifier + ring light image the fresh code" }));
  q.push(SEG(6, 0.7, {}, { end: () => { S.ringR = 0; S.fovR = false; gradeEnd(MI); }, info: "Decode, ISO/IEC 15415 grade, mark presence / position check", infoEnd: () => { const r = S.res[0]; return `Grade ${r.g} (${r.v}) · ${r.ok ? "OK" : "below spec C → NG"} (simulated)`; } }));
  q.push(SEG(7, 0.5, {}, { info: () => `Logged SN ${S.res[0].serial} · job ${JOB[prod]} · ${S.res[0].ok ? "OK" : "NG"} → MES` }));
  q.push(SEG(7, 1.7, { px: 44 }, { info: () => (S.res[0].ok ? "Pallet leaves through the exit tunnel to downstream" : "Pallet leaves with NG flag → downstream reject gate"), end: () => { S.palOn = false; S.pVis[0] = false; S.lastCycle = S.cycleT; S.fz = WDZ; } }));
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
let simT = 0;
const planeN = new T3.Vector3(), planeP = new T3.Vector3();
function applyModel() {
  simT += 0.016;
  const P = PARTS[prod];
  gDoor.position.z = 30 * S.door;
  gTable.rotation.z = S.tab;
  gCurtain.visible = cfg === "rotary";
  gPallet.position.set(S.px, HY, S.plift); gPallet.visible = S.palOn && cfg === "inline" && !hidden.has("pallet");
  palFlag.visible = S.palNG; NEST_PAL.sensor.emissiveIntensity = S.sensor * 1.2;
  SHUT.forEach((g) => (g.position.z = 15 * (1 - S.shut)));
  stopMeshes.forEach((m, k) => { const at = [-58, HX, -12][k]; m.position.z = m.userData.z0 - (Math.abs(S.px - at) < 0.5 || (k === 0 && S.phase <= 2) ? 0 : 1.2); });
  CAM_PRE.lm.emissiveIntensity = S.ringP * 1.5; CAM_VER.lm.emissiveIntensity = S.ringR * 1.5;
  NEST_FIX.sensor.emissiveIntensity = S.sensor * 1.2;
  NEST_ROT.forEach((n, k) => (n.sensor.emissiveIntensity = k === markNest() ? S.sensor * 1.2 : 0));
  // parts
  PART.forEach((pt, i) => {
    pt.g.visible = S.pVis[i] && (cfg === "rotary" || i === 0);
    pt.fl.visible = prod === "flange"; pt.ho.visible = prod === "housing";
    const pose = partPose(i); pt.g.position.set(pose[0], pose[1], pose[2]); pt.g.rotation.z = pose[3];
    const mk = pt.mk[prod]; mk.m.visible = S.rev[i] > 0; mk.fr.visible = !!(S.res[i] && S.res[i].ok === false && S.rev[i] >= 1);
    if (mk.m.visible) {
      pt.g.updateMatrixWorld(true);
      planeN.set(1, 0, 0).transformDirection(mk.m.matrixWorld).negate();
      planeP.set(-P.mw / 2 + P.mw * Math.min(1, S.rev[i]) + (S.rev[i] >= 1 ? 1 : 0), 0, 0); mk.m.localToWorld(planeP);
      mk.mat.clippingPlanes[0].setFromNormalAndCoplanarPoint(planeN, planeP);
    }
  });
  // beam, focus, sensors
  const mi = partAt(markNest());
  const surfZ = NEST_Z + S.plift + P.h;
  focusRing.position.set(HX, HY, S.fz); focusRing.visible = $("#t-fov").checked;
  if (S.beam && mi >= 0) {
    const pose = partPose(mi), u = Math.min(1, S.rev[mi]);
    const lx = P.mark[0] - P.mw / 2 + P.mw * u, ly = P.mark[1] + Math.sin(simT * 90) * P.mh * 0.45;
    const sp = toMachine(pose, lx, ly, P.h + 0.01);
    const nose = [HX, HY, HB - 0.6];
    stretch(BEAM.core, nose, sp); stretch(BEAM.cone, nose, sp);
    BEAM.cone.quaternion.multiply(new T3.Quaternion().setFromAxisAngle(new T3.Vector3(1, 0, 0), Math.PI));
    BEAM.spot.position.set(...sp); BEAM.spot.scale.setScalar(0.8 + 0.4 * Math.sin(simT * 70));
    BEAM.light.position.set(sp[0], sp[1], sp[2] + 0.5); BEAM.light.intensity = 1.6;
    [BEAM.core, BEAM.cone, BEAM.spot].forEach((m) => (m.visible = true));
  } else { [BEAM.core, BEAM.cone, BEAM.spot].forEach((m) => (m.visible = false)); BEAM.light.intensity = 0; }
  if (S.distOn) { const a = [HX + 5.6, HY, HB - 0.4], b = [HX + 0.3, HY, surfZ + 0.02]; stretch(DIST.m, a, b); DIST.dot.position.set(...b); DIST.m.visible = DIST.dot.visible = true; } else DIST.m.visible = DIST.dot.visible = false;
  if (mi >= 0 && S.pVis[mi]) {
    const pose = partPose(mi), cp = pose.slice(0, 2).concat(pose[2] + P.h + 0.02), cm = toMachine(pose, P.mark[0], P.mark[1], P.h + 0.02);
    frustum(fovHead, CAM_PRE.pv.position.toArray(), cp, 3.6, S.fovH);
    frustum(fovReader, CAM_VER.pv.position.toArray(), cm, 2.6, S.fovR);
  } else { fovHead.visible = fovReader.visible = false; }
  emitLed.emissiveIntensity = S.emit * 1.6; laserKey.emissiveIntensity = S.emit > 0.5 || S.beam ? 1.4 : 0.15;
  MAT.lampG.emissiveIntensity = S.lamp === "green" ? 1.6 : 0; MAT.lampA.emissiveIntensity = S.lamp === "amber" || S.beam ? 1.6 : 0; MAT.lampR.emissiveIntensity = S.lamp === "red" ? 1.6 : 0;
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
const cfgOk = (t) => !t.cfg || [].concat(t.cfg).includes(cfg);
function placeCams() {
  const P = cfg === "inline" ? CAM_POSE.inline : CAM_POSE.station;
  [[CAM_PRE, P.pre, P.tPre], [CAM_VER, P.ver, P.tVer]].forEach(([c, p, t]) => {
    c.pv.position.set(...p);
    const d = new T3.Vector3(t[0] - p[0], t[1] - p[1], t[2] - p[2]).normalize();
    c.pv.quaternion.setFromUnitVectors(new T3.Vector3(0, 0, -1), d);
    const top = [p[0] - d.x * 8.5, p[1] - d.y * 8.5, p[2] - d.z * 8.5];
    stretch(c.rod, top, [top[0], top[1], 164]); c.clamp.position.set(top[0], top[1], 164.5);
  });
}
function applyVisibility() {
  TREE.forEach((t) => (t.g.visible = !hidden.has(t.id) && cfgOk(t)));
  $$(".tree-row[data-cfg]").forEach((r) => r.classList.toggle("off", !cfgOk(TREE.find((t) => t.id === r.dataset.id))));
  placeCams(); applyExplode();
}
let explode = 0;
function applyExplode() { TREE.forEach((t) => { const b = cfg === "inline" ? (t.move ? [-4, -77, 0] : t.hmi ? [-4, 0, 0] : [0, 0, 0]) : [0, 0, 0]; t.g.position.set(b[0] + t.ex[0] * explode, b[1] + t.ex[1] * explode, b[2] + t.ex[2] * explode); }); }
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
  iso: { p: [-2500, -3300, 2300], t: [-80, 0, 950] },
  front: { p: [-50, -6000, 1050], t: [-50, 0, 1000] },
  top: { p: [-50, 1, 6600], t: [-50, 0, 900] },
  right: { p: [5200, 0, 1050], t: [0, 0, 1000] },
  process: { p: [-700, -1900, 1500], t: [-330, 20, 960], xray: true },
  head: { p: [-120, -900, 1080], t: [-350, 50, 960], xray: true },
  station: { p: [-950, -1500, 1250], t: [-500, -150, 900] },
};
let camAnim = null;
function goView(name) {
  const v = VIEWS[name]; if (!v) return;
  camAnim = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new T3.Vector3(...v.p), t1: new T3.Vector3(...v.t) };
  setXray(!!v.xray);
  $$("[data-view]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.view === name)));
}
$$("[data-view]").forEach((bt) => bt.addEventListener("click", () => goView(bt.dataset.view)));
function restart() { resetState(); queue = []; seg = null; applyVisibility(); writeNote(); }
function setCfg(next) { cfg = next; $$("[data-cfg-btn]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.cfgBtn === cfg))); restart(); }
function setSrc(next) { src = next; $$("[data-src]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.src === src))); PART.forEach((p, i) => { if (p.serial > 0) setPartSerial(i, p.serial); }); writeNote(); }
function setArtwork(a) { ART = a; PART.forEach((p, i) => { if (p.serial > 0) setPartSerial(i, p.serial); }); }
function setProd(next) { prod = next; $$("[data-prod]").forEach((bt) => bt.setAttribute("aria-pressed", String(bt.dataset.prod === prod))); restart(); }
function writeNote() { $("#note").innerHTML = `<b>${SRC[src]} · ${cfg === "door" ? "Standalone · lift door + fixture nest" : cfg === "inline" ? "Inline · pallet conveyor · pre-mark fiducial → mark → grade verifier" : "Standalone · 2-station rotary indexer (load while marking)"} · ${PARTS[prod].name}</b> — ${NOTES[src]}`; }
$$("[data-cfg-btn]").forEach((bt) => bt.addEventListener("click", () => setCfg(bt.dataset.cfgBtn)));
$$("[data-src]").forEach((bt) => bt.addEventListener("click", () => setSrc(bt.dataset.src)));
$$("[data-prod]").forEach((bt) => bt.addEventListener("click", () => setProd(bt.dataset.prod)));
let paused = false, speed = 1;
$("#play").addEventListener("click", () => { paused = !paused; $("#play").textContent = paused ? "Play" : "Pause"; $("#play").setAttribute("aria-pressed", String(paused)); });
$("#speed").addEventListener("input", (e) => { speed = [0.25, 0.5, 1, 2, 4][Number(e.target.value)]; $("#speed-v").textContent = `${speed}×`; });
function jumpTo(step) {
  if (seg) { const s = seg; seg = null; endSeg(s); }
  while (queue.length) { const s = queue.shift(); startSeg(s); endSeg(s); }
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
  const P = PARTS[prod], mi = partAt(markNest()), r = mi >= 0 ? S.res[mi] : null;
  const key = `${prod}|${cfg}|${src}|${S.phase}|${Math.round((mi >= 0 ? S.rev[mi] : 0) * 10)}|${S.log.length}|${S.log[0] && S.log[0].sn}|${S.meas}|${!!S.vis}`;
  if (key === hmiKey) return; hmiKey = key;
  const c = hmiCanvas.getContext("2d");
  c.fillStyle = "#0f1d1d"; c.fillRect(0, 0, 512, 320);
  c.fillStyle = "#1d3a39"; c.fillRect(10, 10, 492, 34);
  c.fillStyle = "#3cc4bd"; c.font = "bold 16px monospace"; c.fillText(`TEAL 25W FIBER · JOB ${JOB[prod]} · ${STEPS[S.phase].toUpperCase()}`, 18, 33);
  STEPS.forEach((_, i) => { c.fillStyle = i === S.phase ? "#3cc4bd" : i < S.phase ? "#4f8f8a" : "#2c4b4a"; c.fillRect(18 + i * 60, 52, 52, 7); });
  // part preview with mark progress
  c.fillStyle = "#25403f"; c.fillRect(18, 72, 200, 150);
  c.fillStyle = "#8d979e";
  if (prod === "flange") { c.beginPath(); c.arc(118, 147, 66, 0, Math.PI * 2); c.fill(); c.fillStyle = "#25403f"; c.beginPath(); c.arc(118, 147, 20, 0, Math.PI * 2); c.fill(); }
  else c.fillRect(48, 102, 140, 100);
  const u = mi >= 0 ? Math.min(1, S.rev[mi]) : 0;
  const mx = 118 - 50, my = prod === "flange" ? 100 : 128;
  c.strokeStyle = "#3cc4bd"; c.lineWidth = 1; c.strokeRect(mx, my, 100, 38);
  c.fillStyle = "#0f1d1d"; c.fillRect(mx, my, 100 * u, 38);
  c.fillStyle = "#9fd6d3"; c.font = "13px monospace";
  const lines = [
    `SN     ${r ? String(r.serial).padStart(6, "0") : "—"}`,
    `HEIGHT ${S.meas ? ((S.meas - NEST_Z) * 10).toFixed(1) + " mm" : "—"}`,
    `VISION ${S.vis ? `${S.vis.dx}/${S.vis.dy}/${S.vis.dt}°` : "—"}`,
    `PULSE  ${src === "qs" ? "Q-SWITCH" : "MOPA"}`,
    `OK ${S.ok}   NG ${S.ng}`,
  ];
  lines.forEach((t, i) => c.fillText(t, 236, 88 + i * 22));
  c.fillStyle = "#4f8f8a"; c.fillText("LOG  SN      JOB        GRADE", 18, 244);
  S.log.slice(0, 3).forEach((l, i) => { c.fillStyle = l.ok ? "#9fd6d3" : "#e5484d"; c.fillText(`     ${String(l.sn).padStart(6, "0")}  ${l.job}  ${l.g} ${l.ok ? "OK" : "NG"}`, 18, 264 + i * 18); });
  hmiTex.needsUpdate = true;
}
function updateDro() {
  const r = (v) => fmt(v * 10), mi = partAt(markNest());
  $("#dro").innerHTML = [
    ["Part", PARTS[prod].name.split(" ").slice(0, 2).join(" "), ""],
    ["Focal plane Z", r(S.fz - NEST_Z), "mm above nest"],
    ["Focus offset", r(S.fz - WDZ), "mm (±21 range)"],
    ["Measured height", S.meas ? r(S.meas - NEST_Z) : "—", S.meas ? "mm" : ""],
    ["Vision ΔX / ΔY", S.vis ? `${S.vis.dx} / ${S.vis.dy}` : "—", S.vis ? `mm · Δθ ${S.vis.dt}°` : ""],
    cfg === "door" ? ["Door lift", r(S.door * 30), "mm"] : cfg === "inline" ? ["Pallet X", S.palOn ? r(S.px - HX) : "—", S.palOn ? "mm from mark axis" : ""] : ["Indexer angle", `${((S.tab * 180 / Math.PI) % 360).toFixed(1)}°`, ""],
    ...(cfg === "inline" ? [["Lift & locate · shutters", `${r(S.plift)} · ${S.shut > 0.5 ? "closed" : "open"}`, ""]] : []),
    ["Mark progress", mi >= 0 ? `${Math.round(Math.min(1, S.rev[mi]) * 100)} %` : "—", ""],
    ["Parts marked", String(S.parts), ""], ["OK / NG", `${S.ok} / ${S.ng}`, ""],
    ["Cycle (sim)", `${S.cycleT.toFixed(1)} s`, S.lastCycle ? `last ${S.lastCycle.toFixed(1)} s` : ""],
  ].map(([k, v, u]) => `<div><span>${k}</span><b>${v}</b><i>${u}</i></div>`).join("");
  $("#readout").textContent = `${STEPS[S.phase]} · ${S.info}`;
  $$("[data-step]").forEach((el, i) => el.toggleAttribute("data-now", i === S.phase));
  $("#lamp").dataset.lamp = S.lamp;
}
const LABELS = [
  ["XYZ scan head (galvo + Z module)", [HX, -12, 136], null], ["683 nm distance sensor", [HX + 5, HY, 104.5], null],
  ["Pre-mark fiducial camera", [HX - 18, HY + 3, 127], ["door", "rotary"]], ["Post-mark grade verifier", [HX + 18, HY + 3, 127], ["door", "rotary"]],
  ["Pre-mark fiducial camera", [-58, HY, 123], "inline"], ["Post-mark grade verifier", [-12, HY, 123], "inline"],
  ["Inline pallet conveyor", [-95, 3, 88], "inline"], ["Entry tunnel · shutter", [LX0 - 4, OPEN.y1, 99], "inline"], ["Exit tunnel · shutter", [LX1 + 4, OPEN.y1, 99], "inline"], ["Lift & locate", [HX, HY + 8, 83], "inline"],
  ["125 × 125 × 42 field", [HX + 7, HY - 7, 92], null],
  ["Fixture nest", [HX - 8, HY + 4, 88], "door"], ["Rotary indexer · shield", [HX - 14, 26, 119], "rotary"], ["Light curtain", [LX0 + 11, YD, 130], "rotary"],
  ["Lift door · OD window", [LX0 + 30, YD + 3, 152 + 30 * 0], "door"], ["Start / stop · E-stop · key", [LX0 + 5, YD, 160], null], ["Stack light", [-5, 4, 192], null],
  ["Controller cabinet · laser controller", [RX0 + 30, YD, 176], ["door", "rotary"]], ["Controller cabinet (rear)", [RX0 + 26, YD - 77, 176], "inline"], ["HMI", [1, YD + 8, 141], ["door", "rotary"]], ["HMI", [-3, YD + 8, 141], "inline"], ["OK tray · NG bin", [LX0 - 9, 22, 93], ["door", "rotary"]],
  ["Fume extractor", [-52, -64, 100], null], ["Main isolator", [LX0 + 40, YD, 33], null],
];
const labelEls = LABELS.map(([t]) => { const d = document.createElement("div"); d.className = "lbl"; d.textContent = t; $("#labels").appendChild(d); return d; });
const DIMS = [
  { a: [LX0, YD + 16, 0], b: [RX1, YD + 16, 0], text: "≈ 1300 overall (TBD)", cfg: ["door", "rotary"] },
  { a: [CX0, YD + 16, 0], b: [CX1, YD + 16, 0], text: "≈ 1580 with conveyor (TBD)", cfg: "inline" },
  { a: [RX1 + 6, -YD, 0], b: [RX1 + 6, YD, 0], text: "≈ 750 (TBD)", cfg: ["door", "rotary"] },
  { a: [CX1 + 6, -YD - 77, 0], b: [CX1 + 6, YD, 0], text: "≈ 1520 with rear controller (TBD)", cfg: "inline" },
  { a: [LX0 - 22, YD, 0], b: [LX0 - 22, YD, 190], text: "≈ 1900 to stack light (TBD)" },
];
const dimGroup = new T3.Group(); root.add(dimGroup);
const dimEls = DIMS.map((d) => {
  const A = new T3.Vector3(...d.a), Bv = new T3.Vector3(...d.b);
  const line = new T3.Line(new T3.BufferGeometry().setFromPoints([A, Bv]), new T3.LineBasicMaterial({ color: 0x0e8a86 })); dimGroup.add(line);
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
  LABELS.forEach(([, p, c], i) => place(labelEls[i], p, on && cfgOk({ cfg: c })));
  dimEls.forEach((d) => { const ok = on && cfgOk(d); d.line.visible = ok; place(d.el, [d.mid.x, d.mid.y, d.mid.z], ok); });
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
MATNAME.set(MATX.head, "Scan head housing, painted aluminium"); MATNAME.set(MATX.steelPart, "Workpiece: carbon / stainless steel"); MATNAME.set(MATX.aluPart, "Workpiece: aluminium alloy"); MATNAME.set(MATX.fixture, "Fixture plate, hard-anodised aluminium"); MATNAME.set(MATX.window, "Laser-protective window (OD for 1064 nm)"); MATNAME.set(MATX.dark, "Black anodised");
const CODES = { baseL: "BAS", bay: "BAY", enclosure: "ENC", door: "DOR", head: "HED", reader: "VIS", fumeNozzle: "FNZ", fixture: "FIX", rotary: "ROT", shelf: "SHF", controller: "CTL", ctlInside: "CTI", hmi: "HMI", fumeExt: "FEX" };
let partSeq = 0;
function registerParts() {
  TREE.forEach((t) => t.g.traverse((o) => { if (o.isMesh && !o.userData.part) { o.userData.part = { tree: t, no: `TEAL-FLM-${CODES[t.id] || "GEN"}-${String(++partSeq).padStart(4, "0")}` }; } }));
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
  const dyn = new Set([gDoor, gTable, ...PART.map((x) => x.g)]);
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
const secOutline = new T3.LineSegments(new T3.EdgesGeometry(new T3.PlaneGeometry(2200, 2200)), new T3.LineBasicMaterial({ color: 0x0e8a86, transparent: true, opacity: 0.8 }));
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
    const tgt = new T3.Vector3(HX * 10, -HY * 10, 950);
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
  if (k === "1") setSrc("qs"); else if (k === "2") setSrc("mopa");
  else if (k === "c") setProd(prod === "flange" ? "housing" : "flange");
  else if (k === " ") { $("#play").click(); e.preventDefault(); }
  else if (k === "f") goView("front"); else if (k === "t") goView("top"); else if (k === "r") goView("right"); else if (k === "i") goView("iso"); else if (k === "p") goView("process"); else if (k === "h") goView("head"); else if (k === "s") goView("station");
});
resetState(); applyVisibility(); setSrc("qs"); writeNote(); resize();
window.__sim = { S, step: (dt) => advance(dt), setArtwork, setCfg, setSrc, setProd, goView, jumpTo, set speed(v) { speed = v; }, get camera() { return camera; }, controls };
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
 const sim=window.__sim, canvas=renderer.domElement, KEY='fiber';
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
 last={status:'CONCEPT / NOT FOR FABRICATION',platform:"fiber",configuration:typeof cfg==='undefined'?'standalone':cfg,primary:{id:q('a').value,...info(a)},secondary:{id:q('b').value,...info(b)},visibleEnvelope:info(whole),aabbDistanceMm:distance,overlap,requiredClearanceMm:threshold,serviceZone:zone,section:q('axis').value,sectionPositionPercent:Number(q('cut').value),source:typeof src==='undefined'?null:src,notes:'Current visible pose; AABB overlap may be intentional. Hidden geometry excluded. No motion sweep, safety or tolerance certification.'};
 q('result').textContent='PRIMARY: '+(info(a)?.size.join(' × ')||'Not visible')+' mm\nSECONDARY: '+(info(b)?.size.join(' × ')||'Not visible')+' mm\nVISIBLE ENVELOPE: '+(info(whole)?.size.join(' × ')||'—')+' mm\n'+(distance===null?'Select two distinct visible modules.':overlap?'REVIEW — AABB overlap (may be intentional).':distance<threshold?'REVIEW — bounding-box gap '+distance.toFixed(1)+' mm below target.':'Bounding-box gap '+distance.toFixed(1)+' mm; not a validated clearance.')+'\nCyan: primary · green/amber: comparison · blue: service zone.';return last}
 function section(){if(q('axis').value==='off'){if(savedClip!==null){renderer.clippingPlanes=savedClip;savedClip=null}return}const b=bbox(root);if(b.isEmpty())return;if(savedClip===null)savedClip=origClip();const axis=q('axis').value.toLowerCase(),n=new T3.Vector3();n[axis]=-1;const pos=b.min[axis]+(b.max[axis]-b.min[axis])*Number(q('cut').value)/100;renderer.clippingPlanes=[new T3.Plane(n,pos)];}
 function close(){clean();picking=false;q('axis').value='off';section();host.style.display='none'}
 q('focus').onclick=()=>{sim.focus(q('a').value);scan()};q('iso').onclick=()=>{sim.isolate(q('a').value);scan()};q('all').onclick=()=>{sim.showAll();scan()};q('pick').onclick=()=>{picking=true;q('result').textContent='Click a visible component in the viewport.'};cv.addEventListener('click',e=>{if(!picking)return;const r=cv.getBoundingClientRect(),ray=new T3.Raycaster();ray.setFromCamera(new T3.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),controls.object);const h=ray.intersectObject(root,true).find(x=>x.object.isMesh&&visible(x.object)&&!x.object.material?.transparent&&renderer.clippingPlanes.every(p=>p.distanceToPoint(x.point)>=0));if(h){let o=h.object;while(o){const u=TREE.find(x=>x.g===o);if(u){q('a').value=u.id;picking=false;sim.highlight(u.id);scan();break}o=o.parent}}});
 for(const k of ['a','b','boxes','gap','side','depth','service'])q(k).onchange=scan;q('axis').onchange=section;q('cut').oninput=section;q('scan').onclick=scan;q('clear').onclick=()=>{clean();q('result').textContent='Overlays cleared. Refresh geometry to recalculate.'};q('close').onclick=close;q('export').onclick=()=>{const d=scan(),u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='TEAL-concept-3D-DFM.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};q('bom').onclick=()=>{try{window.parent.tealOpenDetailedBOM(q('a').value,typeof cfg==='undefined'?null:cfg,typeof src==='undefined'?null:src)}catch(e){q('result').textContent='Open Detailed BOM from Engineering Studio.'}};
 function open(){host.style.display='block';scan()}const launch=document.createElement('button');launch.textContent='Concept 3D DFM · V6';launch.style.cssText='position:absolute;right:12px;top:98px;z-index:32;background:#0e7773;color:white;border:1px solid #83c5c1;border-radius:6px;padding:7px 10px;font:bold 12px Arial;cursor:pointer';launch.onclick=()=>host.style.display==='none'?open():close();view.append(launch);sim.conceptDFM={open,scan,close};
})();


})();
}
