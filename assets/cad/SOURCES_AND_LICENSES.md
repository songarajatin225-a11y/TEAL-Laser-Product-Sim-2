# CAD sources and licences

**Checked:** 15 October 2026. This file records what was searched for, what was found, and what
may legally be used. The per-component record, with every candidate link, is in
[`manifest.json`](manifest.json). The coverage summary is in [`COVERAGE.md`](COVERAGE.md).

## Summary

- **No CAD file has been downloaded, converted or used in the site.** Every 3D component the
  configurator draws is parametric geometry from its own builder, with illustrative proportions.
- **Downloads were blocked.** This build environment's network policy refused connections to every
  CAD library and manufacturer host tried (HTTP 403 on CONNECT). The hosts are listed under
  `blockers.hostsRefused` in the manifest. The discovery work was done with a web search tool,
  which returns pages, not files.
- **No exact part can be verified.** The product data names the class of each bought-in part and
  some example vendors. It never names the installed manufacturer, model or part number. Even a
  downloaded manufacturer file could only be a *verified equivalent* or a *provisional reference*,
  never the *verified exact* part, until TEAL supplies the bill of materials.
- **No whole-machine CAD is public.** No CAD of any TEAL machine was found. TEAL is Titan Engineering &
  Automation Limited, a TATA enterprise. No complete enclosed fibre-marking machine assembly was
  found in public libraries either.

## What was searched

Searches were made by component class, using the specification and example vendors in the
component library in `index.html`. Each search tried the manufacturer's own site first, then
distributors and the libraries the brief names.

| Area | Searched for | Result |
|---|---|---|
| Galvo scan head | SCANLAB intelliSCAN/basiCube STEP; RAYLASE deflection unit STEP; Novanta/Cambridge Technology; GrabCAD galvo | No public CAD. Coherent states STEP *on request* for its PHF scanner. |
| F-theta objective | Sill Optics S4LFT STEP; Thorlabs FTH160-1064 STEP | Edmund Optics product pages have a downloads section; CAD not confirmed. |
| Laser source | IPG YLP STEP / outline drawing | Catalogue data only. |
| Beam delivery | QBH connector STEP (Optoskand, now Coherent) | PDF dimensional drawings only. |
| Collimator | Optogama beam expander STEP | PDF drawings, "for information only". |
| Linear guides | HIWIN HGR25; THK SHS25 | HIWIN configurator generates 3D CAD. A reseller hosts a HIWIN HGR25R STEP file (licence not established). THK: distributor listings only. |
| Ball screw | HIWIN ballscrew CAD | HIWIN configurator and HIWIN Japan CAD archives (format not confirmed). |
| Servo motor and drive | Yaskawa Sigma-7 STEP | Yaskawa Europe product pages list STEP and 3D data packages. |
| Energy chain | igus e-chain CAD | Free STEP from igus configurators, no registration needed (per igus). |
| T-slot frame | item / MiniTec / Bosch Rexroth 45 × 45 | MiniTec catalogue pages list STEP; Rexroth store links 3D CAD. |
| Levelling feet | Elesa GN 343 | Elesa offers STEP per product code; guests receive files by e-mail. |
| Toggle clamp | DESTACO pneumatic clamps | "Download CAD" on some pages, "Request CAD" on others. |
| Locator pins | MISUMI configurable pins | 2D/3D CAD generated per configuration. |
| Stopper | SMC / Festo stopper cylinders | SMC CADENAS-generated CAD; Festo datasheet only. |
| Conveyor and drive | Nutek SMEMA conveyor; SEW DriveConfigurator | Nutek: none found. SEW: 2D/3D CAD from the configuration cart. |
| Camera and lighting | Basler ace 2; CCS ring lights | Basler: bracket CAD package includes a 3D camera volume. CCS: only 3D-printable mount files. |
| Sensors | SICK M12 inductive; Keyence displacement | SICK: distributor listings; a third-party model was rejected. Keyence: registration required. |
| Safety | Euchner CES; Pilz PNOZ; Schneider XB4 e-stop; Werma beacon | E-stop and beacon: STEP through TraceParts/partner links. Euchner and Pilz: not confirmed. |
| Electrical | Phoenix QUINT; ABB MCB; Siemens S7-1200 and HMI; Beckhoff C6015; Moxa switch | Beckhoff: zipped STEP listed in its public download directory (could not be fetched to verify). Others: listings or renderings only. |
| Utilities | Rittal filter fan; Waldmann light; Termotek chiller; BOFA fume extractor; Gates AT10 | None found. BOFA AD 350 envelope dimensions are published by a distributor. |
| Whole machine | TEAL laser machines; enclosed fibre marker assemblies on GrabCAD | None found. |

**Not searched in this pass:**
- the air-assist nozzle
- the head status LEDs
- the process-gas console
- door hardware and connector inserts

Their manifest records say so.

## Licences and usage terms

| Source | Terms found | Status for this site |
|---|---|---|
| TraceParts (also behind many distributor links) | The general terms prohibit commercial use or redistribution of site content without TraceParts' written consent ([general terms](https://info.traceparts.com/ja/general-terms-of-use)). | **Restricted.** Do not publish converted models without written consent. |
| GrabCAD Community Library | Downloads are for private use. Commercial use needs the designer's explicit permission and attribution ([help article](https://help.grabcad.com/article/246-how-can-models-be-used-and-shared)). | **Restricted.** |
| Elesa | Datasheets ask that the source be credited when drawings are reproduced. Website-distribution terms for 3D files were not found. | **Unresolved.** |
| Manufacturer portals (igus, HIWIN, Yaskawa, MISUMI, DESTACO, SMC, SEW, Basler, Beckhoff) | Not reviewed. Each portal's terms must be read before a file is downloaded for publication. | **Unresolved.** |
| Third-party marketplaces (CGTrader and similar) | Seller-made models; identity and accuracy not traceable to the manufacturer. | **Rejected** for identity. |

The site is published on GitHub Pages, so anything committed under `assets/` is public. A model
whose licence does not permit public distribution must not be committed. Keep it under
`assets/cad/restricted/`, which is git-ignored, and use it locally only.

## How to add a real CAD part

1. Get the exact part identity from TEAL engineering: manufacturer, model and order number.
   Record it in the component's `identity` in `manifest.json`.
2. Download the STEP file from the manufacturer's own portal, and read the portal's terms.
3. Put the file in `assets/cad/raw/` if its licence permits public distribution. Otherwise put it in
   `assets/cad/restricted/`.
4. Convert it:
   `python3 tools/cad/step2glb.py assets/cad/raw/PART.step assets/models/glb/PART.glb --id COMPONENT`
5. Check the `.report.json` the converter writes:
   - each solid's CAD bounding box against its mesh bounding box
   - the overall dimensions against the datasheet
6. In the component's manifest record, fill in:
   - `cad.file`, `cad.downloaded`, `cad.verification` and the candidate's licence note
   - `glb`, set to `{"file": "assets/models/glb/PART.glb", "status": "cad-provisional", "rotDeg": [0,0,0]}`
7. Run `npm test`. The suite checks that every GLB the manifest names exists, parses, and lands
   on a component the model draws.

A component is drawn from CAD only where its builder calls `b.part()`. Today that is:
- the levelling feet
- the Z servo motor and gearbox
- the emergency stop

Other components need the same one-line hook before a GLB will replace their parametric
geometry.
