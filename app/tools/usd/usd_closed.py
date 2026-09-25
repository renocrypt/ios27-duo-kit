# Check whether the Closed pose is flush: angle between the two chassis leaves and their stacked depth.
import math
import os
from pxr import Usd, UsdGeom, Gf

USDZ = os.environ.get('DUO_USDZ', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../.references/apple-model/iPhone_Duo_e-sim_Star-White_Variant.usdz'))  # Apple's asset: in .references/, never in git
stage = Usd.Stage.Open(USDZ)
root = stage.GetPrimAtPath("/VozFyMVAwkoHjOE")
pose = root.GetVariantSets().GetVariantSet("Pose")
mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000
LEAVES = ["jJermpgmctotTSe", "qyiwePzfWzVHIDO"]          # 82.45 x 117.95 chassis leaves
SCREENS = {"hhgAIoCGsHXeDPY": "outer display", "UXtsBZYlaUvHoEh": "inner display"}

for variant in ("Closed", "Landscape"):
    pose.SetVariantSelection(variant)
    xf = UsdGeom.XformCache(Usd.TimeCode.Default())
    normals = []
    print(f"== {variant}")
    for prim in stage.Traverse():
        name = prim.GetName()
        if name not in LEAVES and name not in SCREENS:
            continue
        pts = UsdGeom.Mesh(prim).GetPointsAttr().Get()
        m = xf.GetLocalToWorldTransform(prim)
        ws = [m.Transform(Gf.Vec3d(p)) for p in pts]
        lo = [min(w[i] for w in ws) * mm for i in range(3)]
        hi = [max(w[i] for w in ws) * mm for i in range(3)]
        n = m.TransformDir(Gf.Vec3d(0, 0, 1)).GetNormalized()   # leaf's local +z in world space
        if name in LEAVES:
            normals.append(n)
        label = SCREENS.get(name, "leaf")
        print(f"  {label:13s} {name}: x {lo[0]:7.2f}..{hi[0]:7.2f}  z {lo[2]:6.2f}..{hi[2]:6.2f}  local+z -> ({n[0]:.3f}, {n[1]:.3f}, {n[2]:.3f})")
    if len(normals) == 2:
        dot = max(-1.0, min(1.0, Gf.Dot(normals[0], normals[1])))
        print(f"  angle between leaf orientations: {math.degrees(math.acos(dot)):.2f} deg")
