import bpy
import sys
import mathutils

usdz_path = "/tmp/duo/device-research/references/iPhone_Duo_e-sim_Star-White_Variant.usdz"

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

bpy.ops.wm.usd_import(filepath=usdz_path)

print("\n\n===== SCENE OBJECTS =====")
def report(obj, depth=0):
    indent = "  " * depth
    dims = obj.dimensions
    loc = obj.matrix_world.translation
    print(f"{indent}- {obj.name} | type={obj.type} | dims(m)=({dims.x:.5f},{dims.y:.5f},{dims.z:.5f}) | world_loc=({loc.x:.5f},{loc.y:.5f},{loc.z:.5f})")
    if obj.type == 'MESH':
        me = obj.data
        print(f"{indent}    verts={len(me.vertices)} polys={len(me.polygons)} materials={[m.name if m else None for m in me.materials]}")
    for child in obj.children:
        report(child, depth+1)

roots = [o for o in bpy.data.objects if o.parent is None]
for r in roots:
    report(r)

print("\n\n===== ALL OBJECT NAMES (flat) =====")
for o in bpy.data.objects:
    print(o.name, o.type)

print("\n\n===== OVERALL BOUNDING BOX (world, meters) =====")
import mathutils
min_co = mathutils.Vector((float('inf'),)*3)
max_co = mathutils.Vector((float('-inf'),)*3)
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    for corner in o.bound_box:
        world_co = o.matrix_world @ mathutils.Vector(corner)
        min_co.x = min(min_co.x, world_co.x)
        min_co.y = min(min_co.y, world_co.y)
        min_co.z = min(min_co.z, world_co.z)
        max_co.x = max(max_co.x, world_co.x)
        max_co.y = max(max_co.y, world_co.y)
        max_co.z = max(max_co.z, world_co.z)
size = max_co - min_co
print(f"min={min_co}, max={max_co}")
print(f"size (m) = {size.x:.5f} x {size.y:.5f} x {size.z:.5f}")
print(f"size (mm) = {size.x*1000:.3f} x {size.y*1000:.3f} x {size.z*1000:.3f}")

print("\n\n===== MATERIALS =====")
for m in bpy.data.materials:
    print(m.name)

print("\n\n===== IMAGES / TEXTURES =====")
for img in bpy.data.images:
    print(img.name, img.filepath, img.size[:])
