# Digital twins from the TEAL Laser Engineering OS V8

Four platforms have a hand-built 3D CAD simulation, taken from the TEAL Laser Engineering OS V8 page (`TEAL_Laser_Engineering_OS_V8.html`, supplied by TEAL):

| File | V8 machine | Configurator platform |
|---|---|---|
| `semi.html` | LMS-SEMI, semiconductor laser marking system | Semi SPM (`semispm`) |
| `pcb.html` | LMS-PCB, dual-head CO₂ PCB marker | Mark PCB C2i (`markc2i`) |
| `fiber.html` | FLM-25, 25 W fiber marking system (XYZ) | Mark F-Series (`markf`) |
| `mw.html` | µWELD, compact laser micro-welding workstation | Weld P-Series (`weldp`) |

`node tools/twin/extract.mjs <V8.html>` regenerates every file here except `embed.js`, `embed.css` and this README. The simulations' code is unchanged. The extractor does three things:
- moves each page's script into `<key>.js`;
- adds a Content-Security-Policy;
- links the configurator's settings layer (`embed.js` and `embed.css`, written by hand).

The settings layer reads the address:
- `?embed=1` shows the viewport only.
- `?src=`, `?cfg=` and `?prod=` set the source, handling and part. Each one presses the simulation's own button.
- `?theme=` sets light or dark.

`lib/` holds three.js r147 with OrbitControls, RoomEnvironment, RoundedBoxGeometry and the postprocessing passes, © three.js authors, MIT licence. The licence header is kept in each file.

The V8 simulations state their own limits, and those limits apply here too:
- They are concept models at proportional scale.
- Every dimension, travel, cycle time and grade threshold is TBD pending customer inputs and engineering validation.
- Grades are simulated.
