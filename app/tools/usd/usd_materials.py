# Material binding and UsdPreviewSurface inputs for the named meshes (and all, with --all).
import sys
from pxr import Usd, UsdGeom, UsdShade
stage = Usd.Stage.Open(USDZ)
stage.GetPrimAtPath("/VozFyMVAwkoHjOE").GetVariantSets().GetVariantSet("Pose").SetVariantSelection("Landscape")
import os
import os
USDZ = os.environ.get('DUO_USDZ', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../.references/apple-model/iPhone_Duo_e-sim_Star-White_Variant.usdz'))  # Apple's asset: in .references/, never in git
if os.environ.get("COLOR"): stage.GetPrimAtPath("/VozFyMVAwkoHjOE").GetVariantSets().GetVariantSet("Color").SetVariantSelection(os.environ["COLOR"])
want = set(sys.argv[1:])
for prim in stage.Traverse():
    if not prim.IsA(UsdGeom.Mesh): continue
    if want and prim.GetName() not in want: continue
    mat, rel = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
    info = {}
    if mat:
        for sh in mat.GetPrim().GetChildren():
            s = UsdShade.Shader(sh)
            if s and s.GetIdAttr().Get() == 'UsdPreviewSurface':
                for i in s.GetInputs():
                    v = i.Get()
                    src = i.GetConnectedSources()[0] if i.HasConnectedSource() else None
                    info[i.GetBaseName()] = ('tex:' + str(src[0].source.GetPrim().GetName())) if src else (tuple(round(x, 3) for x in v) if hasattr(v, '__len__') else (round(v, 3) if isinstance(v, float) else v))
    print(prim.GetName(), '|', mat.GetPrim().GetName() if mat else None, '|', info)
