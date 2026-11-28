(() => {
const P = window.PORTAL, $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const dec = (b) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));
let libs = null;

const RISK = { H: "High risk", M: "Medium risk", L: "Low risk" };
// nav
const nav = $("#nav");
[["overview", "Overview"], ...P.map((m) => [m.key, m.code]), ["compare", "Compare"]].forEach(([k, t]) => { const b = document.createElement("button"); b.dataset.go = k; b.textContent = t; b.onclick = () => go(k); nav.appendChild(b); });
// overview
const nMods = P.reduce((a, m) => a + m.modules.length, 0);
$("#kpis").innerHTML = `<div><b>${P.length}</b><span>Platforms</span></div><div><b>${P.reduce((a,m)=>a+m.stations.length,0)}</b><span>Simulated stations</span></div><div><b>${nMods}</b><span>Modules broken down</span></div><div><b>${P.reduce((a, m) => a + m.modules.filter((x) => x.risk === "H").length, 0)}</b><span>High-risk modules</span></div>`;
$("#cards").innerHTML = P.map((m) => `<article class="card"><img src="twin/thumbs/${m.key}.jpg" alt="${m.name} 3D model"><div class="b"><span class="chip">${m.code}</span><h2>${m.name}</h2><p>${m.app}</p><dl><dt>Laser</dt><dd>${m.laser}</dd><dt>Handling</dt><dd>${m.handling}</dd><dt>Vision</dt><dd>${m.vision}</dd></dl><div class="act"><button class="btn p" data-open="${m.key}">Open 3D simulation</button><button class="btn" data-open="${m.key}" data-tab="parts">Engineering</button><button class="btn" data-open="${m.key}" data-tab="recs">Docs & recommendations</button></div></div></article>`).join("");
$$("[data-open]").forEach((b) => (b.onclick = () => go(b.dataset.open, b.dataset.tab)));
// compare
const rows = [["Application", "app"], ["Laser", "laser"], ["Handling", "handling"], ["Vision", "vision"], ["Traceability", "trace"], ["Integration", "integration"], ["Standards", "standards"]];
$("#compare").innerHTML = `<div class="intro"><h1>Platform comparison</h1><p>Same station logic across the portfolio: load → identify → pre-process vision → focus / height → interlock → process → post-process verification → log & unload.</p></div><table><thead><tr><th></th>${P.map((m) => `<th>${m.code}<br><span style="font-weight:500;color:var(--ink-2)">${m.name}</span></th>`).join("")}</tr></thead><tbody>${rows.map(([t, k]) => `<tr><th>${t}</th>${P.map((m) => `<td>${m[k]}</td>`).join("")}</tr>`).join("")}<tr><th>Stations</th>${P.map((m) => `<td>${m.stations.map((s, i) => `${i + 1}. ${s[0]}`).join("<br>")}</td>`).join("")}</tr><tr><th>Make / buy</th>${P.map((m) => { const mk = m.modules.filter((x) => x.make === "Make").length, by = m.modules.filter((x) => x.make === "Buy").length; return `<td>${mk} make · ${by} buy</td>`; }).join("")}</tr><tr><th>High-risk modules</th>${P.map((m) => `<td>${m.modules.filter((x) => x.risk === "H").map((x) => x.name).join("<br>") || "—"}</td>`).join("")}</tr><tr><th>Open values (TBD)</th>${P.map((m) => `<td>${m.tbd.join(", ")}</td>`).join("")}</tr></tbody></table>`;
// ===================== machine view: digital-twin panel =====================
const TABS = [["twin", "Twin"], ["process", "Process"], ["sequence", "Sequence"], ["vision", "Vision"], ["quality", "Monitoring"], ["production", "Production"], ["maint", "Maintenance"], ["safety", "Safety & alarms"], ["eng", "Engineering"], ["docs", "Docs"]];
const frame = $("#sim");
const sim = () => { if (!ready) return null; try { return frame.contentWindow && frame.contentWindow.__sim; } catch (e) { return null; } };
const rawSim = () => { try { return frame.contentWindow && frame.contentWindow.__sim; } catch (e) { return null; } };
let cur = null, M = null, TW = null, curTab = "twin", st = null, ready = false, loadEpoch=0;
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nowStr = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const shift = () => { const h = new Date().getHours(); return h >= 6 && h < 14 ? "A (06–14)" : h >= 14 && h < 22 ? "B (14–22)" : "C (22–06)"; };
function freshState(key) {
  const tw = TWIN[key];
  const modes = Object.keys(tw.modes);
  const params = {}; for (const m of modes) { params[m] = {}; tw.params.forEach((p) => { if (!p.only || p.only.includes(m)) params[m][p.k] = p.d; }); }
  return { mode: modes[0], params, hmi: "auto", key: false, alarms: [], active: null, faults: new Set(), recs: [], lastCycle: null, lastNg: 0, lastOk: 0, t0: performance.now(), run: 0, emit: 0, travel: 0, cycles: 0, lastAx: null, lastDoor: 0, buf: { a: [], b: [], c: [] }, job: `JOB-${String(Date.now()).slice(-6)}`, batch: `B${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-01`, recipe: tw.recipes[0], recipes: tw.recipes.map((r) => ({ id: r })), art: "dm", env: false, acc: false, cfgView: "complete" };
}
frame.addEventListener("load", () => { const t0 = performance.now(), epoch=loadEpoch; if(!cur)return; const w = () => { if(epoch!==loadEpoch||!cur)return; const s = rawSim(); if (s && s.focus && s.steps && s.S) { ready = true; $("#loading").style.display = "none"; applyMode(true); render(); } else if (performance.now() - t0 < 12000) setTimeout(w, 150); else { const el=$("#loading"); el.style.zIndex="4"; el.innerHTML=`<div style="max-width:370px;text-align:center;padding:20px"><b>3D engine unavailable</b><p>WebGL may be disabled or blocked. Enable hardware acceleration in a supported browser, then retry. Engineering Studio remains available.</p><button class="btn p" id="retry3d">Retry model</button></div>`; $("#retry3d").onclick=()=>{ const key=cur;cur=null;openMachine(key); }; } }; w(); });
function openMachine(key) {
  if (cur === key) return;
  loadEpoch++; ready = false; cur = key; M = P.find((x) => x.key === key); TW = TWIN[key]; st = freshState(key);
  $("#loading").style.display = "flex"; $("#loading").style.zIndex=""; $("#loading").innerHTML="<i></i>Loading 3D model…";
  frame.src = 'twin/' + key + '.html';
  $("#m-code").textContent = M.code; $("#m-name").textContent = M.name;
  $("#tabs").innerHTML = TABS.map(([k, t]) => `<button role="tab" data-tab="${k}" aria-selected="${k === curTab}">${t}</button>`).join("");
  $$("#tabs button").forEach((b) => (b.onclick = () => tab(b.dataset.tab)));
  render();
}
function tab(t) { curTab = t; $$("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t))); render(); }
$("#toggle").onclick = () => { const c = $("#panel").classList.toggle("closed"); $("#toggle").textContent = c ? "Show panel" : "Hide panel"; };
$("#camclose").onclick = () => { $("#camview").hidden = true; };

// ---------- HMI modes & simulation control ----------
function applyMode(first) {
  const s = sim(); if (!s) return;
  if (first) { try { s.setSrc(st.mode); } catch (e) {} pushParams(); }
  if (st.hmi === "auto") { s.setSpeed(1); if (!st.active) s.start(); }
  else if (st.hmi === "setup") { s.setSpeed(0.25); if (!st.active) s.start(); }
  else s.pause();
  s.access(st.hmi === "maint" || st.acc);
}
function setHmi(m) {
  if ((m === "setup" || m === "maint") && !st.key) { flash("Service key required for " + (m === "setup" ? "Setup" : "Maintenance") + " mode (Safety & alarms tab)."); return; }
  st.hmi = m; applyMode(); render();
}
function flash(t) { const el = $("#m-step"); el.textContent = t; el.style.color = "var(--red)"; setTimeout(() => (el.style.color = ""), 2500); }
function pushParams() {
  const s = sim(); if (!s) return; const p = st.params[st.mode];
  if (cur === "mw" && s.setWobble && p.wa != null) s.setWobble(p.wa / 10, Math.max(2, Math.min(12, p.wf / 50)));
  if (cur === "fiber" && s.setArtwork) s.setArtwork(st.art);
}

// ---------- sampling loop (5 Hz) ----------
setInterval(() => {
  const s = sim(); if (!s || !s.S || !M) return; const S = s.S, c = TW.counts(S);
  const running = !s.isPaused() && !st.active;
  if (running) st.run += 0.2; if (c.emit) st.emit += 0.2;
  const ax = TW.axes(S).map((a) => a[1]); if (st.lastAx) st.travel += ax.reduce((t, v, i) => t + Math.abs(v - st.lastAx[i]), 0) / 1000; st.lastAx = ax;
  if (st.lastDoor < 0.05 && c.door >= 0.05) st.cycles++; st.lastDoor = c.door;
  // simulated signals (labelled as such in the UI)
  const p = st.params[st.mode] || {}, n = () => (Math.random() - 0.5);
  const push = (k, v) => { const b = st.buf[k]; b.push(v); if (b.length > 150) b.shift(); };
  push("a", c.emit ? (p.pw || 50) * (1 + n() * 0.04) : 0);
  push("b", c.emit ? 92 + n() * 6 - (S.lamp === "amber" ? 18 : 0) : null);
  push("c", S.phase >= 2 ? (Math.abs(n()) * 12 + (S.vis ? 4 : 8)) : null);
  // traceability record on every completed cycle
  if (S.lastCycle && S.lastCycle !== st.lastCycle) {
    st.lastCycle = S.lastCycle;
    const ng = c.ng - st.lastNg, ok = c.ok - st.lastOk; st.lastNg = c.ng; st.lastOk = c.ok;
    st.recs.unshift({ time: new Date().toISOString().replace("T", " ").slice(0, 19), job: st.job, batch: st.batch, sn: S.serial != null ? String(S.serial).padStart(6, "0") : String(st.recs.length + 1).padStart(6, "0"), recipe: st.recipe, mode: TW.modes[st.mode], params: Object.entries(p).map(([k, v]) => `${k}=${v}`).join(" "), units_ok: ok, units_nok: ng, result: ng > 0 ? "NOK" : "OK", cycle_s: S.lastCycle.toFixed(1), shift: shift() });
    if (st.recs.length > 500) st.recs.pop();
  }
  // header state
  const stp = (s.steps() || [])[S.phase] || "";
  const state = st.active ? "ALARM" : s.isPaused() ? (st.hmi === "auto" ? "PAUSED" : st.hmi.toUpperCase()) : st.hmi === "setup" ? "SETUP · RUN" : "AUTO · RUN";
  const pill = $("#m-state"); pill.textContent = state; pill.className = "pill " + (st.active ? "alarm" : s.isPaused() ? "idle" : "run");
  if ($("#m-step").style.color === "") $("#m-step").textContent = `Station ${S.phase + 1} · ${stp} — ${S.info || ""}`;
  live();
}, 200);

// ---------- render the active tab ----------
function render() {
  const el = $("#tp"); if (!M || !st) return;
  const f = { twin: tTwin, process: tProcess, sequence: tSequence, vision: tVision, quality: tQuality, production: tProduction, maint: tMaint, safety: tSafety, eng: tEng, docs: tDocs }[curTab];
  el.innerHTML = f(); bind(); live();
}
const seg = (name, opts, curv, dis = {}) => `<div class="seg" data-seg="${name}">${Object.entries(opts).map(([k, t]) => `<button data-v="${k}" aria-pressed="${k === curv}" ${dis[k] ? "disabled" : ""}>${t}</button>`).join("")}</div>`;
function tTwin() {
  return `<div class="sec"><h3>Simulation control</h3><div class="row"><button class="btn p" data-act="start">Start / resume</button><button class="btn" data-act="pause">Pause</button><button class="btn" data-act="stop">Stop</button><button class="btn" data-act="reset">Reset</button><span style="margin-left:auto;font-size:12px;color:var(--ink-3)">Speed</span>${seg("speed", { x025: "¼×", x05: "½×", x1: "1×", x2: "2×", x4: "4×" }, "x1")}</div></div>
  <div class="sec"><h3>HMI mode</h3>${seg("hmi", { auto: "Auto", manual: "Manual", setup: "Setup 🔑", maint: "Maintenance 🔑" }, st.hmi)}<p class="muted" style="margin-top:6px">${{ auto: "Automatic cycle; emission enabled only when the safety chain is healthy.", manual: "Cycle held; step the sequence one station at a time. Emission inhibited.", setup: "Reduced speed for teach / setup (service key on).", maint: "Machine held, emission disabled, access zones shown (service key on)." }[st.hmi]}</p>${st.hmi === "manual" ? `<div class="row" style="margin-top:6px"><button class="btn" data-act="stepnext">Step to next station</button></div>` : ""}</div>
  <div class="sec"><h3>Production</h3><div class="tiles"><div class="tile"><span>Cycle (sim)</span><b id="v-cyc">—</b></div><div class="tile"><span>Last cycle</span><b id="v-last">—</b></div><div class="tile"><span>Utilisation</span><b id="v-util">—</b></div><div class="tile"><span>Parts / panels</span><b id="v-parts">—</b></div><div class="tile"><span>OK units</span><b id="v-ok">—</b></div><div class="tile"><span>NOK units</span><b id="v-ng">—</b></div></div></div>
  <div class="sec"><h3>Axis positions <span class="pill sim">SIM</span></h3><div class="kv" id="v-axes"></div></div>
  <div class="sec"><h3>Laser & utilities health <span class="pill sim">SIMULATED</span></h3><div class="kv" id="v-health"></div><p class="muted" style="margin-top:6px">Energy consumption: concept — requires a power meter on the main incomer (e.g. Modbus TCP). Not connected.</p></div>`;
}
function tProcess() {
  const ps = TW.params.filter((p) => !p.only || p.only.includes(st.mode)), v = st.params[st.mode];
  return `<div class="banner">Simulation defaults — illustrative values, not validated process settings. Parameters are logged with every part; they do not change the simulated physics.</div>
  <div class="sec"><h3>Recipe</h3><div class="row"><select id="recipe" class="btn">${st.recipes.map((r) => `<option ${r.id === st.recipe ? "selected" : ""}>${esc(r.id)}</option>`).join("")}</select><button class="btn" data-act="saverec">Save as new recipe</button><button class="btn" data-act="resetprm">Restore defaults</button></div></div>
  <div class="sec"><h3>Source configuration</h3>${seg("mode", TW.modes, st.mode)}<p class="muted" style="margin-top:6px">Only parameters that apply to the selected configuration are shown.</p></div>
  ${TW.artwork ? `<div class="sec"><h3>Artwork</h3>${seg("art", TW.artwork, st.art)}</div>` : ""}
  <div class="sec"><h3>Parameters</h3><div class="prm">${ps.map((p) => `<span>${p.l}</span><input type="number" data-k="${p.k}" value="${v[p.k]}" min="${p.min}" max="${p.max}" step="${p.step}"><i>${p.u}</i>`).join("")}</div></div>
  ${cur === "mw" ? `<div class="sec"><h3>Derived (simulated)</h3><div class="kv" id="v-derived"></div></div>` : ""}`;
}
function tSequence() {
  return `<p class="muted" style="margin-bottom:8px">Click a station to jump the simulation to it. Interlock conditions are design intent (concept).</p><ol class="st">${M.stations.map((s, i) => `<li data-j="${i}"><span>${String(i + 1).padStart(2, "0")}</span><b>${s[0]}</b><p>${s[1]}</p></li>`).join("")}</ol>
  <div class="sec"><h3>Step interlocks (concept)</h3><ul class="rl" style="font-size:12.5px"><li>Process / emission steps require: guard closed & locked, E-stop healthy, extraction OK, cooling OK, recipe valid, part present.</li><li>Motion steps require: axes homed, no collision zone violation (concept), clamp feedback consistent.</li><li>Unload requires: emission off, verification result written to the log.</li></ul></div>`;
}
function tVision() {
  return `<div class="sec"><div class="row" style="margin-bottom:8px"><button class="btn p" data-act="camview">Camera inspection view (full)</button><span class="pill sim">SIMULATED IMAGE</span></div><canvas class="vis" id="visc" width="640" height="480"></canvas></div><div class="sec"><h3>Vision result</h3><div class="kv" id="v-vis"></div></div><p class="muted">Synthetic camera image rendered from the simulation state: boundary, fiducials, target vs actual (offset exaggerated for visibility), path / mark overlay and result. No real camera or algorithm is connected.</p>`;
}
function tQuality() {
  const lab = cur === "mw" ? ["Laser power (% setpoint)", "Process stability index", "Position deviation (µm)"] : ["Laser power (% setpoint)", "Mark / code quality index", "Position residual (µm)"];
  return `<div class="banner">All monitoring signals below are simulated. No photodiode, camera, pyrometer, OCT or acoustic sensor is connected; no defect or penetration detection is claimed.</div>
  ${lab.map((t, i) => `<div class="sec"><h3>${t}</h3><canvas class="ch" id="ch${i}" width="420" height="70"></canvas></div>`).join("")}
  <div class="sec"><h3>Quality summary <span class="pill sim">SIM</span></h3><div class="kv" id="v-q"></div></div>
  <div class="sec"><h3>Sensor architecture</h3><table class="mini"><thead><tr><th>Sensor</th><th>Status</th></tr></thead><tbody>${TW.sensors.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table></div>`;
}
function tProduction() {
  return `<div class="sec"><h3>Order</h3><div class="prm" style="grid-template-columns:90px 1fr"><span>Job ID</span><input id="job" value="${esc(st.job)}"><span>Batch</span><input id="batch" value="${esc(st.batch)}"><span>Recipe</span><input value="${esc(st.recipe)}" disabled><span>Shift</span><input value="${shift()} · assumed pattern" disabled></div><p class="muted" style="margin-top:6px">Barcode / QR scan concept: the job and serial fields would be filled by a scanner or MES; here they are local.</p></div>
  <div class="sec"><h3>Shift dashboard</h3><div class="tiles"><div class="tile"><span>Cycles logged</span><b id="v-nrec">0</b></div><div class="tile"><span>OK</span><b id="v-rok">0</b></div><div class="tile"><span>NOK</span><b id="v-rng">0</b></div></div></div>
  <div class="sec"><h3>History <button class="btn" data-act="csv" style="margin-left:auto;font-size:11.5px;padding:3px 9px">Export CSV</button></h3><div style="max-height:300px;overflow:auto"><table class="mini"><thead><tr><th>Time</th><th>SN</th><th>Recipe</th><th>Result</th><th>Cycle s</th></tr></thead><tbody id="v-hist"></tbody></table></div></div>
  <div class="banner" style="margin-top:4px">MES: local simulation only — records stay in this browser session. No MES connection is implemented.</div>`;
}
function tMaint() {
  return `<div class="banner">Simulated health indicators, sim-accelerated (1 s of simulation counted as 1 h). Intervals are illustrative until vendor data is available — ${TBD}.</div><div class="sec"><h3>Predictive maintenance</h3><div class="maint" id="v-maint"></div></div>
  <div class="sec"><h3>Utilities <span class="pill sim">SIM</span></h3><div class="kv" id="v-util2"></div></div>`;
}
function tSafety() {
  return `<div class="sec"><h3>Service key</h3>${seg("key", { off: "Key OFF", on: "Key ON" }, st.key ? "on" : "off")}<p class="muted" style="margin-top:6px">Key-controlled service mode enables Setup and Maintenance modes.</p></div>
  <div class="sec"><h3>Safety chain <span class="pill sim">CONCEPT</span></h3><ul class="chain" id="v-chain"></ul><p class="muted" style="margin-top:6px">Architecture: safety PLC / relay → laser interlock input and shutter. Use "Inject" to simulate a fault. No certification or compliance is claimed.</p></div>
  <div class="sec"><h3>Alarm history ${st.active ? `<button class="btn p" data-act="ack" style="margin-left:auto;font-size:11.5px;padding:3px 9px">Acknowledge & reset</button>` : ""}</h3><table class="mini"><thead><tr><th>Time</th><th>Alarm</th><th>State</th></tr></thead><tbody id="v-alarms"></tbody></table></div>
  <div class="sec"><h3>Design references</h3><p class="muted">ISO 11553-1 (laser processing machines), ISO 12100 (risk assessment), IEC 60825-1 (laser product safety), IEC 60204-1 (electrical equipment), ISO 13849-1 (safety-related control).</p></div>`;
}
function tEng() {
  return `<div class="sec"><h3>Model configuration</h3><div class="row">${Object.entries(CONFIG_LABELS).map(([k, t]) => `<button class="btn ${st.cfgView === k ? "p" : ""}" data-cfgv="${k}" style="font-size:12px;padding:5px 9px">${t}</button>`).join("")}</div></div>
  <div class="sec"><h3>Views & overlays</h3><div class="row">${["iso", "front", "rear", "left", "right", "top"].map((v) => `<button class="btn" data-view="${v}" style="font-size:12px;padding:5px 9px;text-transform:capitalize">${v}</button>`).join("")}<button class="btn" data-act="resetcam" style="font-size:12px;padding:5px 9px">Reset camera</button></div><div class="row" style="margin-top:8px"><label><input type="checkbox" id="o-env" ${st.env ? "checked" : ""}> Machine envelope</label><label><input type="checkbox" id="o-acc" ${st.acc ? "checked" : ""}> Maintenance access zones</label></div><p class="muted" style="margin-top:6px">Collision detection: concept — axis soft limits and keep-out volumes to be defined from engineering data.</p></div>
  <div class="sec"><h3>Component explorer · BOM structure <button class="btn" data-act="bom" style="margin-left:auto;font-size:11.5px;padding:3px 9px">Export BOM CSV</button></h3>
  ${M.modules.map((x, i) => `<div class="mod" data-id="${x.id}"><div class="mh"><span class="no">${String(i + 1).padStart(2, "0")}</span><span class="n">${x.name}</span><span class="tag">${x.make}</span><span class="tag ${x.risk}">${({ H: "High", M: "Medium", L: "Low" })[x.risk]} risk</span></div><div class="mb"><h4>Function</h4><div>${x.fn}</div><h4>Key components</h4><ul>${x.items.map((t) => `<li>${t}</li>`).join("")}</ul><h4>Component information</h4><div class="kv"><span>Material</span><b style="font-weight:500">${TBD}</b><span>Dimensions</span><b style="font-weight:500">${TBD}</b><span>Manufacturer</span><b style="font-weight:500">${TBD}</b><span>Model number</span><b style="font-weight:500">${TBD}</b><span>Maintenance</span><b style="font-weight:500">${TBD}</b><span>Revision</span><b style="font-weight:500">A0 · concept</b></div><h4>Candidate vendors (to qualify)</h4><div>${x.vendors}</div><div class="rec"><b>Recommendation.</b> ${x.rec}</div><div class="act"><button class="btn p" data-f="${x.id}">Focus in 3D</button><button class="btn" data-i="${x.id}">Isolate</button><button class="btn" data-act="showall">Show all</button></div></div></div>`).join("")}</div>`;
}
function tDocs() {
  const ci = ["semi", "pcb", "fiber", "mw"].indexOf(cur) + 1;
  return `<div class="sec"><h3>Existing-model assessment</h3><p style="margin:0;font-size:12.5px">${ASSESS[cur]}</p></div>
  <div class="sec"><h3>Feature implementation matrix</h3><table class="mini"><thead><tr><th>Feature</th><th>${M.code}</th></tr></thead><tbody>${FEATURES.map((r) => `<tr><td>${r[0]}</td><td class="st-${r[ci][0]}">${({ I: "Implemented", S: "Simulated", C: "Concept", P: "Proposed", "—": "n/a" })[r[ci][0]] || r[ci]}${r[ci].length > 1 ? " " + r[ci].slice(1) : ""}</td></tr>`).join("")}</tbody></table></div>
  <div class="sec"><h3>Engineering recommendations</h3><ol class="rl" style="font-size:12.5px">${M.recs.map((r) => `<li>${r}</li>`).join("")}</ol></div>
  <div class="sec"><h3>Smart-factory connectivity</h3><table class="mini"><thead><tr><th>Interface</th><th>Status</th></tr></thead><tbody>${[["OPC UA", "Architecture only — not connected"], ["Modbus TCP", "Architecture only — not connected"], ["EtherNet/IP", "Architecture only — not connected"], ["PLC communication", "Built-in state machine (simulation)"], ["MES integration", "Local simulated log only"], ["ERP integration", "Not implemented"], ["Production database", "Not implemented (in-memory log)"], ["CSV reports", "Implemented (production + BOM)"], ["Recipe management", "Implemented locally (session)"]].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table></div>
  <div class="sec"><h3>Required engineering inputs</h3><ul class="rl" style="font-size:12.5px">${INPUTS.map((t) => `<li>${t}</li>`).join("")}</ul></div>
  <div class="sec"><h3>Open values (TBD)</h3><div class="tbd">${M.tbd.map((t) => `<span>${t}</span>`).join("")}</div></div>
  <div class="sec"><h3>Assumptions & limitations</h3><ul class="rl" style="font-size:12.5px">${ASSUMPTIONS.map((t) => `<li>${t}</li>`).join("")}</ul></div>
  <div class="sec"><h3>Hardware-integration roadmap</h3><table class="mini"><tbody>${ROADMAP.map(([a, b]) => `<tr><th style="width:150px">${a}</th><td>${b}</td></tr>`).join("")}</tbody></table></div>`;
}
// ---------- event binding ----------
function bind() {
  const s = sim();
  $$("#tp [data-seg]").forEach((g) => $$(`#tp [data-seg="${g.dataset.seg}"] button`).forEach((b) => (b.onclick = () => {
    const v = b.dataset.v, k = g.dataset.seg;
    if (k === "speed") { sim() && sim().setSpeed({ x025: 0.25, x05: 0.5, x1: 1, x2: 2, x4: 4 }[v]); $$(`[data-seg=speed] button`).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); return; }
    if (k === "hmi") return setHmi(v);
    if (k === "mode") { st.mode = v; try { sim().setSrc(v); } catch (e) {} pushParams(); applyMode(); render(); return; }
    if (k === "art") { st.art = v; pushParams(); render(); return; }
    if (k === "key") { st.key = v === "on"; if (!st.key && (st.hmi === "setup" || st.hmi === "maint")) { st.hmi = "manual"; applyMode(); } render(); return; }
  })));
  $$("#tp [data-act]").forEach((b) => (b.onclick = () => act(b.dataset.act)));
  $$("#tp input[data-k]").forEach((i) => (i.onchange = () => { const p = TW.params.find((x) => x.k === i.dataset.k); let v = Number(i.value); v = Math.min(p.max, Math.max(p.min, v)); i.value = v; st.params[st.mode][p.k] = v; pushParams(); live(); }));
  const rs = $("#recipe"); if (rs) rs.onchange = () => { st.recipe = rs.value; const r = st.recipes.find((x) => x.id === rs.value); if (r && r.params) { st.mode = r.mode; st.params[r.mode] = { ...r.params }; try { sim().setSrc(r.mode); } catch (e) {} pushParams(); } render(); };
  const j = $("#job"); if (j) j.onchange = () => (st.job = j.value);
  const bt = $("#batch"); if (bt) bt.onchange = () => (st.batch = bt.value);
  $$("#tp [data-j]").forEach((li) => (li.onclick = () => sim() && sim().jumpTo(Number(li.dataset.j))));
  $$("#tp [data-cfgv]").forEach((b) => (b.onclick = () => { st.cfgView = b.dataset.cfgv; sim() && sim().showOnly(b.dataset.cfgv === "complete" ? null : TW.configs[b.dataset.cfgv]); render(); }));
  $$("#tp [data-view]").forEach((b) => (b.onclick = () => sim() && sim().view(b.dataset.view)));
  const oe = $("#o-env"); if (oe) oe.onchange = () => { st.env = oe.checked; sim() && sim().envelope(st.env); };
  const oa = $("#o-acc"); if (oa) oa.onchange = () => { st.acc = oa.checked; sim() && sim().access(st.acc || st.hmi === "maint"); };
  $$("#tp .mh").forEach((h) => (h.onclick = () => { const d = h.parentElement; d.classList.toggle("open"); $$(".mod").forEach((x) => (x.dataset.active = String(x === d))); sim() && sim().highlight(d.dataset.id); }));
  $$("#tp [data-f]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); sim() && sim().focus(b.dataset.f); }));
  $$("#tp [data-i]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); if (sim()) { sim().isolate(b.dataset.i); sim().focus(b.dataset.i); } }));
  $$("#tp [data-inject]").forEach((b) => (b.onclick = () => inject(b.dataset.inject)));
}
function act(a) {
  const s = sim(); if (!s) return;
  if (a === "start") { if (st.active) return flash("Acknowledge and reset the active alarm first (Safety & alarms)."); if (st.hmi === "manual" || st.hmi === "maint") st.hmi = "auto"; applyMode(); render(); }
  else if (a === "pause") s.pause();
  else if (a === "stop") s.stop();
  else if (a === "reset") { s.reset(); st.lastNg = st.lastOk = 0; st.lastCycle = null; }
  else if (a === "stepnext") { const n = (s.S.phase + 1) % 8; s.jumpTo(n); }
  else if (a === "camview") { $("#camview").hidden = false; }
  else if (a === "saverec") { const id = `${st.recipe.split("-R")[0]}-R${st.recipes.length + 1}`; st.recipes.push({ id, mode: st.mode, params: { ...st.params[st.mode] } }); st.recipe = id; render(); }
  else if (a === "resetprm") { TW.params.forEach((p) => { if (st.params[st.mode][p.k] != null) st.params[st.mode][p.k] = p.d; }); pushParams(); render(); }
  else if (a === "csv") download(`${M.code}_production_${st.batch}.csv`, toCSV(st.recs));
  else if (a === "bom") download(`${M.code}_BOM_structure.csv`, toCSV(bomRows()));
  else if (a === "ack") { st.alarms.forEach((x) => { if (x.state === "Active") x.state = "Cleared " + nowStr(); }); st.active = null; st.faults.clear(); s.clearFault(); render(); }
  else if (a === "showall") s.showAll();
  else if (a === "resetcam") s.view("iso");
}
function inject(id) {
  const it = TW.safety.find((x) => x.id === id); if (!it) return;
  st.faults.add(id); st.active = it.fault; st.alarms.unshift({ t: nowStr(), text: it.fault, state: "Active" });
  sim() && sim().fault(it.fault); render();
}
function bomRows() {
  const rows = [{ level: 0, item: M.code, name: M.name, make_buy: "", function: "", manufacturer: "", model: "", qty: 1, revision: "A0" }];
  M.modules.forEach((x, i) => { rows.push({ level: 1, item: `${M.code}-${String(i + 1).padStart(2, "0")}`, name: x.name, make_buy: x.make, function: x.fn, manufacturer: TBD, model: TBD, qty: 1, revision: "A0" }); x.items.forEach((c, k) => rows.push({ level: 2, item: `${M.code}-${String(i + 1).padStart(2, "0")}-${String(k + 1).padStart(2, "0")}`, name: c, make_buy: "", function: "", manufacturer: TBD, model: TBD, qty: TBD, revision: "A0" })); });
  return rows;
}
function toCSV(rows) { if (!rows.length) return "no records\n"; const k = Object.keys(rows[0]); return [k.join(","), ...rows.map((r) => k.map((x) => `"${String(r[x] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n"); }
async function download(name, text) {
  try { const c = window.claude && window.claude.use ? await window.claude.use("downloads") : null; if (c) { await c.save({ filename: name, data: text }); return; } } catch (e) { if (window.claude && window.claude.use) { flash("Download declined or unavailable."); return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

// ---------- live updates for the active tab ----------
function live() {
  const s = sim(); if (!s || !s.S || !st) return; const S = s.S, c = TW.counts(S), p = st.params[st.mode] || {};
  const set = (id, h) => { const e = document.getElementById(id); if (e) e.innerHTML = h; };
  const el = (performance.now() - st.t0) / 1000;
  set("v-cyc", `${fmt(S.cycleT)} s`); set("v-last", S.lastCycle ? `${fmt(S.lastCycle)} s` : "—"); set("v-util", `${Math.round(100 * st.run / Math.max(1, el))}%`);
  set("v-parts", c.parts); set("v-ok", c.ok); set("v-ng", c.ng);
  set("v-axes", TW.axes(S).map(([n, v, u]) => `<span>${n}</span><b>${fmt(v, u === "°" ? 1 : 2)} ${u}</b>`).join(""));
  const t = 22 + Math.sin(el / 9) * 0.3 + (c.emit ? 0.4 : 0);
  set("v-health", [["Laser source state", st.active ? "Interlocked" : c.emit ? "Emitting" : "Ready"], ["Emission time (sim)", `${fmt(st.emit, 0)} s`], ["Source temperature", `${fmt(t + 2)} °C (sim)`], ["Chiller / cooling", `${fmt(t)} °C · flow OK (sim)`], ["Extraction", st.faults.has("extract") ? "LOW" : "Running (sim)"], ["Alarm status", st.active || "None"]].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join(""));
  if (cur === "mw") { const L = { tab_qcw: 9, tab_cw: 42, tab_wob: 42, can_qcw: 40, can_cw: 92.4, can_wob: 92.4 }; const prod = S.serial != null ? null : null; set("v-derived", st.mode === "qcw" ? `<span>Spots per part (geometry)</span><b>9 (tab) / 40 (can)</b><span>Energy per part (setpoint × spots)</span><b>${fmt(p.pe * 9, 1)} J (tab) · ${fmt(p.pe * 40, 1)} J (can)</b><span>Duty cycle (pd × pf)</span><b>${fmt(p.pd * p.pf / 10, 1)} %</b>` : `<span>Weld path length (geometry)</span><b>42 mm (tab, 3 stitches) · 92.4 mm (can)</b><span>Weld time at speed</span><b>${fmt(42 / p.sp, 2)} s · ${fmt(92.4 / p.sp, 2)} s</b><span>Line-energy index (power % ÷ speed)</span><b>${fmt(p.pw / p.sp, 3)}</b>${st.mode === "wob" ? `<span>Wobble</span><b>${p.wa} mm · ${p.wf} Hz</b>` : ""}`); }
  if (curTab === "vision") { drawVision($("#visc")); set("v-vis", visionKV(S)); }
  if (!$("#camview").hidden) { const cv = $("#camc"); const r = cv.getBoundingClientRect(); if (cv.width !== Math.round(r.width)) { cv.width = Math.round(r.width); cv.height = Math.round(r.height); } drawVision(cv); }
  if (curTab === "quality") { ["a", "b", "c"].forEach((k, i) => chart($(`#ch${i}`), st.buf[k], i === 0 ? 100 : i === 1 ? 100 : 30)); const tot = c.ok + c.ng; set("v-q", `<span>Units graded</span><b>${tot}</b><span>OK / NOK</span><b>${c.ok} / ${c.ng}</b><span>Yield (sim)</span><b>${tot ? fmt(100 * c.ok / tot) + " %" : "—"}</b><span>Spatter events (concept)</span><b>${S.lamp === "amber" ? 1 : 0}</b><span>Classification</span><b>${S.lamp === "amber" ? "NOK on last part" : "OK"}</b>`); }
  if (curTab === "production") { set("v-nrec", st.recs.length); set("v-rok", st.recs.filter((r) => r.result === "OK").length); set("v-rng", st.recs.filter((r) => r.result === "NOK").length); set("v-hist", st.recs.slice(0, 40).map((r) => `<tr><td>${r.time.slice(11)}</td><td>${r.sn}</td><td>${esc(r.recipe)}</td><td style="color:${r.result === "OK" ? "var(--green)" : "var(--red)"};font-weight:700">${r.result}</td><td>${r.cycle_s}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Completed cycles appear here.</td></tr>`); }
  if (curTab === "maint") {
    const basis = { emit: st.emit, travel: st.travel * 20, time: el / 2, cycles: st.cycles * 30 };
    set("v-maint", TW.maint.map(([n, b]) => { const used = Math.min(100, basis[b] / 3); return `<span>${n}<br><i style="font-style:normal;color:var(--ink-3);font-size:11px">${{ emit: "emission hours", travel: "axis travel", time: "running hours", cycles: "actuation cycles" }[b]} · interval TBD</i></span><div class="bar2"><i style="width:${used}%;background:${used > 80 ? "var(--red)" : used > 60 ? "var(--amber)" : "var(--teal)"}"></i></div><b style="font-size:12px;text-align:right">${fmt(used, 0)}%</b>`; }).join(""));
    set("v-util2", `<span>Door interlock</span><b>${c.door > 0.05 ? "Open (no emission)" : "Closed & locked"}</b><span>Cooling flow</span><b>${st.faults.has("cool") ? "LOW" : "OK (sim)"}</b><span>Filter life</span><b>${fmt(Math.max(0, 100 - el / 6), 0)} % (sim)</b><span>Servo status</span><b>${st.active ? "Disabled (alarm)" : "Enabled (sim)"}</b>`);
  }
  if (curTab === "safety") {
    const door = c.door > 0.05;
    set("v-chain", TW.safety.map((x) => { const bad = st.faults.has(x.id), warn = x.id === "guard" && door && !bad; return `<li><span class="dot ${bad ? "bad" : warn ? "warn" : ""}"></span><span>${x.name}<br><i style="font-style:normal;color:var(--ink-3);font-size:11px">${bad ? "FAULT — " + x.fault : warn ? "Open for load / unload — emission inhibited" : "Healthy"}</i></span><button class="btn" data-inject="${x.id}">Inject</button></li>`; }).join("") + `<li><span class="dot ${st.active ? "bad" : c.emit ? "" : "off"}"></span><span><b>Laser emission enable</b><br><i style="font-style:normal;color:var(--ink-3);font-size:11px">${st.active ? "Removed by safety chain" : c.emit ? "Enabled — emitting" : "Permitted when cycle requests"}</i></span><span></span></li>`);
    $$("#tp [data-inject]").forEach((b) => (b.onclick = () => inject(b.dataset.inject)));
    set("v-alarms", st.alarms.map((a) => `<tr><td>${a.t}</td><td>${esc(a.text)}</td><td style="color:${a.state === "Active" ? "var(--red)" : "var(--ink-3)"}">${a.state}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">No alarms.</td></tr>`);
  }
}
function chart(cv, data, max) {
  if (!cv) return; const x = cv.getContext("2d"), w = cv.width, h = cv.height; x.clearRect(0, 0, w, h);
  x.strokeStyle = "rgba(128,140,146,.25)"; x.lineWidth = 1; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, h * i / 4); x.lineTo(w, h * i / 4); x.stroke(); }
  x.strokeStyle = "#0e8a86"; x.lineWidth = 1.6; x.beginPath(); let pen = false;
  data.forEach((v, i) => { const px = w * i / 149, py = h - 4 - (h - 8) * Math.min(1, (v ?? 0) / max); if (v == null) { pen = false; return; } if (!pen) { x.moveTo(px, py); pen = true; } else x.lineTo(px, py); }); x.stroke();
  x.fillStyle = "#7b868c"; x.font = "10px Inter, Arial"; x.fillText(`max ${max}`, 4, 11); x.fillText("SIMULATED", w - 62, 11);
}
// ---------- synthetic camera image ----------
function visionKV(S) {
  const v = S.vis, rows = [["Station", (sim().steps() || [])[S.phase] || ""]];
  if (cur === "mw" || cur === "fiber") { rows.push(["Workpiece detected", S.pVis && S.pVis.some ? (S.pVis.some((x) => x) ? "Yes" : "No") : S.pOn ? "Yes" : "No"]); rows.push(["Orientation", "0° nominal · notch / feature found (sim)"]); rows.push(["Alignment deviation", v ? `ΔX ${v.dx} · ΔY ${v.dy} mm · Δθ ${v.dt}°` : "—"]); rows.push(["Correction status", v ? "Applied to path" : "Pending"]); if (cur === "mw") rows.push(["Joint gap (sim)", v ? `${(0.02 + (S.serial % 3) * 0.01).toFixed(2)} mm` : "—"]); rows.push(["Height", S.meas ? `${((S.meas - (cur === "mw" ? 88 : 86)) * 10).toFixed(1)} mm` : "—"]); const r = S.res && (S.res.length ? S.res.find((x) => x && x.g) : S.res); rows.push(["Inspection result", r ? (r.ok === false ? "NOK" : r.ok ? "OK" + (r.g ? ` · grade ${r.g}` : "") : "—") : "—"]); }
  else if (cur === "pcb") { rows.push(["Fiducial", S.fid >= 0 ? `#${S.fid + 1} under CCD` : "—"]); rows.push(["Codes marked", (S.tm ? S.tm.size : 0) + (S.bm ? S.bm.size : 0)]); rows.push(["Codes graded", (S.tg ? S.tg.size : 0) + (S.bg ? S.bg.size : 0)]); rows.push(["Board result", S.ng ? "Bad-board flag" : "Good"]); }
  else { rows.push(["Marked units", S.marks ? S.marks.size : 0]); rows.push(["Graded units", S.checks ? S.checks.size : 0]); rows.push(["Fiducial", S.fid >= 0 ? `#${S.fid + 1}` : "—"]); rows.push(["Last grade", S.grade || "—"]); }
  return rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join("");
}
function drawVision(cv) {
  if (!cv) return; const s = sim(); if (!s || !s.S) return; const S = s.S, x = cv.getContext("2d"), w = cv.width, h = cv.height;
  x.fillStyle = "#0d1214"; x.fillRect(0, 0, w, h);
  const k = Math.min(w, h) / 9;                         // px per model unit (10 mm)
  const tf = (mx, my, cx, cy) => [w / 2 + (mx - cx) * k, h / 2 - (my - cy) * k];
  const line = (pts, col, lw = 2, dash = []) => { x.strokeStyle = col; x.lineWidth = lw; x.setLineDash(dash); x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(...p) : x.moveTo(...p))); x.stroke(); x.setLineDash([]); };
  const cross = (px, py, col, r = 10) => { line([[px - r, py], [px + r, py]], col, 1.5); line([[px, py - r], [px, py + r]], col, 1.5); };
  const txt = (t, px, py, col = "#bfe9e5", f = 13) => { x.fillStyle = col; x.font = `${f}px Inter, Arial`; x.fillText(t, px, py); };
  const v = S.vis, ex = 20;                            // offsets exaggerated ×20 for visibility
  if (cur === "mw") {
    const cam = S.phase >= 6 ? [-14, -2] : [-2, -2], P = [S.sx, S.sy];
    const prod = S.bead != null && document ? null : null;
    const isCan = (() => { try { return frame.contentWindow.document.querySelector("[data-prod=can]").getAttribute("aria-pressed") === "true"; } catch (e) { return false; } })();
    const [px, py] = tf(P[0], P[1], cam[0], cam[1]);
    x.save(); x.translate(px, py); if (!S.pOn) x.globalAlpha = 0.15;
    if (!isCan) { x.fillStyle = "#8a5a3a"; x.fillRect(-2.1 * k, -1.3 * k, 4.2 * k, 2.6 * k); x.fillStyle = "#9aa3a8"; x.fillRect(-0.8 * k, -2.4 * k, 1.6 * k, 3.7 * k); }
    else { x.fillStyle = "#7d868b"; x.beginPath(); x.arc(0, 0, 2 * k, 0, 7); x.fill(); x.fillStyle = "#aab2b7"; x.beginPath(); x.arc(0, 0, 1.47 * k, 0, 7); x.fill(); x.fillStyle = "#c3c9cd"; x.beginPath(); x.arc(0, 0, 1.4 * k, 0, 7); x.fill(); }
    const mode = st.mode, pts = []; if (!isCan) { if (mode === "qcw") { for (const yy of [-0.6, 0, 0.6]) for (const xx of [-0.45, 0, 0.45]) pts.push([xx, yy]); } else for (const xx of [-0.45, 0, 0.45]) for (let i = 0; i <= 28; i++) pts.push([xx, -0.7 + 1.4 * i / 28]); } else { const n = mode === "qcw" ? 40 : 160; for (let i = 0; i < n; i++) { const a = i / n * 6.283; pts.push([Math.cos(a) * 1.47, Math.sin(a) * 1.47]); } }
    const done = Math.floor(S.bead || 0);
    pts.forEach((p, i) => { x.fillStyle = i < done ? (S.res && !S.res.ok ? "#ff8a7a" : "#ffc56b") : "rgba(60,196,189,.55)"; x.beginPath(); x.arc(p[0] * k, -p[1] * k, mode === "qcw" ? 0.09 * k : (mode === "wob" ? 0.09 : 0.05) * k, 0, 7); x.fill(); });
    x.strokeStyle = "#3cc4bd"; x.lineWidth = 2; x.setLineDash([6, 4]); if (!isCan) x.strokeRect(-2.15 * k, -1.35 * k, 4.3 * k, 2.7 * k); else { x.beginPath(); x.arc(0, 0, 2.05 * k, 0, 7); x.stroke(); } x.setLineDash([]);
    x.restore();
    const [tx, ty] = tf(cam[0], cam[1], cam[0], cam[1]); cross(tx, ty, "#ffffff", 14); txt("target", tx + 10, ty - 10, "#ffffff", 11);
    if (v) { const ax = tx + Number(v.dx) * ex * k / 10 * 10, ay = ty - Number(v.dy) * ex * k / 10 * 10; cross(ax, ay, "#ffb347", 10); txt("actual (×20)", ax + 8, ay + 16, "#ffb347", 11); }
    txt(S.phase >= 6 ? "POST-WELD INSPECTION CAMERA" : "COAXIAL CCD (PRE-WELD)", 14, 24, "#3cc4bd", 13);
    txt(`${v ? "Correction applied" : "Searching joint…"} · ${done}/${pts.length} welds`, 14, h - 16);
    if (S.res) txt(S.res.ok ? "OK" : "NOK", w - 64, 28, S.res.ok ? "#5fd38d" : "#ff6b6b", 22);
  } else if (cur === "fiber") {
    const isHsg = (() => { try { return frame.contentWindow.document.querySelector("[data-prod=housing]").getAttribute("aria-pressed") === "true"; } catch (e) { return false; } })();
    const u = Math.max(...S.rev);
    x.save(); x.translate(w / 2, h / 2);
    if (!isHsg) { x.fillStyle = "#8d969b"; x.beginPath(); x.arc(0, 0, 3.6 * k, 0, 7); x.fill(); x.fillStyle = "#0d1214"; x.beginPath(); x.arc(0, 0, 1.1 * k, 0, 7); x.fill(); for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.52; x.beginPath(); x.arc(Math.cos(a) * 2.7 * k, Math.sin(a) * 2.7 * k, 0.3 * k, 0, 7); x.fill(); } }
    else { x.fillStyle = "#b9c0c4"; x.fillRect(-3.4 * k, -2.6 * k, 6.8 * k, 5.2 * k); }
    const mw = 3.4 * k, mh = 1.3 * k, my0 = isHsg ? -0.3 * k : -2.6 * k;
    x.strokeStyle = "#3cc4bd"; x.setLineDash([5, 4]); x.strokeRect(-mw / 2, my0 - mh / 2, mw, mh); x.setLineDash([]);
    x.save(); x.beginPath(); x.rect(-mw / 2, my0 - mh / 2, mw * u, mh); x.clip(); x.fillStyle = "#1a1d20";
    if (st.art === "dm" || st.art === "qr") { const n = st.art === "dm" ? 12 : 15, cs = mh / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i === 0 || j === n - 1 || (i * 13 + j * 7 + i * j) % 7 < 3) x.fillRect(-mw / 2 + i * cs, my0 - mh / 2 + j * cs, cs, cs); x.font = `bold ${mh * 0.35}px Inter`; x.fillText("TEAL", -mw / 2 + mh * 1.15, my0 - mh * 0.05); x.font = `${mh * 0.22}px monospace`; x.fillText(`SN ${String(S.serial).padStart(6, "0")}`, -mw / 2 + mh * 1.15, my0 + mh * 0.32); }
    else { x.font = `bold ${mh * 0.45}px Inter`; x.fillText(st.art === "serial" ? String(S.serial).padStart(6, "0") : st.art === "logo" ? "TT TEAL" : "TEAL · LOT", -mw / 2 + 6, my0 + mh * 0.15); }
    x.restore();
    // hatch preview lines (vector path)
    x.strokeStyle = "rgba(255,179,71,.6)"; x.lineWidth = 1; const hs = Math.max(3, 10 * (st.params[st.mode].hs || 0.03) / 0.03);
    for (let yy = -mh / 2; yy < mh / 2; yy += hs) { x.beginPath(); x.moveTo(-mw / 2, my0 + yy); x.lineTo(-mw / 2 + mw * u, my0 + yy); x.stroke(); }
    x.restore();
    const f1 = isHsg ? [[-3.1, 2.3], [3.1, -2.3]] : [[0, -3.6], [0, 1.1]];
    f1.forEach(([fx, fy]) => cross(w / 2 + fx * k, h / 2 - fy * k, "#3cc4bd", 9));
    cross(w / 2, h / 2 - (my0 / k) * -k, "#ffffff", 12);
    if (v) { cross(w / 2 + Number(v.dx) * ex * k, h / 2 + my0 - Number(v.dy) * ex * k, "#ffb347", 9); txt("actual (×20)", w / 2 + Number(v.dx) * ex * k + 8, h / 2 + my0 + 18, "#ffb347", 11); }
    txt(S.phase >= 6 ? "POST-MARK GRADE VERIFIER" : S.phase <= 2 ? "PRE-MARK FIDUCIAL CAMERA" : "MARK PREVIEW · VECTOR PATH", 14, 24, "#3cc4bd");
    txt(`${v ? "Position corrected" : "Locating fiducials…"} · mark ${Math.round(u * 100)}% · ${TW.artwork[st.art]}`, 14, h - 16);
    const r = S.res && S.res.find && S.res.find((q) => q && q.g); if (r) txt(r.ok ? `OK · ${r.g}` : `NOK · ${r.g}`, w - 110, 28, r.ok ? "#5fd38d" : "#ff6b6b", 20);
  } else if (cur === "pcb") {
    const big = S.W > 25, cols = big ? 4 : 3, rows = big ? 3 : 2, L = big ? 45 : 30, W = big ? 35 : 20, kk = Math.min(w / (L + 6), h / (W + 8));
    const x0 = w / 2 - L * kk / 2, y0 = h / 2 - W * kk / 2;
    x.fillStyle = "#1f5a40"; x.fillRect(x0, y0, L * kk, W * kk);
    const px = (L - 2.4) / cols, py = (W - 2.4) / rows; let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, n++) { const cx = 1.2 + px * (c + 0.5), cy = 1.2 + py * (r + 0.5); x.strokeStyle = "rgba(255,255,255,.18)"; x.strokeRect(x0 + (1.2 + px * c) * kk, y0 + (1.2 + py * r) * kk, px * kk, py * kk); const mx = x0 + (cx - px * 0.28) * kk, my = y0 + (W - (cy + py * 0.24)) * kk, sz = 1.2 * kk; const g = S.tg && S.tg.get(n); x.fillStyle = g ? (g.g === "D" ? "#ff6b6b" : "#5fd38d") : S.tm && S.tm.has(n) ? "#e9efe9" : "rgba(255,255,255,.3)"; x.fillRect(mx - sz / 2, my - sz / 2, sz, sz); }
    [[0.6, W - 0.6], [L - 0.6, 2.2], [0.6, 0.6]].forEach(([fx, fy], i) => { x.fillStyle = S.fid === i ? "#ffb347" : "#d9a65c"; x.beginPath(); x.arc(x0 + fx * kk, y0 + (W - fy) * kk, 0.35 * kk, 0, 7); x.fill(); });
    txt("UPPER CCD · PANEL MAP (schematic)", 14, 24, "#3cc4bd"); txt(`${S.tm ? S.tm.size : 0} marked · ${S.tg ? S.tg.size : 0} graded${S.ng ? " · BAD-BOARD FLAG" : ""}`, 14, h - 16);
  } else {
    const n = 24, cols = 8, rows = 3, cw = (w - 80) / cols, ch = (h - 140) / rows;
    x.fillStyle = "#2b3135"; x.fillRect(30, 60, w - 60, h - 100);
    for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); const mk = S.marks && S.marks.has(i), ck = S.checks && S.checks.has(i), bad = S.bad === i; x.fillStyle = "#14171a"; x.fillRect(40 + c * cw + 4, 70 + r * ch + 4, cw - 8, ch - 8); if (mk) { x.fillStyle = bad ? "#ff6b6b" : ck ? "#5fd38d" : "#c9cfd2"; x.fillRect(40 + c * cw + cw * 0.3, 70 + r * ch + ch * 0.35, cw * 0.4, ch * 0.3); } }
    [[36, 66], [w - 36, h - 46]].forEach(([fx, fy], i) => cross(fx, fy, S.fid === i ? "#ffb347" : "#3cc4bd", 8));
    txt("FIDUCIAL / GRADER CAMERA · STRIP MAP (schematic)", 14, 24, "#3cc4bd"); txt(`${S.marks ? S.marks.size : 0} marked · ${S.checks ? S.checks.size : 0} graded`, 14, h - 16);
  }
  x.fillStyle = "rgba(255,200,90,.85)"; x.font = "10px Inter, Arial"; x.fillText("SIMULATED IMAGE", w - 104, h - 10);
}

function go(k, t) {
  document.getElementById("studio")?.classList.remove("on");
  $$("nav button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.go === k)));
  const isM = P.some((m) => m.key === k);
  $("#overview").classList.toggle("on", k === "overview"); $("#compare").classList.toggle("on", k === "compare"); $("#machine").classList.toggle("on", isM);
  if (isM) { openMachine(k); tab(t === "recs" ? "docs" : t === "parts" ? "eng" : "twin"); }
  else if (cur) { loadEpoch++; ready = false; cur = null; frame.src = "about:blank"; }
  try { history.replaceState(null, "", "#" + k); } catch (e) {}
}
window.tealGo = go;
const h0 = location.hash.slice(1);
go([...P.map((m) => m.key), "compare"].includes(h0) ? h0 : "overview");
})();
