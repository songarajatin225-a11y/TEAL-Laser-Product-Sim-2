# TEAL Laser Equipment Configurator

Interactive configurator for the TEAL laser automation portfolio — Titan Engineering
& Automation Ltd, Laser & Photonics Vertical.

Configuration data is derived from *TEAL Laser Automation Solutions — Product
Catalogue, 2026 Edition* (Ch. 02–13): 7 product families, 22 platforms, 12 laser
sources, 4 f-theta objectives, 25 automation modules, 4 LaserSuite editions.

## Deploy to GitHub Pages

1. Create a repository and add `index.html`, `.nojekyll` and this `README.md` to the
   default branch.
2. **Settings → Pages → Source:** deploy from branch, `main`, `/ (root)`.
3. Live at `https://<user>.github.io/<repo>/` within about a minute.

For a custom domain, add a `CNAME` file containing the hostname and point a DNS
record at GitHub Pages.

## Notes

- Single self-contained file. The TEAL logo is embedded as a base64 data URI, so
  there are no asset paths to break when served from a repository subpath.
- Only external request is Google Fonts (Archivo, IBM Plex Sans, IBM Plex Mono).
  System fonts are used as fallback if it is blocked.
- No build step, no framework, no backend. The only thing kept in the browser
  is a recoverable draft of admin-panel edits — see below.
- Configurations are shareable by URL — state is encoded in the location hash,
  e.g. `#p=markc2i&a=dual&s=co2&w=30&l=f254&f=inline`.
- **Print / PDF** produces a branded A4 specification sheet.

## The 3D machine view

The nameplate panel carries a live 3D view of the machine being configured. It is
rendered by a small painter's-algorithm engine written into `index.html` — no
library, no CDN, so the page stays a single self-contained file.

**The machine assembles as you configure it.** Each step adds hardware:

| Step | What appears |
|------|--------------|
| 01 Family | Floor plan and Class-1 keep-out zone, plus a ghost of the machine |
| 02 Platform | Frame, enclosure or guarding, control cabinet, HMI, status beacon — and any modules that are standard content on that platform |
| 03 Application | Work table, fixture and the workpiece for the selected material |
| 04 Source | Laser source, chiller, beam delivery, scan head and the f-theta objective — head height and cone angle follow the focal length |
| 05 Integration | Every automation module you select, placed on its own footprint: conveyors, robots, feeders, turntables, vision, extraction, gas, dry room, glovebox, host cabinets |
| 06 Specification | CE marking, and the **Start simulation** button arms |

### Everything in the view comes from the configuration

Change any option and the machine is rebuilt around it — nothing is a fixed
picture:

| Change this | The 3D changes |
|-------------|----------------|
| Platform | Beam delivery: `galvo` a scan head over a table, `galvo2` opposed heads above and below a conveyor, `gantry` a bridge and carriage, `robot` an articulated arm in a fenced cell, `handpiece` a trolley and armoured fibre over an open bench |
| Platform | Enclosure size. A stated `Footprint` is used verbatim (Mark PCB C2i builds at 1,250 × 1,450 × 1,650 mm with the conveyor at 900 mm); otherwise the frame is derived and shown as *est.* |
| Source | Resonator archetype — a sealed RF CO₂ tube whose length tracks the power, a fibre rack, a DPSS bench with a THG crystal oven, or a diode stack on a cold plate. Beam colour, and whether an armoured fibre or a rigid beam guide runs to the head |
| Power | Enclosure and conveyor height scale with the power class; the chiller is sized from the heat the source actually rejects (wall-plug efficiency), and the pump-module count follows |
| Objective | Head standoff, lens barrel diameter, beam cone angle, the addressable field marked on the work surface, and the spot glow scaled from the computed spot diameter |
| Application | Workpiece geometry and material — PCB panel with fiducials and traces, silicon wafer, foil, plate, package strip, battery module |
| Application | Process emission: metals throw spatter, organics smoke, ceramics and semiconductors flash |
| Modules | Each one is real geometry on its own footprint, and it changes the cycle — see below |

The panel headline reports the resulting envelope, so the dimensions are visible
as they change.

### The run cycle is computed, not scripted

**Start simulation** runs home, load, clamp, locate, focus, process, verify,
unload, with the beam tracing a real path on the part (a Data Matrix for
marking, a seam for welding, a raster for cleaning, a contour for cutting, die
crosses for semiconductor, tab welds for battery).

The timings come out of the catalogue rather than being hard-coded. The path
length is measured in millimetres, divided by the marking speed the platform
specifies, and jumps are traversed at 3.2× that — so the process time is a
consequence of the objective and the family, not a constant. Handling time comes
from the modules actually specified, and overlapping loaders (shuttle,
turntable, dial) subtract from it. A stated `Cycle time` in the platform
specification wins over the computed figure. Fitting a larger objective on a
Mark F-Series takes the marked path from 327 mm to 1,403 mm and the process time
from 0.08 s to 0.33 s; the enclosure grows with it.

Motion follows the configuration too: the conveyor only runs if one is
specified, the vision ring light only fires if fiducial vision is fitted, the
grading camera only reads if verification is fitted, and parts only divert to a
bin if a reject station is fitted. Phase durations keep their real proportions
but are fitted to a watchable runtime, so a 6-second weld visibly dominates its
cycle where a 0.19-second mark does not. Telemetry reports cycle, process,
throughput, parts and yield, and states the slow-motion ratio; playback speed is
switchable between 0.5× and 4×.

Handling is not one generic motion. The part arrives the way the specified
module delivers it — a conveyor slides it in, a tray tower lowers it, a bowl
feeder chutes it, a robot swings it through an arc, a web feeds continuously,
and with no handling module at all it is placed by hand from above. Where the
module genuinely overlaps loading with processing (shuttle, turntable, dial) the
next part is visible waiting at the load station.

The process signature comes from the computed regime rather than the family
name: above roughly 10⁶ W/cm² a weld runs as a **keyhole** — narrow, deep, with a
vapour column — and below it as **conduction**, wide and shallow. Cutting leaves a
kerf, cleaning an ablated band, marking a thin bright line. Each is drawn
accordingly, with a melt pool where one physically exists.

The cycle can also stop, for the reasons this machine could actually stop:
a guard interlock opening, extraction flow falling below threshold, or no part at
the load station. The beacon goes red, the beam inhibits, the message line says
why, and the stoppage is counted. Faults are only drawn from hardware that is
fitted — a machine without extraction never reports an extraction fault.

Controls sit along the bottom edge: camera presets (Iso / Front / Top / Work),
auto-rotate, callout labels, **layers and view mode**, reset, the original 2D
optical schematic, and expand to full screen (Esc to exit). Drag to orbit, scroll
or pinch to zoom. Playback runs at 0.5× to 4×, or pauses and steps frame by frame. Clicking any
phase in the strip scrubs straight to it, and the cycle can loop or run once.
Telemetry reports cycle, process, handling, rate, parts, yield, stoppages,
beam-on share and utilisation, over a bar showing where the cycle time goes.

### Layers and view modes

The enclosure is no longer always in the way. Eight layers switch independently —
enclosure and guarding, glazing, sheet-metal covers, interior lighting,
automation modules, utilities and routing, beam and process, floor and safety
zone — alongside four view modes:

| Mode | What it does |
|------|--------------|
| Solid | The machine as delivered |
| Cutaway | Near panel and glazing removed, so the process is visible in place |
| X-ray | Structure ghosted back, internals left solid |
| Exploded | Roof lifted clear of the frame |

Keyboard: `1`–`4` select the view mode; `e` `g` `c` `i` `m` `u` `b` `f` toggle
enclosure, glazing, covers, interior lighting, modules, utilities, beam and floor;
`l` toggles callout labels.

### The enclosure is sized around what is fitted

The shell contains what the configuration actually specifies. A two-station
turntable pushes the depth out, a shuttle table widens the frame, a cleanroom
canopy raises the roof — and where fitted equipment exceeds a stated footprint,
the envelope is recomputed and marked *est.* rather than repeating a figure that
is no longer true.

| Mark F-Series, 30 W | Envelope |
|---|---|
| Bare machine | 1,149 × 960 × 1,552 mm |
| + two-station turntable | 1,149 × 1,020 × 1,552 mm |
| + shuttle table | 1,420 × 960 × 1,552 mm |
| + cleanroom canopy | 1,149 × 960 × 1,722 mm |
| All three | 1,420 × 1,020 × 1,722 mm |

Every module carries a mounting zone — `head` travels with the scan head, `in`
occupies interior volume, `frame` is bolted to the machine, `floor` stands
alongside on its own feet, `shell` encloses the whole machine. Only interior
equipment sizes the shell; floor-standing equipment instead grows the **installed
footprint**, which is reported separately, because a tray tower does not make the
enclosure bigger — it makes the installation bigger.

Sensors are mounted the way they work rather than merely placed: the fiducial
camera, grading camera, weld monitor, seam tracker and auto-focus each aim at the
process point, and the extraction hood sits over the work zone on a routed duct.

Combinations that cannot coexist are refused rather than drawn: a cleanroom
canopy with a dry-room shell, an inert glovebox with open extraction, two
indexing tables, discrete transport with a continuous web, two manipulators. The
clash is flagged on the integration step and fails the health check.

### Engineering detail

The machine is modelled as assemblies rather than blocks, with the hardware an
engineer would expect to find:

| Group | What is modelled |
|-------|------------------|
| Structure | Welded steel base with gussets and weld seams, levelling feet, powder-coated cabinet, twin service doors with hinges, handles, lock barrels and louvres, T-slot extrusion chamber frame with cast corner brackets, laser-safe glazing, rear service panel and connector bank, machine nameplate and branding plate, top plenum with lifting eyes |
| Motion | Profiled linear guide rails, recirculating bearing blocks, ground ball screw with a preloaded nut, servo motor with encoder and brake, planetary gearbox, toothed-belt drive on gantry machines, energy chain following the carriage, inductive home sensors and mechanical end stops |
| Laser head | Housing and protective cover, collimator, galvanometer mirror pair, f-theta objective with lock ring and cover glass, air-assist nozzle with tubing, standoff sensor, process-fibre connector, status LEDs, aperture warning label |
| Vision | Industrial camera with C-mount lens, LED ring light, sealed housing, adjustable bracket, connectors — with an acquisition sweep and inspection region drawn during the locate phase |
| Fixturing | Ground tool plate with T-slots, mounting-hole grid and marked datums; replaceable fixture plate on round and diamond locator pins; pneumatic toggle clamps that close on the part; part-present sensor |
| Handling | Driven roller conveyor with belt, ESD edge guides, geared drive motor, blade stopper, inbound and outbound sensors, flow-direction arrows |
| Electrical | Back panel with DIN rail and cable ducting, main breaker, 24 V supply, PLC, servo drives, industrial PC, laser supply, Ethernet switch, safety relay, terminal blocks, filter fan — revealed when the covers layer is switched off |

Materials are differentiated by their optical response, not just colour: powder
coat is matte, brushed aluminium is directional, stainless and chrome are bright,
polycarbonate and glass carry a fresnel edge, rubber is flat.

Level of detail follows viewport size and camera distance. Fasteners, slot
grooves, weld beads and small hardware appear only when they would resolve, and
segment counts on cylinders scale with it.

### Click any assembly

Clicking geometry opens a panel giving the component's group, description,
function, material, specification, example vendors and its service note — around
sixty assemblies are described, from the guide rail to the safety relay. Vendor
names are examples of the class of part, not a specified bill of material.

### Machine status

While the cycle runs, a status column reports machine state, laser emission,
axis position, cycle progress, door and interlock state, emergency-stop state,
camera state, cooling, air pressure and temperature.

### Rendering

Materially aware shading: a three-light rig, Blinn specular per surface,
fresnel on the glazing, a contact-occlusion term, soft projected contact
shadows, distance fog and a vignette. Opaque and transparent geometry are
sorted and drawn in separate passes so glazing never swallows what is behind
it. Off-screen and sub-pixel faces are dropped, and if a frame overruns its
budget the renderer trades resolution rather than detail.

Family cards on step 01 carry the same engine — one scene per family, built from
the catalogue, alongside the platform, application, source, power, industry and
lead-time counts for that family.

## DFM report

The specification step carries **DFM report (PDF)**, which generates a
design-for-manufacture document and downloads it. It is a real PDF, written
directly in PDF 1.4 with the base-14 fonts — no library and no CDN, so the page
stays one self-contained file.

The report is computed from the configuration that has just been made, because
spot diameter, depth of focus, field, material coupling and process regime are
what actually determine what a part may look like:

| Section | Contents |
|---------|----------|
| Cover | The configured machine rendered at 1520 × 900, the model designation, and what the report is based on |
| Process capability | Spot diameter, smallest reliable feature (~1.2 × spot), depth of focus, addressable field, placement accuracy with or without fiducial vision, working distance, and the computed process regime |
| Design guidance | Family-specific rules — Data Matrix cell size and quiet zone, minimum character height and edge clearance for marking; joint type, fit-up gap and clamping for welding; kerf, minimum internal radius, slot width and web for cutting; process window and line-of-sight for cleaning |
| Handling and fixturing | Derived from the modules actually specified — conveyor edge clearance and warpage, fiducial requirements, rotary concentricity, magazine and tray presentation, web tension |
| Before you commit | Trial, material fixing and acceptance criteria |
| Appendix | The full configuration, and an explicit statement of basis and limitations |

Figures move with the configuration. A larger objective raises the spot diameter
and therefore the minimum Data Matrix cell; a welding platform above roughly
10⁶ W/cm² is described as keyhole rather than conduction; fitting auto Z-focus
changes the depth-of-focus advice from a constraint to a tracked variable.

Every page is footed *"Indicative, model-derived guidance — not a process
specification. Validate on your parts."* The optical figures are
diffraction-limited estimates and the material data is handbook data for a clean
flat surface; the report says so in its own basis section.

## Editing the data model

Values load from `data.json` (see below). The same structure exists as fallback
defaults at the top of the `<script>` block in `index.html`:

| Object   | Contents |
|----------|----------|
| `SRC`    | Laser sources — wavelength, M², beam diameter, price premium |
| `LENS`   | f-theta objectives — focal length and field size |
| `FAM`    | The 7 product families and their catalogue chapters |
| `PLAT`   | Platforms — base price, standard content, sources, powers, applications, specifications |
| `MOD`    | Automation modules (Ch. 13) and prices |
| `SW` / `EXTRA` | LaserSuite editions, connectivity and compliance packages |

Each platform carries a `std: [...]` list of modules included in its base price.
Those are shown as *Included as standard* and are never charged again.

## Calibration

Prices are **indicative ex-works estimates in INR, not quotations.** They come from a
parametric model intended for early scoping. Two levers to tune against real quotes:

- `PLAT[<id>].base` — the standard-machine ex-works price for each platform.
- `SRC[<id>].prem` — wavelength premium multipliers (UV ×1.55, ps ×1.85, fs ×2.40).

The Mark PCB C2i is calibrated against the internal BOM figure: standard machine
resolves to roughly ₹59–74 L against a ~₹65.6 L reference.

Optical figures (spot diameter, depth of focus) are computed live from
`d = 4λfM²/πD` and are diffraction-limited estimates, not measured values.


## Editing values — the `data.json` backend

The configurator loads every price, specification and pricing rule from
`data.json` at startup. Git is the store: edit the file, commit, and the live
site reflects it. If `data.json` is missing or unreachable, the page falls back
to the values built into `index.html`, so it never breaks.

### Option A — the admin panel (no code)

1. Click **⚙ Values**, bottom right (or open `<site-url>/#admin`).
2. Enter the PIN — `teal2026` by default, changeable under **Pricing rules**.
3. Edit across five tabs:

| Tab | What you can change |
|-----|---------------------|
| Platforms | Standard-machine base price, and which modules count as standard content |
| Modules | Name, description and price of each automation module |
| Software & compliance | LaserSuite edition and connectivity package pricing |
| Sources | Wavelength premium, M², beam diameter, f-theta focal lengths and fields |
| Pricing rules | Budget band, power scaling, objective uplift, admin PIN |

Edits apply to the configurator immediately, so you can see the effect on a
quoted band while you type.

4. Click **⭳ Export data.json** and commit the downloaded file to the repository,
   replacing the existing one.

**Export is still the save step** — nothing is published until `data.json` is
committed. But edits are no longer lost if the tab closes:

| | |
|---|---|
| **Recoverable draft** | Every edit is written to a browser-local draft. Reopen the panel and it is offered back with its age and source, to restore or discard. Closing the panel with unexported work asks first, and so does closing the tab |
| **Undo / redo** | Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z, 40 steps deep, across every tab |
| **Change log** | A real diff of the value store, not a list of keystrokes: *Platform · Mark PCB C2i · specs*, with the before and after. Exportable as CSV |
| **Search** | One box over the whole store — platforms, applications, families, modules, materials, industries, sources, objectives, standards, lexicon, rules. Click a hit to jump to it. Press `/` to focus |
| **Shortcuts** | `/` search · `Ctrl/Cmd+S` export · `Ctrl/Cmd+Z` undo · `Esc` clear search, then close |

### Editing a platform

Every field the six steps read is editable, and platforms can be added,
duplicated and deleted. Beyond the card, applications, optical envelope, pricing
and specification table, each platform carries:

- **Machine envelope & cycle** — width, depth, height, work height, process
  speed and stated cycle time as plain numbers. These write into the
  specification table in the exact format the 3D view parses, so the catalogue
  stays the single source of truth. Leave the footprint blank and the enclosure
  is derived from beam delivery, power class and objective field, and labelled
  *est.*
- **Live 3D preview** — the machine that platform builds, with its standard
  content fitted, rebuilt as you type. Change the beam delivery or the footprint
  and watch it change.

### Fitment — which modules a platform can take

A new **Fitment** tab records, per module, the families and beam-delivery types
it can be fitted to, and the ones it never can. A weld monitor belongs on a
welding machine; a 3-axis scan head cannot be fitted to a robot arm, which
reaches a stepped surface by moving the arm instead.

This gates the recommendation engine: a rule can suggest only equipment the
matched platform can physically accept. Manual selection on the integration step
stays open — it is flagged, not blocked.

### Recommendation rules

27 rules, up from 13. The new ones cover shield and cutting gas, deep-penetration
monitoring above a kilowatt, gap bridging, seam following, mixed-height focus,
load-while-processing, board and tray handling, continuous web, operator-safe
loading, inert atmosphere, whole-cell conformity and validated-site protocols.

Rules now carry exclusions and physical conditions — beam delivery, material,
power thresholds and `not` clauses — so a rule fires only where it genuinely
applies.

### Health check

Run it before exporting. Alongside dangling references it catches unknown beam
delivery, unparseable footprints and cycle times, a work height that leaves no
chamber, duplicate short codes (two platforms sharing a model designation),
families with no platforms, and an inverted budget band.

Two sweeps then prove the catalogue rather than sampling it:

- **Rule sweep** — fires every rule against every platform, application and
  source it can match (954 combinations) and fails if a rule would offer
  equipment that machine cannot take. This found a real fault on first run: the
  *Non-flat surfaces* rule was recommending a 3-axis scan head to robot cells.
- **3D build sweep** — builds every platform in every view mode with all modules
  fitted (88 combinations) and fails on an exception or an unbalanced transform
  stack.

### Option B — edit `data.json` directly

Open `data.json` in the GitHub web editor and commit. Useful for bulk changes.
Base prices sit at `PLAT.<key>.base`, module prices at `MOD.<key>.p`, and the
parametric levers under `RULES`.

**⭱ Import data.json** loads a file back into the panel — handy for reviewing a
colleague's version before committing it.

### A caution about privacy

This is a static site: the configurator runs entirely in the browser, so every
value in `data.json` is readable by anyone who can load the page. The PIN
prevents accidental edits; it is not access control. If your cost basis must stay
confidential, keep the repository **private** (GitHub Pages on a private repo
requires a paid plan), or move the values behind an authenticated API and have
the page fetch from there instead.


## v3.0 — engineering tooling

Added without altering the six-step flow. Every existing feature and the
navigation are unchanged; all of this layers on top.

**Recommendation engine.** On the Integration step, rules evaluate the current
configuration and suggest modules, connectivity and the LaserSuite edition, each
with a one-line engineering rationale. Nothing is applied automatically — the
engineer clicks **Apply** per rule or **Apply all**. Rules live in `data.json`
under `RECO` and are editable in the admin panel's *Recommendation rules* tab.
Conditions (`fam`, `plat`, `app`, `src`) are ANDed; leave one blank to ignore it.

**Saved configurations, history and favourites.** *Saved & history*, top right.
Configurations you complete are recorded automatically; named saves and
favourites persist in the browser. Where browser storage is unavailable the app
falls back to session memory and says so, rather than failing.

**Comparison.** Select two or three from the drawer and compare side by side.
Differing rows are highlighted and the lowest indicative band is marked. Prints
directly.

**Search.** On the Platform step, search across platform names, taglines and
application text — optionally across all seven families at once.

**Engineering notes.** Free text on the specification step, carried into the
printed sheet, the RFQ summary and any enquiry.

**Enquiry capture.** Builds a complete enquiry from the current configuration and
delivers it three ways: an email draft (`mailto:`), a 25-column CSV row for your
pipeline, or plain text. Validates name and email before allowing any of them.
There is no server to post to on a static host — see the caution above.

**Other.** Non-blocking toasts replace alert dialogs; platforms can be duplicated
and deleted from admin; shared links now load when pasted into an already-open
tab, and browser back/forward work.

### Not yet covered

These need a real backend and cannot run on GitHub Pages: server-side inquiry
storage, media/brochure/datasheet uploads, email notifications, and genuine admin
authentication. Supabase, Firebase, or Cloudflare Pages + Workers + R2 would each
cover them while leaving this frontend as it is.


## v4.0 — enterprise UI

Presentation only. Every class name the JavaScript creates was preserved, so the
six-step flow, the recommendation engine, saved configurations, comparison,
enquiry capture and the admin panel behave exactly as before.

**Design system.** Navy `#0B1A2A` for chrome, white cards on a light-grey ground,
TEAL `#00B7BA` as the brand accent, and a single warm CTA colour used only for
primary actions. Inter for interface text, IBM Plex Mono for all engineering data
— codes, wavelengths, tolerances and prices are tabular-figure aligned.

**Layout.** True 12-column grid (8 / 4 split), sticky nameplate offset below the
header, generous section rhythm, uniform card heights.

**Chrome.** Sticky header that gains a translucent blurred background and shadow
on scroll; step rail with an animated active underline; premium four-column
footer whose portfolio links jump into the flow rather than adding routes;
back-to-top button.

**Motion.** Restrained. Cards lift on hover, panels ease in once on scroll via
IntersectionObserver, the budget figure counts between values instead of
snapping, drawers slide and modals rise. All of it collapses under
`prefers-reduced-motion`.

**Icons.** One Lucide-geometry set at a consistent 1.75 stroke replaces the mixed
glyph characters that were in use.

**Forms.** Floating labels on the enquiry modal, 3px focus halos, inline
validation.

### Accessibility

Audited and corrected rather than asserted. Three palette values failed WCAG AA
on measurement and were changed: the CTA orange (4.37:1 → 4.85:1), the tertiary
ink used for small labels (3.08:1 → 4.76:1), and the schematic caption on navy
(3.75:1 → 5.7:1). Also verified: no horizontal overflow at 390px or 834px, no
touch target under 44px, logical tab order from the skip link inward, visible
focus rings, `role="tablist"` on the step rail, `aria-live` on toasts.


## v5.0 — full catalogue CRUD

The admin panel previously let you *edit* what existed but not *add* anything.
It now covers every choice a user makes, across all six steps.

**Catalogue tab — master/detail editor.** A navigator lists families and their
platforms; selecting one opens an editor organised by the step it drives:

| Section | What you can add, edit or delete |
|---------|----------------------------------|
| Step 1 | Families — name, chapter, subtitle, description |
| Step 2 | Platforms — name, type, tagline, code, badge, family |
| Step 3 | Applications — label, description, recommended source, power, objective, and the rationale the user reads |
| Step 4 | Which sources, powers and objectives the platform offers, its defaults, and the beam-delivery mode that drives the schematic |
| Step 5 | Base price and standard content |
| Step 6 | Specification rows, reorderable |

Families and platforms can be created from scratch or duplicated. New platforms
arrive with a valid application and specification so they are immediately usable.

**Other tabs.** Sources and objectives are now add/delete as well as edit —
adding a source makes it selectable on step 4 straight away. Same for modules
(including their grouping), LaserSuite editions and connectivity items. Deleting
anything unlinks it from standard content and recommendation rules rather than
leaving a dangling key.

**Health check.** A data-driven catalogue fails on broken references, not syntax
errors, so this tab validates every one: platforms pointing at missing families,
sources or objectives; defaults not present in their own option list; standard
content naming something that no longer exists; applications recommending a
source the platform does not offer; rules referencing deleted keys; missing
rationales. Run it before exporting.

It found a real costing bug on first run. The Semi WM-300 listed SECS/GEM as
standard content, but SECS/GEM is a connectivity item rather than a module, so
the check rejected it and the configurator was charging ₹8 L for something the
catalogue says is included. Standard content now covers modules and connectivity
items alike, and the pristine catalogue validates clean.


## v5.0 — full catalogue CRUD

The admin panel previously only *edited* what already existed. It now creates and
deletes at every step of the configurator.

| Tab | What you can now do |
|-----|---------------------|
| Catalogue | Add, edit, duplicate and delete families and platforms. Selecting a platform opens a full editor: card copy, applications, source/power/objective choices, beam delivery, base price, standard content and the specification table |
| Sources & optics | Add and delete laser sources and f-theta objectives, not just retune them |
| Modules | Add and delete modules; deleting one unlinks it from every platform and rule automatically |
| Software & compliance | Add and delete LaserSuite editions and connectivity items |
| Recommendation rules | Add and delete rules, now including a source condition |
| Pricing rules | The parametric levers |
| Health check | Validates every reference before you export |

The platform editor is organised by the step each field controls — *Step 3 —
applications offered*, *Step 4 — source, power and objective choices* — so it is
clear what a change will do to the user's journey. Delete guards prevent orphans:
you cannot remove a family that still holds platforms, or a source a platform
still offers.

### Health check

The failure mode of a data-driven catalogue is a dangling key, not a syntax
error — a platform whose default source was deleted renders an empty step rather
than throwing. The Health tab walks every reference: platform to family, source,
objective and module; application to source and objective; rule conditions and
actions; defaults present in their own option lists. Run it before exporting.

It earned its place immediately. On the shipped catalogue it flagged one genuine
error: **Semi WM-300 listed `secsgem` as standard content, but SECS/GEM was
defined as a connectivity item rather than a module**, so a host interface the
catalogue calls standard was being charged as an extra. Standard content now
spans both pools, and the tool reports zero errors and zero warnings.


## v6.0 — process physics

Each step now carries computed engineering data. Everything shown is
deterministic — it follows from the selected wavelength, power, objective and
material. Nothing is a look-up of a "typical" value.

**Optics.** Spot diameter d = 4λfM²/πD, depth of focus, Rayleigh range.

**Pulse train.** Pulse energy, peak power and fluence from average power,
repetition rate and pulse duration. Fluence is shown only where the process spot
*is* the focused spot — micro-processing, not welding, which defocuses.

**Process regime.** Follows the process family, not raw arithmetic. The
~10⁶ W/cm² keyhole threshold is a welding result and is applied only to welding;
marking is classified as annealing or ablative by fluence, cutting by pulse
duration, cleaning as selective ablation.

**Material coupling.** 15 materials with absorptivity across five wavelength
bands, thermal conductivity, melting or decomposition point, density and
specific heat. Coupled power and per-pulse thermal diffusion length √(4ατ) are
computed from them. All 76 applications are mapped to a material.

**Services.** Wall-plug draw from published source efficiencies (fiber ~30 %,
CO₂ ~10 %, UV DPSS ~3 %), heat to reject, and whether a chiller is needed.

All of it flows into the printed specification, the RFQ summary and the enquiry.

### What is deliberately absent

Ablation thresholds and material removal rates are not shown. Published values
scatter by several times across surface conditions, oxide state and supplier lot;
a number that precise-looking and that unreliable would do more harm than good.
Eyewear optical density is likewise not computed — that is a safety calculation
belonging to a Laser Safety Officer under IEC 60825-1, not to a scoping tool.

Absorptivity is labelled throughout as the clean, room-temperature, optically
flat value — the cold-start floor. Oxide, roughness and the melt itself raise it
substantially, and the tool says so wherever the figure appears.

### Validation

The physics was checked against reference cases rather than assumed. Copper reads
4 % at 1070 nm and 40 % at 532 nm — a 10× coupling ratio, which is the reason
green exists for copper welding. A 30 W fiber marker at 45 kHz gives 0.67 mJ and
6.7 kW peak over 100 ns. Rayleigh range and depth of focus agree to the same
order.

The first pass of the regime classifier was wrong — it labelled 30 W marking as
"keyhole" and 1500 W copper welding as "ablation", because it applied a welding
threshold to peak irradiance from a pulsed source. It was rebuilt around the
process family before shipping.


## v6.1 — audit pass

A full re-audit found four real defects. All are fixed.

**Power classes were per-platform, not per-source.** A platform offering both a
300 W fiber and a 15 W UV head shared one power list, so Cut X-G would let you
select a 200 W UV source — which does not exist in that class. Nine platforms now
carry `pwBySrc`, a power list per source. Changing source snaps the power into
the new class, and a shared link carrying an out-of-class value is corrected
rather than honoured.

**Weld P-Series claimed a field its optics could not produce.** The specification
said a 160 × 160 mm scan head; the objectives offered gave 110 or 175 mm, so the
spec table and the live field readout contradicted each other. An F230 objective
(160 mm field) was added and made the platform default.

**Two applications recommended power that did not exist** for their source — 100 W
UV on flex PCB cutting and 300 W CO₂ on plastics. Corrected to 15 W and 150 W.

**The build pipeline was generating `data.json` from a stale extract**, so two
earlier fixes silently failed to reach the shipped data. Replaced with a single
`build.sh` that regenerates everything from one source and asserts on every patch.

### Verification

- Every platform × every application — 22 platforms, 76 applications — driven
  through all six steps: no exceptions, no non-finite prices, spots or
  irradiances, no missing regimes
- Catalogue health: 0 errors, 0 warnings
- Spec-text claims cross-checked against computed optics: field sizes, minimum
  features, power ranges all now agree
- Contrast 8/8 AA · no overflow at 390 px or 834 px · no touch target under 44 px
- Printed specification confirmed to carry regime, absorptivity, coupled power,
  wall-plug, safety note and engineering notes


## v6.2 — Liquid Glass on the navigation layer

Apple's Liquid Glass skill targets SwiftUI on iOS 26 / macOS 26, so it could not
be applied directly to a web build. The *material* was reproduced in CSS, and
Apple's own rule was followed strictly:

> Never apply glass to content itself. Glass is for controls and navigation only.

**Glass surfaces (7 elements):** the sticky header once scrolled, the ⚙ Values
and back-to-top floating controls, the drawer and enquiry scrims, and the two
close pills. Nothing else.

**Content stays opaque** — option cards, spec tables, the process-physics grid,
the nameplate readout and every admin table. Those carry small monospaced
engineering data, and translucency behind them would make contrast
unmeasurable.

### Contrast on translucent surfaces

Because the effective background of a glass surface changes with whatever
scrolls beneath it, contrast was computed by compositing each tint over the
lightest and darkest possible backdrops — white, page grey, brand teal, navy
chrome and the near-black schematic panel — and taking the worst case.

| Surface | Worst case | Against |
|---|---|---|
| Header | 9.20:1 | over the schematic panel |
| Values button | 7.02:1 | over white |
| Back-to-top | 11.26:1 | over the schematic panel |
| Toast | 7.02:1 | over white |
| Close pill | 12.41:1 | on the navy header |

The first pass failed: the back-to-top icon fell to **3.15:1** when it scrolled
over the dark schematic. The icon was darkened and the tint raised to 80 %.

### Escape hatches

- `prefers-reduced-transparency: reduce` and `prefers-contrast: more` turn every
  glass surface fully opaque — the web equivalent of Apple's `.identity` style
- `@supports not (backdrop-filter)` falls back to solid fills; tints alone still
  carry the text safely
- Print already excludes all seven elements, so the A4 specification is unchanged


## v7.0 — flow and catalogue depth

**Cards decide.** Selecting a family, platform or application now advances to the
next step on its own. A short delay lets the selected state register first, so it
reads as confirmation rather than a jump. Continue remains for the steps where
the choice is not a single card — source and integration.

**Back at the top.** A labelled back control sits above the step title showing
where it returns to — "← Application" — alongside the existing one in the footer.

**Industries.** A new backend dimension. Eight industries, every platform tagged,
with a filter above the platform cards that works within a family or across all
seven. Industry tags appear on each card, and the count beside each chip shows
how many platforms serve that sector.

**Commercial terms.** Lead time, warranty and installation days per platform,
flowing into the specification card, the printed A4 sheet and the RFQ summary —
so a scoping conversation now covers delivery as well as capability.

**Add controls everywhere.** Verified per tab rather than assumed: Catalogue 8,
Sources & optics 2, Materials 1, Industries 1, Modules 1, Software 2,
Recommendation rules 1. Pricing rules and Health check have none by design — one
is a fixed set of levers, the other is a report.

### Fixed during this pass

- **The top back button had no click handler.** It rendered with the right label
  and did nothing. Caught by test, not by inspection.
- **Jumping to a later step without a platform crashed the source step**, which a
  malformed shared link could reach. Every step now declares what it depends on
  and falls back to the last valid one instead of throwing.
- The new back control was 27 px tall on touch; raised to 44 px.


## v8.0 — backend depth and data provenance

### The honest part first

You asked for "true data". Most of what is here already is: the platform
specifications are transcribed from your catalogue, the material and optical
constants are published reference values, and the physics is computed from them.

But the **commercial data is not yours and cannot be.** Every price in this tool
is extrapolated from a single figure you supplied — the CO₂ PCB dual-head at
roughly ₹65.6 L ex-works. Lead times, warranty, installation days and industry
tags are reasonable industry defaults, not TEAL commitments. No amount of work
here can turn those into true data; only your cost base can.

So rather than quietly leaving that risk buried, there is now a **Data
provenance** tab that classifies every data area:

| Class | Areas | Action |
|---|---|---|
| TEAL catalogue | 4 | Verify against the current revision |
| Published reference | 2 | None — cite the source if challenged |
| Computed | 1 | Check the formula, not the number |
| **Estimate** | **7** | **Replace before commercial use** |

The seven that need real figures are named explicitly: platform base prices,
module/software/connectivity prices, source premiums, pricing levers, lead time
and warranty, industry tags, and the recommendation rules.

### Standards register

Fifteen real standards — IEC 60825-1 and -4, ISO 12100, ISO 13849-1,
ISO/IEC 29158 and 15415, SEMI T7/M12/M13 and E30/E37/E40, IPC-SMEMA-9851,
IPC-HERMES-9852, IEC 61340-5-1, ISO 14644-1, 21 CFR Part 11 — with official
titles and scope.

Applicability is **derived** from the configuration rather than tagged by hand,
so it stays correct as the catalogue changes: a wafer tool resolves 7 standards,
a robot welding cell 4, an inline PCB marker 5. They print on the specification.

The register carries a warning that naming a standard is not conformity —
conformity comes from design review, risk assessment and test.

### CSV round-trip

Modules, materials, industries, sources and connectivity items export to CSV,
edit in Excel, and import back. Imports validate the header, reject files with
missing columns rather than mangling the table, and report how many rows were
updated versus added.

### Change log

Every edit made in the session, with before and after values, exportable as CSV.
Nothing is written anywhere until you export — this is a record of what you are
about to commit, and a way to catch a stray keystroke first.

### Admin now has 12 tabs

Catalogue · Sources & optics · Materials · Industries · Modules · Software &
compliance · Recommendation rules · Pricing rules · Standards · Data provenance ·
Change log · Health check


## v9.0 — the advisor

An entry point that reads a written requirement and recommends where to start.
It opens once on a first visit, and afterwards from **Help me choose** in the
header. It never appears for someone arriving on a shared configuration link,
and never twice.

### Why it is not an LLM

A static site cannot safely call an LLM API: the key would sit in the page source
for anyone to copy and bill. So this is a deterministic matcher scored against
the actual catalogue. Three consequences worth having:

- It cannot invent a machine, a wavelength or a price — it can only return a
  configuration that already exists
- It works offline, costs nothing per query, and returns instantly
- Its reasoning is inspectable and editable, not a black box

If a backend is added later, an LLM layer could sit in front of this and hand it
structured intent — the matcher underneath would not change.

### How it works

A 273-term lexicon in five groups maps written language onto catalogue keys:
process → family, material → material, requirement → module, plus scale and
sensitivity signals. Scoring weights process match, material match, industry,
free-text overlap against application and platform wording, and care signals such
as "no heat" steering toward shorter wavelengths or ultrashort pulses.

Results show the best application per platform — three suggestions rather than
three rows of the same machine — each with the reasoning that produced it.
Opening one loads the platform, application, source, power, objective, standard
content and any modules the brief implied, drops you at the source step, and
keeps the original brief in the engineering notes so it reaches the spec sheet.

The whole lexicon is editable under **Advisor lexicon** in admin, and the health
check flags any term group whose key no longer resolves.

### Tested against nine real briefs

Surgical instrument marking, copper busbar welding, dual-side PCB, 300 mm wafer
ID, on-site rust removal, copper foil cutting, hermetic titanium implants, flex
circuits with no heat damage, and high-volume shaft marking. All nine resolve to
the correct platform.

### Two bugs found and fixed

- **A local variable named `go` shadowed the global navigation function**, so
  "Open this configuration" silently did nothing. The brief loaded, the overlay
  closed, and the user stayed on step 1.
- **Short lexicon terms matched inside longer words.** `ng` fired on "welding",
  "marking" and "cutting", so nearly every brief appeared to request a reject
  station. Terms of four characters or fewer now require word boundaries.


## v9.1 — advisor optimisation

The first advisor was a search box with a nice front end. Probing it exposed
five weaknesses; all are fixed and it is now a short guided conversation.

**Negation.** "We do not need vision alignment" previously *added* vision.
Negation cues — no, not, without, don't need, avoid, instead of — now open a span
and anything named inside it is excluded rather than requested. It works on
materials too: "welding stainless, not aluminium" rules aluminium out.

**Numbers.** Thickness and throughput were discarded. Both are parsed now —
mm, µm and micron for section; per hour, minute, shift or day for rate, including
Indian usage like "300 nos per day". Rate steers toward inline and rotary
platforms above roughly 200/hour and toward benchtop below 20.

**Thickness selects the machine, not just a number.** This was the sharpest bug:
a 3 mm copper busbar returned Weld P-Series with a note reading *"suggests roughly
2805 W — nearest option is 450 W"*. It had recommended a micro-welder for a
busbar and quietly clamped the number. Required power is now scored against what
each platform can actually deliver: too small and it is scored down, in range and
it is scored up. The same brief now returns Weld B-Series at 3000 W. Where
nothing can reach the requirement the advisor says so plainly instead of clamping.

**Honest confidence.** "I need a laser machine" used to return RoboCell as though
it meant it. Confidence is now absolute, not relative to the other results —
below the threshold it says it is not confident and asks for more.

**Unknown materials.** Wood, leather, rubber, fabric, stone and similar are
recognised as *not in the database* and named as such, with a note that organics
are normally CO₂ work and need a trial, rather than being silently mapped onto
the nearest metal.

**It asks questions.** Up to three, one at a time, chosen by what is missing:
process if unknown, then material, then thickness for welding and cutting or
volume for marking. Each comes with quick-reply chips, and it echoes back what it
has understood so far so a wrong reading can be corrected immediately.

### A regression I caused and caught

Requiring word boundaries at both ends of short terms stopped "welding" matching
the stem `weld`. The rule is prefix-only: "welding", "welded" and "welds" all
match `weld`, while `ng` inside "welding" still correctly fails.

---

© Titan Engineering & Automation Limited — A TATA Enterprise.
