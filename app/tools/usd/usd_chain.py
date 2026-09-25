# Chain the cross-section of named meshes into polylines and simplify them (RDP), printing them in our
# device frame: z' = z - 2.49 (inner display surface at 0). Usage:
#   usd_chain.py POSE AXIS VALUE U0 U1 V0 V1 TOL MESH [MESH...]
import sys, math, json
from pxr import Usd, UsdGeom, Gf
import os
USDZ = os.environ.get('DUO_USDZ', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../.references/apple-model/iPhone_Duo_e-sim_Star-White_Variant.usdz'))  # Apple's asset: in .references/, never in git
POSE, AXIS, VALUE = sys.argv[1], 'xyz'.index(sys.argv[2]), float(sys.argv[3])
U0, U1, V0, V1, TOL = map(float, sys.argv[4:9]); NAMES = set(sys.argv[9:])
stage = Usd.Stage.Open(USDZ)
stage.GetPrimAtPath("/VozFyMVAwkoHjOE").GetVariantSets().GetVariantSet("Pose").SetVariantSelection(POSE)
mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000
xf = UsdGeom.XformCache(Usd.TimeCode.Default())
other = [i for i in range(3) if i != AXIS]
def rdp(p, tol):
    if len(p) < 3: return p
    a, b = p[0], p[-1]; L = math.dist(a, b) or 1e-12; worst, k = -1, 0
    for i in range(1, len(p) - 1):
        d = abs((b[0]-a[0])*(a[1]-p[i][1]) - (a[0]-p[i][0])*(b[1]-a[1])) / L
        if d > worst: worst, k = d, i
    return rdp(p[:k+1], tol)[:-1] + rdp(p[k:], tol) if worst > tol else [a, b]
out = {}
for prim in stage.Traverse():
    if prim.GetName() not in NAMES or not prim.IsA(UsdGeom.Mesh): continue
    mesh = UsdGeom.Mesh(prim); pts = mesh.GetPointsAttr().Get()
    m = xf.GetLocalToWorldTransform(prim); W = [m.Transform(Gf.Vec3d(p)) * mm for p in pts]
    idx = mesh.GetFaceVertexIndicesAttr().Get(); segs = []; o = 0
    for c in mesh.GetFaceVertexCountsAttr().Get():
        poly = [W[idx[o + i]] for i in range(c)]; o += c; hits = []
        for i in range(c):
            a, b = poly[i], poly[(i + 1) % c]
            if (a[AXIS] - VALUE) * (b[AXIS] - VALUE) < 0:
                t = (VALUE - a[AXIS]) / (b[AXIS] - a[AXIS]); hits.append(tuple(a[j] + t * (b[j] - a[j]) for j in other))
        if len(hits) >= 2:
            a, b = hits[0], hits[1]
            if all(U0 <= p[0] <= U1 and V0 <= p[1] <= V1 for p in (a, b)): segs.append((a, b))
    # Chain segments by matching endpoints (rounded keys).
    key = lambda p: (round(p[0], 4), round(p[1], 4))
    adj = {}
    for a, b in segs: adj.setdefault(key(a), []).append(b); adj.setdefault(key(b), []).append(a)
    used = set(); chains = []
    for a, b in segs:
        if (key(a), key(b)) in used: continue
        chain = [a, b]; used.add((key(a), key(b))); used.add((key(b), key(a)))
        for end in (1, 0):
            while True:
                tip = chain[-1] if end else chain[0]; prev = chain[-2] if end else chain[1]
                nxt = [q for q in adj.get(key(tip), []) if (key(tip), key(q)) not in used]
                if not nxt: break
                q = nxt[0]; used.add((key(tip), key(q))); used.add((key(q), key(tip)))
                chain.append(q) if end else chain.insert(0, q)
        chains.append(chain)
    chains.sort(key=len, reverse=True)
    out[prim.GetName()] = [[(round(p[0], 3), round(p[1] - (2.49 if AXIS != 2 else 0), 3)) for p in rdp(c, TOL)] for c in chains if len(c) > 3]
for n, cs in out.items():
    for c in cs: print(n, len(c), c)
os.makedirs('/tmp/duo/usd', exist_ok=True)
json.dump(out, open('/tmp/duo/usd/chain.json', 'w'))
