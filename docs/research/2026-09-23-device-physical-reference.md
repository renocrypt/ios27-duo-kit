# iPhone Duo physical reference: body, hinge, cameras, controls, materials, and colors

Checked: September 23, 2026. Scope: the physical device beyond what the [geometry and mockups note](2026-09-23-device-geometry-and-mockups.md) already covers — Apple's Accessory Design Guidelines, Apple's AR Quick Look USDZ model (measured directly), rear camera count/arrangement, control positions, hinge and spine, body corner radii and edge profile, materials, finishes, and colors, official reference images, hands-on reports, and third-party cross-checks. Does not repeat display point sizes, corner radii of the *displays*, safe areas, or poses — see the companion note for those. Does not cover Three.js/Anime.js rendering technique — see the [3D approach note](2026-09-23-device-3d-approach.md). Evidence tiers: **A** Apple official · **F** firsthand report · **D** third-party/community. Full machine-readable values are in [`duo-device-spec.json`](2026-09-23-device-physical-reference/duo-device-spec.json); downloaded references and their licenses are listed in [`SOURCES.md`](2026-09-23-device-physical-reference/SOURCES.md) (the files themselves stay in `/tmp/duo/device-research/references/`, per project rules).

> **Superseded in part (September 23, 2026):** the [geometry pass](2026-09-23-device-geometry-pass.md) measured the body sections, corners, hinge, rim, plateau, controls, and PBR materials directly from the USDZ. Where the two notes differ, the geometry pass and `app/src/device/spec.ts` are current.

## Short answer

- **Apple's Accessory Design Guidelines do not cover Duo yet.** The current edition (Release R31, dated 2026-09-21, 404 pages) has no iPhone Duo chapter, no foldable case-testing matrix, and no per-device Duo dimensional-drawing PDF, even though it postdates the September 9 announcement [A]. Case makers have nothing official to build from yet.
- **Apple's own AR Quick Look USDZ model is real, detailed, and measurable.** `iPhone_Duo_e-sim_Star-White_Variant.usdz`, linked from apple.com/iphone-duo/, imports cleanly into Blender and contains ~74 mesh parts with real materials and ~40 textures. Its node names are randomized (no semantic labels). It carries two variant sets: **Pose** {`Closed`, `Landscape`} and **Color** {`Night_Sky`, `Star_White`}. The flat `Landscape` pose is true to scale: each leaf measures 82.45 × 117.95 mm, against the published 164.6 × 117.8 mm open size. So the file gives the camera bump, button positions, and display borders directly (see the [reviewer pass](#reviewer-pass-usdz-variants)). The plan-view footprint and several part positions were cross-validated exactly against an independent community re-measurement of the same file (byte-identical, confirmed by SHA-256) [A].
- **Two rear cameras, not three.** Apple's "2x Telephoto" is a digital crop of the 48MP Fusion Main sensor, not a third lens; the USDZ geometry confirms exactly two lens-sized mesh clusters, spaced 17.77 mm apart, each a 16.25 mm-diameter ring [A].
- **Frame is grade 5 titanium, mirror-polished; hinge cover is titanium with a micro-blasted finish; back is Ceramic Shield, front (outer display) is Ceramic Shield 2.** Colors are Night Sky (`#394452`) and Star White (`#f7f6f5`), both read directly from Apple's own product-page CSS and cross-checked by sampling official photos [A].
- **Hands-on reports agree the hinge closes flat with a barely-there gap and a subtle but present crease**, visible mainly at an angle or under direct light [F].

## 1. Apple's Accessory Design Guidelines

| Question | Finding | Source | Tier | Confidence |
| --- | --- | --- | --- | --- |
| Does the current edition include Duo? | No. Release R31 (2026-09-21) has no "Duo", "foldable", or "hinge" hits anywhere in its 404 pages (checked by full-text search of the extracted PDF text) | developer.apple.com/accessories/Accessory-Design-Guidelines.pdf | A | High |
| Is there a per-device Duo dimensional-drawing PDF? | No. `developer.apple.com/accessories/dimensional-drawings/` lists PDFs through iPhone 18 Pro Max, 18 Pro, and iPhone Air; no Duo file exists | Same page's link list | A | High |
| Case-testing device list (§5.10.1) | Covers iPhone 18 Pro Max down through iPhone 16 Plus and earlier; no Duo entry | Guidelines PDF §5.10.1 | A | High |
| Button/camera/hinge/gap/inset drawings for Duo | None exist in this document | — | A | High |

**Implication:** there is no official case-maker dimensional drawing to trace. The best geometric ground truth for the 3D model is Apple's own AR USDZ (below) plus the specs-page dimensions already in the companion note.

## 2. Apple's AR Quick Look model

Confirmed present at `apple.com/iphone-duo/` ("View in your space"). The file name says Star White, but the file itself also contains a `Night_Sky` color variant (reviewer pass). Downloaded to `/tmp/duo/device-research/references/` (SHA-256 `5cab2ea63…8b2`, 8,107,136 bytes) and imported with `bpy.ops.wm.usd_import` in Blender 5.2 (headless; the sandbox's Metal probe crashes headless Blender before Python runs — this run required `dangerouslyDisableSandbox`, confirmed as a sandbox-caused crash, not a model problem).

| Check | Result | Confidence |
| --- | --- | --- |
| Scale vs. published specs | Excluding a low-poly invisible bounding proxy (24 verts, clearly an AR interaction/shadow volume, not device geometry), the visible shell's plan-view footprint is 85.22 × 118.40 mm, vs. the published closed 84.1 × 117.8 mm — within ~1 mm | Medium |
| Pose | **Corrected in reviewer pass.** The default `Closed` variant is flush closed: its two leaves are parallel with a 0.94 mm gap, a stack of 11.0 mm. Its 16.73 mm depth is that stack plus the 5.73 mm camera bump. It is not cracked open. A second variant, `Landscape`, is flat open | High |
| Node/part names | All 74 mesh objects and their parent empties have randomized names (e.g. `JnJdTkxbQgUtLwU`, `MvKPXGSdYDVvSpk`); no semantic labels ship with the file. Part identity below is inferred from size, position, and shared material, not read from a label | — |
| Independent cross-check | [agarwalmukul/iPhoneDuo](https://github.com/agarwalmukul/iPhoneDuo) archived the identical file (same SHA-256) and separately measured lens spacing (17.77 mm), lens-ring diameter (16.25 mm), and per-leaf chassis footprint (82.45 × 117.95 mm) — all three match this session's independent Blender measurements exactly | High (for the match itself) |

**Method:** two Python scripts run inside Blender computed world-space vertex bounding boxes per mesh (accounting for the full parent transform chain, not just each object's own transform) and, for a second pass, per-face area-weighted normals to locate flat shell surfaces. Scripts and full text output are kept in [the evidence folder](2026-09-23-device-physical-reference/) for reproducibility, with the usd-core inventories of both finishes.

## 3. Cameras

| Item | Value | Source | Tier | Confidence |
| --- | --- | --- | --- | --- |
| Rear camera count | 2 (48MP Fusion Main with an integrated optical-quality 2x crop, plus 48MP Fusion Ultra Wide) | Apple newsroom text; corroborated by exactly two lens-sized mesh clusters in the USDZ | A | High |
| Arrangement | Side-by-side horizontal pair, on the back of the half **opposite** the outer display (the right half in the open view), near the top edge and the free edge. Corrected in reviewer pass: the USDZ puts the outer display on the back of the left half and the camera plateau on the back of the right half | Official photo `highlights_camera_2x.jpg`; USDZ `Landscape` variant | A | High |
| Lens spacing (center to center) | 17.77 mm | USDZ (own measurement), exact match to agarwalmukul/iPhoneDuo | A | High |
| Lens ring outer diameter | 16.25 mm | USDZ (own measurement), exact match to agarwalmukul/iPhoneDuo | A | High |
| Position from top/free edges | Lens centers 15.29 mm from the top edge; 15.29 mm and 33.06 mm from the free edge (reviewer pass, flat `Landscape` variant). This replaces an earlier low-confidence estimate of about 15 mm and 25 mm | USDZ (measured) | A | High |
| Flash | One small (~6 mm) circular element, up and right of the lens pair | Official photo; a matching small mesh cluster in the USDZ | A | Medium |
| Camera bump housing | Single rounded-rectangle/pill chrome-rimmed plate enclosing both lenses and the flash | Official photos (`highlights_camera_2x.jpg`, `newsroom_colors_2x.jpg`) | A | High. Reviewer pass: the plateau is 55.78 × 21.15 mm and 3.65 mm high; the lens rings reach 5.55 mm |
| Front camera, outer display | Visible circular cutout, top-right corner | Official photo `newsroom_opening_action_2x.jpg` | A | High |
| Front camera, inner display | Hidden under-display FaceTime camera, invisible when off | Apple newsroom | A | High |

## 4. Controls and ports

Apple's own specs-page diagram (`specs_external_connectors_2x.jpg`) carries no visible numeric labels at readable resolution, but its HTML `aria-label` is an exact Apple-authored caption, quoted in full here:

> "iPhone Duo in three angles. iPhone Duo, unfolded, interior display, external features: built-in stereo speaker, built-in microphone, volume up and down, Side button, and Camera Control. iPhone Duo, bottom exterior, folded: USB-C connector, built-in microphones, built-in stereo speaker. iPhone Duo, top exterior, folded: built-in stereo speaker, volume up and down." — apple.com/iphone-duo/specs/ [A]

| Control | Position | Source | Tier | Confidence |
| --- | --- | --- | --- | --- |
| Side button (Touch ID) | Free (right) edge, upper-middle third, above Camera Control | Newsroom text + specs aria-label + official photos | A | High for edge, low for exact offset |
| Camera Control | Free (right) edge, below the side button | Same | A | High for edge, low for exact offset |
| Volume up/down | Top edge when folded, toward one side | Specs aria-label | A | High for edge, unpublished exact spacing |
| USB-C | Bottom edge when folded, centered between two microphone holes | Specs aria-label + diagram | A | High |
| Speakers | Grille perforations on both top and bottom folded edges (stereo) | Specs aria-label | A | High |
| Microphones | Bottom folded edge (visible holes); also called out on the open interior view | Specs aria-label | A | High |
| Face ID | Absent — Touch ID only, via the side button | Absence across all Apple Duo materials checked | A | High |
| Apple Pencil | USB-C Pencil support on either display, arriving later in the year (not at launch); implies no dedicated garage or magnetic bay | Apple newsroom | A | High |
| SIM tray | Not identified in any source opened this session | — | — | Unknown |

## 5. Hinge and spine

| Item | Finding | Source | Tier | Confidence |
| --- | --- | --- | --- | --- |
| Component count | ">100 components" | Apple newsroom | A | High |
| Closure | Integrated magnet array | Apple newsroom | A | High |
| Flat when open | Yes — "supports the center of the display to hold it flat when opened" | Apple newsroom | A | High |
| Hinge cover finish | 3D-printed titanium, micro-blasted, deliberately contrasting with the mirror-polished body | Apple newsroom | A | High |
| Internal reinforcement | Support ribs for stiffness; antenna splits with ceramic fiber inserts | Apple newsroom | A | High |
| Fold-cycle rating | Not published (unlike Samsung's stated 500,000-fold rating for the Z Fold8, noted by contrast in one hands-on) | androidheadlines.com hands-on | F | Medium |
| Gap when closed | Near-zero; "closes nearly flat" with a "barely-there gap," described as tighter than competing foldables | Multiple Sept 2026 hands-on reports (HardwareZone Singapore and others) | F | Medium |
| Hinge feel | Reviewers converge on "tight," "well-damped," "best hinge on the market"; Apple's hardware VP described tuning the torque profile to feel "like a high-end automobile's car door" | 9to5Mac (VP interview), Dave2D (via pasqualepillitteri.it), Mark Ellis Reviews | F | Medium-high (consistent across independent outlets) |
| Crease visibility | Present but subtle straight-on; visible at an angle or under direct light. One outlet rated it comparable to the Galaxy Z Fold 8/8 Ultra; most rated it better hidden, crediting the nano-texture inner display | MacRumors, HardwareZone Singapore, 9to5google, Mark Ellis Reviews | F | Medium |
| Hinge axis position (own measurement) | A hinge-barrel-shaped mesh sits at x ≈ −42 mm from the model's center — almost exactly half the published closed width (84.1⁄2 = 42.05 mm) — running nearly the full 117.8 mm height | USDZ (own measurement) | A | Medium |
| Edge/spine cross-section | Bright flat chamfer facets on each half meet a black polymer wedge insert at the fold peak (visible reveal line, not a fully seamless join) | Official photo `newsroom_hinge_closeup_2x.jpg` | A | High (visual read; no numeric profile published) |

## 6. Body

| Item | Finding | Source | Tier | Confidence |
| --- | --- | --- | --- | --- |
| Closed / open dimensions, weight | Already published and carried in the JSON spec for convenience: closed 84.1 × 117.8 × 11.3 mm, open 164.6 × 117.8 × 5.2 mm, 254 g | apple.com/iphone-duo/specs/ | A | High |
| Plan-view footprint (measured) | 85.22 × 118.40 mm, matching the closed spec within ~1 mm | USDZ (own measurement) | A | Medium |
| Corner radii, plan view | Not published. Derived in the reviewer pass as about 12.55 mm on the free side, from display radius plus border. Not confidently isolated from the USDZ mesh. Official photos show a generous, uniform radius, visually similar in proportion to recent iPhone frames scaled to this footprint | Official photos (own visual read) | A | Low (visual estimate only) |
| Edge profile | Flat chamfer band on the top face transitioning into a rounded side wall, matching Apple's recent titanium-frame language | Official photos | A | Medium |
| Per-leaf chassis footprint (measured) | 82.45 × 117.95 mm (a single leaf's own shell mesh, not simply half the device) | USDZ (own measurement), exact match to agarwalmukul/iPhoneDuo | A | Medium |
| Per-half thickness split of the 11.3 mm closed depth | Equal: each chassis leaf is 5.03 mm, with a 0.94 mm gap between them when closed (reviewer pass, USDZ `Closed` variant) | USDZ (measured) | A | High |
| Frame width around each display | Carried from the companion geometry note: ≈3.4 mm around the inner panel, derived from published panel size vs. body size | Derived (companion note) | A | Medium |

## 7. Materials, finishes, and colors

| Item | Value | Source | Tier | Confidence |
| --- | --- | --- | --- | --- |
| Frame | Grade 5 titanium, mirror-polished finish | Apple newsroom | A | High |
| Hinge cover | 3D-printed titanium, micro-blasted (contrasting) finish | Apple newsroom | A | High |
| Back panel | Ceramic Shield | Apple newsroom + specs page | A | High |
| Outer display cover | Ceramic Shield 2, "3x better scratch resistance than the previous generation" | Apple newsroom + specs page | A | High |
| Inner display cover | Custom nano-textured polymer over high-strength glass, plus a separate scratch-resistant coating; high-strength glass above/below the flexible panel; titanium plate at the bottom | Apple newsroom | A | High |
| Water/dust resistance | IP68, 6 m up to 30 minutes, IEC 60529 | apple.com/iphone-duo/specs/ | A | High |
| Colors (names) | Night Sky, Star White | apple.com/iphone-duo/specs/ | A | High |
| Night Sky hex | `#394452` (UI swatch); photo-sampled median range `#3c444f`–`#4d5560` | Apple product-page CSS; own pixel sampling of `newsroom_colors_2x.jpg` | A | High (swatch) / Medium (photo cross-check) |
| Star White hex | `#f7f6f5` (UI swatch); photo-sampled median range `#f0efed`–`#f6f6f4` | Same | A | High / Medium |
| Frame finish behavior | Mirror-polished titanium is highly specular; its apparent color shifts with reflected environment, so no single hex represents it well — model as a reflective metal material, not a flat color | Own observation of official photography | A | High |

**Color-sampling method:** median of 20×20 px patches at 3–4 flat, non-specular, non-logo points on each colorway's back panel in `newsroom_colors_2x.jpg` (1960×1102 px), using Python/Pillow. One outlier point per colorway (in a deep shadow near the edge) was excluded as unrepresentative; the remaining values bracket Apple's own CSS swatch value closely, cross-validating it.

## 8. Reference images downloaded

23 files (Apple official photos, spec diagrams, HIG diagrams, and the USDZ/PDF) are in `/tmp/duo/device-research/references/`, manifested in [`SOURCES.md`](2026-09-23-device-physical-reference/SOURCES.md) with URL, contents, and license notes for each. Highlights: `highlights_camera_2x.jpg` (clearest camera shot), `newsroom_hinge_closeup_2x.jpg` (spine cross-section), `newsroom_opening_action_2x.jpg` (asymmetric closed-corner radii, outer camera cutout), `newsroom_colors_2x.jpg` (both colorways), `specs_external_connectors_2x.jpg` + its aria-label (control positions), `specs_dimensions_open/closed_2x.jpg` + aria-labels (restating the published dimensions).

## 9. Third-party cross-checks

| Source | Value | Assessment | Tier |
| --- | --- | --- | --- |
| [agarwalmukul/iPhoneDuo](https://github.com/agarwalmukul/iPhoneDuo) | Independent re-measurement of the identical (SHA-256-verified) Apple USDZ; lens spacing, lens diameter, and per-leaf footprint all match this session's own measurements exactly | High for the numbers that re-measure Apple's own asset; their animated pose is their own invention | D |
| [chuspeeism/iphone-duo](https://github.com/chuspeeism/iphone-duo) | Notes its asset-prep script "selects the model's Landscape pose" from the same USDZ — implying the file may expose more than one named pose/variant | Not independently verified this session; flagged as an open question below | D |
| Pikkme Studios "iPhone Duo 3D Model" (Sketchfab, published Sept 10, 2026) | From-scratch recreation | Too soon after announcement to be more than a marketing-photo likeness; not used for any number here | D |
| MakerWorld dimensional mockups | 3D-print reference models | Self-described by their own creators as visualization-only, not for precision-fit use | D |
| Pre-announcement case-mold leaks (TrendForce, May 2026) | Reported (per search summary) to have tracked the final announced dimensions closely | General evidence that case-maker CAD leaks are usually reliable for gross dimensions; no specific number from these leaks is used here | D |

## Modeling implications

1. **Use the specs-page numbers for overall body dimensions, and the USDZ `Landscape` variant for everything else.** That includes part layout, thickness, the camera bump, the display borders, and button positions. The variant is flat and true to scale within 0.3 mm (reviewer pass).
2. **Model the frame as a real mirror-finish metal** (high metalness, low roughness, environment reflection), not a flat color. Corrected in the reviewer pass: the frame color follows the finish. Night Sky has a dark blue frame; Star White has a silver one.
3. **Camera module is a two-lens horizontal pair on a single pill-shaped bump**, 17.77 mm center-to-center, 16.25 mm lens rings, with a small flash up-and-right of the pair — build this once and mirror/reuse rather than guessing a triple-camera layout.
4. **Hinge spine should show a visible seam**, not a seamless wrap: a metal chamfer on each half meeting a dark polymer insert at the peak, per the official closeup photo. Model the closed gap as very tight but not literally zero.
5. **Controls sit on three edges**: side button + Camera Control on the free edge; volume up/down on the top edge (folded); USB-C + mics on the bottom edge (folded); stereo speakers on top and bottom. Exact offsets along each edge are Apple's unpublished numbers — use the companion geometry note's simulator-derived button order as the best secondary estimate, and label any specific pixel offset as an assumption.
6. **Corner radii in plan view remain a visual-match choice**, not a sourced number — pick one deliberately and record it as a token, the same way the companion note treats display corner radii.
7. **No case-maker CAD exists yet to cross-check against** — Apple's Accessory Design Guidelines have not been updated for Duo as of this check.

## Reviewer pass: USDZ variants

Checked September 23 with `usd-core`, run through `uv` with Python 3.12, reading the file's variant sets directly. The scripts are `usd_variants.py`, `usd_measure.py`, `usd_parts.py`, `usd_layout.py`, and `usd_closed.py`, in `app/tools/usd/`. The measurements below have been added to `duo-device-spec.json`.

Coordinates for the flat `Landscape` pose: the hinge line is at x = 0 and the bottom edge at y = 0. The camera leaf is x > 0 and the outer-display leaf is x < 0. Part identities are inferred from size, position, and material.

| Item | Measurement | Confidence |
| --- | --- | --- |
| Variant sets | Pose {`Closed`, `Landscape`}; Color {`Night_Sky`, `Star_White`} | High |
| Scale | Leaves 2 × 82.45 × 117.95 mm against the spec's 164.6 × 117.8 mm open size; the whole model is 165.36 × 118.40 mm including button protrusions | High |
| Half thickness | Each chassis leaf is 5.03 mm. The leaf plus the inner display surface is 5.23 mm, against the spec's 5.2 mm | High |
| Closed stack | Two parallel leaves with a 0.94 mm gap, 11.0 mm in total, against the spec's 11.3 mm. The folded inner display bulges into the hinge region (±1.23 mm) | Medium |
| Outer display | 77.39 × 112.51 mm, on the back of the **left** half. Borders: 2.34 mm on the hinge side, 2.72 mm on the free side, top, and bottom | High |
| Inner display | 157.99 × 111.03 mm, centered, with a uniform 3.46 mm border | High |
| Camera plateau | 55.78 × 21.15 mm on the back of the **right** half: 4.94 mm from the free edge, 4.71 mm from the top edge. It stands 3.65 mm above the back; the lens rings reach 5.55 mm and the highest point 5.73 mm | High |
| Lens centers | 15.29 mm from the top edge. One lens center is 15.29 mm from the free edge, the other 33.06 mm | High |
| Side button (Touch ID) | Free edge of the camera leaf, 18.71 mm long, starting 33.61 mm from the top edge; protrudes 0.45 mm | High |
| Camera Control | Free edge of the camera leaf, 17.13 mm long, starting 24.23 mm from the bottom edge; nearly flush (0.08 mm) | High |
| Volume buttons | Top edge of the camera leaf, two buttons 10.91 mm long with a 2.51 mm gap, starting 20.90 mm from the free edge; protrude 0.45 mm | High |
| USB-C | Bottom edge of the outer-display leaf, centered 41.02 mm from the hinge edge | Medium |
| Outer-display camera | Centre 10.65 mm from the leaf's free edge and 10.65 mm from its top edge. The black cutout is 6.11 mm across and the lens aperture 3.22 mm. This replaces the geometry note's estimate from the HIG diagram (about 6 mm from the display edges) | High |
| Frame color by finish | Apple's colour photo (`newsroom_colors_2x.jpg`) shows a dark blue frame and hinge cover on Night Sky and silver titanium on Star White. The frame color follows the finish; it is not shared | High (visual) |
| Hinge | A core 8.22 mm wide on the fold line, and a 23.77 mm band under the display in the fold zone | Medium (identity inferred) |
| Body corner radius, plan view (derived) | About 12.55 mm on the free side; about 3.67 mm at the hinge side of the closed device. Each is a display corner radius, converted at 6.02 pt/mm, plus the measured border. The outer display gives 9.80 + 2.72 = 12.52 mm and the inner display gives 9.14 + 3.46 = 12.60 mm; the two agree, which supports concentric corners | Medium (derived) |

The physical-continuity question in the [hub concept brief](../hub.md) is now answered geometrically. The outer display sits on the back of the left half, so opening the device brings the outer display's half to the **left** pane.

## Open questions and limits

- **USDZ variants: resolved in the reviewer pass above.** The file has a flat `Landscape` pose and a flush `Closed` pose. Blender's default import showed only `Closed`.
- **Camera bump footprint, protrusion, and control offsets: resolved** from Apple's own model (see above). They are not published as numbers anywhere else, so they are only as accurate as Apple's AR asset.
- **Plan-view body corner radius** has no published number. The reviewer pass derives about 12.55 mm on the free side from the concentric display radii. Confirm it against the USDZ mesh outline before relying on it.
- **SIM tray presence/absence** was not confirmed in any source opened this session.
- **Fold-cycle durability rating** is not published by Apple.
- **No teardown exists yet** — iPhone Duo ships October 23, 2026; all firsthand evidence here is from pre-launch hands-on demo events (roughly September 9–18, 2026), not from disassembly.
