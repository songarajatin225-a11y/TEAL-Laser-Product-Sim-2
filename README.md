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
  there are no asset paths to break when served from a repository subpath. It is
  the TEAL lockup — symbol, wordmark and *A TATA Enterprise* — as lossless WebP at
  711 × 160 with a true alpha channel: exact brand colours, enough resolution for
  the header at 3× density and the printed sheet, and clean edges where the footer
  reverses it to white. It appears in the header, the footer and the A4 sheet.
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

The timings come out of the configuration rather than being hard-coded, and one
list of real phase durations drives the telemetry, the breakdown bar and the
phase strip, so they always agree.

**Process time.** Marking is modelled at the size a code is actually made: a
12 × 12 ECC200 Data Matrix at the module the DFM report recommends for this spot,
plus a 9-character text line, filled with hatch lines at half the line width.
A pulsed source can only go as fast as 50 % pulse overlap allows, so a
Q-switched fiber at 45 kHz marks at about 715 mm/s rather than the head's
7,000 mm/s. Each vector pays a 250 µs scanner delay. A 30 W Mark F-Series with
the F254 marks its 3.9 mm code in 1.03 s. The drawn path still fills the part so
it can be seen. Other processes use the reference path across the field at the
head speed the platform specifies.

**Handling and cycle.** Handling comes from the modules actually specified. A
shuttle, turntable or dial works a second station, so the machine only waits for
the index unless the second station is the slower of the two, and then the
index says so. Where the specification states a cycle, a cycle window or a
throughput, the handling is fitted to it and the process stays computed. Where
the process alone cannot reach the stated figure, the computed cycle is used and
the summary says why: the Mark IT's "up to 200 parts/min" assumes lighter content
than the reference code.

Motion follows the configuration too: the conveyor only runs if one is
specified, the vision ring light only fires if fiducial vision is fitted, the
grading camera only reads if verification is fitted, and parts only divert to a
bin if a reject station is fitted. Phase durations keep their real proportions
but are fitted to a watchable runtime, so a 6-second weld visibly dominates its
cycle where a one-second mark does not. Telemetry reports cycle, process,
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

The cycle can also stop, for the reasons this machine could actually stop, at
the point in the cycle where each happens: extraction flow falling below
threshold mid-process (the mark stops part-drawn), no part at the load station,
or a guard interlock opening at unload. The beacon and the frame go red, the beam
inhibits, and the message bar says why and what clears it: "Close the guard,
acknowledge and reset — typically 25 s on a real machine". Faults are only drawn
from hardware that is fitted, so a machine without extraction never reports an
extraction fault. Stoppages are shown far more often than a healthy machine has
them, because a run you can watch has to show one, so they never count against
the throughput fit or the result. The ⚠ button turns them off.

Controls sit along the bottom edge: camera presets (Iso / Front / Top / Work),
auto-rotate, callout labels, **layers and view mode**, reset, the original 2D
optical schematic, and expand to full screen (Esc to exit). Drag to orbit, scroll
or pinch to zoom. Playback runs at 0.5× to 4×, or pauses and steps a tenth of a
second at a time. Clicking any phase in the strip scrubs straight to it, and the
cycle can loop or run once.

Telemetry sits below the machine, not on it: the view frames the machine in the
space above the run bar, and callouts stay clear of the telemetry and the status
text. In the nameplate panel or on a phone it shows the five figures that matter
(cycle, rate, parts, yield, result) and the three key status rows. Expanded, it
adds process, handling, beam-on share, good parts per 8-hour shift, speed or
performance against a target, and stops, plus the full machine status. On a
phone the stage grows taller while the cycle runs.

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

## v9.0 — platform layer

An enterprise UI/UX and simulator pass over the existing product. Nothing was
rebuilt: the machine families, platforms, optical model, process physics, pricing
model, advisor, saved/history/compare, value store and 3D machine view are all
the code they were. Every data literal in `index.html` — `SRC`, `LENS`, `MAT`,
`IND`, `STD`, `LEX`, `FAM`, `PLAT`, `MOD`, `EXTRA`, `SW`, `MODFIT`,
`MODCONFLICT`, `RECO`, `RULES`, `DEFAULTS` — is byte-identical to the previous
revision, and `data.json` was not touched. Eight gaps were closed.

**Global navigation.** The header carries four destinations — Configurator,
Portfolio, Applications, Engineering — each mapped to a place that already
existed (the rail, the family step, the application step, the review step),
with Saved, Compare, Value store and Submit enquiry on the right. The shell caps
at 1460 px, so the centre nav and the static catalogue meta cannot share the row:
above 1360 px the nav takes it, below that the meta comes back. Nothing wraps.
Measured at every width from 360 to 1900 px — no overlap, no page overflow, and
the header never exceeds 72 px.

**Indicative configuration fit.** A score out of 100 over five dimensions, each
derived from a rule that already existed rather than a new one:

| Dimension | Derived from |
|---|---|
| Application fit | the application's own recommended source and power |
| Optical fit | the objective against the platform default, plus computed spot, field and depth of focus |
| Parameter fit | the platform's declared source list and power classes |
| Automation fit | module fitment and the conflict table |
| Throughput fit | a machine cycle that has actually been run |

The panel states how many dimensions it could derive — "4 of 5" until a cycle is
run — and labels itself as indicative, not a certification. Throughput is stamped
with the designation it ran for, so a result is never carried onto a
configuration that was changed afterwards: change the objective and it reverts to
*not available from the current model*.

**Process result.** The live telemetry gained a classification alongside cycle,
rate, yield and utilisation: OPTIMAL, WITHIN TARGET, ATTENTION, OUTSIDE TARGET
or REQUIRES VALIDATION. Before the first part completes there is nothing to
classify, and it says so rather than reporting a pass.

**Engineering considerations.** A conflict is a decision with a consequence, not
"invalid". Each one states what changed, why it matters and what can be adjusted,
then offers Review configuration, Change parameter, or Continue to engineering
review. Raised from the conflict table, module fitment, the platform's declared
source and power lists, and an application whose recommended source was
overridden.

**Standard and Engineering views.** Progressive disclosure over the same screens,
not a second interface. Standard shows spot, depth of focus, scan field,
absorptivity and coupled power. Engineering adds the pulse train and thermal
scale — on a pulsed fiber marker: pulse energy, peak power, fluence, peak
irradiance, thermal conductivity and heat diffusion per pulse. The choice
persists per browser.

**Customer demo mode.** Shift+D, or `?demo` on the URL for a kiosk. It runs the
worked example this README already documents — Mark PCB C2i, dual-side board ID,
sealed RF CO₂ at 30 W, F254 — step by step, then the machine cycle, narrating
each stage in a footer bar. No configuration values are invented: every key it
sets exists in the value store, and it refuses to run if the platform is absent.

**Simulation summary.** A text report covering configuration, computed optics,
process parameters, simulation result, configuration fit, considerations,
assumptions and validation requirements. An un-run cycle is reported as
`NOT RUN`, not as a zero.

**Contextual status.** Named states replace the absent generic spinner —
*Loading value store…*, *Generating DFM report…*, *Reading data.json…*,
*Importing MOD values…*. Applied only where work is genuinely slow: the fetch,
the PDF build, the file reads. Synchronous updates get none, because a status
that cannot paint before the work finishes is decoration.

### Fixed during this pass

- **The fit panel did not refresh when a run stopped.** `simHud` clears the
  telemetry and returns early once the run is off, so the refresh never fired and
  the throughput dimension kept reading *not available* after a completed cycle.
  It is now refreshed from `simStop`.
- **Optical fit printed a bare field number** — "field 175" where the rest of the
  tool reads "175 × 175 mm". `LENS.fld` is a single edge, not a formatted string.
- The centre nav overflowed into the advisor button between 1180 and 1360 px; the
  breakpoints now sit where the row actually fits, verified by sweep rather than
  by eye.

### Verification

A Playwright suite covers all sixty checks in this pass: navigation, fit
derivation and its staleness guard, the status vocabulary, considerations,
progressive disclosure, demo mode, the summary sections, contextual status,
accessible names on every new control, no horizontal overflow at 390 px, and a
regression pass confirming designation, optics, physics, price, the standards
register, the summary rows, the budget band and every overlay still work.
Two apparent failures were test artefacts, not defects: the value store is
PIN-gated by `RULES.adminPin`, which headless `prompt()` auto-dismisses, and
Google Fonts is blocked in the sandbox — the documented system-font fallback.

### Not yet covered

The fit score weights are judgement, not measurement: OPTIMAL 100, WITHIN TARGET
88, REQUIRES VALIDATION 70, ATTENTION 62, OUTSIDE TARGET 30, averaged over the
dimensions that could be derived. They order configurations sensibly but the
absolute number carries no more authority than the dimension rows beneath it,
which is why the panel shows both and calls itself indicative.


## v10.0 — audit and simulation pass

A full walk through every step, overlay and admin tab at desktop and phone
widths, and a read of the simulation code. It fixes what was wrong, reworks the
run cycle, and makes the telemetry readable at the size it is usually seen.
Data literals and `data.json` are unchanged.

### Defects fixed

| Defect | Effect | Fix |
|---|---|---|
| Depth of focus omitted M² | Every DOF read M² times too deep: ±0.75 mm instead of ±0.58 mm on a 1.3-M² fiber, and 18× too deep on the direct diode. It showed as "Depth of focus" never matching the "Rayleigh range" beside it | DOF is now ±z_R = πd²/(4M²λ). A tighter ±5 % spot window (0.32 z_R) is shown alongside it. The fix flows into the panel, spec sheet, RFQ, DFM PDF, fit and summary |
| The simulation ignored standard content | A link without `m=`, including this README's own example, and demo mode drew the C2i's conveyor, vision and grading camera, but the cycle loaded by hand, reported "Camera: not fitted" and skipped locate and grade | `hasMod()` counts the platform's standard content. Links seed it, and every entry point selects a platform through one `pickPlatform()` path |
| Step button did nothing | It advanced time by `dt × rate` while the rate was 0 | The run advances in animation seconds through `simAdvance()`, and the step button moves 0.1 s |
| Telemetry disagreed with the animation | The C2i reported a 3.5 s cycle while its phases added up to 6.15 s, and "Handling" was cycle minus process rather than the handling phases | One list of real phase durations drives everything. A stated cycle fits the handling to it |
| Stale run after a link change | Pasting a link while the cycle ran kept animating the old machine | A configuration change ends the run |
| Throughput carried across applications | Runs were stamped with the designation, which does not name the application | Runs are stamped with the full configuration |
| Single-cycle end left the controls wrong | The speed button showed "1×" while paused, and the step button was hidden. Stepping past the end would also have counted parts that never ran | Controls sync from one function. A completed cycle holds until it is deliberately resumed |
| Advisor close button was blank | `advX` was missing from the icon map | Added |
| Value store opened empty | The default tab was `'platforms'`, renamed to `'catalogue'` in v5 | Defaults to Catalogue |
| Enquiry labels never floated | The label came before its input, so `input:focus + span` never matched. Typed text overlapped the label, and example text sat under it | Label after input, blank placeholders, example text only on focus |
| Summary misreported | The field printed as a bare number, the repetition rate as `44.721359549995796 kHz`, and absorptivity never printed (it read `ph.abs`, not `ph.mat.abs`) | Fixed. The summary also carries material and coupled power |
| Pulse duration formatting | Femtosecond showed as "0 ps", and QCW as "500000 ns" | `tauTxt()` gives 300 fs, 10 ps, 0.5 ms |
| Layout | The fit panel sat flush to the edge, the process grid left a grey filler cell, the value-store Close button wrapped onto its own line, and the footer said v3.0 | Corrected |

### Simulation

- **Readable in place.** The message bar joins the telemetry stack, so it can't
  overlap the figures. The view frames the machine above the run bar, and
  callouts avoid the telemetry, the name block and the status column. A
  container query shows five figures and three status rows in the nameplate
  panel or on a phone, and everything when expanded.
- **Physical process time.** Codes are marked at their real size with hatch
  fill, and pulsed sources are held to 50 % pulse overlap. See *The run cycle
  is computed* above.
- **Honest stated figures.** Cycle times, windows and "up to N/h" throughputs are
  read from the specification. The handling is fitted to them where the process
  can reach them; where it can't, the summary explains why.
- **Second-station handling.** Turntable, dial and shuttle machines wait only for
  the index, unless loading the second station is slower.
- **Stoppages where they happen**, with the real recovery action and time, a
  red alarm state, and an on/off toggle. They are demonstrations, so they never
  count against the fit.
- **Target rate.** Set it in the fit panel, or it comes from the advisor brief
  ("300 boards per hour"). It travels in the link as `t=`. The throughput fit
  becomes a real comparison: at or above target is optimal, within 10 % needs
  attention, and anything lower is outside target. The telemetry shows
  performance against it and good parts per 8-hour shift.
- **Status that means something.** Temperature and air-pressure figures were
  constants, so they're replaced: extraction flow, part presence, and heat load
  from the energy balance.
- **Summary.** Adds the cycle basis, process basis, speed and its limit, each
  phase's real seconds, good parts per shift, the target comparison, and a plain
  statement of what the stoppages are.

### Verification

- Every platform × application × source (161 combinations) was started and run
  through at least two cycles with stoppages on. No exceptions, no non-finite
  figures, and no `NaN` or `undefined` in the telemetry or the summary.
- Catalogue health: 0 errors, 0 warnings. Rule sweep 954/954 and 3D build sweep
  88/88 still pass.
- The six-step click-through, demo mode (now with the conveyor, camera and
  Inline edition the card selects), the advisor, saved configurations, the
  enquiry and the value store all run without page errors.
- No horizontal overflow at 390 px. At phone width the camera presets and tools
  share one row without overlapping, and the tool buttons keep their 29 px size.

## v10.1 — simulation performance

The machine view adapts its resolution to keep motion smooth. That adaptation
had never once taken effect.

**The downshift was dead code.** `frame()` lowered `this.dpr` a quarter step and
then called `resize()`, which recomputed the ratio from `window.devicePixelRatio`
and put it straight back. The comment promised "trading resolution, not detail";
it traded nothing. Measured directly: 2 → 1.75 → 2 across a single resize.
`resize()` now honours a `dprCap` the panel owns, so a decision to spend less
survives the next resize.

**It was watching the wrong clock.** The heuristic averaged the time spent inside
`paint()` and compared it against 13 ms. At a high pixel ratio the cost is not the
script — it is rasterising the backing store, which lands after `paint()` returns.
On a fully loaded Mark PCB C2i at device pixel ratio 2, the script measured 6.1 ms
while frames were actually arriving every 42.6 ms. Nothing above the threshold,
nothing to react to, 23.5 fps. Adaptation now runs on the real frame cadence and
falls back to the script time only as a second signal.

| | before | after |
|---|---|---|
| Heavy configuration, dpr 2 | 23.5 fps | 60 fps |
| Chosen pixel ratio | 2 (fixed) | 1.25 (adaptive) |
| Script time per frame | 6.1 ms | unchanged — it was never the problem |

The controller settles on the sharpest ratio that still holds rate. Measured on
the same scene: dpr 2 gives 27 fps, 1.75 gives 35, 1.5 gives 44, 1.25 gives 57.
It picks 1.25. On hardware that sustains 60 fps at full ratio it never downshifts
at all, because the frame time never crosses the threshold.

**It no longer oscillates.** A level that has proved too expensive is remembered
and not tried again until the panel is genuinely resized, and restoration needs
eight consecutive good windows. Without that ratchet the panel stepped up and
back down every few seconds, which reads worse than simply holding still. A
warm-up window is skipped so first-paint costs do not trigger a permanent
downshift.

### Also fixed

**The nameplate overlay collided with itself.** The assembly list was pinned at
`top:54px`, which assumed the title block was always two lines. A designation
long enough to wrap to three — Mark PCB C2i at 1,250 × 1,450 × 1,650 mm is one —
ran the list straight through the dimensions. The two now share a flow column.

### On rendering this in Blender

Asked, considered, declined — with the reasoning recorded so it does not have to
be relitigated. Blender is a desktop authoring tool and cannot run in a browser,
so "in Blender" means one of three things, and each gives up more than it returns:

- **Model in Blender, render with three.js at runtime.** Adds a library an order
  of magnitude larger than the current engine and breaks the single-file, no-CDN
  deployment. More seriously, it gives up the property the tool exists for: the
  machine is *assembled from the configuration*. The frame is built from the
  stated footprint, the chiller sized from the wall-plug efficiency of the chosen
  source, head standoff and cone angle from the focal length, each selected module
  placed on its own footprint. A hand-modelled asset is fixed; you would have to
  rebuild that same procedural logic in three.js and would have gained nothing.
- **Bake Blender geometry into the existing engine.** Keeps the single file and
  the assembly logic, but the components it would replace are parametric — they
  scale with power, focal length and footprint — and a baked mesh is not.
- **Pre-render stills.** The configuration space is 22 platforms × 12 sources ×
  5 objectives × 26 modules. Combinatorially hopeless, and it removes orbit, zoom,
  layers and the run cycle.

The brief this work follows says it plainly: prefer high-quality technical
visualisation over fake photorealistic 3D, and use heavier technology only where
it provides genuine value. The engine already renders perspective, back-face and
sub-pixel culling, Blinn-Phong with key/fill/bounce lights, fresnel glazing, fog
and painter-sorted shadows at 60 fps in a single file with no dependencies. The
useful work is in that engine, not beside it.

## v10.2 — material and surface pass

Fidelity work inside the existing engine, chosen over moving the view to
Blender and three.js for the reasons recorded above. Three changes, each
measured on a fixed camera against the previous revision.

**Metals tint their own highlight.** The material table already separated powder
coat from brushed aluminium by specular strength and shininess. It now also
carries metalness. A dielectric — paint, moulded plastic, powder coat — reflects
the lamp and keeps a near-white highlight; a metal reflects it through its own
colour, so brass and copper read warm at the edge of the light instead of looking
like painted steel. Warm-tinted pixels across the machine rose from 1.25 % to
1.83 %, which is the brass, copper, aluminium and stainless finally reading as
different materials rather than different greys.

**Contact darkening follows the normal.** Ambient occlusion was a single
height-based term, so a downward-facing surface was lit as brightly as an
upward-facing one at the same height. A downward face sees floor bounce rather
than sky, and now shades accordingly. No ray is cast — it is a standing term on
the normal — but parts stop reading as though they float. Mean scene luminance
moved 73.1 → 68.9.

**Polygon seams close.** Two abutting quads each anti-alias their shared edge
independently, so the half-covered pixels do not sum to full coverage and the
background shows through as a hairline crack. Faces that carry an edge colour
were already stroked and never showed it; faces without one did. They now draw
their own outline. Crack pixels — measurably darker than both horizontal
neighbours, inside the machine body — fell from 198 to 134, a 32 % reduction,
with no measurable change in silhouette area.

### Paid for out of the frame budget, not on top of it

Closing seams costs a second stroke per face: +29 % script time, 5.7 → 7.4 ms on
the heaviest scene. That is poor value per millisecond compared with resolution,
and the benefit shrinks as faces get smaller. Rather than gate it on scene size —
face counts across every configuration sit in a narrow 1,300–2,000 band and would
not separate typical from heavy — it joins the degradation ladder as the first
thing surrendered:

| Frames slipping | Action |
|---|---|
| 1st | drop seam closing |
| 2nd | step the pixel ratio down |
| 3rd | drop shading quality |

Verified under sustained load: seam closing goes at 15.5 s, then the ratio steps
2 → 1.75 → 1.5 → 1.25 → 1, settling at 59 fps. Hardware that holds 60 fps never
enters the ladder and keeps every one of them. A genuine panel resize restores
the full budget and re-evaluates.

## Testing

The site is still `index.html` and `data.json` — no build step. `package.json`
exists only to run the tests.

```
npm install
npx playwright install chromium     # once
npm test                            # data validator, CAD coverage check, then the browser suite
npm run validate                    # data validator alone — no dependencies
npm run coverage                    # regenerate assets/cad/COVERAGE.md from the manifest
```

`tests/validate-data.mjs` checks every cross-reference in the value store and
exits non-zero on a critical or high finding; run it after any admin-panel edit
before publishing a new `data.json`. Its last full report is in
[`DATA-QUALITY.md`](DATA-QUALITY.md).

`tools/cad/report.mjs --check` fails if `assets/cad/COVERAGE.md` no longer matches the
manifest, if a component in the 3D model has no manifest record (or the reverse), or if a
record names a GLB that is missing or claims an exact match without a part number.

`tests/e2e.mjs` serves the repository on a free local port and drives the page in
headless Chromium: 104 checks across navigation, pricing reconciliation, the BOM,
fit and considerations, the 3D view, the component explorer, CAD loading,
kinematics, mechanisms, the 3D comparison, the engineering assistant, the guided
missions, the run cycle and its scrubbing, the presentation, the machine story,
layout from 320 to 1,900 px and accessible names. Each check names the behaviour it
protects.

## v11.0 — commercial breakdown, assemblies, presentation

### One itemiser for every price

`price()` was a single number. It is now the total of `priceLines()`, which
itemises it — platform base, the power, source and objective levers, each added
module, the software edition and each extra — and the budget band, the BOM, the
comparison, the RFQ text and the printed sheet all read from it. A line item
cannot disagree with the total it sums to, because they are one computation.

The arithmetic and its order are exactly those of the old function. Checked
against the previous implementation across 3,000 configurations — every
platform, source, power class and objective, with random module, extra and
software sets — the result is bit-identical in every case.

The specification step shows the breakdown as an engineering table, and it
exports as CSV and prints on the A4 sheet. Each line is rounded to the rupee by
the largest-remainder method so the column visibly sums to the displayed total.
Every priced line is labelled **Estimate**, because Data provenance classes every
price that way; supplier and part numbers are not in the value store, so they are
not shown as empty columns.

### Exploded view is an exploded view

"Exploded" used to lift the roof. Every assembly is now separated once the whole
machine is built, so each one's extent is known before any of them moves. Each
translates as a rigid body:

| Assembly | Separation |
|---|---|
| Floor plan, frame, CE plate | Stay put — the frame is the reference |
| Through-feed transport | Stays put — it is the line's reference |
| Status beacon | Rides on the roof |
| Enclosing shells | Lift clear above the roof |
| Equipment beside the frame | Moves radially outward |
| Equipment in the base cabinet | Leaves through the front |
| Everything in the chamber | Lifts in height order, evenly spaced |

Callout labels travel with their parts, contact shadows stay on the floor and
thin as parts rise, and a **Separation** control sets the amount. Switching mode
eases in and out. At zero separation every vertex is bit-identical to the
assembled build — checked face by face. The panel says what the view is:
separated for inspection, not an assembly sequence.

### Focus and isolate

Clicking an assembly still opens its description, and now offers **Focus**, which
flies the camera to that component, and **Isolate assembly**, which ghosts
everything else and limits clicking to what is isolated. The flight is
interruptible — a drag or a scroll takes the camera back — and claims the camera
so automatic framing does not fight it. Esc, Reset view, or removing the isolated
module ends isolation.

### Presentation mode

The demo overwrote the user's configuration and wrote its own machine into their
History. It is now an eight-scene presentation — portfolio, platform,
application, optical train, cutaway, exploded assemblies, the run cycle and the
commercial breakdown — with Previous, Play/Pause, Next and Exit. Each scene sets
its whole state from scratch, so a scene is the same however it is reached, and
chooses the platform through `pickPlatform()`, the same path a click on its card
takes — so the conveyor, cameras and LaserSuite edition the v10.0 audit seeded
are all there.
Touching the configurator pauses the show. Exit restores the selection, step,
view mode and camera exactly, and nothing is written to History.

### Defects fixed

- **X-ray mode lifted the machine 420 mm off the floor.** The drop-in animation
  read the ghosted transparency as "not yet arrived", so the frame, cabinet and
  control cabinet floated 4.2 units up. It now reads arrival only.
- **The view-mode panel lost Exploded** — a regression from v9.0. The
  Standard/Engineering toggle reused the class name `.vmode`, which restyled the
  3D panel's 2×2 mode grid into a pill that overflowed it; X-RAY wrapped and
  EXPLODED was clipped out of reach. The toggle is now `.dmode`.
- **The header's primary action was a dead end on a first visit** — another v9.0
  regression. *Submit enquiry* with nothing configured only raised a toast. It
  now opens the advisor, which is how a configuration starts.
- **The health check moved the live view.** It builds every platform through the
  main viewport; it now builds offscreen, at full separation, and leaves the
  user's view mode, separation, isolation and selection untouched.
- The `?demo` kiosk link snapshotted the configuration before reading it from the
  URL, so Exit would have restored an empty machine.

### Not done, and why

- **Real CAD.** There are no STEP, IGES or GLB assets in the repository, so the
  machine remains the parametric model the engine builds from the configuration.
  The assembly bookkeeping is per group, which is where a CAD asset would be
  swapped in.
- **Supplier, part number, lead time per line.** Not in the value store.
- **A language-model assistant.** The advisor is deterministic and says so;
  connecting a model needs a server to hold the key, which a static site has not.

## v12.0 — the machine story

The page now opens on the machine itself. Above the configurator sits a
scroll-told introduction in seven scenes, each one built from the configuration
rather than drawn for the occasion:

| Scene | What happens | Drawn from |
|---|---|---|
| A · Machine | The machine is revealed — assemblies arrive one after another as the camera settles | The configurator's parametric model and its own callouts |
| B · Enclosure | Guarding and covers ghost back as you scroll | The X-ray view, made continuous |
| C · Assemblies | The machine separates | The v11.0 exploded-view rules |
| D · Optical system | Everything but the source and optics ghosts back, and the camera moves in | The assemblies' measured extents |
| E · Laser path | The beam is drawn from source to work plane | `schematicSVG()` — the configured optical train |
| F · Process | The scan path is traced in the order it is run | `markPath()` and `procModel()` |
| G · Configure | The machine reassembles, and the configurator takes over | Designation, budget band, lead time |

**It tells your machine.** With nothing configured it shows the README's worked
example, chosen exactly as a click on its card would choose it and labelled
*Example*. Once a configuration is complete, every scene shows that machine
instead, and changing an option rebuilds the story's machine and its numbers.
All 22 platforms, across every delivery type, are swept through every scene by
the test suite.

**It never touches the configurator.** The story renders through its own
viewport with its own view state. `mmBuild` now takes its view state — view mode,
X-ray amount, separation, emphasis — from the viewport when one is supplied, and
from the configurator otherwise. The story reads the configuration and never
writes it, and it never starts, stops or advances the simulator. The suite scrolls
the whole story and checks that the selection, step, simulator, viewer and
History come out unchanged.

**Scroll is the browser's.** No wheel event is intercepted and nothing is
hijacked: a sticky stage and native scroll progress drive a target state, and
the drawn state eases toward it, so a wheel's discrete steps read as one move.
Scene letters on the right jump to any scene; *Skip to configurator* is always
on screen; each scene stands on its own. Someone arriving on a shared link lands
on the workspace, with the story above it. The advisor's first-visit offer now
waits until the visitor reaches the workspace, rather than covering the opening.

**What it claims.** Every number is computed by the same functions the
configurator uses, and every caption says what kind of number it is: the spot is
a diffraction-limited estimate, the beam path is a schematic rather than a ray
trace, the process time comes from the process model and is indicative, and the
scan path of a code is enlarged to be legible, with its real marked size stated.
The stage carries a standing label: *parametric model — built from the
configuration, not CAD*.

**Motion with a reason.** The camera moves only to bring something into view,
the hero breathes slightly until you scroll and then settles, and the scroll cue
disappears once used. Under `prefers-reduced-motion` there is no opening reveal,
no easing and no drift: scenes change state directly. On a phone the caption
moves below the model, which is framed in the space above it, and the floating
buttons step aside. Without a canvas the story falls back to plain text, every
scene in order, and the configurator works as before.

### Technology

No GSAP, no Three.js. The page is a single file with no dependencies, and its
own engine already draws the machine; native scroll position plus the engine's
frame loop do what a timeline library would, without adding one. There is no
WebGL to detect or recover from, because the renderer is Canvas 2D.

### Performance

Measured in headless Chromium without a GPU — a pessimistic case — scrolling the
whole story at device pixel ratio 2, using the page's real frame cadence:

| | Median frame | 95th percentile | Frames over 50 ms |
|---|---|---|---|
| First scroll, while the renderer adapts | 33 ms | 117 ms | 64 of 240 |
| After adapting, either direction | 16.7 ms | 33 ms | 0–2 of 240 |

The story canvas is the full viewport, about six times the pixels of the
configurator's panel, so its viewport may lower resolution below pixel ratio 1
(to 0.6) under load — softness is the better trade on a full-bleed backdrop. The
configurator's viewer keeps its floor of 1. On hardware that holds 60 fps at full
resolution neither ever steps down.

### Defects found on the way

- **Every step change scrolled to the top of the page.** `go()` called
  `scrollTo(0)`. With the story above the workspace, each Continue would have
  thrown the user back into it. Step changes now bring the workspace into view.
- **The optical schematic dropped beam segments.** Its glow filter used
  bounding-box units, and an exactly horizontal or vertical beam has a
  zero-height box, which collapses the filter region. The configurator's own
  schematic was losing about a tenth of its beam pixels; a copy in the story
  lost all of them. The filter now uses a user-space region.

### Not done

- **The reference site.** motionsites.ai does not resolve from the build
  environment, so the direction was taken from the brief itself.
- **CAD.** There are still no CAD or glTF assets; the machine is the parametric
  model, and says so.

## v12.1 — new TEAL logo

The header, footer and printed specification carry the new TEAL lockup.

It is embedded as lossless WebP at 711 × 160. A palette PNG would have been
smaller, but the available encoder flattens alpha to two levels, which gives the
edges a hard stair-step — worst where the footer reverses the logo to white.
Lossy WebP was half the size again, but lossless keeps the brand colours exact.

The lockup is 4.4 : 1 where the old logo was 2.4 : 1, so it is 1.8× wider at the
same height, and the header was re-fitted around it: the logo is 34 px tall on
desktop and 30 px on a phone, and the centre navigation is slightly tighter. On a
phone the header drops the value-store icon, which duplicates the floating
*Values* button, and below 400 px the Compare icon, which is also in the Saved
drawer — no function is lost. Every width from 360 to 1,900 px keeps at least
23 px between header groups.

The header test was not catching this. It compared element boxes, and the title
block may shrink below its non-wrapping text, so the subtitle could run into the
navigation while the boxes still reported clearance. It now measures what is
drawn — every visible descendant, text overflow included — and requires 8 px.

## v13.0 — component register, CAD pipeline and kinematics

This release makes the 3D model accountable, part by part. For each part it now states
what the model is, what it is not, and what it would take to make it real CAD.

**The model is not a validated digital twin.** Every one of the 69 components it can draw
is parametric geometry with illustrative proportions. The product data names the class
of each bought-in part, with example vendors, but never the installed manufacturer,
model or part number. The fabricated assemblies exist only in TEAL's own CAD.
[`assets/cad/COVERAGE.md`](assets/cad/COVERAGE.md) gives the counts.

### CAD discovery

Of the 69 components, 7 are not CAD parts: labels, plates, an inspection region and the
customer's workpiece. Another 3 were not searched: the air-assist nozzle, the head LEDs and
the gas console. The other 59 were searched in manufacturer portals, distributors, TraceParts,
GrabCAD and similar libraries. The results:
- 17 classes have a manufacturer or distributor that publishes CAD for parts of that class.
- 12 have a maker page where CAD could not be confirmed.
- 4 have CAD on request only.
- 12 have no public CAD.
- 14 are made to TEAL drawing.

No public CAD of any TEAL machine exists.

No file could be downloaded, because this build environment's network policy refuses
every CAD and manufacturer host. Nothing here claims otherwise. Each component's search
result, candidate links, licence notes and the blocked hosts are in
[`assets/cad/manifest.json`](assets/cad/manifest.json) and
[`assets/cad/SOURCES_AND_LICENSES.md`](assets/cad/SOURCES_AND_LICENSES.md).

**Licences:** TraceParts and GrabCAD content may not be published commercially without
permission. `assets/cad/restricted/` is git-ignored for such files.

### Pipeline

- **Conversion:** `tools/cad/step2glb.py` converts a STEP file to GLB through OpenCASCADE
  (the gmsh wheel).
  - It refuses a file without the ISO-10303-21 header, or over 200 MB.
  - It keeps one node per solid, writes positions in metres, and converts Z-up to Y-up.
  - It writes a report comparing each solid's CAD bounding box with its mesh bounding box.
  - It was tested on a synthetic two-solid fixture (`tests/fixtures/cad/`, clearly not a
    machine part): 60 × 40 × 30 mm in, 60 × 40 × 30 mm out, 0.000 mm deviation.
- **Loading in the site:** the site reads GLB with its own parser. Node transforms are
  applied, and size and triangle limits are enforced.
- **Placement:** a component whose manifest record names a GLB is drawn from it wherever
  its builder calls `b.part()`, on the same local frame as the parametric part, at every
  instance. Today that is the levelling feet, the Z servo and the e-stop. Without CAD it
  falls back to parametric geometry.

### Mapping fixes

- **Missing component IDs:** about 30 % of the drawn faces carried no component ID, so
  clicking them did nothing. That included the laser source, chiller, status beacon,
  HMI, e-stop, workpiece and most automation modules. They now resolve. A module is
  described by its own catalogue record, the same one that prices it.
- **Unresolved geometry:** what still maps to no record is reported as an unresolved
  mapping, never given a guessed record. That covers the floor plan, beam effects and
  the handpiece bench.
- **Working distance:** the DFM report and the objective callout showed the focal length
  as the "working distance". The data has no working distances, so they now show the
  focal length, labelled as such.

### Inspector

The component inspector now has an **Engineering record** section showing:
- the component ID and assembly
- identity status
- geometry status
- CAD search result with links
- where the part is priced: platform base, module line or adjustment
- the platform lead time
- the joint it moves on
- the other parts of its assembly

**Component register:** a new CSV on the summary page lists the same record for every
drawn component.

### Assembly explorer

The new tree button opens the explorer, listing what the current view mode draws. You
can:
- search
- click to inspect and fly to a part
- shift-click to multi-select
- hide parts
- isolate the selection

Hovering names the part under the pointer. None of this touches the configuration or the
price.

### Kinematics

Every animated mechanism now moves through a declared joint and is clamped to its limits:
- the Z axis
- the gantry X traverse
- part transfer
- the toggle clamps
- the index table
- the two galvo mirrors

The Z stroke comes from the product data where it is stated, which is one platform.
Elsewhere the limits are labelled as the animation envelope.

The galvo mirror angles come from the ideal f-θ relation, r = f·θ. The mirror turns
through half the optical angle, so with an F254 objective and a 175 mm field the limit
is ±9.9° mechanical.

The **Joints** tab tabulates the joints. Layers → *Axes & joints* (key J) draws the
datum, the travels and the live values.

### Run cycle

- **New controls:** restart, step back, and a scrubber across the whole cycle.
- **Repeatable seeking:** seeking reproduces exactly the pose that playing to the same
  instant gives.
- **Repeatable stoppages:** a stoppage ahead of the new point happens again where it did.
- **Counting:** replaying a finished single cycle counts it once.

### Layout

Two layout faults are fixed. The camera presets used to overlap the view tools below
390 px, and in the 1,125–1,155 px two-column layout. The run controls also overflowed
on a phone. The presets now move up a row whenever the viewer itself is too narrow, and
the run controls tighten and wrap.

**Still to do:** guided missions and a troubleshooting tutorial were not built. The
existing presentation mode remains the guided path.

## v14.0 — mechanisms, 3D comparison, engineering assistant, guided missions

### Mechanisms

- **Chamber door:** now a glazed panel that swings outward on its hinge line, through
  a declared door joint.
  - **Manual load:** on a hand-loaded machine the operator opens it to load and unload,
    and the HMI status reads *Open — loading*.
  - **Guard stoppage:** it is what the stoppage now shows. The door opens, the
    interlock lamp turns red, and the door closes before the cycle resumes.
  - **Beam:** the door is shut whenever the beam can fire, and a test checks that.
- **Conveyor blade stopper:** it has its own joint. It holds the part through the
  process, drops to release it, and rises once it has passed. Before, it was tied to
  the clamps.
- **Energy chains:** both already followed the head and the Z carriage, so nothing
  changed there.
- **Inspection lighting:** Layers → *Lighting* adds an inspection mode next to studio
  lighting. It is flat, bright and glare-free, has no depth fog, and outlines every
  face, for reading form and fit. The geometry is unchanged.

All door and stopper motion is labelled as animation, not engineering data: the product
data gives no door angle and no stopper stroke.

### 3D comparison

The comparison dialog now draws the second machine with its differences from the first:
- **Green:** what B adds.
- **Red ghost:** what A has and B drops.
- **Amber:** what both have but build or specify differently.

Both machines are built by the same `mmBuild` as the configurator, with the
configuration swapped in and back out as the machine story does it. Your selection,
step, run and view are never touched.

**How "built differently" is decided:** by comparing each part's own face shapes, so
a part that has only moved does not count.
- **Moved, not changed:** the e-stop on a wider machine is not flagged.
- **Changed:** a longer frame member is.
- **Specification changes:** the parametric model draws a 30 W and a 100 W fibre source
  alike, so a changed source, power, objective or application is also flagged, with
  its reason, such as *Fiber (Q-switched) 30 W → Fiber MOPA 100 W*.

**Alongside the view:**
- the enclosure size change, with a note when the size is estimated
- the priced lines added, dropped or changed
- the total difference, labelled an estimate

With three configurations you can choose which pair to compare. A swap button and a
*Differences only* view are also there.

### Engineering assistant

The explorer gains an **Ask** tab. Answers are computed in the browser from the
configurator's own data and models. Each says where its number comes from and
highlights the part concerned in the view.

**What it answers:**
- spot size and depth of focus, from the optics model
- field and focal length
- scan angle, from the ideal f-θ relation
- source, pulse and power
- heat load, from wall-plug efficiency
- cycle time, from the process model or the last simulated cycle
- price band and lead time
- Z stroke
- machine size
- material absorption
- laser class, quoted from the platform's specification
- what any drawn part is and does

**Data gaps:** where the data has none, it says so. The working distance is not the
focal length, and is not in the data. Platforms without a stated laser class get no
assumed one.

**Out of scope:** questions outside these topics are declined.

**It is not an AI service:** the page says so, and nothing leaves the browser.

### Guided missions

The new flag button opens five optional missions:
1. **Find the optical train:** scan head, objective, door interlock.
2. **Trace the beam:** inspect every part on the path, in order. Picking out of order is
   explained.
3. **Configure for a finer mark:** reach a spot-size target computed from the platform's
   own sources and objectives.
4. **Run and read a cycle:** cycle time and longest phase, both read from the run.
5. **Diagnose a stoppage:** the machine stops on one of the faults it can actually
   suffer. You identify the cause and the recovery, then acknowledge. The stoppage is
   held until you do.

**Scoring:** each step scores full marks without a hint or a wrong try. The best scores
are kept in this browser only.

**Your configuration is safe:** a mission works on a copy, like the presentation mode.
It gives back the configuration, step, view, camera and link exactly, and writes no
History. With no machine configured, it uses the README's worked example.

### Fixes

- The step and step-back controls stayed visible after a paused run was stopped.
- On a phone the viewer now grows to the run-cycle height while the explorer or
  missions panel is open.
- The narrow-viewer layout allows for the eighth toolbar button.

---

© Titan Engineering & Automation Limited — A TATA Enterprise.
