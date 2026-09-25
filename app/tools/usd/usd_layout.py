# Locate the outer display, camera plateau, and body slabs in both Pose variants.
import os
from pxr import Usd, UsdGeom, Gf

USDZ = os.environ.get('DUO_USDZ', '/tmp/duo/device-research/references/iPhone_Duo_e-sim_Star-White_Variant.usdz')  # Apple's asset stays in /tmp
stage = Usd.Stage.Open(USDZ)
root = stage.GetPrimAtPath("/VozFyMVAwkoHjOE")
pose = root.GetVariantSets().GetVariantSet("Pose")
mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000
CAMERA = {"XziVXUmXQoAudpp", "TjnQASEQBIHreGe", "zKTkIrxcXzWwBYK", "SxeyDDoPvaCZQxB", "gCGRiYiWIxXRhXE"}

def bounds(variant):
    pose.SetVariantSelection(variant)
    xf = UsdGeom.XformCache(Usd.TimeCode.Default())
    out = {}
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh) or UsdGeom.Imageable(prim).ComputeVisibility() == UsdGeom.Tokens.invisible:
            continue
        pts = UsdGeom.Mesh(prim).GetPointsAttr().Get()
        if not pts or len(pts) <= 24:
            continue
        m = xf.GetLocalToWorldTransform(prim)
        ws = [m.Transform(Gf.Vec3d(p)) for p in pts]
        out[prim.GetName()] = ([min(w[i] for w in ws) * mm for i in range(3)], [max(w[i] for w in ws) * mm for i in range(3)])
    return out

land = bounds("Landscape")
print("Landscape: flat surfaces larger than 60 x 60 mm (x range, y range, z range):")
for n, (lo, hi) in sorted(land.items(), key=lambda kv: kv[1][0][2]):
    if hi[0] - lo[0] > 60 and hi[1] - lo[1] > 60:
        print(f"  {n:18s} x {lo[0]:7.2f}..{hi[0]:7.2f}  y {lo[1]:6.2f}..{hi[1]:6.2f}  z {lo[2]:6.2f}..{hi[2]:6.2f}  ({hi[0]-lo[0]:.2f} x {hi[1]-lo[1]:.2f})")

closed = bounds("Closed")
zs = [v for n, (lo, hi) in closed.items() if n not in CAMERA for v in (lo[2], hi[2])]
zc = [v for n, (lo, hi) in closed.items() if n in CAMERA for v in (lo[2], hi[2])]
xs = [v for n, (lo, hi) in closed.items() if n not in CAMERA for v in (lo[0], hi[0])]
print(f"Closed: depth without camera meshes = {max(zs) - min(zs):.2f} mm; camera meshes z {min(zc):.2f}..{max(zc):.2f}; overall z {min(zs+zc):.2f}..{max(zs+zc):.2f}")
print(f"Closed: body x range {min(xs):.2f}..{max(xs):.2f}")
