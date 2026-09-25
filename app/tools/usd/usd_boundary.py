# Boundary loops of (planar) meshes: edges used by exactly one face, chained, in the XY plane.
import sys, math
from pxr import Usd, UsdGeom, Gf
import os
USDZ = os.environ.get('DUO_USDZ', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../.references/apple-model/iPhone_Duo_e-sim_Star-White_Variant.usdz'))  # Apple's asset: in .references/, never in git
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
    edges = [k for k, v in count.items() if v == 1]
    adj = {}
    for a, b in edges: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    seen = set(); loops = []
    for s in adj:
        if s in seen: continue
        loop = [s]; seen.add(s); prev = None; cur = s
        while True:
            nxt = [q for q in adj[cur] if q != prev and q not in seen]
            if not nxt: break
            prev, cur = cur, nxt[0]; seen.add(cur); loop.append(cur)
        loops.append([(round(W[i][0], 3), round(W[i][1], 3)) for i in loop])
    for L in loops:
        # print the part in the top-right quadrant of the loop's bbox (one corner), sorted along the loop
        xs = [p[0] for p in L]; ys = [p[1] for p in L]
        print(prim.GetName(), 'loop', len(L), 'bbox x', min(xs), max(xs), 'y', min(ys), max(ys))
        cx, cy = (max(xs) if "--left" not in sys.argv else min(xs)), max(ys)
        q = [p for p in L if abs(p[0] - cx) < 16 and p[1] > cy - 16]
        print('  free-top corner:', q)
        if min(xs) < 0 and max(xs) <= 0.5 or len(sys.argv) > 99: pass
