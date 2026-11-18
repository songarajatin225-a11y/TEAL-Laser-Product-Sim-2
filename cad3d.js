/* TEAL configurator — Fig 3: the workstation as a CAD render, running.
 *
 * A WebGL scene of the configured galvo workstation, sized from the configurator's own
 * machineDims(), built from real component models where an open licence allows it and
 * from parametric parts elsewhere:
 *
 *   assets/cad3d/profile40.bin  40 × 40 slot-8 aluminium profile  (frame, Z column)
 *   assets/cad3d/mgn12.bin      MGN12 linear rail                 (Z axis guides)
 *   assets/cad3d/nema23.bin     NEMA 23 stepper with connector    (Z drive)
 *   assets/cad3d/estop.bin      22 mm emergency-stop mushroom     (control panel)
 *   assets/cad3d/btn_green.bin  22 mm green push-button           (cycle start)
 *   assets/cad3d/btn_red.bin    22 mm red push-button             (stop)
 *   assets/cad3d/fan50.bin      50 mm fan                         (cabinet cooling)
 *
 * The models are from the FreeCAD parts library, CC-BY 3.0; their authors are credited in
 * assets/cad3d/CREDITS.md and in the figure's caption. tools/cad3d/convert.mjs made the
 * meshes from the STEP files. Everything else (panels, scan head, objective, clamps,
 * light tower, operator screen) is drawn parametrically and is indicative.
 *
 * The scene plays the simulation's own phases with their own durations, exactly as Fig 2
 * does: live while the run is on, otherwise a preview of the same computed phase list.
 * During the process phase the spot follows the configuration's own process path and
 * the marks build up on the part as a texture. three.js (MIT) is in vendor/three.
 */
import * as THREE from "./vendor/three/three.module.min.js";
import { OrbitControls } from "./vendor/three/OrbitControls.js";
import { RoomEnvironment } from "./vendor/three/RoomEnvironment.js";
import { RoundedBoxGeometry } from "./vendor/three/RoundedBoxGeometry.js";

const PART_IDS = ["profile40", "mgn12", "nema23", "estop", "btn_green", "btn_red", "fan50"];
const CACHE = {};

/* ---- the converted meshes: Int16 positions in their box, Int8 normals, indices ------ */
async function loadPart(id) {
  if (CACHE[id]) return CACHE[id];
  CACHE[id] = (async () => {
    const buf = await (await fetch("assets/cad3d/" + id + ".bin")).arrayBuffer();
    const dv = new DataView(buf), hl = dv.getUint32(0, true);
    const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
    let off = 4 + hl;
    const n = head.v;
    const qp = new Int16Array(buf, off, n * 3); off += n * 6; off += (4 - (off % 4)) % 4;
    const qn = new Int8Array(buf, off, n * 3); off += n * 3 + ((4 - ((n * 3) % 4)) % 4);
    const I = head.big ? new Uint32Array(buf, off, head.i) : new Uint16Array(buf, off, head.i);
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) {
      const a = i % 3, s = head.hi[a] - head.lo[a];
      P[i] = head.lo[a] + ((qp[i] + 32767) / 65534) * s - (head.lo[a] + head.hi[a]) / 2;   // centred
      N[i] = qn[i] / 127;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    g.setIndex(new THREE.BufferAttribute(I, 1));
    g.userData.size = head.hi.map((h, a) => h - head.lo[a]);
    g.userData.groups = head.groups;
    return g;
  })();
  return CACHE[id];
}

/* ---- materials ----------------------------------------------------------------------- */
function materials(cfg) {
  const M = {
    paint: new THREE.MeshStandardMaterial({ color: 0xd8dcdf, roughness: 0.52, metalness: 0.08 }),            // RAL 7035-like powder coat
    paintDark: new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.58, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x00a9ac, roughness: 0.45, metalness: 0.15 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.34, metalness: 0.9 }),
    aluDark: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.85 }),
    anod: new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.32, metalness: 0.65 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8e959b, roughness: 0.42, metalness: 0.75 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.12, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.9, metalness: 0 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.55 }),
    glassLens: new THREE.MeshPhysicalMaterial({ color: 0x9fc4ff, roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.7 }),
    /* laser-safety glazing, tinted as such windows are for the source's wavelength */
    window: new THREE.MeshPhysicalMaterial({ color: cfg.tint || 0x5f8f3a, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.05 }),
    screen: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    lampOff: [0x1f6b2f, 0x8a5a12, 0x7a1d1d].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.85 })),
    lampOn: [0x39ff6a, 0xffb020, 0xff3b3b].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.3 })),
    red: new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.4 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.45 }),
    green: new THREE.MeshStandardMaterial({ color: 0x1f9d3a, roughness: 0.4 }),
  };
  return M;
}

function box(w, h, d, mat, x, y, z, parent, opts = {}) {
  /* sheet metal and machined parts have radiused edges: r > 0 rounds them */
  const r = opts.r || 0;
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false;
  if (parent) parent.add(m);
  return m;
}
function cyl(r, h, mat, x, y, z, parent, axis = "y", seg = 40, r2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2 == null ? r : r2, r, h, seg), mat);
  if (axis === "x") m.rotation.z = Math.PI / 2; else if (axis === "z") m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
/* a real part, centred, oriented by `rot` (Euler, radians) and scaled along its long axis */
function part(geo, mat, x, y, z, parent, { rot = [0, 0, 0], scale = [1, 1, 1], mats = null } = {}) {
  if (mats && !geo.userData.grouped) { geo.userData.groups.forEach((g, i) => geo.addGroup(g.start, g.count, i)); geo.userData.grouped = true; }
  const m = new THREE.Mesh(geo, mats || mat);
  m.rotation.set(rot[0], rot[1], rot[2]); m.scale.set(scale[0], scale[1], scale[2]);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

/* ---- the machine ----------------------------------------------------------------------- */
function buildMachine(cfg, G, M) {
  if (cfg.deliv === "gantry") return buildGantry(cfg, G, M);
  if (cfg.deliv === "robot") return buildRobot(cfg, G, M);
  if (cfg.deliv === "handpiece") return buildCart(cfg, G, M);
  return buildGalvo(cfg, G, M);
}
function buildGalvo(cfg, G, M) {
  const W = cfg.dims.w, D = cfg.dims.d, H = cfg.dims.h, T = cfg.dims.cv;   // mm, from machineDims()
  const root = new THREE.Group(), R = {};
  const hw = W / 2, hd = D / 2;
  /* feet and plinth */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cyl(32, 12, M.rubber, sx * (hw - 70), 6, sz * (hd - 70), root);
    cyl(10, 40, M.chrome, sx * (hw - 70), 32, sz * (hd - 70), root);
    cyl(26, 10, M.steel, sx * (hw - 70), 46, sz * (hd - 70), root, "y", 6);
  }
  box(W - 30, 70, D - 30, M.paintDark, 0, 86, 0, root, { r: 4 });
  /* cabinet: body, two doors proud of it with a seam, handles, louvres, nameplate stripe */
  const cabH = T - 30 - 121;
  box(W, cabH, D, M.paint, 0, 121 + cabH / 2, 0, root, { r: 6 });
  for (const sx of [-1, 1]) {
    const dw = W / 2 - 14;
    box(dw, cabH - 24, 8, M.paint, sx * (dw / 2 + 4), 121 + cabH / 2, hd + 3, root, { r: 3 });
    box(14, 120, 22, M.chrome, sx * 22, 121 + cabH * 0.62, hd + 14, root);
    cyl(9, 4, M.steel, sx * 60, 121 + cabH * 0.62, hd + 7, root, "z");
    for (let i = 0; i < 7; i++) box(dw - 120, 7, 3, M.paintDark, sx * (dw / 2 + 4), 160 + i * 18, hd + 7, root);
  }
  box(W + 2, 18, D + 2, M.accent, 0, T - 30 - 18, 0, root);
  /* decals: the laser warning label on the door and on the cabinet, the nameplate with the configured designation */
  function decal(w, h, draw, x, y, z, parent, ry = 0) {
    const c = document.createElement("canvas"); c.width = Math.round(w * 2); c.height = Math.round(h * 2);
    draw(c.getContext("2d"), c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.05 }));
    m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; parent.add(m); return m;
  }
  const warn = (g, w, h) => {
    g.fillStyle = "#f6c400"; g.fillRect(0, 0, w, h); g.strokeStyle = "#111"; g.lineWidth = w * 0.04; g.strokeRect(w * 0.03, h * 0.03, w * 0.94, h * 0.94);
    g.fillStyle = "#111"; g.beginPath(); g.moveTo(w * 0.5, h * 0.12); g.lineTo(w * 0.88, h * 0.62); g.lineTo(w * 0.12, h * 0.62); g.closePath(); g.fill();
    g.fillStyle = "#f6c400"; g.beginPath(); g.moveTo(w * 0.5, h * 0.22); g.lineTo(w * 0.78, h * 0.57); g.lineTo(w * 0.22, h * 0.57); g.closePath(); g.fill();
    g.strokeStyle = "#111"; g.lineWidth = w * 0.025; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(w * 0.5, h * 0.44); g.lineTo(w * 0.5 + Math.cos(a) * w * 0.12, h * 0.44 + Math.sin(a) * w * 0.12); g.stroke(); }
    g.font = `700 ${Math.round(h * 0.13)}px sans-serif`; g.textAlign = "center"; g.fillText("CLASS 1 LASER PRODUCT", w * 0.5, h * 0.8); g.font = `500 ${Math.round(h * 0.09)}px sans-serif`; g.fillText("IEC 60825-1", w * 0.5, h * 0.92);
  };
  decal(120, 80, warn, -hw + 110, T - 30 - 70, hd + 7.2, root);
  decal(150, 46, (g, w, h) => {
    g.fillStyle = "#c9ced2"; g.fillRect(0, 0, w, h); g.fillStyle = "#0e1a24"; g.font = `700 ${Math.round(h * 0.34)}px sans-serif`; g.fillText("TEAL", w * 0.05, h * 0.42);
    g.font = `500 ${Math.round(h * 0.2)}px monospace`; g.fillText(String(cfg.desig || "").slice(0, 26), w * 0.05, h * 0.78);
  }, -hw + 330, T - 30 - 62, hd + 7.2, root);
  /* cooling fans in the right-hand side (real 50 mm fan model), behind a grille frame */
  for (const z of [-hd * 0.45, -hd * 0.15]) {
    part(G.fan50, M.paintDark, hw + 6, 121 + cabH * 0.35, z, root, { rot: [0, Math.PI / 2, 0], scale: [2.4, 2.4, 1] });
    box(4, 130, 130, M.aluDark, hw + 1, 121 + cabH * 0.35, z, root);
  }
  /* control panel: a sloped box on the front right with the real E-stop and buttons */
  const cp = new THREE.Group(); cp.position.set(hw - 210, T - 30 - 120, hd + 30); root.add(cp);
  box(320, 150, 60, M.paint, 0, 0, 0, cp, { r: 8 });
  box(310, 140, 2, M.paintDark, 0, 0, 31, cp);
  /* the E-stop station (yellow housing, red mushroom) stands proud of the panel; the buttons pass through it */
  part(G.estop, M.red, -95, 0, 31 + 40, cp, { rot: [Math.PI / 2, 0, 0], mats: [M.yellow, M.red] });
  part(G.btn_green, M.green, 15, 10, 31 - 69 / 2 + 22, cp, { rot: [Math.PI / 2, 0, 0] });
  part(G.btn_red, M.red, 80, 10, 31 - 69 / 2 + 22, cp, { rot: [Math.PI / 2, 0, 0] });
  box(46, 14, 2, M.paint, 15, -34, 32, cp); box(46, 14, 2, M.paint, 80, -34, 32, cp);
  /* worktop: a 30 mm steel plate with T-slots */
  box(W + 30, 30, D + 30, M.steel, 0, T - 15, 0, root, { r: 4 });
  for (let i = -3; i <= 3; i++) box(W - 80, 2, 14, M.paintDark, 0, T + 0.5, i * (D / 8), root, { cast: false });
  /* upper frame from the real 40 × 40 profile: four posts, the top rectangle */
  const top = H - 20, postH = top - T;
  const prof = G.profile40, pz = prof.userData.size[2];
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    part(prof, M.alu, sx * (hw - 20), T + postH / 2, sz * (hd - 20), root, { rot: [Math.PI / 2, 0, 0], scale: [1, 1, postH / pz] });
  for (const sz of [-1, 1]) part(prof, M.alu, 0, top, sz * (hd - 20), root, { rot: [0, Math.PI / 2, 0], scale: [1, 1, (W - 80) / pz] });
  for (const sx of [-1, 1]) part(prof, M.alu, sx * (hw - 20), top, 0, root, { scale: [1, 1, (D - 80) / pz] });
  /* roof with an interior light; back wall in steel; sides in laser-safety glazing */
  box(W, 6, D, M.paint, 0, H + 3, 0, root);
  box(W - 200, 14, 40, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f7ff, emissiveIntensity: 0.8 }), 0, top - 30, hd - 120, root, { cast: false });
  box(W - 80, postH - 40, 4, new THREE.MeshStandardMaterial({ color: 0xa9b1b8, roughness: 0.6, metalness: 0.1 }), 0, T + postH / 2, -hd + 20, root);
  /* the work area's own light, under the roof */
  const lamp = new THREE.PointLight(0xf2f6ff, 900000, 2200, 2); lamp.position.set(0, top - 60, hd * 0.2); root.add(lamp);
  for (const sx of [-1, 1]) box(4, postH - 40, D - 80, M.window, sx * (hw - 20), T + postH / 2, 0, root, { cast: false, receive: false });
  /* front: header panel, fixed side panels, the lift door with its window and handle */
  const openH = postH * 0.6, doorW = W * 0.62;
  box(W - 80, postH - openH - 20, 4, M.window, 0, T + openH + (postH - openH) / 2, hd - 20, root, { cast: false, receive: false });
  for (const sx of [-1, 1]) box((W - 80 - doorW) / 2, openH, 4, M.window, sx * (doorW / 2 + (W - 80 - doorW) / 4), T + openH / 2, hd - 20, root, { cast: false, receive: false });
  const door = new THREE.Group(); door.position.set(0, T + openH / 2 + 10, hd - 2); root.add(door); R.door = door; R.doorTravel = postH - openH - 40;   /* the door rises in front of the header, within the enclosure */
  for (const [w, h, x, y] of [[doorW, 36, 0, openH / 2 - 18], [doorW, 36, 0, -openH / 2 + 18], [36, openH, -doorW / 2 + 18, 0], [36, openH, doorW / 2 - 18, 0]]) box(w, h, 20, M.alu, x, y, 0, door);
  box(doorW - 72, openH - 72, 6, M.window, 0, 0, 0, door, { cast: false, receive: false });
  cyl(12, doorW * 0.6, M.chrome, 0, -openH / 2 + 60, 40, door, "x");
  for (const sx of [-1, 1]) box(20, 20, 30, M.aluDark, sx * doorW * 0.3, -openH / 2 + 60, 22, door);
  /* door guide rails, floor of the enclosure to the roof */
  for (const sx of [-1, 1]) box(24, postH, 24, M.aluDark, sx * (doorW / 2 + 14), T + postH / 2, hd + 16, root, { r: 2 });
  /* Z column at the back: two real profiles side by side, real MGN12 rails, real NEMA 23 */
  const zc = new THREE.Group(); zc.position.set(0, T, -hd + 90); root.add(zc);
  const colH = Math.min(760, postH - 120);
  box(260, 16, 160, M.aluDark, 0, 8, 10, zc);
  for (const sx of [-1, 1]) part(prof, M.alu, sx * 20, 16 + colH / 2, 0, zc, { rot: [Math.PI / 2, 0, 0], scale: [1, 1, colH / pz] });
  const mg = G.mgn12, mz = mg.userData.size[2];
  for (const sx of [-1, 1]) part(mg, M.steel, sx * 26, 16 + colH / 2, 24, zc, { rot: [Math.PI / 2, 0, 0], scale: [1, 1, (colH - 40) / mz] });
  part(G.nema23, M.anod, 0, 16 + colH + 48, 0, zc, { rot: [-Math.PI / 2, 0, 0] });
  box(64, 10, 64, M.aluDark, 0, 16 + colH + 5, 0, zc);
  /* the carriage, arm, scan head and objective move together */
  const zg = new THREE.Group(); zg.position.set(0, 0, 0); zc.add(zg); R.z = zg;
  const carY = 16 + colH * 0.52;
  box(110, 150, 18, M.aluDark, 0, carY, 38, zg, { r: 3 });
  box(70, 50, 250, M.alu, 0, carY + 30, 170, zg, { r: 4 });
  const head = new THREE.Group(); head.position.set(0, carY + 10, 320); zg.add(head); R.head = head;
  box(180, 110, 200, M.anod, 0, 0, 0, head, { r: 8 });
  box(182, 6, 202, M.accent, 0, 40, 0, head);
  cyl(26, 70, M.anod, -60, 70, -40, head);
  cyl(28, 40, M.aluDark, 95, 0, -50, head, "x");
  cyl(22, 60, M.aluDark, 50, 85, -60, head);
  /* the f-theta objective: barrel, knurled focus ring, protective window */
  cyl(48, 70, M.anod, 0, -90, 50, head);
  cyl(51, 18, M.aluDark, 0, -80, 50, head, "y", 48);
  cyl(40, 4, M.glassLens, 0, -127, 50, head);
  R.lensBottom = new THREE.Vector3(0, -129, 50);
  /* the armoured fibre from the collimator up and over to the back wall */
  const fpts = [[50, 115, -60], [50, 230, -60], [40, 300, -200], [160, 320, -330], [210, 120, -340], [210, -300, -340]].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const fib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fpts), 80, 9, 12, false), M.cable);
  fib.castShadow = true; head.add(fib);
  /* fixture, toggle clamps and the part under the objective */
  const fx = new THREE.Group(); fx.position.set(0, T, -hd + 90 + 320 + 50); root.add(fx); R.fix = fx;
  box(420, 22, 360, M.anod, 0, 11, 0, fx, { r: 3 });
  for (const [x, z] of [[-150, -130], [150, -130], [-150, 130], [150, 130]]) cyl(6, 3, M.steel, x, 23, z, fx, "y", 6);
  /* the part: a brushed steel plate whose top takes the marks as a texture */
  const can = document.createElement("canvas"); can.width = can.height = 512;
  const hot = document.createElement("canvas"); hot.width = hot.height = 512;
  const tex = new THREE.CanvasTexture(can), htex = new THREE.CanvasTexture(hot);
  tex.colorSpace = THREE.SRGBColorSpace;
  const partTop = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, emissive: 0xff8a2a, emissiveMap: htex, emissiveIntensity: 1.6, metalness: 0.85, roughness: 0.32, transparent: true });
  const partSide = new THREE.MeshStandardMaterial({ color: 0xb9bec3, metalness: 0.85, roughness: 0.35, transparent: true });
  const pmesh = new THREE.Mesh(new THREE.BoxGeometry(260, 8, 220), [partSide, partSide, partTop, partSide, partSide, partSide]);
  pmesh.position.set(0, 26, 0); pmesh.castShadow = true; pmesh.receiveShadow = true; fx.add(pmesh);
  R.part = pmesh; R.partMats = [partTop, partSide]; R.canvas = can; R.hot = hot; R.tex = tex; R.htex = htex; R.partSize = [260, 220];
  R.clamps = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Group(); c.position.set(s * 175, 22, 0); fx.add(c);
    box(40, 30, 60, M.paintDark, 0, 15, 0, c);
    const piv = new THREE.Group(); piv.position.set(0, 42, 0); c.add(piv);
    box(80, 12, 18, M.steel, -s * 40, 0, 0, piv);
    cyl(9, 26, M.rubber, -s * 76, -16, 0, piv);
    box(14, 70, 14, M.red, s * 18, 30, 0, piv);
    R.clamps.push({ piv, s });
  }
  /* the beam and the spot (the beam drawn faintly: an infrared beam is invisible) */
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: cfg.beamCol || 0xff5533, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(beam); R.beam = beam;
  const spot = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(spot); R.spot = spot;
  const light = new THREE.PointLight(0xffa860, 0, 600, 1.6); root.add(light); R.spotLight = light;
  /* sparks: additive points with gravity */
  const NS = 260, sp = new Float32Array(NS * 3), sv = new Float32Array(NS * 3), sl = new Float32Array(NS);
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffc070, size: 5, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false; root.add(sparks); R.sparks = { pts: sparks, p: sp, v: sv, l: sl, n: NS, next: 0 };
  /* light tower on the roof */
  const tw = new THREE.Group(); tw.position.set(hw - 120, H + 6, -hd + 120); root.add(tw);
  cyl(30, 14, M.paintDark, 0, 7, 0, tw); cyl(9, 120, M.chrome, 0, 74, 0, tw);
  R.lamps = [0, 1, 2].map((i) => cyl(32, 52, M.lampOff[i], 0, 160 + i * 54, 0, tw));
  cyl(32, 12, M.paintDark, 0, 160 + 3 * 54 - 21, 0, tw);
  /* the operator screen on a swing arm at the left front */
  const hmi = new THREE.Group(); hmi.position.set(-hw - 230, T + 360, hd - 60); root.add(hmi);
  box(240, 22, 22, M.aluDark, 130, 0, -20, hmi);
  cyl(18, 60, M.paintDark, 250, 0, -20, hmi);
  box(420, 300, 50, M.paintDark, 0, 0, 10, hmi, { r: 10 });
  const sc = document.createElement("canvas"); sc.width = 512; sc.height = 360;
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(380, 262), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false }));
  screen.position.set(0, 0, 36); hmi.add(screen); R.screen = { c: sc, tex: stex };
  R.fixWorld = () => { const v = new THREE.Vector3(); pmesh.getWorldPosition(v); return v; };
  root.userData.size = [W, H, D];
  return { root, R };
}


/* ---- shared pieces for the other machine types ------------------------------------------ */
function markPart(parent, R, M, w, d, y, style) {
  const can = document.createElement("canvas"); can.width = can.height = 512;
  const hot = document.createElement("canvas"); hot.width = hot.height = 512;
  const tex = new THREE.CanvasTexture(can), htex = new THREE.CanvasTexture(hot);
  tex.colorSpace = THREE.SRGBColorSpace;
  const top = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, emissive: 0xff8a2a, emissiveMap: htex, emissiveIntensity: 1.6, metalness: style === "clean" ? 0.5 : 0.85, roughness: style === "clean" ? 0.6 : 0.32, transparent: true });
  const side = new THREE.MeshStandardMaterial({ color: style === "clean" ? 0x7a4426 : 0xb9bec3, metalness: 0.7, roughness: 0.45, transparent: true });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 8, d), [side, side, top, side, side, side]);
  m.position.set(0, y, 0); m.castShadow = true; m.receiveShadow = true; parent.add(m);
  Object.assign(R, { part: m, partMats: [top, side], canvas: can, hot, tex, htex, partSize: [w, d], partY: y });
  return m;
}
function processFx(root, R, cfg) {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: cfg.beamCol || 0xff5533, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(beam); R.beam = beam;
  const spot = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(spot); R.spot = spot;
  const light = new THREE.PointLight(0xffa860, 0, 600, 1.6); root.add(light); R.spotLight = light;
  const NS = 260, sp = new Float32Array(NS * 3), sv = new Float32Array(NS * 3), sl = new Float32Array(NS);
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const pts = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffc070, size: 5, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false; root.add(pts); R.sparks = { pts, p: sp, v: sv, l: sl, n: NS, next: 0 };
}
function tower(parent, R, M, x, y, z) {
  const tw = new THREE.Group(); tw.position.set(x, y, z); parent.add(tw);
  cyl(30, 14, M.paintDark, 0, 7, 0, tw); cyl(9, 120, M.chrome, 0, 74, 0, tw);
  R.lamps = [0, 1, 2].map((i) => cyl(32, 52, M.lampOff[i], 0, 160 + i * 54, 0, tw));
  cyl(32, 12, M.paintDark, 0, 160 + 3 * 54 - 21, 0, tw);
}
function screenOn(parent, R, M, w, h, x, y, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  box(w + 40, h + 40, 50, M.paintDark, 0, 0, -10, g, { r: 10 });
  const sc = document.createElement("canvas"); sc.width = 512; sc.height = 360;
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false }));
  m.position.set(0, 0, 16); g.add(m); R.screen = { c: sc, tex: stex };
  return g;
}
function controlBox(parent, G, M, x, y, z, ry = 0) {
  const cp = new THREE.Group(); cp.position.set(x, y, z); cp.rotation.y = ry; parent.add(cp);
  box(320, 150, 60, M.paint, 0, 0, 0, cp, { r: 8 });
  box(310, 140, 2, M.paintDark, 0, 0, 31, cp);
  part(G.estop, M.red, -95, 0, 31 + 40, cp, { rot: [Math.PI / 2, 0, 0], mats: [M.yellow, M.red] });
  part(G.btn_green, M.green, 15, 10, 31 - 69 / 2 + 22, cp, { rot: [Math.PI / 2, 0, 0] });
  part(G.btn_red, M.red, 80, 10, 31 - 69 / 2 + 22, cp, { rot: [Math.PI / 2, 0, 0] });
  return cp;
}
function cabinet(parent, G, M, w, h, d, x, z, R) {
  /* the electrical cabinet: a door with a handle, louvres, two real 50 mm fans, the tower on top */
  const c = new THREE.Group(); c.position.set(x, 0, z); parent.add(c);
  box(w, 80, d, M.paintDark, 0, 40, 0, c, { r: 4 });
  box(w, h - 80, d, M.paint, 0, 80 + (h - 80) / 2, 0, c, { r: 6 });
  box(w - 40, h - 130, 8, M.paint, 0, 80 + (h - 80) / 2, d / 2 + 3, c, { r: 3 });
  box(14, 120, 22, M.chrome, w / 2 - 60, 80 + (h - 80) * 0.55, d / 2 + 14, c);
  for (let i = 0; i < 6; i++) box(w - 140, 7, 3, M.paintDark, 0, 120 + i * 18, d / 2 + 8, c);
  for (const zz of [-d * 0.2, d * 0.2]) part(G.fan50, M.paintDark, w / 2 + 6, h * 0.35, zz, c, { rot: [0, Math.PI / 2, 0], scale: [2.4, 2.4, 1] });
  tower(c, R, M, -w / 2 + 70, h, -d / 2 + 70);
  return c;
}

/* ---- the gantry cutting table (Cut X-T, LinCell) ---------------------------------------- */
function buildGantry(cfg, G, M) {
  const W = cfg.dims.w, D = cfg.dims.d, H = cfg.dims.h, root = new THREE.Group(), R = { clamps: [] };
  const hw = W / 2, hd = D / 2, bed = 820, prof = G.profile40, pz = prof.userData.size[2];
  /* welded frame: legs, side and end members, an extraction plenum under the bed */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box(90, bed - 40, 90, M.paintDark, sx * (hw - 60), (bed - 40) / 2, sz * (hd - 60), root, { r: 3 }); cyl(36, 14, M.rubber, sx * (hw - 60), 7, sz * (hd - 60), root); }
  for (const sz of [-1, 1]) box(W - 60, 140, 90, M.paint, 0, bed - 110, sz * (hd - 60), root, { r: 4 });
  for (const sx of [-1, 1]) box(90, 140, D - 60, M.paint, sx * (hw - 60), bed - 110, 0, root, { r: 4 });
  box(W - 260, 300, D - 260, M.paintDark, 0, bed - 330, 0, root, { r: 6 });
  cyl(70, 260, M.aluDark, hw - 200, bed - 430, -hd + 40, root, "z");
  /* the slat bed: steel slats on edge, the sheet lying on their tops */
  const nS = Math.floor((W - 300) / 70);
  for (let i = 0; i < nS; i++) box(4, 70, D - 280, M.steel, -hw + 150 + i * 70 + 35, bed - 35, 0, root, { cast: false });
  const sheetW = W - 420, sheetD = D - 360;
  const sheetG = new THREE.Group(); sheetG.position.set(0, bed, 0); root.add(sheetG);
  markPart(sheetG, R, M, sheetW, sheetD, 4, cfg.style);
  /* rails on both side members, the gantry beam on its two carriages, the cutting head */
  const railY = bed - 40;
  for (const sx of [-1, 1]) part(G.mgn12, M.steel, sx * (hw - 60), railY + 4, 0, root, { scale: [1.6, 1.4, (D - 120) / G.mgn12.userData.size[2]] });
  const gan = new THREE.Group(); root.add(gan); R.gantry = gan;
  for (const sx of [-1, 1]) { box(120, 70, 180, M.aluDark, sx * (hw - 60), railY + 45, 0, gan, { r: 4 }); box(80, 300, 120, M.alu, sx * (hw - 60), railY + 230, 0, gan, { r: 4 }); }
  for (const yy of [railY + 360, railY + 400]) part(prof, M.alu, 0, yy, 0, gan, { rot: [0, Math.PI / 2, 0], scale: [1, 1, (W - 40) / pz] });
  part(G.nema23, M.anod, hw - 60, railY + 120, 120, gan, { rot: [0, 0, 0] });
  for (let i = 0; i < 18; i++) box(40, 24, 50, M.rubber, -hw + 120 + i * ((W - 240) / 18), railY + 440, -40, gan, { cast: false });
  const car = new THREE.Group(); car.position.set(0, railY + 380, 50); gan.add(car); R.carriage = car;
  box(200, 220, 26, M.aluDark, 0, 0, 0, car, { r: 4 });
  const zg = new THREE.Group(); car.add(zg); R.z = zg; R.zTravel = 60;
  box(90, 300, 60, M.alu, 0, -90, 40, zg, { r: 4 });
  part(G.nema23, M.anod, 0, 100, 40, zg, { rot: [-Math.PI / 2, 0, 0] });
  const head = new THREE.Group(); head.position.set(0, -280, 60); zg.add(head); R.head = head;
  cyl(48, 160, M.anod, 0, 0, 0, head); cyl(52, 20, M.accent, 0, 50, 0, head);
  cyl(30, 40, M.aluDark, 0, -100, 0, head); cyl(8, 50, new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.3 }), 0, -140, 0, head, "y", 24, 22);
  R.lensBottom = new THREE.Vector3(0, -166, 0);
  const fib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 80, 0], [0, 260, -20], [-200, 330, -60]].map((p) => new THREE.Vector3(...p))), 40, 9, 10), M.cable);
  head.add(fib);
  /* a light-tight enclosure: profile posts, glazing on four sides, a lift door at the front */
  const top = H, postH = top - bed;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(prof, M.alu, sx * (hw - 20), bed + postH / 2, sz * (hd - 20), root, { rot: [Math.PI / 2, 0, 0], scale: [1, 1, postH / pz] });
  for (const sz of [-1, 1]) part(prof, M.alu, 0, top, sz * (hd - 20), root, { rot: [0, Math.PI / 2, 0], scale: [1, 1, (W - 80) / pz] });
  for (const sx of [-1, 1]) part(prof, M.alu, sx * (hw - 20), top, 0, root, { scale: [1, 1, (D - 80) / pz] });
  box(W, 6, D, M.paint, 0, top + 23, 0, root);
  for (const sx of [-1, 1]) box(4, postH - 40, D - 80, M.window, sx * (hw - 20), bed + postH / 2, 0, root, { cast: false, receive: false });
  box(W - 80, postH - 40, 4, M.window, 0, bed + postH / 2, -hd + 20, root, { cast: false, receive: false });
  const doorH = postH * 0.55, door = new THREE.Group(); door.position.set(0, bed + doorH / 2 + 10, hd - 2); root.add(door); R.door = door; R.doorTravel = postH - doorH - 40;
  for (const [w, h, x, y] of [[W - 120, 30, 0, doorH / 2 - 15], [W - 120, 30, 0, -doorH / 2 + 15], [30, doorH, -(W - 120) / 2 + 15, 0], [30, doorH, (W - 120) / 2 - 15, 0]]) box(w, h, 20, M.alu, x, y, 0, door);
  box(W - 180, doorH - 60, 6, M.window, 0, 0, 0, door, { cast: false, receive: false });
  cyl(12, W * 0.4, M.chrome, 0, -doorH / 2 + 50, 40, door, "x");
  box(W - 80, postH - doorH - 40, 4, M.window, 0, bed + doorH + (postH - doorH) / 2, hd - 20, root, { cast: false, receive: false });
  /* the electrical cabinet, the control panel, the operator screen */
  cabinet(root, G, M, 600, 1700, 500, hw + 420, -hd + 300, R);
  controlBox(root, G, M, hw - 220, bed - 110, hd + 30);
  screenOn(root, R, M, 380, 262, hw + 420, 1300, -hd + 300 + 280);
  processFx(root, R, cfg);
  /* the axes put the head over the spot; parked at the back right */
  R.track = (p) => {
    const bz = p ? p.z : -sheetD / 2 + 40, bx = p ? p.x : sheetW / 2 - 60;
    gan.position.z = bz - 50 - 60; car.position.x = bx;
  };
  R.partMove = (o) => { sheetG.position.z = (D * 0.75) * o.lift; };
  R.workAt = () => new THREE.Vector3(0, bed, 0);
  root.userData.size = [W + 300, H, D];
  return { root, R };
}

/* ---- the robot cell (Weld R-Cell, Clean CL-A, RoboCell) --------------------------------- */
function buildRobot(cfg, G, M) {
  const W = cfg.dims.w, D = cfg.dims.d, H = cfg.dims.h, root = new THREE.Group(), R = { clamps: [] };
  const hw = W / 2, hd = D / 2, prof = G.profile40, pz = prof.userData.size[2];
  /* floor plate and a guard fence: yellow posts, mesh panels on three sides, light-curtain columns at the front */
  box(W + 200, 12, D + 200, M.paintDark, 0, 6, 0, root, { r: 3 });
  const mc = document.createElement("canvas"); mc.width = mc.height = 64;
  const mg = mc.getContext("2d"); mg.clearRect(0, 0, 64, 64); mg.strokeStyle = "rgba(40,44,48,0.95)"; mg.lineWidth = 5; for (let i = 0; i <= 64; i += 32) { mg.beginPath(); mg.moveTo(i, 0); mg.lineTo(i, 64); mg.stroke(); mg.beginPath(); mg.moveTo(0, i); mg.lineTo(64, i); mg.stroke(); }
  const mtex = new THREE.CanvasTexture(mc); mtex.wrapS = mtex.wrapT = THREE.RepeatWrapping;
  const fenceH = Math.min(H, 2000), yellowM = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5, metalness: 0.2 });
  const panel = (w, x, z, ry) => { const t = mtex.clone(); t.needsUpdate = true; t.repeat.set(w / 110, fenceH / 110); t.anisotropy = 8; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, fenceH - 200), new THREE.MeshStandardMaterial({ map: t, transparent: true, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5, alphaTest: 0.1 })); m.position.set(x, 100 + (fenceH - 200) / 2, z); m.rotation.y = ry; root.add(m); };
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, -hd], [-hw, 0], [hw, 0]]) box(50, fenceH, 50, yellowM, x, fenceH / 2 + 12, z, root, { r: 3 });
  panel(W / 2 - 50, -W / 4, -hd, 0); panel(W / 2 - 50, W / 4, -hd, 0); panel(D / 2 - 50, -hw, -D / 4, Math.PI / 2); panel(D / 2 - 50, -hw, D / 4, Math.PI / 2); panel(D / 2 - 50, hw, -D / 4, Math.PI / 2); panel(D / 2 - 50, hw, D / 4, Math.PI / 2);
  for (const sx of [-0.25, 0.25]) { box(40, 1600, 40, M.paintDark, sx * W, 812, hd + 60, root, { r: 2 }); for (let i = 0; i < 14; i++) box(6, 6, 2, new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 1.5 }), sx * W, 120 + i * 105, hd + 81, root, { cast: false }); }
  /* the work table with a fixture and the part */
  const tb = new THREE.Group(); tb.position.set(0, 0, hd * 0.25); root.add(tb);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(60, 760, 60, M.paintDark, sx * 330, 392, sz * 230, tb, { r: 2 });
  box(760, 30, 560, M.steel, 0, 787, 0, tb, { r: 3 });
  box(520, 22, 380, M.anod, 0, 813, 0, tb, { r: 3 });
  markPart(tb, R, M, 420, 300, 828, cfg.style);
  for (const s of [-1, 1]) { const c = new THREE.Group(); c.position.set(s * 240, 824, 0); tb.add(c); box(40, 30, 60, M.paintDark, 0, 15, 0, c); const piv = new THREE.Group(); piv.position.set(0, 42, 0); c.add(piv); box(80, 12, 18, M.steel, -s * 40, 0, 0, piv); box(14, 70, 14, M.red, s * 18, 30, 0, piv); R.clamps.push({ piv, s }); }
  /* the six-axis arm on its pedestal: turret, shoulder, upper arm, elbow, forearm, wrist, laser head */
  const white = new THREE.MeshStandardMaterial({ color: 0xe9ecee, roughness: 0.35, metalness: 0.15 }), joint = new THREE.MeshStandardMaterial({ color: 0x4a525a, roughness: 0.4, metalness: 0.5 });
  const base = new THREE.Vector3(0, 0, -hd * 0.45);
  box(360, 520, 360, M.paintDark, base.x, 272, base.z, root, { r: 6 });
  box(420, 20, 420, M.steel, base.x, 22, base.z, root, { r: 3 });
  const turret = new THREE.Group(); turret.position.set(base.x, 532, base.z); root.add(turret);
  cyl(150, 90, white, 0, 45, 0, turret); cyl(120, 40, joint, 0, 110, 0, turret);
  const L1 = 560, L2 = 520, WR = 120, TOOL = 230;
  const sh = new THREE.Group(); sh.position.set(60, 230, 0); turret.add(sh);
  box(180, 220, 200, white, -40, -60, 0, turret, { r: 30 });
  cyl(95, 230, joint, 60, 230, 0, turret, "z");
  const up = new THREE.Group(); sh.add(up); box(L1 + 80, 150, 140, white, L1 / 2, 0, 0, up, { r: 40 });
  const el = new THREE.Group(); el.position.set(L1, 0, 0); up.add(el); cyl(80, 190, joint, 0, 0, 0, el, "z");
  const fo = new THREE.Group(); el.add(fo); box(L2 + 40, 110, 110, white, L2 / 2, 0, 0, fo, { r: 35 });
  const wr = new THREE.Group(); wr.position.set(L2, 0, 0); fo.add(wr); cyl(55, 130, joint, 0, 0, 0, wr, "z");
  const tool = new THREE.Group(); wr.add(tool);
  box(WR, 80, 80, white, WR / 2, 0, 0, tool, { r: 20 });
  const head = new THREE.Group(); head.position.set(WR, 0, 0); head.rotation.z = Math.PI; tool.add(head); R.head = head;   /* the head hangs straight down from the wrist block */
  cyl(45, 120, M.anod, 0, 60, 0, head); cyl(48, 18, M.accent, 0, 100, 0, head); cyl(30, 90, M.aluDark, 0, 150, 0, head);
  cyl(10, 40, new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.3 }), 0, 205, 0, head, "y", 24, 24);
  R.lensBottom = new THREE.Vector3(0, TOOL, 0);
  /* inverse kinematics: yaw toward the target, a two-link arm to the wrist, the tool kept pointing down */
  const tmp = new THREE.Vector3();
  R.track = (p) => {
    const target = p ? p.clone() : new THREE.Vector3(base.x + 380, 1250, base.z + 380);
    const wrist = target.clone(); wrist.y += TOOL + WR * 0;          /* the head hangs below the wrist */
    const shW = new THREE.Vector3(); turret.updateMatrixWorld(); 
    const dx = wrist.x - base.x, dz = wrist.z - base.z, yaw = Math.atan2(-dz, dx);
    turret.rotation.y = yaw;
    const r = Math.hypot(dx, dz) - 60 - WR, zz = wrist.y - (532 + 230);
    const d = Math.min(Math.hypot(r, zz), L1 + L2 - 1);
    const e = Math.acos(Math.max(-1, Math.min(1, (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2))));
    const a1 = Math.atan2(zz, r) + Math.atan2(L2 * Math.sin(e), L1 + L2 * Math.cos(e)), a2 = -e;
    sh.rotation.z = a1; el.rotation.z = a2; wr.rotation.z = -a1 - a2;     /* the wrist block stays level: the head hangs straight down */
  };
  /* the controller outside the fence, the panel and the screen on the fence */
  cabinet(root, G, M, 600, 1700, 500, hw + 520, -hd + 300, R);
  controlBox(root, G, M, hw + 230, 1100, hd * 0.35, -Math.PI / 2 + 0.6);
  screenOn(root, R, M, 380, 262, hw + 230, 1400, hd * 0.35, -Math.PI / 2 + 0.6);
  /* a fume hood over the table for the weld or clean */
  box(700, 60, 420, M.paint, 0, Math.min(H, 2000) - 120, hd * 0.25, root, { r: 8 });
  cyl(70, Math.max(100, 2200 - Math.min(H, 2000)), M.aluDark, 0, Math.min(H, 2000) + 20, hd * 0.25, root);
  processFx(root, R, cfg);
  R.door = new THREE.Group(); R.doorTravel = 0; R.z = new THREE.Group(); R.zTravel = 0;
  root.userData.size = [W + 500, Math.max(H, 2000), D];
  return { root, R };
}

/* ---- the handheld cleaning cart (Clean CL-P) -------------------------------------------- */
function buildCart(cfg, G, M) {
  const W = cfg.dims.w, D = cfg.dims.d, H = cfg.dims.h, root = new THREE.Group(), R = { clamps: [] };
  const cw = Math.min(W, 700), cd = Math.min(D, 560), ch = Math.min(H, 1000);
  /* the cart: cabinet on four castors, a push handle, a hose hook, a beacon and a screen */
  const cart = new THREE.Group(); cart.position.set(-500, 0, 0); root.add(cart);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl(45, 30, M.rubber, sx * (cw / 2 - 70), 45, sz * (cd / 2 - 60), cart, "x"); box(30, 60, 30, M.chrome, sx * (cw / 2 - 70), 95, sz * (cd / 2 - 60), cart); }
  box(cw, ch - 120, cd, M.paint, 0, 120 + (ch - 120) / 2, 0, cart, { r: 10 });
  box(cw + 6, 16, cd + 6, M.accent, 0, ch - 60, 0, cart, { r: 4 });
  for (let i = 0; i < 8; i++) box(cw - 160, 7, 3, M.paintDark, 0, 200 + i * 18, cd / 2 + 2, cart);
  for (const sz of [-1, 1]) cyl(14, 300, M.chrome, -cw / 2 - 50, ch + 90, sz * (cd / 2 - 60), cart);
  cyl(14, cd - 120 + 28, M.chrome, -cw / 2 - 50, ch + 240, 0, cart, "z");
  box(80, 40, 80, M.paintDark, cw / 2 - 60, ch + 20, -cd / 2 + 70, cart);
  part(G.estop, M.red, -cw / 2 + 120, ch - 120, cd / 2 + 40, cart, { rot: [Math.PI / 2, 0, 0], mats: [M.yellow, M.red] });
  part(G.fan50, M.paintDark, cw / 2 + 6, 300, 0, cart, { rot: [0, Math.PI / 2, 0], scale: [2.4, 2.4, 1] });
  screenOn(cart, R, M, 300, 200, 60, ch - 260, cd / 2 + 30);
  tower(cart, R, M, cw / 2 - 70, ch, -cd / 2 + 70);
  /* the work: a rusty steel plate on a stand */
  const st = new THREE.Group(); st.position.set(450, 0, 0); root.add(st);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(50, 820, 50, M.paintDark, sx * 300, 410, sz * 220, st, { r: 2 });
  box(700, 30, 520, M.steel, 0, 835, 0, st, { r: 3 });
  markPart(st, R, M, 520, 380, 854, cfg.style || "clean");
  /* the handheld head on its hose, swept by the operator over the plate */
  const gun = new THREE.Group(); root.add(gun); R.head = gun;
  cyl(36, 200, M.anod, 0, 80, 0, gun); cyl(40, 20, M.accent, 0, 160, 0, gun);
  box(50, 160, 60, M.paintDark, 0, 140, -70, gun, { r: 12 }); cyl(24, 60, M.aluDark, 0, -50, 0, gun);
  R.lensBottom = new THREE.Vector3(0, -80, 0);
  const hoseM = M.cable;
  let hose = null;
  const hoseFrom = new THREE.Vector3(-500 + cw / 2 - 60, ch + 40, -cd / 2 + 70);
  R.track = (p) => {
    const at = p ? p.clone() : new THREE.Vector3(450 + 300, 1100, 300);
    gun.position.set(at.x, at.y + 160, at.z);
    const mid = hoseFrom.clone().lerp(gun.position, 0.5); mid.y = Math.min(hoseFrom.y, gun.position.y) - 240;
    if (hose) { root.remove(hose); hose.geometry.dispose(); }
    hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([hoseFrom, mid, gun.position.clone().add(new THREE.Vector3(0, 230, -40))]), 30, 11, 8), hoseM);
    hose.castShadow = true; root.add(hose);
  };
  processFx(root, R, cfg);
  R.door = new THREE.Group(); R.doorTravel = 0; R.z = new THREE.Group(); R.zTravel = 0;
  root.userData.size = [1300, 1050, 800];
  return { root, R };
}

/* ---- the phases: where everything is in phase k at share u ----------------------------- */
const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const span = (u, a, b) => ease((u - a) / (b - a));
function pose(k, u) {
  const o = { door: 0, z: 1, lift: 0, show: true, clamp: 0, beam: false, prog: 0, marks: false };
  if (k === "HOME") { o.z = span(u, 0, 1); o.show = false; o.clamp = 1; }
  else if (k === "LOAD") { o.clamp = 1; o.door = span(u, 0, 0.28) * (1 - span(u, 0.78, 1)); o.lift = 1 - span(u, 0.3, 0.74); }
  else if (k === "CLAMP") { o.clamp = 1 - span(u, 0, 1); }
  else if (k === "LOCATE") { }
  else if (k === "FOCUS") { o.z = 1 - span(u, 0, 1); }
  else if (k === "PROCESS") { o.z = 0; o.beam = u < 1; o.prog = u; o.marks = true; }
  else if (k === "VERIFY") { o.z = 0; o.prog = 1; o.marks = true; }
  else if (k === "UNLOAD") { o.z = 0; o.prog = 1; o.marks = true; o.clamp = span(u, 0, 0.2); o.door = span(u, 0.2, 0.38) * (1 - span(u, 0.82, 1)); o.lift = span(u, 0.4, 0.78); o.show = u < 0.8; }
  return o;
}
function movesOf(segs) {
  const mv = []; let prev = null, tot = 0;
  for (const s of segs) s.forEach((p, j) => { if (prev) { const d = Math.hypot(p[0] - prev[0], p[1] - prev[1]), on = j > 0, w = d / (on ? 1 : 3.2); mv.push({ a: prev, b: p, on, w, c: tot }); tot += w; } prev = p; });
  return { mv, tot: tot || 1 };
}

let current = null;
export function mount(host, cfg) {
  if (current) current.stop();
  host.innerHTML = "";
  const wrap = document.createElement("div"); wrap.className = "cad3d";
  wrap.innerHTML = '<div class="cad3d-stage" tabindex="0" role="img" aria-label="The configured workstation rendered in 3D, running the simulation’s cycle. Drag to turn it."></div>' +
    '<div class="cad3d-bar"><span class="cad3d-hint">Drag to turn · two fingers on touch · Z work zone · R resets</span><span class="cad3d-btns"><button type="button" data-a="spin" aria-pressed="false">Turn</button><button type="button" data-a="work" aria-pressed="false">Work zone</button><button type="button" data-a="reset">Reset view</button></span><span class="cad3d-readout" data-readout>Loading the parts…</span></div>' +
    '<p class="cad3d-cap"></p>';
  host.appendChild(wrap);
  const stage = wrap.querySelector(".cad3d-stage"), readout = wrap.querySelector("[data-readout]"), capEl = wrap.querySelector(".cad3d-cap");
  if (cfg.caption) capEl.textContent = cfg.caption;
  let stopped = false, frame = 0, visible = false, renderer = null;
  const api = { stop() { stopped = true; if (frame) cancelAnimationFrame(frame); frame = 0; if (io) io.disconnect(); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } }, ready: false };
  current = api;
  let io = null;
  (async () => {
    let G;
    try { G = Object.fromEntries(await Promise.all(PART_IDS.map(async (id) => [id, await loadPart(id)]))); }
    catch (e) { readout.textContent = "The 3D parts could not be loaded."; return; }
    if (stopped) return;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!cfg.capture });
    } catch (e) { readout.textContent = "This browser cannot show the 3D view (no WebGL)."; api.noGL = true; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const M = materials(cfg);
    const { root, R } = buildMachine(cfg, G, M);
    scene.add(root);
    const [W, H, D] = root.userData.size;
    /* studio lighting: a key light with soft shadows, a cool fill, a floor that only takes shadows */
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(W * 1.1, H * 1.6, D * 1.4); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.bias = -0.0004;
    const sc = Math.max(W, D) * 1.1;
    Object.assign(key.shadow.camera, { left: -sc, right: sc, top: sc * 1.2, bottom: -sc, near: 10, far: 9000 });
    scene.add(key);
    scene.add(new THREE.HemisphereLight(0xdfe9f3, 0x30343a, 0.55));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.ShadowMaterial({ opacity: 0.22 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const camera = new THREE.PerspectiveCamera(32, 1, 20, 20000);
    const target = new THREE.Vector3(-W * 0.05, H * 0.52, 0);
    const home = new THREE.Vector3(W * 2.0, H * 0.98, D * 3.15);
    camera.position.copy(home);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target); controls.enableDamping = true; controls.enableZoom = false; controls.enablePan = false;
    controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.45;
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.autoRotateSpeed = 0.8;
    controls.update();
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    function size() {
      const w = stage.clientWidth || 800, h = Math.round(Math.min(Math.max(w * 0.62, 320), window.innerHeight * 0.82));
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    size(); addEventListener("resize", size);
    /* camera moves ease between the whole machine and the work zone */
    const fly = { from: null, to: null, t: 1 };
    const workBtn = wrap.querySelector('[data-a="work"]');
    function flyTo(pos, tgt, work) {
      fly.from = [camera.position.clone(), controls.target.clone()]; fly.to = [pos.clone(), tgt.clone()]; fly.t = still.matches ? 1 : 0;
      if (still.matches) { camera.position.copy(pos); controls.target.copy(tgt); controls.update(); }
      workBtn.setAttribute("aria-pressed", work ? "true" : "false"); api.work = work; api.wake && api.wake();
    }
    const workPos = () => { const f = new THREE.Vector3(); R.part.getWorldPosition(f); f.y = cfg.dims.cv + 120; /* just inside the enclosure, clear of the posts, the glazing and the door, looking down at the part under the head */
      return [f.clone().add(new THREE.Vector3(W * 0.24, 400, D * 0.44)), f.clone().add(new THREE.Vector3(0, 50, 0))]; };
    workBtn.onclick = () => { if (api.work) flyTo(home, target, false); else { const [p, t] = workPos(); flyTo(p, t, true); } };
    wrap.querySelector('[data-a="reset"]').onclick = () => flyTo(home, target, false);
    api.flyStep = (dt) => { if (fly.t >= 1 || !fly.to) return false; fly.t = Math.min(1, fly.t + dt / 0.9); const e = fly.t * fly.t * (3 - 2 * fly.t);
      camera.position.lerpVectors(fly.from[0], fly.to[0], e); controls.target.lerpVectors(fly.from[1], fly.to[1], e); return true; };
    const spin = wrap.querySelector('[data-a="spin"]');
    spin.onclick = () => { controls.autoRotate = !controls.autoRotate; spin.setAttribute("aria-pressed", controls.autoRotate ? "true" : "false"); };
    stage.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") flyTo(home, target, false); else if (e.key === "z" || e.key === "Z") workBtn.click(); });
    const MV = movesOf(cfg.segs || [[[-0.3, 0], [0.3, 0]]]);
    const moveAt = (p) => {
      const x = p * MV.tot;
      for (let i = 0; i < MV.mv.length; i++) { const m = MV.mv[i]; if (x <= m.c + m.w) { const f = m.w ? (x - m.c) / m.w : 1; return { i, f, at: [m.a[0] + (m.b[0] - m.a[0]) * f, m.a[1] + (m.b[1] - m.a[1]) * f], on: m.on }; } }
      const e = MV.mv[MV.mv.length - 1]; return { i: MV.mv.length, f: 1, at: e ? e.b : [0, 0], on: false };
    };
    /* the marks, painted on the part's top in its own texture space; the newest glow hot */
    const cx = R.canvas.getContext("2d"), hx = R.hot.getContext("2d"), S = 512, SC = 0.92;
    const uv = (p) => [(p[0] / SC * 0.5 + 0.5) * S * 0.86 + S * 0.07, (p[1] / SC * 0.5 + 0.5) * S * 0.86 + S * 0.07];
    let lastProg = -1, lastMarks = null;
    function paintMarks(prog, on) {
      const key = on ? Math.round(prog * 400) : -2;
      if (key === lastProg && lastMarks === on) return; lastProg = key; lastMarks = on;
      const style = cfg.style || "mark";
      cx.fillStyle = style === "clean" ? "#7b4a2c" : "#c4c9ce"; cx.fillRect(0, 0, S, S);
      if (style === "clean") { for (let i = 0; i < 900; i++) { cx.fillStyle = `rgba(${90 + (i * 37) % 60},${40 + (i * 17) % 30},${20 + (i * 7) % 20},0.35)`; cx.fillRect((i * 97) % S, (i * 61) % S, 6 + (i % 9), 4 + (i % 7)); } }
      /* a brushed finish: fine streaks across the plate */
      cx.globalAlpha = 0.08; cx.strokeStyle = "#ffffff";
      for (let i = 0; i < 120; i++) { const y = (i * 37) % S; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(S, y + ((i * 13) % 7) - 3); cx.stroke(); }
      cx.globalAlpha = 1;
      hx.fillStyle = "#000"; hx.fillRect(0, 0, S, S);
      if (!on) { R.tex.needsUpdate = true; R.htex.needsUpdate = true; return; }
      const cur = moveAt(prog), recent = Math.max(0, prog - 0.06);
      const sty = { mark: ["#2a2622", 4.2], cut: ["#121212", 3.2], weld: ["#b9a27a", 9], clean: ["#d3d8dc", 34] }[style] || ["#2a2622", 4.2];
      cx.strokeStyle = sty[0]; cx.lineWidth = sty[1]; cx.lineCap = "round";
      hx.strokeStyle = style === "clean" ? "#ffd2a0" : "#ffb070"; hx.lineWidth = Math.max(5, sty[1]); hx.lineCap = "round";
      for (let i = 0; i <= Math.min(cur.i, MV.mv.length - 1); i++) {
        const m = MV.mv[i]; if (!m.on) continue;
        const b = i < cur.i ? m.b : cur.at, a = uv(m.a), bb = uv(b);
        cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(bb[0], bb[1]); cx.stroke();
        if (m.c / MV.tot >= recent && prog < 1) { hx.beginPath(); hx.moveTo(a[0], a[1]); hx.lineTo(bb[0], bb[1]); hx.stroke(); }
      }
      R.tex.needsUpdate = true; R.htex.needsUpdate = true;
    }
    let lastScreen = "";
    function paintScreen(name, u, fault) {
      const key = name + "|" + Math.round(u * 50) + "|" + fault;
      if (key === lastScreen) return; lastScreen = key;
      const c = R.screen.c.getContext("2d");
      c.fillStyle = "#0e1a24"; c.fillRect(0, 0, 512, 360);
      c.fillStyle = "#00b7ba"; c.fillRect(0, 0, 512, 44);
      c.fillStyle = "#06222a"; c.font = "600 24px ui-monospace, Menlo, monospace"; c.fillText("LaserSuite", 18, 30);
      c.fillStyle = fault ? "#ff6b5b" : "#e4ecf1"; c.font = "700 54px ui-monospace, Menlo, monospace"; c.fillText((fault ? "STOPPED" : name).toUpperCase().slice(0, 12), 22, 150);
      c.fillStyle = "#2a3a48"; c.fillRect(22, 196, 468, 18);
      c.fillStyle = "#00b7ba"; c.fillRect(22, 196, 468 * Math.max(0, Math.min(1, u)), 18);
      c.fillStyle = "#8da0ae"; c.font = "500 22px ui-monospace, Menlo, monospace"; c.fillText(cfg.title || "", 22, 270);
      R.screen.tex.needsUpdate = true;
    }
    const tmp = new THREE.Vector3(), lensW = new THREE.Vector3(), fixW = new THREE.Vector3();
    const st = { t: 0 };
    let last = 0;
    function step(dt) {
      const lv = cfg.live ? cfg.live() : null;
      let ph, u, real;
      if (lv) { ph = lv.phases[lv.i]; u = lv.u; real = lv.real; if (lv.fault || lv.paused) dt = 0; }
      else {
        const P0 = cfg.phases || []; if (!P0.length) return;
        if (still.matches) { ph = P0.find((p) => p.k === "PROCESS") || P0[0]; u = 1; dt = 0; }
        else {
          if (cfg.clock) st.t = cfg.clock(); else st.t += dt; let tot = 0; P0.forEach((p) => { tot += p.d; }); st.t %= tot;
          let acc = 0, i = 0; for (; i < P0.length; i++) { if (st.t < acc + P0[i].d) break; acc += P0[i].d; }
          i = Math.min(i, P0.length - 1); ph = P0[i]; u = (st.t - acc) / P0[i].d;
        }
        real = cfg.real;
      }
      const o = pose(ph.k, u);
      R.door.position.y = (R.door.userData.y0 ??= R.door.position.y) + R.doorTravel * o.door;
      R.z.position.y = (R.zTravel == null ? 70 : R.zTravel) * o.z;
      if (R.partMove) R.partMove(o); else R.part.position.y = (R.partY == null ? 26 : R.partY) + 130 * o.lift;
      const fade = o.show ? (o.lift > 0.82 ? (1 - o.lift) / 0.18 : 1) : 0;
      R.partMats.forEach((m) => { m.opacity = fade; }); R.part.visible = fade > 0.01;
      R.clamps.forEach((c) => { c.piv.rotation.z = c.s * -o.clamp * 1.2; });
      paintMarks(o.prog, o.marks);
      /* beam and spot */
      const mv = o.beam ? moveAt(o.prog) : null, on = !!(mv && mv.on);
      if (o.beam) {
        R.part.getWorldPosition(fixW);
        const sx = mv.at[0] / SC * 0.5 * R.partSize[0] * 0.86, sz = mv.at[1] / SC * 0.5 * R.partSize[1] * 0.86;
        tmp.set(fixW.x + sx, fixW.y + 4.5, fixW.z + sz);
        /* gantry axes, robot joints or the operator's hand put the tool over the spot */
        if (R.track) { R.track(tmp); R.head.updateWorldMatrix(true, false); }
        R.head.localToWorld(lensW.copy(R.lensBottom));
        const dir = new THREE.Vector3().subVectors(tmp, lensW), L = dir.length();
        R.beam.visible = on; R.beam.scale.set(1, L, 1); R.beam.position.copy(lensW).addScaledVector(dir, 0.5);
        R.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        R.spot.visible = on; R.spot.position.copy(tmp); R.spot.scale.setScalar(on ? 1 + Math.random() * 0.35 : 0.5);
        R.spotLight.position.copy(tmp).y += 12; R.spotLight.intensity = on ? 2600 + Math.random() * 1200 : 0;
        /* sparks for metal, smoke-coloured slow motes for organics, a glow alone for glass */
        if (on && dt > 0 && cfg.fx !== "plasma") {
          const S2 = R.sparks;
          for (let k = 0; k < (cfg.fx === "smoke" ? 1 : 5); k++) {
            const j = S2.next; S2.next = (S2.next + 1) % S2.n;
            S2.p[j * 3] = tmp.x; S2.p[j * 3 + 1] = tmp.y + 1; S2.p[j * 3 + 2] = tmp.z;
            const a = Math.random() * Math.PI * 2, sp = cfg.fx === "smoke" ? 25 : 260 + Math.random() * 380;
            S2.v[j * 3] = Math.cos(a) * sp; S2.v[j * 3 + 1] = cfg.fx === "smoke" ? 90 + Math.random() * 40 : 250 + Math.random() * 420; S2.v[j * 3 + 2] = Math.sin(a) * sp;
            S2.l[j] = cfg.fx === "smoke" ? 1.6 : 0.4 + Math.random() * 0.4;
          }
        }
      } else { R.beam.visible = false; R.spot.visible = false; R.spotLight.intensity = 0; if (R.track) R.track(null); }
      const S2 = R.sparks, gk = cfg.fx === "smoke" ? -30 : 1800;
      for (let j = 0; j < S2.n; j++) {
        if (S2.l[j] <= 0) { S2.p[j * 3 + 1] = -9999; continue; }
        S2.l[j] -= dt; S2.v[j * 3 + 1] -= gk * dt;
        S2.p[j * 3] += S2.v[j * 3] * dt; S2.p[j * 3 + 1] += S2.v[j * 3 + 1] * dt; S2.p[j * 3 + 2] += S2.v[j * 3 + 2] * dt;
      }
      S2.pts.material.color.set(cfg.fx === "smoke" ? 0x9aa4ad : 0xffc070); S2.pts.material.size = cfg.fx === "smoke" ? 14 : 5;
      S2.pts.geometry.attributes.position.needsUpdate = true;
      /* the light tower: green while the cycle runs, amber when stopped, red while the laser emits */
      const fault = !!(lv && lv.fault);
      R.lamps[0].material = M[lv && !fault ? "lampOn" : "lampOff"][0];
      R.lamps[1].material = M[fault ? "lampOn" : "lampOff"][1];
      R.lamps[2].material = M[on ? "lampOn" : "lampOff"][2];
      paintScreen(ph.n, u, fault);
      const text = lv ? ph.n + " · " + (u * ph.real).toFixed(2) + " of " + ph.real.toFixed(2) + " s · cycle " + real.toFixed(2) + " s"
                      : "Preview · " + ph.n + " · " + ph.real.toFixed(2) + " s of a " + real.toFixed(2) + " s cycle";
      if (readout.textContent !== text) readout.textContent = text;
    }
    /* adaptive quality: when frames come slowly, lower the resolution, then the shadows */
    const perf = { n: 0, sum: 0, level: 0 };
    function adapt(ms) {
      perf.n++; perf.sum += ms;
      if (perf.n < 30) return;
      const avg = perf.sum / perf.n; perf.n = 0; perf.sum = 0;
      if (avg > 45 && perf.level < 2) {
        perf.level++;
        if (perf.level === 1) { renderer.setPixelRatio(1); size(); }
        else { renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); }
        api.quality = perf.level;
      }
    }
    function tick(now) {
      if (stopped) return;
      const raw = last ? now - last : 16, dt = last ? Math.min(raw / 1000, 1 / 20) : 1 / 60; last = now;
      adapt(raw);
      step(dt); api.flyStep && api.flyStep(dt); controls.update(); renderer.render(scene, camera);
      frame = visible && !api.held ? requestAnimationFrame(tick) : 0;
    }
    io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible && !frame && !stopped) { last = 0; frame = requestAnimationFrame(tick); } }, { rootMargin: "120px 0px" });
    io.observe(stage);
    step(0); renderer.render(scene, camera);
    api.ready = true; api.scene = scene; api.parts = Object.keys(G).length;
    wrap.setAttribute("data-ready", "1");
    api.wake = () => { if (!frame && visible && !stopped && !api.held) { last = 0; frame = requestAnimationFrame(tick); } };
    /* hold the picture still (for a print or a capture), and let it go again */
    api.hold = () => { api.held = true; if (frame) cancelAnimationFrame(frame); frame = 0; step(0); api.flyStep && api.flyStep(9); controls.update(); renderer.render(scene, camera); };
    api.release = () => { api.held = false; api.wake(); };
  })();
  return api;
}
window.TEALCad = { mount, version: 1 };
