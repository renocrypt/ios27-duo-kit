# iPhone Duo geometry pass: measured sections, corners, hinge, and materials

September 23, 2026. This pass replaced the estimated body geometry. The old model clipped, and its hinge was wrong. The new geometry is measured from Apple's AR Quick Look model and rebuilt with reusable tools. The numbers are in `app/src/device/spec.ts`, where every value is tagged `[M]` (measured), `[D]` (derived), or `[C]` (our choice). The measuring scripts are in `app/tools/usd/`.

## Method

- Apple's USDZ has two variant sets: Pose (Closed, Landscape) and Color (Star_White, Night_Sky). We cut it with planes and chained the cut segments into polylines (`usd_chain.py`). We simplified the polylines to 0.004 mm and expressed them in our device frame.
- We fitted every plan outline with superellipse corners, `(1 − u/ax)^n + (1 − v/ay)^n = 1` in the corner box (`fit_corners.py`). The rms error is 0.01 mm or less.
- We located holes and openings from the frame mesh's boundary loops (`usd_holes.py`).
- We read material values from each mesh's UsdPreviewSurface inputs (`usd_inventory.py`).
- We verify the result against the model in two ways:
  - silhouette masks in eight views (`/labs/compare.html`, `window.compare.metrics()`);
  - a 2D collision sweep of the hinge over every fold angle (`node tools/check-hinge.ts` in `app/`).

## Findings

**One master outline.** The leaf's plan outline at mid-thickness has two kinds of corner:

| Corner | ax × ay | n |
| --- | --- | --- |
| Free corners | 14.36 × 14.36 | 2.38 |
| Hinge corners | 0.95 × 0.89 | 2.21 |

A circle-equivalent radius of 12.4 at 45°, the value we estimated earlier, was right only at that one point. The plan outline begins curving 14.4 mm from the corner.

Every inner outline is an offset of this master: the back plates (inset 1.332), the display rim (0.73 to 2.98), and both active areas (3.455 and 2.72). Display corners are superellipses too:

| Display corner | ax | n | Equivalent |
| --- | --- | --- | --- |
| Inner | 11.105 | 2.58 | the UI's 55 pt corner |
| Outer, free side | 11.785 | 2.52 | 59 pt |
| Outer, hinge side | 1.57 | 2.43 | 8 pt |

**Wall section.** The free, top, and bottom walls share one section. It is almost flat through the middle 3 mm, then rolls in hard at both faces.

- At the front, the titanium ends in a small bead 0.21 mm below the display plane, inset 0.63.
- At the back, it ends in a flat lip at −5.101, inset 1.14 to 1.28.
- The glass sits 0.05 mm inside the lip. Its edge rolls 0.086 mm toward the front over its last 1.6 mm, a 2.5D edge.

The old model's circular-arc wall, 0.55 mm sagitta, and chamfers were wrong in shape.

**Display rim.** A black rim surrounds the inner display and stands 0.264 mm above it. The pivot height is 0.27 mm, so the two rims almost touch when the device is closed: this is what sets the 0.54 mm display gap. The rim ends 0.5 mm from the hinge line. Across the fold zone (±11.885 mm) its inner part is a separate flexible strip that folds with the display.

**Hinge end of each leaf.**
- **Lip.** A rounded metal lip, 0.907 wide and 1.27 tall, runs along the back of the hinge edge.
- **Pocket.** Above the lip is an open pocket, 5.72 mm deep, with its lip top at −3.966. The top and bottom walls, 1.054 mm thick, close it.
- **End faces.** The frame's end faces at the hinge are flat, with a roughly 0.8 mm roll into the front and back.

**Hinge cover (spine).** A rigid U channel:

| Dimension | Value |
| --- | --- |
| Width | 8.224 |
| Depth | 2.894 |
| Bottom edge radius | 2.1 |
| End curl radius | 1.9 |
| End inset from the top and bottom edges | 1.186 |

It stays level and rises toward the axis as the leaves close. Its bottom moves from −3.892 (open) to −2.32 (closed) relative to the axis. Apple ships only two poses, so the path between them is ours: `bottom = open + (closed − open) · sin(leafAngle)`. The collision sweep confirms this path clears the lips at every angle.

**Camera plateau.**
- **Top.** A flat window 55.792 × 21.152. Each end is one continuous curve (corner 12.2 × 10.576, n 2.2). It rises 3.64 above the back.
- **Open flank.** Toward the hinge and the bottom, the flank falls from the top edge over 7.9 mm.
- **Short flank.** On the top and free sides it has only 3.4 mm before the glass edge, so it is steeper and has no foot. Both flank sections are in the spec.

**Controls and openings.** All buttons are stadiums centred at z = −2.566, sitting in openings 0.05 mm larger all round.

| Part | Size (length × height) | Protrudes |
| --- | --- | --- |
| Touch ID side button | 18.71 × 3.06 | 0.455 |
| Camera Control | 17.13 × 2.534 | 0.079 |
| Volume buttons | 10.91 × 2.35 | 0.449 |

Openings:
- **Outer-display leaf, bottom:** USB-C 8.43 × 2.5, between two 1.6 mm pentalobe screws.
- **Outer-display leaf, top:** six 1.355 mm holes at a 2.6626 mm pitch.
- **Camera leaf, bottom:** two rows of four 1.355 mm speaker holes at a 2.2615 mm pitch, and two screws.
- **Antenna bands:** 1.253 mm wide. They sit where the free corners begin, 14.83 mm from each edge, plus two on the bottom edge and one near the hinge on the top edge.

**Materials (Apple's PBR values).**
- **Frame and volume buttons:** metallic 1, roughness 0.05 (mirror-polished). Base colour linear (0.89, 0.851, 0.783) for Star White, (0.05, 0.071, 0.1) for Night Sky.
- **Hinge cover:** metallic, with a textured roughness.
- **Rim:** near-black dielectric.
- **Antenna bands:** a coated polymer (clearcoat 0.6).
- **Back glass:** matte. Star White is (1.0, 0.98, 0.94), metallic 0. Night Sky is (0.012, 0.036, 0.06) with metallic 0.2 and clearcoat 1.
- **Button faces:** Touch ID and Camera Control have a matte metal face under sapphire.

All finish colours are in `app/tokens/device.tokens.json`.

## Verification

| Check | Before | After |
| --- | --- | --- |
| Silhouette IoU, Landscape (front, back, top, side) | 0.9975, 0.9975, 0.941, 0.934 | 0.9999, 0.9999, 0.9982, 0.999 |
| Silhouette IoU, Closed (front, back, top, side) | 0.987, 0.987, 0.927, 0.961 | 0.9993, 0.9993, 0.998, 0.9999 |
| Closed bounds, spine side | 5.23 mm (ours) vs 2.05 (Apple) | 2.05 vs 2.05 |
| Hinge collision sweep, 0° to 180° in 0.25° steps | not checked (visible clipping) | no overlap; tightest pair is spine against lip, 0.111 mm at 12.8° |

## Display fold (elastica)

The fold zone's shape is now solved from first principles (`app/tools/fold-elastica.ts`). The display is treated as an inextensible elastic strip that minimises its bending energy over the 23.77 mm fold zone, with these conditions:

- It is clamped tangent to both leaves.
- It is symmetric about the hinge plane.
- It is kept out of the chassis: it may sink at most 0.2 mm below the display plane beyond the pocket, and down to the pocket's lip less 0.35 mm over it.

The solver works in angle space with L-BFGS, an augmented Lagrangian for the axis condition, and an escalating penalty for the chassis. It solves each whole degree from open to closed, warm-starting each solve from the last, and writes `app/src/device/foldTable.json`; `fold.ts` interpolates between degrees.

Results:
- **Open:** straight.
- **Partly folded:** a smooth hammock that rounds the corner above the leaves. Its lowest point sits 0.5 mm above the display plane at 120° and 0.7 mm at 90°.
- **Closed:** a teardrop sitting in the pockets. The bulb tip is 0.96 mm above the axis (Apple's model: 1.28) and the bulb is about 3.1 mm wide (Apple's: about 2.5).

At every angle, the axis residual is below 1e-7 mm and no chassis constraint is violated. A closer match would need Apple's support-plate geometry, which the AR model does not show.

## Rim and fold-zone details (second pass)

- **Rims meet exactly.** The rim's top rises to the axis height (0.27, from 0.264 measured), so closed, the twin rims touch along the top, bottom, and free edges and no gap line shows between the leaves.
- **Flexible rim wall.** Across the fold zone the flexible rim has an outer wall down to 1.31 mm below the display (`bumper.flexWallZ`). Without it, the view past the rigid rim's end showed the hinge cover; `npm run hinge` now also sweeps this wall against the pocket lip (min clearance 1.486).
- **Looking into the fold.** The rigid rim's top at the flexible split (0.207) leaves a 0.13 mm slot between the leaves near the hinge. Through it, an environment map lights the display's bulb as if it were in open air. The display material therefore traces each reflection through the space between the leaves (`screen.ts`, "Facing halves"), and closed, the slot shows black, as it does on a real device.

## Open items

- **Textured surfaces.** Apple's model uses texture maps for the roughness of the rim, hinge cover, and back glass. We use constant values (`[C]`).
- **Plateau glass.** Apple's plateau top is a clear window over the plateau body. We render the top opaque in the back material.
