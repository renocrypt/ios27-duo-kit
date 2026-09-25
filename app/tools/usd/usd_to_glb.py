# Export Apple's Duo AR model, per Pose variant, to GLB for internal geometry comparison only.
# Output goes to .references/apple-model/, next to the model (never in git). Units: millimetres, Apple's frame.
import struct, json, sys
from pxr import Usd, UsdGeom, Gf
import os
USDZ = os.environ.get('DUO_USDZ', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../.references/apple-model/iPhone_Duo_e-sim_Star-White_Variant.usdz'))  # Apple's asset: in .references/, never in git

def export(pose, out):
    stage = Usd.Stage.Open(USDZ)
    stage.GetPrimAtPath("/VozFyMVAwkoHjOE").GetVariantSets().GetVariantSet("Pose").SetVariantSelection(pose)
    mm = UsdGeom.GetStageMetersPerUnit(stage) * 1000
    xf = UsdGeom.XformCache(Usd.TimeCode.Default())
    buf = bytearray(); accessors = []; views = []; meshes = []; nodes = []
    def add_view(data, target):
        while len(buf) % 4: buf.append(0)
        off = len(buf); buf.extend(data); views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data), "target": target})
        return len(views) - 1
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh) or UsdGeom.Imageable(prim).ComputeVisibility() == UsdGeom.Tokens.invisible: continue
        mesh = UsdGeom.Mesh(prim)
        pts = mesh.GetPointsAttr().Get(); counts = mesh.GetFaceVertexCountsAttr().Get(); idx = mesh.GetFaceVertexIndicesAttr().Get()
        if not pts or len(pts) <= 24: continue
        m = xf.GetLocalToWorldTransform(prim)
        W = [m.Transform(Gf.Vec3d(p)) * mm for p in pts]
        tris = []; o = 0
        for c in counts:
            for k in range(1, c - 1): tris += [idx[o], idx[o + k], idx[o + k + 1]]
            o += c
        pos = b"".join(struct.pack("<3f", *w) for w in W)
        ind = struct.pack(f"<{len(tris)}I", *tris)
        lo = [min(w[i] for w in W) for i in range(3)]; hi = [max(w[i] for w in W) for i in range(3)]
        pv = add_view(pos, 34962); iv = add_view(ind, 34963)
        accessors.append({"bufferView": pv, "componentType": 5126, "count": len(W), "type": "VEC3", "min": lo, "max": hi})
        accessors.append({"bufferView": iv, "componentType": 5125, "count": len(tris), "type": "SCALAR"})
        mat = prim.GetRelationship("material:binding").GetTargets()
        meshes.append({"name": prim.GetName(), "primitives": [{"attributes": {"POSITION": len(accessors) - 2}, "indices": len(accessors) - 1, "material": 0}],
                       "extras": {"material": str(mat[0].name) if mat else ""}})
        nodes.append({"name": prim.GetName(), "mesh": len(meshes) - 1})
    while len(buf) % 4: buf.append(0)
    gltf = {"asset": {"version": "2.0", "generator": "duo usd_to_glb.py (internal reference only)"},
            "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": meshes,
            "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [0.8, 0.8, 0.8, 1], "metallicFactor": 0, "roughnessFactor": 0.6}}],
            "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(buf)}]}
    js = json.dumps(gltf).encode(); js += b" " * ((4 - len(js) % 4) % 4)
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(buf), 0x004E4942) + bytes(buf)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "wb").write(glb)
    print(f"{pose}: {len(nodes)} meshes -> {out} ({len(glb)//1024} KB)")

for pose in ["Closed", "Landscape"]:
    export(pose, os.path.join(os.path.dirname(USDZ), f"apple-duo-{pose.lower()}.glb"))
