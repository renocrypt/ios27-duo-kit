# Per-mesh bounds in the flat Landscape pose, to separate the body slab from protrusions (camera bump).
import os
from pxr import Usd, UsdGeom, Gf

USDZ = os.environ.get('DUO_USDZ', '/tmp/duo/device-research/references/iPhone_Duo_e-sim_Star-White_Variant.usdz')  # Apple's asset stays in /tmp
stage = Usd.Stage.Open(USDZ)
root = stage.GetPrimAtPath("/VozFyMVAwkoHjOE")
root.GetVariantSets().GetVariantSet("Pose").SetVariantSelection("Landscape")
mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000
xf = UsdGeom.XformCache(Usd.TimeCode.Default())

parts = []
for prim in stage.Traverse():
    if not prim.IsA(UsdGeom.Mesh) or UsdGeom.Imageable(prim).ComputeVisibility() == UsdGeom.Tokens.invisible:
        continue
    pts = UsdGeom.Mesh(prim).GetPointsAttr().Get()
    if not pts or len(pts) <= 24:
        continue
    m = xf.GetLocalToWorldTransform(prim)
    ws = [m.Transform(Gf.Vec3d(p)) for p in pts]
    lo = [min(w[i] for w in ws) * mm for i in range(3)]
    hi = [max(w[i] for w in ws) * mm for i in range(3)]
    mat = UsdGeom.Mesh(prim).GetPrim().GetRelationship("material:binding").GetTargets()
    parts.append((prim.GetName(), len(pts), lo, hi, str(mat[0].name) if mat else "-"))

zlo = min(p[2][2] for p in parts); zhi = max(p[3][2] for p in parts)
print(f"overall z: {zlo:.2f} .. {zhi:.2f}  (depth {zhi - zlo:.2f} mm)")
# Body slab = z range covered by the largest-footprint meshes.
big = sorted(parts, key=lambda p: -(p[3][0] - p[2][0]) * (p[3][1] - p[2][1]))[:6]
print("largest-footprint meshes (x-size, y-size, z-lo, z-hi):")
for n, v, lo, hi, mat in big:
    print(f"  {n:18s} {hi[0]-lo[0]:7.2f} {hi[1]-lo[1]:7.2f}  z {lo[2]:6.2f}..{hi[2]:6.2f}  mat {mat}")
print("meshes reaching within 3 mm of either z extreme (candidates for the camera bump):")
for n, v, lo, hi, mat in sorted(parts, key=lambda p: -p[3][2]):
    if hi[2] > zhi - 3 or lo[2] < zlo + 3:
        if (hi[0]-lo[0]) < 60:
            print(f"  {n:18s} x {lo[0]:7.2f}..{hi[0]:7.2f}  y {lo[1]:7.2f}..{hi[1]:7.2f}  z {lo[2]:6.2f}..{hi[2]:6.2f}  size {hi[0]-lo[0]:5.2f}x{hi[1]-lo[1]:5.2f}  verts {v}  mat {mat}")
