# Measure Apple's Duo AR model per Pose variant from mesh points (the file has no authored extents).
import os
from pxr import Usd, UsdGeom, Gf

USDZ = os.environ.get('DUO_USDZ', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../.references/apple-model/iPhone_Duo_e-sim_Star-White_Variant.usdz'))  # Apple's asset: in .references/, never in git
stage = Usd.Stage.Open(USDZ)
root = stage.GetPrimAtPath("/VozFyMVAwkoHjOE")
mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000

def measure():
    xf = UsdGeom.XformCache(Usd.TimeCode.Default())
    lo = [1e9] * 3; hi = [-1e9] * 3; meshes = 0; verts = 0
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        img = UsdGeom.Imageable(prim)
        if img.ComputeVisibility() == UsdGeom.Tokens.invisible:
            continue
        pts = UsdGeom.Mesh(prim).GetPointsAttr().Get()
        if not pts or len(pts) <= 24:   # skip the low-poly AR proxy volume
            continue
        m = xf.GetLocalToWorldTransform(prim)
        meshes += 1; verts += len(pts)
        for p in pts:
            w = m.Transform(Gf.Vec3d(p))
            for i in range(3):
                lo[i] = min(lo[i], w[i]); hi[i] = max(hi[i], w[i])
    size = [round((hi[i] - lo[i]) * mm, 2) for i in range(3)]
    return size, meshes, verts

pose = root.GetVariantSets().GetVariantSet("Pose")
for v in pose.GetVariantNames():
    pose.SetVariantSelection(v)
    size, meshes, verts = measure()
    print(f"Pose={v}: extent mm (x, y, z) = {size}  | visible meshes {meshes}, verts {verts}")
