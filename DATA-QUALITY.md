# Value-store data quality

Audit of `data.json` — the catalogue, fitment, recommendation and pricing tables
the configurator runs on. Re-run at any time:

```
node tests/validate-data.mjs          # human-readable
node tests/validate-data.mjs --json   # for tooling
```

It exits non-zero on any CRITICAL or HIGH finding, so it can gate a commit or a
CI job. The checks mirror the configurator's own rules — `powersFor()` and
`modFits()` are reproduced exactly — so a finding means the configurator would
misbehave, not that a style rule was broken.

## Result — 2026-10-15

**22 platforms · 12 sources · 5 objectives · 26 modules · 4 extras · 27 rules**

| Severity | Count | Meaning |
|---|---|---|
| Critical | **0** | could produce a wrong configuration, price or technical representation |
| High | **0** | affects selection or compatibility, or omits needed information |
| Medium | 5 | reduces usability or content quality |
| Low | 0 | cosmetic |

Every cross-reference resolves: each platform's family, sources, objectives,
default source, default objective, default power, per-source power classes,
standard modules and industries exist; every application's material and
recommended source exist, and the recommended source and power are ones that
platform can actually fit; every fitment rule, recommendation rule and price is
well-formed. No standard module is excluded by its own fitment rule.

The catalogue embedded in `index.html` (used when the page is opened from disk)
was compared table by table against `data.json`: all 14 tables are identical, so
the hosted and local experiences show the same machines. The end-to-end suite
re-checks this on every run.

## Findings that need a TEAL decision

These are flagged, not changed. Each is an engineering or product decision, and
resolving it by guesswork would put an unverified claim into the catalogue.

| Severity | Record | Finding | Decision needed |
|---|---|---|---|
| Medium | `SRC.blue` | Catalogued but offered on no platform — it can never be selected | Which platform takes a blue diode source, or remove it |
| Medium | `SRC.femto` | Catalogued but offered on no platform | Which platform takes the femtosecond source, or remove it |
| Medium | `SRC.diode` | Catalogued but offered on no platform | Which platform takes the direct-diode source, or remove it |
| Medium | `MAT.sic` | Silicon carbide is in the material database but no application uses it | Add the SiC application it was intended for, or remove it |
| Medium | `SRC.co293` | Display name "Sealed RF CO₂" is identical to `SRC.co2`; only the wavelength differs | Confirm a distinguishing name, e.g. "Sealed RF CO₂ (9.3 µm)" |

## Documentation discrepancy

The README's opening paragraph describes the source catalogue as containing
"4 f-theta objectives, 25 automation modules". The data holds **5** objectives
(F100, F163, F230, F254, F420) and **26** modules. Either the 2026 catalogue has
4 and 25 and the data has gained one of each, or the README is stale. Neither has
been changed; confirm against the current catalogue revision.

## Commercial data

Every price in the value store — platform bases, module, software and extra
prices, source premiums and the five pricing levers — is classed **Estimate** in
the configurator's Data provenance tab: extrapolated from a single supplied anchor
(the CO₂ PCB dual-head at about ₹65.6 L ex-works), not TEAL procurement data. The
new commercial breakdown labels every priced line accordingly. Supplier names and
part numbers are not held in the value store, so the BOM has no columns for them
rather than columns of blanks.

One rule is hard-coded rather than held as data: the large-field objective uplift
applies to the key `f420` by name inside `priceLines()`. If objectives are renamed
or another large-field objective is added, that rule will not follow. Moving it to
a per-objective field in `LENS` would make it data.

## Engineering data (2026-10-16)

The machine model was audited against the data behind it. The component-level picture
is in [`assets/cad/COVERAGE.md`](assets/cad/COVERAGE.md), which `npm test` keeps current.

| Finding | Status |
|---|---|
| The DFM report labelled the objective's focal length as its "working distance", and the 3D callout read "WD = f" | **Fixed.** The data holds focal length and field only, so the working distance is not shown |
| About 30 % of the drawn geometry carried no component ID, including the laser source, chiller, beacon, HMI, e-stop, workpiece and most modules, so it could not be inspected | **Fixed.** What remains unmapped is reported as unresolved |
| No bought-in component has a manufacturer, model or part number; 48 are specified by class and example vendors only | **Needs TEAL** — an engineering BOM |
| 14 components are fabricated to TEAL drawings that are not in the data | **Needs TEAL** — drawing numbers, and CAD for the 3D model |
| Only 1 of 18 platforms with a Z column states its Z stroke (`markf`, 300 mm) | **Needs TEAL** — the other strokes |
| No objective states a working distance | **Needs TEAL** — the objective datasheets |
| Lead time is held per platform, not per component; prices are not itemised per component | By design of the commercial model — flagged, not changed |


## Safety, access and identity data (2026-10-16)

| Finding | Status |
|---|---|
| `RULES.adminPin` (`teal2026`) was shipped in the public `data.json` and gated the value store. Anyone could read it, so it protected nothing while implying it did | **Removed** from `data.json` and the page. The value store opens from the Internal view, which is labelled a demonstration. See [`SECURITY.md`](SECURITY.md) |
| The printed sheet, the specification step and the 3D floor plan called every platform "Class 1 per IEC 60825-1" | **Fixed.** All three read the platform's own `Safety` specification. Where there is none, they say the class is not stated |
| At that date, only 6 of 22 platforms had a `Safety` specification (v16.0 also counts an `Enclosure` row; see below): `markf` and `markm` (Class 1 per IEC 60825-1), `weldr` (Class 1 cabin per IEC 60825-4), `robo` (Class 1 guarding), `cleanp` (eyewear, beacons, key control) and `roto` (risk assessment to ISO 12100) | **Needs TEAL** — the laser class and safety concept of the other 16 platforms |
| Every export now carries the configuration ID, revision and fingerprint: the share link, printed sheet, BOM CSV, RFQ, component register, DFM report and requests | Done. Documents can be traced back to the selection they describe |

No catalogue value was changed, apart from the removal of the PIN.

## Process model and reference data (2026-11-11)

An end-to-end inspection ran all 1,143 combinations of platform, application, source,
power and objective through the optics, physics and cycle models. `npm test` now
repeats that sweep on every run.

### Fixed

| Finding | Status |
|---|---|
| The focus limit was shown as the process spot on platforms that state a working spot: 12–20 µm on `weldh` (stated 50–300 µm), 19–32 µm on `weldp` (stated 30–600 µm) | **Fixed.** The working spot stays inside the stated range |
| Quasi-CW peak power was derived from a guessed repetition rate, giving 0.95 kW at 150 W against the catalogue's 1.5 kW | **Fixed.** `SRC.qcw.pk = 10`, the catalogue's own ratio |
| The physics panel, the heat-input figure and the run each used a different speed | **Fixed.** One process point |
| Cutting, scribing and automation platforms ran pulsed lines with the pulses apart | **Fixed.** Each line process starts at an overlap rule |
| `voltm` and `voltt` (cell marking) were simulated as a joining process | **Fixed** |
| The MOPA source was computed at its shortest pulse, 2 ns, giving a 237 kW peak at 30 W | **Fixed.** The pulse starts at the geometric mid-point of the tunable range and is adjustable |
| Thermal properties did not match any one source: carbon steel 50 W/m·K, 304 at 16 W/m·K and 8,000 kg/m³ | **Fixed.** Nine materials now carry the Incropera & DeWitt Appendix A values at 300 K |
| Silicon absorptivity at 355 nm was 65 %; the tabulated n and k give 43 % | **Fixed** |
| Glass "melts at 1,000 °C" and polyimide "decomposes near 400 °C" | **Fixed.** Each material states how it gives way: melts, decomposes, or passes a transition |
| Wall-plug efficiency was labelled a published figure for every source | **Fixed.** Published ranges were found for fiber, CO₂ and diode only; the rest are now labelled estimates |
| The 3D nameplate, robot schematic, run message and DFM report asserted Class 1, CE, ± 0.05 mm and ± 0.25 mm for every platform | **Fixed.** Each reads the platform's own specification |

With the `Enclosure` row counted alongside `Safety`, 7 of 22 platforms make a safety
statement and 5 name Class 1: `markf`, `markm`, `weldr`, `cleana` and `robo`.

### Still estimates

| Data | Why it matters | Needs |
|---|---|---|
| Beam quality M² and beam diameter at the objective, for all 12 sources | They set the computed focus spot. Neither is in the catalogue | **TEAL** — the source and beam-expander data sheets |
| Starting pulse overlap: marking 50 %, cutting and scribing 80 %, cleaning 30 % | They set the default speed and so the cycle time | **TEAL** — application trial results. Only the 75 % for pulsed seams has a published basis |
| Speed where the specification states none (19 of 22 platforms): welding 120, cleaning 900, cutting 400, semiconductor 3,000, otherwise 2,500 mm/s | Process time on those platforms is indicative | **TEAL** — a speed row in each platform's specification |
| Absorptivity, except copper and silicon | Coupled power is indicative | Measured values, or n and k from a cited table |
| Thermal properties of glass, FR4, engineering polymer and mould compound | Grade-dependent | The grades TEAL validates against |
| Wall-plug efficiency of UV, green, blue, picosecond and femtosecond sources | Heat load and electrical energy for those sources | **TEAL** — source data sheets |
| The 20 µm minimum mark line and the 250 µs scanner delay | Marking time | Scan-head settings |
| The 10 J/cm² line between an annealing and an ablative mark | The regime label on marking platforms | Trial results per material |

### Needs a TEAL decision

| Record | Finding |
|---|---|
| `PLAT.weldh` | The specification calls 150–450 W the "peak class". The configurator treats platform power as average power, as on `weldp` (150 W average, 1.5 kW peak). If 150–450 W is peak, the average is a tenth of it and every energy figure for this platform is ten times too high |
| `PLAT.weldp` | The seam application recommends CW 500 W, but the platform's power list stops at 450 W, so the recommendation snaps to 450 W |
| `SRC.smcw` at 3–6 kW | Modelled as single-mode (M² 1.05). The catalogue also offers a ring-mode option. No beam parameter product is given, so the focus spot on `weldb` and `weldr` is the single-mode figure |
| Source limits | Maximum pulse energy and peak power are not in the data. The process point can be set to a pulse energy a real source may not reach |
