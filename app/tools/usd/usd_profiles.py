# Dense edge profiles from Apple's model (Landscape): the outer silhouette of the body in a cross-section,
# expressed as inset d (mm, from the outermost extent) at each height z. Also the hinge-region section.
import json
from pxr import Usd, UsdGeom, Gf
import os
USDZ = os.environ.get('DUO_USDZ', '/tmp/duo/device-research/references/iPhone_Duo_e-sim_Star-White_Variant.usdz')  # Apple's asset stays in /tmp
stage = Usd.Stage.Open(USDZ)
stage.GetPrimAtPath("/VozFyMVAwkoHjOE").GetVariantSets().GetVariantSet("Pose").SetVariantSelection("Landscape")
mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000
xf = UsdGeom.XformCache(Usd.TimeCode.Default())
MESHES = []
for prim in stage.Traverse():
    if not prim.IsA(UsdGeom.Mesh) or UsdGeom.Imageable(prim).ComputeVisibility() == UsdGeom.Tokens.invisible: continue
    mesh = UsdGeom.Mesh(prim); pts = mesh.GetPointsAttr().Get()
    if not pts or len(pts) <= 24: continue
    m = xf.GetLocalToWorldTransform(prim)
    MESHES.append((prim.GetName(), [m.Transform(Gf.Vec3d(p)) * mm for p in pts], mesh.GetFaceVertexCountsAttr().Get(), mesh.GetFaceVertexIndicesAttr().Get()))

def segments(axis, value):
    other = [i for i in range(3) if i != axis]; out = []
    for name, W, counts, idx in MESHES:
        o = 0
        for c in counts:
            poly = [W[idx[o + i]] for i in range(c)]; o += c
            hits = []
            for i in range(c):
                a, b = poly[i], poly[(i + 1) % c]
                if (a[axis] - value) * (b[axis] - value) < 0:
                    t = (value - a[axis]) / (b[axis] - a[axis]); hits.append(tuple(a[j] + t * (b[j] - a[j]) for j in other))
            if len(hits) >= 2: out.append((name, hits[0], hits[1]))
    return out

def silhouette(segs, u_index, outward, z_lo=-2.76, z_hi=2.5, step=0.05):
    """For each z bin, the outermost coordinate along u (sign = outward) over all segments, sampling segments densely."""
    best = {}
    for name, a, b in segs:
        n = max(2, int(max(abs(a[0] - b[0]), abs(a[1] - b[1])) / 0.01))
        for k in range(n + 1):
            t = k / n; u = a[u_index] + t * (b[u_index] - a[u_index]); z = a[1 - u_index] + t * (b[1 - u_index] - a[1 - u_index])
            if not (z_lo <= z <= z_hi): continue
            key = round(z / step) * step
            if key not in best or u * outward > best[key] * outward: best[key] = u
    return sorted(best.items())

# Free edge (right leaf) at y = 59: cut plane y, 2D coordinates (x, z) -> u = x (index 0), outward +1.
free = silhouette([s for s in segments(1, 59.0) if s[1][0] > 75], 0, +1)
# Top edge at x = 41 (middle of the right leaf): cut plane x, 2D coords (y, z) -> u = y (index 0), outward +1.
top = silhouette([s for s in segments(0, 41.0) if s[1][0] > 110], 0, +1)
xmax = max(u for z, u in free); ymax = max(u for z, u in top)
prof = {"free": [(round(z, 3), round(xmax - u, 3)) for z, u in free], "top": [(round(z, 3), round(ymax - u, 3)) for z, u in top]}
os.makedirs("/tmp/duo/reference", exist_ok=True)
json.dump(prof, open("/tmp/duo/reference/edge-profiles.json", "w"))
for k in ["free", "top"]:
    pts = prof[k]
    print(f"{k}: {len(pts)} samples; outermost at z = {min(pts, key=lambda p: p[1])[0]}")
    print("   ", [(z, d) for z, d in pts[::6]])
