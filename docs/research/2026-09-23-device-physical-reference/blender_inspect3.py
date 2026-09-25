import bpy
import mathutils

usdz_path = "/tmp/duo/device-research/references/iPhone_Duo_e-sim_Star-White_Variant.usdz"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=usdz_path)

def world_bbox_verts(obj):
    mw = obj.matrix_world
    return [mw @ v.co for v in obj.data.vertices]

print("\n===== ALL MESH OBJECTS (full list, sorted by Z then X) =====")
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
    mat = o.data.materials[0].name if o.data.materials else None
    mesh_info.append((o.name, len(o.data.vertices), len(o.data.polygons), size, center, mat))

mesh_info.sort(key=lambda m: (round(m[4][2],1), round(m[4][0],1)))
for name, nv, npoly, size, center, mat in mesh_info:
    print(f"{name}: verts={nv} polys={npoly} size_mm=({size[0]*1000:.2f},{size[1]*1000:.2f},{size[2]*1000:.2f}) "
          f"center_mm=({center[0]*1000:.2f},{center[1]*1000:.2f},{center[2]*1000:.2f}) mat={mat}")

print(f"\nTOTAL MESH COUNT: {len(mesh_info)}")

# Look specifically for near-circular/near-square footprint candidates (potential lenses/sensors/buttons)
print("\n===== Candidate circular/small parts (X and Z both between 1-20mm, roughly equal) =====")
for name, nv, npoly, size, center, mat in mesh_info:
    x_mm, y_mm, z_mm = size[0]*1000, size[1]*1000, size[2]*1000
    if 1 < x_mm < 20 and 1 < z_mm < 20 and abs(x_mm - z_mm) < x_mm * 0.3:
        print(f"{name}: size_mm=({x_mm:.2f},{y_mm:.2f},{z_mm:.2f}) center_mm=({center[0]*1000:.2f},{center[1]*1000:.2f},{center[2]*1000:.2f}) mat={mat}")
