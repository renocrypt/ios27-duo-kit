# USD measurement tools

Scripts that measure Apple's iPhone Duo AR Quick Look model. The model itself never enters this folder: it stays in `/tmp/duo/device-research/references/` (override with `DUO_USDZ=/path/to/model.usdz`). Only the numbers these scripts print are recorded in the project, in `app/src/device/spec.ts` and `docs/research/2026-09-23-device-geometry-pass.md`.

Run with `uv run -q --python 3.12 --with usd-core [--with pillow] python <script> ...` (usd-core has no wheel for Python 3.13 yet).

| Script | What it measures |
| --- | --- |
| `usd_variants.py` | The model's variant sets, and the bounds of each Pose |
| `usd_measure.py` | The device's size in each Pose, from mesh points (the file has no authored extents) |
| `usd_parts.py` | Per-mesh bounds in the flat Landscape pose: the body slab against what protrudes (the camera plateau) |
| `usd_layout.py` | The outer display, the camera plateau, and the body slabs in both poses |
| `usd_closed.py` | Whether the Closed pose is flush: the angle between the two leaves and their stacked depth |
| `usd_inventory.py` | Every visible mesh: bounding box (mm, display surface at z = 2.49), vertex count, bound material and its constant PBR inputs. `COLOR=Night_Sky` for the other finish |
| `usd_materials.py NAME...` | Material inputs of the named meshes |
| `usd_atlas.py POSE AXIS VALUE U0 U1 V0 V1 [px/mm]` | Cuts the model with a plane and draws the section to a PNG with a mm grid (`atlas.sh NAME ...` names the output) |
| `usd_chain.py POSE AXIS VALUE U0 U1 V0 V1 TOL MESH...` | The same cut, chained into polylines and simplified (RDP), printed in our device frame (z − 2.49). The source of every section in the spec |
| `usd_boundary.py MESH...` | Boundary loops of planar meshes (display outlines), for corner fits |
| `usd_holes.py MESH...` | Small boundary loops of the frame: every hole and opening, with centre and size |
| `usd_profiles.py` | Dense wall profiles (inset against height) of the free and top edges |
| `fit_corners.py` | Fits superellipse corners to outline points: `ax`, `ay`, `n`, and the error. Run, it fits the frame, glass, and plateau corners; `from fit_corners import fit` for other outlines |
| `fit_display_corners.py` | The display areas' corners and the bumper's (outlines from `usd_boundary.py`): the source of `spec.ts`'s `inner.corner` and `outer.corners`. Plain Python |
| `usd_to_glb.py` | Exports both poses to GLB in `/tmp/duo/reference/` for the compare tool (`/labs/compare.html`, dev server only) |

Apple's frame: x across the fold (hinge at x = 0), y from the bottom edge (0) to the top edge (117.95), z out of the inner display (display surface 2.49, back −2.74). Our device frame shifts y by −58.975 and z by −2.49.
