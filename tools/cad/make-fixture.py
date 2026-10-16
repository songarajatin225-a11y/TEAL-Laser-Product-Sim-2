#!/usr/bin/env python3
"""Write the synthetic test STEP used by the conversion test.

    python3 tools/cad/make-fixture.py tests/fixtures/cad/test-bracket.step

This is NOT a model of any machine component. It is a made-up two-solid part —
an angle bracket 60 x 40 x 30 mm with a 10 mm pin — whose dimensions are known
exactly, so the converter's scale, units and part separation can be checked.
"""
import sys
import gmsh

out = sys.argv[1] if len(sys.argv) > 1 else 'test-bracket.step'
gmsh.initialize()
try:
    gmsh.option.setNumber('General.Terminal', 0)
    gmsh.model.add('test-bracket')
    occ = gmsh.model.occ
    base = occ.addBox(0, 0, 0, 60, 6, 40)           # 60 x 6 x 40 mm foot
    web = occ.addBox(0, 0, 0, 6, 30, 40)            # 6 x 30 x 40 mm upright
    bracket, _ = occ.fuse([(3, base)], [(3, web)])
    pin = occ.addCylinder(40, 6, 20, 0, 18, 0, 5)   # dia 10, 18 mm tall, on the foot
    occ.synchronize()
    gmsh.model.setEntityName(3, bracket[0][1], 'TEST bracket (synthetic)')
    gmsh.model.setEntityName(3, pin, 'TEST pin (synthetic)')
    gmsh.write(out)
finally:
    gmsh.finalize()
print('wrote', out)
