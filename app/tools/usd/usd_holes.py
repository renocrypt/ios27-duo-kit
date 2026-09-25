# Small boundary loops (holes) of the frame meshes: centre, size, and the plane they sit in.
import sys
from pxr import Usd, UsdGeom, Gf
import os
USDZ = os.environ.get('DUO_USDZ', '/tmp/duo/device-research/references/iPhone_Duo_e-sim_Star-White_Variant.usdz')  # Apple's asset stays in /tmp
stage = Usd.Stage.Open(USDZ)
stage.GetPrimAtPath("/VozFyMVAwkoHjOE").GetVariantSets().GetVariantSet("Pose").SetVariantSelection("Landscape")
mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000
xf = UsdGeom.XformCache(Usd.TimeCode.Default())
for prim in stage.Traverse():
    if prim.GetName() not in sys.argv[1:]: continue
    mesh = UsdGeom.Mesh(prim); pts = mesh.GetPointsAttr().Get()
    m = xf.GetLocalToWorldTransform(prim); W = [m.Transform(Gf.Vec3d(p)) * mm for p in pts]
    idx = mesh.GetFaceVertexIndicesAttr().Get(); count = {}; o = 0
    for c in mesh.GetFaceVertexCountsAttr().Get():
        f = [idx[o + i] for i in range(c)]; o += c
        for i in range(c):
            a, b = f[i], f[(i + 1) % c]; k = (min(a, b), max(a, b)); count[k] = count.get(k, 0) + 1
    adj = {}
    for (a, b), v in count.items():
        if v == 1: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    seen = set()
    for s in adj:
        if s in seen: continue
        loop = [s]; seen.add(s); prev = None; cur = s
        while True:
            nxt = [q for q in adj[cur] if q != prev and q not in seen]
            if not nxt: break
            prev, cur = cur, nxt[0]; seen.add(cur); loop.append(cur)
        P = [W[i] for i in loop]
        lo = [min(p[k] for p in P) for k in range(3)]; hi = [max(p[k] for p in P) for k in range(3)]
        size = [hi[k] - lo[k] for k in range(3)]
        if max(size) < 20:
            c = [(lo[k] + hi[k]) / 2 for k in range(3)]
            print(f"{prim.GetName()[:6]} centre x {c[0]:8.3f} y {c[1]:8.3f} z' {c[2]-2.49:7.3f}  size {size[0]:.3f} {size[1]:.3f} {size[2]:.3f}  n {len(P)}")
