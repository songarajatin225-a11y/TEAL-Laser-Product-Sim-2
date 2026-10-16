#!/usr/bin/env python3
"""STEP/STP -> GLB for the TEAL configurator's 3D view.

    python3 tools/cad/step2glb.py IN.step OUT.glb [--id COMPONENT] [--size MM] [--max-tris N]

Reads a STEP file through OpenCASCADE (via the gmsh Python wheel), tessellates
every solid separately, and writes a glTF 2.0 binary with one node per solid so
parts stay individually selectable. A JSON report is written next to the GLB
(OUT.report.json): the source file's SHA-256, its units, each solid's name,
triangle count, and the bounding box of the CAD solid against the bounding box
of its mesh. The deviation between the two is the conversion check.

Units: STEP lengths are converted to millimetres by OpenCASCADE on import;
glTF positions are written in metres (the glTF convention), so a 25 mm rail is
0.025 in the file. The source unit is recorded in asset.extras.

Axes: STEP models are conventionally Z-up and glTF is Y-up, so positions are
written as (x, z, -y). Pass --keep-axes for a model that is already Y-up. The
choice is recorded in asset.extras.axes.

Treat input as untrusted: the file must start with the ISO-10303-21 header and
be under the size limit. STEP is plain data; nothing in it is executed.

Requires: pip install -r tools/cad/requirements.txt (gmsh, numpy). On Linux the
gmsh wheel needs libGLU (apt install libglu1-mesa) even when run headless.
"""
import argparse, hashlib, json, os, struct, sys

MAX_BYTES = 200 * 1024 * 1024


def fail(msg):
    print('step2glb: ' + msg, file=sys.stderr)
    sys.exit(2)


def check_input(path):
    if not os.path.isfile(path):
        fail('no such file: ' + path)
    size = os.path.getsize(path)
    if size == 0 or size > MAX_BYTES:
        fail('refusing %s: %d bytes (limit %d)' % (path, size, MAX_BYTES))
    with open(path, 'rb') as f:
        head = f.read(64).lstrip()
    if not head.startswith(b'ISO-10303-21'):
        fail('not a STEP file (no ISO-10303-21 header): ' + path)
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return size, h.hexdigest()


def tessellate(path, size_mm, max_tris):
    import gmsh
    gmsh.initialize()
    try:
        gmsh.option.setNumber('General.Terminal', 0)
        gmsh.option.setString('Geometry.OCCTargetUnit', 'MM')
        gmsh.option.setNumber('Geometry.OCCImportLabels', 1)
        gmsh.model.add('step')
        gmsh.model.occ.importShapes(path)
        gmsh.model.occ.synchronize()
        vols = gmsh.model.getEntities(3)
        if not vols:
            fail('no solids in ' + path + ' (surface-only STEP is not supported)')
        # coarsen until the triangle budget is met
        factor = 1.0
        for _ in range(6):
            gmsh.model.mesh.clear()
            gmsh.option.setNumber('Mesh.MeshSizeMax', size_mm * factor)
            gmsh.option.setNumber('Mesh.MeshSizeFromCurvature', 12)
            gmsh.model.mesh.generate(2)
            total = 0
            for _, s in gmsh.model.getEntities(2):
                types, _, nodes = gmsh.model.mesh.getElements(2, s)
                for t, n in zip(types, nodes):
                    if t == 2:
                        total += len(n) // 3
            if total <= max_tris:
                break
            factor *= 1.8
        parts = []
        for _, v in vols:
            name = gmsh.model.getEntityName(3, v) or ('solid_%d' % v)
            cad = gmsh.model.getBoundingBox(3, v)
            pos, idx, remap = [], [], {}
            bnd = gmsh.model.getBoundary([(3, v)], combined=False, oriented=False)
            for s in sorted(set(abs(t) for d, t in bnd if d == 2)):
                types, _, nodes = gmsh.model.mesh.getElements(2, s)
                for t, n in zip(types, nodes):
                    if t != 2:
                        continue
                    for tag in n:
                        tag = int(tag)
                        if tag not in remap:
                            c, _, _, _ = gmsh.model.mesh.getNode(tag)
                            remap[tag] = len(pos)
                            pos.append((c[0], c[1], c[2]))
                        idx.append(remap[tag])
            if not idx:
                continue
            mn = [min(p[i] for p in pos) for i in range(3)]
            mx = [max(p[i] for p in pos) for i in range(3)]
            dev = max(abs(mn[0] - cad[0]), abs(mn[1] - cad[1]), abs(mn[2] - cad[2]),
                      abs(mx[0] - cad[3]), abs(mx[1] - cad[4]), abs(mx[2] - cad[5]))
            parts.append({'name': name, 'pos': pos, 'idx': idx,
                          'cadBox': [list(cad[:3]), list(cad[3:])], 'meshBox': [mn, mx],
                          'deviationMM': dev})
        return parts, size_mm * factor
    finally:
        gmsh.finalize()


def write_glb(parts, out, comp_id, sha, src_name, zup=True):
    bin_ = bytearray()

    def ax(p):
        return (p[0], p[2], -p[1]) if zup else (p[0], p[1], p[2])
    views, accs, meshes, nodes = [], [], [], []

    def pad4(b, fill=b'\x00'):
        while len(b) % 4:
            b += fill

    for i, p in enumerate(parts):
        # positions in metres
        off = len(bin_)
        pts = [ax(q) for q in p['pos']]
        for x, y, z in pts:
            bin_ += struct.pack('<3f', x / 1000.0, y / 1000.0, z / 1000.0)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(bin_) - off, 'target': 34962})
        mn = [min(q[i] for q in pts) / 1000.0 for i in range(3)]
        mx = [max(q[i] for q in pts) / 1000.0 for i in range(3)]
        accs.append({'bufferView': len(views) - 1, 'componentType': 5126, 'count': len(p['pos']),
                     'type': 'VEC3', 'min': mn, 'max': mx})
        pad4(bin_)
        off = len(bin_)
        for k in p['idx']:
            bin_ += struct.pack('<I', k)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(bin_) - off, 'target': 34963})
        accs.append({'bufferView': len(views) - 1, 'componentType': 5125, 'count': len(p['idx']), 'type': 'SCALAR'})
        pad4(bin_)
        meshes.append({'name': p['name'], 'primitives': [{'attributes': {'POSITION': len(accs) - 2},
                                                          'indices': len(accs) - 1, 'mode': 4}]})
        nodes.append({'name': p['name'], 'mesh': i})
    gltf = {
        'asset': {'version': '2.0', 'generator': 'TEAL tools/cad/step2glb.py',
                  'extras': {'componentId': comp_id, 'source': src_name, 'sourceSha256': sha,
                             'sourceUnits': 'mm', 'positionUnits': 'm',
                             'axes': 'y-up, converted from z-up' if zup else 'as authored'}},
        'scene': 0, 'scenes': [{'nodes': [len(nodes)]}],
        'nodes': nodes + [{'name': comp_id or 'root', 'children': list(range(len(nodes)))}],
        'meshes': meshes, 'accessors': accs, 'bufferViews': views,
        'buffers': [{'byteLength': len(bin_)}],
    }
    js = bytearray(json.dumps(gltf, separators=(',', ':')).encode('utf8'))
    pad4(js, b' ')
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(out, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)
    return total


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--id', default='', help='component id from assets/cad/manifest.json')
    ap.add_argument('--size', type=float, default=4.0, help='target mesh edge length, mm')
    ap.add_argument('--max-tris', type=int, default=6000, help='triangle budget for the whole file')
    ap.add_argument('--keep-axes', action='store_true', help='the model is already Y-up')
    a = ap.parse_args()
    nbytes, sha = check_input(a.src)
    parts, used = tessellate(a.src, a.size, a.max_tris)
    if not parts:
        fail('no triangles produced')
    size = write_glb(parts, a.out, a.id, sha, os.path.basename(a.src), zup=not a.keep_axes)
    worst = max(p['deviationMM'] for p in parts)
    report = {'source': os.path.basename(a.src), 'sourceBytes': nbytes, 'sourceSha256': sha,
              'componentId': a.id or None, 'glb': os.path.basename(a.out), 'glbBytes': size,
              'meshSizeMM': round(used, 3), 'axes': 'as authored' if a.keep_axes else 'y-up, converted from z-up',
              'solids': [
                  {'name': p['name'], 'triangles': len(p['idx']) // 3, 'cadBoxMM': p['cadBox'],
                   'meshBoxMM': p['meshBox'], 'deviationMM': round(p['deviationMM'], 4)} for p in parts],
              'maxDeviationMM': round(worst, 4)}
    with open(os.path.splitext(a.out)[0] + '.report.json', 'w') as f:
        json.dump(report, f, indent=2)
    print('%s: %d solid(s), %d triangles, max bbox deviation %.3f mm -> %s (%d bytes)' % (
        os.path.basename(a.src), len(parts), sum(len(p['idx']) // 3 for p in parts), worst, a.out, size))


if __name__ == '__main__':
    main()
