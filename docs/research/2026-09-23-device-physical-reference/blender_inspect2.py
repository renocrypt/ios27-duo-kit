import bpy
import mathutils
import statistics

usdz_path = "/tmp/duo/device-research/references/iPhone_Duo_e-sim_Star-White_Variant.usdz"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=usdz_path)

def world_bbox_verts(obj):
    """Return list of world-space vertex coords (sampled, for perf use bound_box corners only if huge)"""
    mw = obj.matrix_world
    return [mw @ v.co for v in obj.data.vertices]

print("\n===== PER-OBJECT: world matrix decomposed =====")
for o in bpy.data.objects:
    loc, rot, scale = o.matrix_world.decompose()
    eul = rot.to_euler()
    import math
    print(f"{o.name} type={o.type} parent={o.parent.name if o.parent else None} "
          f"loc_mm=({loc.x*1000:.2f},{loc.y*1000:.2f},{loc.z*1000:.2f}) "
          f"rot_deg=({math.degrees(eul.x):.2f},{math.degrees(eul.y):.2f},{math.degrees(eul.z):.2f}) "
          f"scale=({scale.x:.3f},{scale.y:.3f},{scale.z:.3f})")

print("\n===== MESH OBJECTS: vertex count, world AABB (mm), poly count =====")
mesh_info = []
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    verts = world_bbox_verts(o)
    if not verts:
        continue
    xs = [v.x for v in verts]; ys = [v.y for v in verts]; zs = [v.z for v in verts]
    size = (max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
    center = ((max(xs)+min(xs))/2, (max(ys)+min(ys))/2, (max(zs)+min(zs))/2)
    mesh_info.append((o.name, len(o.data.vertices), len(o.data.polygons), size, center, o.data.materials[0].name if o.data.materials else None))

# Sort by bounding box volume descending to find "big" shell parts
mesh_info.sort(key=lambda m: -(m[3][0]*m[3][1]*m[3][2]))
for name, nv, npoly, size, center, mat in mesh_info[:30]:
    print(f"{name}: verts={nv} polys={npoly} size_mm=({size[0]*1000:.2f},{size[1]*1000:.2f},{size[2]*1000:.2f}) "
          f"center_mm=({center[0]*1000:.2f},{center[1]*1000:.2f},{center[2]*1000:.2f}) mat={mat}")

print("\n===== TRUE WORLD AABB across ALL mesh vertices (mm) =====")
allx=[]; ally=[]; allz=[]
allx_novox=[]; ally_novox=[]; allz_novox=[]
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    verts = world_bbox_verts(o)
    for v in verts:
        allx.append(v.x); ally.append(v.y); allz.append(v.z)
    # exclude the low-poly proxy object (heuristic: fewer than 30 polys AND large size)
    if len(o.data.polygons) > 30:
        for v in verts:
            allx_novox.append(v.x); ally_novox.append(v.y); allz_novox.append(v.z)

print(f"ALL meshes incl. proxies: size_mm = ({(max(allx)-min(allx))*1000:.2f}, {(max(ally)-min(ally))*1000:.2f}, {(max(allz)-min(allz))*1000:.2f})")
if allx_novox:
    print(f"Excluding low-poly (<=30 poly) proxies: size_mm = ({(max(allx_novox)-min(allx_novox))*1000:.2f}, {(max(ally_novox)-min(ally_novox))*1000:.2f}, {(max(allz_novox)-min(allz_novox))*1000:.2f})")

print("\n===== Attempt to find the two back-shell meshes and their face normals =====")
# Heuristic: shell meshes are large flat meshes with relatively few polys but big area.
candidates = []
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    me = o.data
    if len(me.polygons) < 5:
        continue
    # compute average world-space normal weighted by polygon area
    mw = o.matrix_world
    normal_mat = mw.inverted().transposed().to_3x3()
    total_area = 0.0
    accum = mathutils.Vector((0,0,0))
    for p in me.polygons:
        n_world = (normal_mat @ p.normal).normalized()
        a = p.area
        accum += n_world * a
        total_area += a
    if total_area == 0:
        continue
    avg_n = accum.normalized()
    verts = world_bbox_verts(o)
    xs = [v.x for v in verts]; ys=[v.y for v in verts]; zs=[v.z for v in verts]
    size = (max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
    flatness = min(size)  # smallest dimension -> "thin" flat shell candidate
    candidates.append((o.name, total_area, avg_n, size, flatness))

candidates.sort(key=lambda c: -c[1])
for name, area, n, size, flat in candidates[:15]:
    print(f"{name}: area={area*1e6:.1f}mm^2 normal=({n.x:.3f},{n.y:.3f},{n.z:.3f}) size_mm=({size[0]*1000:.2f},{size[1]*1000:.2f},{size[2]*1000:.2f}) minsize_mm={flat*1000:.3f}")

print("\n===== Material name -> object name mapping (all) =====")
mat_to_objs = {}
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.data.materials:
        continue
    for m in o.data.materials:
        if m:
            mat_to_objs.setdefault(m.name, []).append(o.name)
for mat, objs in mat_to_objs.items():
    print(mat, "->", objs)

print("\n===== Material properties (base color, roughness, metallic if available) =====")
for m in bpy.data.materials:
    info = {"name": m.name}
    if m.use_nodes:
        bsdf = None
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                bsdf = n
                break
        if bsdf:
            try:
                base_color = bsdf.inputs['Base Color'].default_value
                info["base_color_rgba"] = tuple(round(c,4) for c in base_color)
            except Exception as e:
                info["base_color_err"] = str(e)
            try:
                info["metallic"] = bsdf.inputs['Metallic'].default_value
                info["roughness"] = bsdf.inputs['Roughness'].default_value
            except Exception:
                pass
            # check for base color texture link
            bc_input = bsdf.inputs.get('Base Color')
            if bc_input and bc_input.is_linked:
                src = bc_input.links[0].from_node
                if src.type == 'TEX_IMAGE' and src.image:
                    info["base_color_texture"] = src.image.name
    print(info)
