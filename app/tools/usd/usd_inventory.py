# Inventory of Apple's model (Landscape): every visible mesh with its bbox (mm, display surface z = 2.49),
# vertex count, bound material and the material's constant inputs (textured inputs shown as 'tex').
import os
from pxr import Usd, UsdGeom, UsdShade, Gf
import os
USDZ = os.environ.get('DUO_USDZ', '/tmp/duo/device-research/references/iPhone_Duo_e-sim_Star-White_Variant.usdz')  # Apple's asset stays in /tmp
stage = Usd.Stage.Open(USDZ)
vs = stage.GetPrimAtPath("/VozFyMVAwkoHjOE").GetVariantSets()
vs.GetVariantSet("Pose").SetVariantSelection("Landscape")
vs.GetVariantSet("Color").SetVariantSelection(os.environ.get("COLOR", "Star_White"))
mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000
xf = UsdGeom.XformCache(Usd.TimeCode.Default())
rows = []
for prim in stage.Traverse():
    if not prim.IsA(UsdGeom.Mesh) or UsdGeom.Imageable(prim).ComputeVisibility() == UsdGeom.Tokens.invisible: continue
    pts = UsdGeom.Mesh(prim).GetPointsAttr().Get()
    if not pts: continue
    m = xf.GetLocalToWorldTransform(prim); W = [m.Transform(Gf.Vec3d(p)) * mm for p in pts]
    lo = [min(p[i] for p in W) for i in range(3)]; hi = [max(p[i] for p in W) for i in range(3)]
    mat, _ = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
    info = []
    if mat:
        for sh in mat.GetPrim().GetChildren():
            s = UsdShade.Shader(sh)
            if s and s.GetIdAttr().Get() == 'UsdPreviewSurface':
                for i in s.GetInputs():
                    n = i.GetBaseName()
                    if n in ('occlusion', 'normal'): continue
                    v = 'tex' if i.HasConnectedSource() else i.Get()
                    if hasattr(v, '__len__') and not isinstance(v, str): v = '(' + ','.join(f'{x:.3f}' for x in v) + ')'
                    elif isinstance(v, float): v = f'{v:.2f}'
                    info.append(f'{n[:5]}={v}')
    rows.append((lo, hi, prim.GetName(), mat.GetPrim().GetName()[:6] if mat else '-', len(W), ' '.join(info)))
rows.sort(key=lambda r: (r[0][0], r[0][2]))
for lo, hi, n, mt, cnt, info in rows:
    print(f"{n[:8]} {mt} n{cnt:6d} x[{lo[0]:7.2f},{hi[0]:7.2f}] y[{lo[1]:7.2f},{hi[1]:7.2f}] z[{lo[2]:6.2f},{hi[2]:6.2f}] {info}")
