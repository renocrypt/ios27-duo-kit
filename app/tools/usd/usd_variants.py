# List USD variant sets in Apple's Duo AR model and measure each Pose variant.
import os
from pxr import Usd, UsdGeom

USDZ = os.environ.get('DUO_USDZ', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../.references/apple-model/iPhone_Duo_e-sim_Star-White_Variant.usdz'))  # Apple's asset: in .references/, never in git
stage = Usd.Stage.Open(USDZ)
print("metersPerUnit:", UsdGeom.GetStageMetersPerUnit(stage), "upAxis:", UsdGeom.GetStageUpAxis(stage))

pose_sets = []
for prim in stage.Traverse():
    vsets = prim.GetVariantSets()
    for name in vsets.GetNames():
        vs = vsets.GetVariantSet(name)
        print("prim:", prim.GetPath(), "| set:", name, "| variants:", vs.GetVariantNames(), "| selected:", vs.GetVariantSelection())
        pose_sets.append((prim, name))

def extent_mm():
    cache = UsdGeom.BBoxCache(Usd.TimeCode.Default(), [UsdGeom.Tokens.default_, UsdGeom.Tokens.render])
    mpu = UsdGeom.GetStageMetersPerUnit(stage)
    box = cache.ComputeWorldBound(stage.GetPseudoRoot()).ComputeAlignedRange()
    size = box.GetSize()
    return [round(s * mpu * 1000, 2) for s in size]

for prim, name in pose_sets:
    vs = prim.GetVariantSets().GetVariantSet(name)
    for v in vs.GetVariantNames():
        vs.SetVariantSelection(v)
        print(f"{name}={v}: world extent (mm, x/y/z) =", extent_mm())
