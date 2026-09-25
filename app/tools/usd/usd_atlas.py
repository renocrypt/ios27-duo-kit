# Section atlas of Apple's model: cuts by planes x/y/z = const in either pose, drawn to PNG with a mm grid,
# plus numeric extents per mesh. Usage: usd_atlas.py POSE AXIS VALUE U0 U1 V0 V1 [scale]
#   AXIS is the cut axis (x|y|z); the image shows the other two axes (u right, v up) within the window.
import sys, colorsys
from pxr import Usd, UsdGeom, Gf
from PIL import Image, ImageDraw
import os
USDZ = os.environ.get('DUO_USDZ', '/tmp/duo/device-research/references/iPhone_Duo_e-sim_Star-White_Variant.usdz')  # Apple's asset stays in /tmp
POSE, AXIS, VALUE = sys.argv[1], 'xyz'.index(sys.argv[2]), float(sys.argv[3])
U0, U1, V0, V1 = map(float, sys.argv[4:8]); S = float(sys.argv[8]) if len(sys.argv) > 8 else 60
stage = Usd.Stage.Open(USDZ)
stage.GetPrimAtPath("/VozFyMVAwkoHjOE").GetVariantSets().GetVariantSet("Pose").SetVariantSelection(POSE)
mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000
xf = UsdGeom.XformCache(Usd.TimeCode.Default())
other = [i for i in range(3) if i != AXIS]
segs, names = [], []
for prim in stage.Traverse():
    if not prim.IsA(UsdGeom.Mesh) or UsdGeom.Imageable(prim).ComputeVisibility() == UsdGeom.Tokens.invisible: continue
    mesh = UsdGeom.Mesh(prim); pts = mesh.GetPointsAttr().Get()
    if not pts or len(pts) <= 24: continue
    m = xf.GetLocalToWorldTransform(prim); W = [m.Transform(Gf.Vec3d(p)) * mm for p in pts]
    k = len(names); names.append(prim.GetName()); o = 0
    for c in mesh.GetFaceVertexCountsAttr().Get():
        idx = mesh.GetFaceVertexIndicesAttr().Get(); poly = [W[idx[o + i]] for i in range(c)]; o += c
        hits = []
        for i in range(c):
            a, b = poly[i], poly[(i + 1) % c]
            if (a[AXIS] - VALUE) * (b[AXIS] - VALUE) < 0:
                t = (VALUE - a[AXIS]) / (b[AXIS] - a[AXIS]); hits.append(tuple(a[j] + t * (b[j] - a[j]) for j in other))
        if len(hits) >= 2: segs.append((k, hits[0], hits[1]))
inside = lambda p: U0 <= p[0] <= U1 and V0 <= p[1] <= V1
used = sorted({k for k, a, b in segs if inside(a) or inside(b)})
img = Image.new('RGB', (int((U1 - U0) * S), int((V1 - V0) * S)), (255, 255, 255)); d = ImageDraw.Draw(img)
step = 1 if (U1 - U0) < 40 else 5
for g in range(int(U0), int(U1) + 1):
    if g % step == 0: d.line([((g - U0) * S, 0), ((g - U0) * S, img.height)], fill=(225, 225, 225) if g % 5 else (190, 190, 190))
for g in range(int(V0), int(V1) + 1):
    if g % step == 0: d.line([(0, (V1 - g) * S), (img.width, (V1 - g) * S)], fill=(225, 225, 225) if g % 5 else (190, 190, 190))
col = {k: tuple(int(c * 255) for c in colorsys.hsv_to_rgb((i * 0.61) % 1, 0.85, 0.7)) for i, k in enumerate(used)}
for k, a, b in segs:
    if k in col: d.line([((a[0] - U0) * S, (V1 - a[1]) * S), ((b[0] - U0) * S, (V1 - b[1]) * S)], fill=col[k], width=2)
for i, k in enumerate(used):
    P = [p for kk, a, b in segs if kk == k for p in (a, b) if inside(p)]
    label = f"{names[k]}  u {min(p[0] for p in P):.2f}..{max(p[0] for p in P):.2f}  v {min(p[1] for p in P):.2f}..{max(p[1] for p in P):.2f}"
    d.text((8, 8 + 13 * i), label, fill=col[k]); print(label)
out = f"/tmp/duo/device-research/atlas-{POSE}-{sys.argv[2]}{VALUE:g}.png"; img.save(out); print("wrote", out, img.size)
