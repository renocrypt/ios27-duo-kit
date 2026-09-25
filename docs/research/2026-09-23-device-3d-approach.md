# Building a realistic, foldable, animatable iPhone Duo in Three.js and Anime.js

Checked: September 23, 2026. Scope: modeling pipeline, the flexible-display bend, live hub UI on the two canvases, materials and lighting in Three.js r186, Anime.js 4.5's Three.js adapter (read from package source), hinge kinematics, tooling, and a brief reading of Apple's marketing license as it applies to 3D. Does not research device measurements; see the [geometry note](2026-09-23-device-geometry-and-mockups.md) for those, cited here as needed. Evidence tiers: **V** official docs/source (I opened the file or the doc) · **F** firsthand/practitioner report · **D** opinion, forum, or secondhand. Scratch packages and notes are under `/tmp/duo/device-research/tech/`.

## Short answer

- **Modeling:** a parametric **Blender Python script → glTF** (Blender 5.2.1 LTS is installed), with named nodes per part (`OuterHalf`, `InnerHalf`, `Hinge`, buttons, cameras), driven by constants the geometry team can update. Keep only the screens as separate live Three.js meshes.
- **Flexible display:** a **skinned mesh with bones along the hinge band**, exported from the same Blender rig. UVs stay continuous by construction because skinning moves vertices, not UVs, and the mesh is not cut at the fold.
- **Live UI:** **CanvasTexture**, drawing each screen's DOM into an offscreen canvas and uploading it as a texture on the bent screen mesh. CSS3DRenderer cannot bend, and HTML-in-Canvas is Chrome-only and flag-gated. Duo has no browser target yet, so an all-Chrome bet is a real risk here — flag it.
- **Renderer:** `WebGLRenderer` for the concept; `WebGPURenderer` + TSL is source-verified and real in r186 but adds an extra fallback path Duo doesn't need yet. `MeshPhysicalMaterial` for glass and metal, with `anisotropy` on the metal frame. `RoomEnvironment` via `PMREMGenerator` for lighting. `NeutralToneMapping` for a product-accurate look (AgX is more filmic, for a scene, not a product shot).
- **Anime.js:** import `animejs/adapters/three` once as a side effect, drive the hinge via bone rotation (already a supported `Object3D` property) and materials via the same timeline, and set `engine.useDefaultMainLoop = false` so a single Three.js `requestAnimationFrame` loop calls both `engine.update()` and `renderer.render()`.
- **Tooling:** **npm + Vite**, matching `design/site`, not a CDN import map. A concept needs TypeScript, `@types/three`, and fast HMR across `.ts`/`.glsl`/`.glb` more than it needs zero build step.
- **Licensing:** Apple's own bezels may not be rendered in 3D, tilted, or animated in marketing; that reading is Apple's rule for its *own* asset files, not a ban on drawing your own device likeness. Treated as an interpretation below, not legal advice.

## 1. Modeling pipeline

| | Procedural Three.js geometry | Blender Python → glTF |
| --- | --- | --- |
| Fidelity | Hard to get bevels, the asymmetric "D" corners, camera cutouts, and the teardrop hinge cavity right by hand; `BufferGeometry` math for compound curvature is real work | Bevel, mirror, and boolean modifiers give production-grade curvature; booleans for the camera and Dynamic Island cutouts are native |
| Iteration speed | Fastest for the first version: no external tool, edits are live in the browser | A script re-run (`blender -b -P build_duo.py`) regenerates the whole asset in seconds, headless; no manual re-sculpting |
| File size | Near zero extra payload; geometry is defined in JS | Tens of KB to low MB depending on density and textures; Draco or Meshopt compression brings this down |
| Updates when measurements change | Every fillet, radius, and offset is separately coded; asymmetric radii (8 pt hinge-side vs. 59 pt free-side, per the geometry note) are easy to get subtly wrong in each spot they appear | Change one constant at the top of the script (`OUTER_CORNER_HINGE`, `OUTER_CORNER_FREE`, …), re-run, re-export; one source of truth |
| Boolean cutouts (camera, buttons) | No CSG in Three.js core; a third-party library such as `three-bvh-csg` is the common workaround [D, discourse.threejs.org] | Native (Boolean modifier) |
| Middle ground | `RoundedBoxGeometry`, an addon bundled with three.js (`three/addons/geometries/RoundedBoxGeometry.js`, confirmed in package source [V]), covers a simple uniform-radius rounded box but not Duo's asymmetric per-corner radii or cutouts | — |

**Recommendation:** Blender Python → glTF for the shell, hinge, buttons, and cameras, with named nodes so Three.js can address `scene.getObjectByName('Hinge')` etc. Keep the two screen meshes' *materials* driven live from Three.js (Section 3), even though their base geometry can also come from the same glTF export (see Section 2). This matches what a second, independent 3D study of Duo already did — Crosley's write-up mentions Three.js fold studies "built on Apple's 3D model" [D, blakecrosley.com, from the geometry note] — though ours must be an original model, since Apple's own 3D assets are outside the Design Resources license.

## 2. The flexible inner display across the fold

| Option | Continuous arbitrary angle? | Teardrop curvature? | UV continuity | Cost |
| --- | --- | --- | --- | --- |
| Two flat planes + a cylindrical segment | Only if the cylinder radius is re-computed per angle | Yes, if the segment's radius is shaped | Needs matching UVs at each seam, error-prone | Simple, but looks faceted unless segment count is high |
| Bend in the vertex shader (procedural, e.g. bend a plane around a runtime-computed radius) | Yes, driven by one uniform | Approximate; needs an eased profile function to avoid a sharp crease | Continuous automatically, since it's one unbroken mesh | Custom `ShaderMaterial` or `onBeforeCompile` patch; more code to keep in sync with lighting/PBR |
| Morph targets (blend shapes) | Only between the authored keyframe shapes; interpolation between them is linear per-vertex, not physically a hinge sweep | Only as good as the number of authored shapes | Continuous (topology doesn't change) | Needs one authored shape per named posture at minimum; in-between angles look "off-model" |
| **Skinned mesh with bones along the hinge band** (recommended) | Yes: interpolate bone rotation freely between 0° and 180° | Yes: use 3–5 bones across the band, not 2, with skin weights that blend smoothly rather than a hard split, so the arc rounds instead of creasing — this is the same "distance-based bending" technique used in a community cylinder-bend example [D, discourse.threejs.org] | Continuous by construction: skinning transforms vertex positions and normals, not UVs, and the mesh isn't split at the fold [D, discourse.threejs.org] | Authored once in the Blender rig (Section 1), reused for every posture; drives directly off `bone.rotation` |

**Recommendation:** skinned mesh with bones, generated from the same parametric Blender rig, exported as a glTF skin (`KHR` skinning is native to glTF). This is also the only option that plugs into Anime.js with zero custom adapter code: a `Bone` is a `THREE.Object3D` subclass, and the Three.js adapter's `Object3D` property set (`rotateX/Y/Z`, in degrees) already applies (verified in `object3d.js`, Section 5). The physically real "teardrop" cross-section — a foldable hinge holds the panel's bend radius above its damage limit rather than creasing it at a point — comes from patent literature on foldable hinges in general [D, USPTO filings via search, not Duo-specific]; Apple has not published Duo's radius, so treat the exact curve as our own placeholder, tuned by eye against the concept's screenshots.

## 3. Live hub UI on the screens

| | Text sharpness | Taps on the 3D screen | Performance | Copes with the bend | The two canvases (1398×2034, 2853×2007) |
| --- | --- | --- | --- | --- | --- |
| **CanvasTexture** | Sharp if you size the source canvas to the texel density you need and redraw on change, not every frame | Manual: raycast against the screen mesh, convert the UV hit to canvas pixel coordinates, dispatch a synthetic DOM event or drive your own hit-test table | Good: one GPU upload per UI change (`texture.needsUpdate = true`), not per frame | Works on any geometry, including the bent skinned mesh, since it's a plane's worth of UV space regardless of vertex position | Draw the real hub DOM to an offscreen canvas at 1:1 with these pixel sizes (or a scaled-down multiple) via `drawImage`/manual re-implementation, or by drawing an `<img>` snapshot of a live DOM render (see below) |
| **CSS3DRenderer** | Native DOM text, the sharpest option | Native, since it's real DOM | DOM layout/reflow cost per change; elements always draw on top of the WebGL canvas | **Does not work**: CSS3DObjects are flat planes only — "it's also not possible to use geometries" [D, three.js forum, via search] — so it cannot represent a bent screen | Would need one flat CSS3DObject per screen half, breaking at the exact fold |
| **HTML-in-Canvas (WICG proposal)** | Native DOM text, rasterized into canvas/texture space | Yes, in principle: the spec has `updateElementGeometry()` with a `preserveHitTestOrder` option, and a `paint` event to resync DOM and canvas [V, github.com/WICG/html-in-canvas README] | Unmeasured; too new for practitioner benchmarks | Draws into a 2D/WebGL/WebGPU surface, so in principle it could feed a bent mesh's texture the same way CanvasTexture does, but no example of this was found | Plausible, unverified |
| Other option: render the DOM to an image via a library (e.g. a DOM-to-canvas renderer), then treat that image like a CanvasTexture | Depends on the library's text rendering fidelity, typically softer than native | Manual, same as CanvasTexture | Extra per-frame or per-change render cost on top of the canvas upload | Same as CanvasTexture, since the output is still a 2D image | Same as CanvasTexture |

**HTML-in-Canvas status, checked this session:** experimental, implemented behind a flag in Chromium, `chrome://flags/#canvas-draw-element`, shipping-behind-flag from around Chromium 146 [D/F, secondary reporting]; there is a real Chromium "Intent to Experiment" thread [V, groups.google.com/a/chromium.org/g/blink-dev, seen in search results] and a WICG explainer repo [V, github.com/WICG/html-in-canvas]. As of the check, Firefox has "no implementation and no flag," and no Safari/WebKit implementation was found [F, html-in-canvas.dev/docs/browser-support, community-run status page, not Apple or Mozilla themselves]. **This is a Chrome-only technique today** and Duo has not chosen a browser target — flagging per instructions. Do not build on it for the concept.

**Recommendation:** **CanvasTexture**, for three reasons: it is the only option confirmed to work with a bent, arbitrary-topology screen mesh; it works in every engine that supports WebGL, so it does not force a Chrome-only decision; and it composes cleanly with Anime.js, since the texture object itself is a valid Anime.js/Three.js adapter target (`isTexture` is one of the duck-typed checks in `adapter.js`, Section 5) for crossfades between UI states. Build the hub's actual DOM off-screen (a hidden `<iframe>` or a detached DOM tree using the real HTML/CSS the rest of the prototype already uses), and either draw it into the canvas incrementally with the Canvas 2D API for simple layouts, or fall back to snapshotting it (e.g. via the browser's own rasterization, `drawImage` of a rendered `<canvas>`/SVG `foreignObject`) for anything text-heavy. Re-texture only on state change, not every frame, to keep the two ~2–6 MP canvases cheap.

## 4. Realistic materials and lighting in r186

| Decision | Recommendation | Notes |
| --- | --- | --- |
| Renderer | `WebGLRenderer` | `WebGPURenderer` is real and importable from `three/webgpu`, with TSL from `three/tsl` — both confirmed as separate export entries in the package's own `package.json` [V, npm pack]. r186's WebGPU changes are mostly compute/XR/pipeline internals, not glass-and-metal fidelity [D, GitHub release notes]. Since Duo has no browser target, `WebGLRenderer` avoids betting the whole render path on WebGPU's more uneven support before that decision is made |
| Glass (screen cover, camera lenses) | `MeshPhysicalMaterial` with `transmission`, `thickness`, `ior`, low `roughness` | Standard PBR glass recipe; r186 also added retroreflectivity and diffuse-Fresnel fixes to this material [D, GitHub release notes], not required for glass specifically |
| Metal (frame) | `MeshPhysicalMaterial` with `metalness` near 1, and `anisotropy` | `anisotropy`, `anisotropyRotation`, `anisotropyMap` are real fields on `MeshPhysicalMaterial`, confirmed directly in the shipped source (`src/materials/MeshPhysicalMaterial.js`) [V]. Anisotropy matters for a brushed-metal frame; `anisotropyMap` must be tagged `NoColorSpace`, since it is a direction/strength map, not a color [V, source comment] |
| Environment lighting | `RoomEnvironment` → `PMREMGenerator.fromScene()` | Confirmed present in the package (`examples/jsm/environments/RoomEnvironment.js`) [V]. Zero network asset, deterministic studio look; this is the same technique `<model-viewer>`'s default lighting uses [D, via search]. Swap to a real HDRI (`PMREMGenerator.fromEquirectangular()`) later for a branded backdrop; either path requires the PMREM conversion step for `MeshPhysicalMaterial` to read the map correctly [D, three.js forum] |
| Tone mapping | `THREE.NeutralToneMapping` | Based on the Khronos PBR Neutral spec, aimed at accurate, non-color-shifted reproduction, which search results describe as the better fit "for product visualizations or embedded 3D on 2D pages" [D]. `AgXToneMapping` is also in the r186 export list [V, confirmed in bundle source] and gives a more filmic, Blender-4.0-matching look, better suited to a cinematic scene than a product shot |
| Shadows / AA / post | A soft contact shadow (a baked or blurred shadow-catcher plane under the device) rather than full dynamic shadow maps; MSAA or `renderer.setPixelRatio` + FXAA/SMAA; minimal post (maybe a light bloom on the emissive screen only) | Keeps the device readable and fast; heavy post-processing risks fighting the tone-mapped screen texture's own contrast |
| Reference examples | Three.js's official `webgl_loader_gltf_variants` (glTF + `KHR_materials_variants`, HDRI-lit) and `webgl_materials_envmaps_hdr` [V, threejs.org/examples]; `tsl-car-config` (WebGPURenderer + TSL, metal-flake clearcoat, day/night HDRI switching) as a practitioner example of the WebGPU/TSL path [D, GitHub, seen in search] | Good starting points to study material and lighting setup, not device-shell specific |

## 5. Anime.js 4.5 with Three.js — verified against package source

Package inspected: `animejs@4.5.0` unpacked at `/tmp/duo/device-research/tech/animejs`. The Three.js binding is not part of the default `animejs` import; it must be imported once as a side effect: `import 'animejs/adapters/three'` (its files are declared under `sideEffects` in `package.json` [V], and `threeAdapter` self-registers on import via `registerAdapter()` in `adapter.js` [V]).

**What it adds beyond plain object-property animation** (all read directly from `object3d.js`, `resolvers.js`, `uniform.js`, `instance.js` [V]):
- Duck-typed target detection (`isObject3D`, `isMaterial`, `isTexture`, `isFog`, `isColor`, `isVector2/3/4`, `isUniformNode`) means you `animate()` a mesh, a material, a color, or a texture the same way you'd animate a DOM element.
- `Object3D` gets first-class flat properties: `x/y/z` (position), `rotateX/Y/Z` (auto-converted degrees ↔ radians), `scale`/`scaleX/Y/Z`, `opacity` and `color` (routed to `.material` automatically, or to the light itself for lights), plus camera-specific `fov`, `aspect`, `near`, `far`, `zoom` (each triggers `updateProjectionMatrix()` for you).
- Generic resolvers auto-detect any `Color`, `Vector2/3/4`, or shader/TSL `UniformNode` field anywhere on a target or its material — so a custom `ShaderMaterial` uniform (e.g., a bend-radius or fold-progress uniform) animates with no adapter code, and a TSL `uniform()` node built via `three/tsl` animates through its `.value`, `.color`, or `.x/y/z/w`.
- `InstancedMesh`/`BatchedMesh` get a per-instance proxy via `getInstances(mesh)`, so you can `animate(getInstances(mesh)[i], { x: 1 })` without touching `instanceMatrix` by hand; a patched `onBeforeRender` flushes dirty instances before each render automatically.

**Keeping Anime.js's clock in sync with the render loop.** By default `engine.useDefaultMainLoop = true`, and the engine drives its own `requestAnimationFrame` loop internally (`tickEngine`/`engine.wake()` in `engine.js` [V]) — so out of the box, Anime.js does **not** drive Three.js's render call, it just advances its own tweens on its own frame. For a Three.js scene, set `engine.useDefaultMainLoop = false` once and call `engine.update()` yourself inside the single Three.js `requestAnimationFrame` loop, immediately before `renderer.render()`, so both are locked to the same frame and there is exactly one rAF callback driving the whole app — this mirrors the pattern already used in `design/site/src/worlds/01-noir/scene.ts`, which runs its own `requestAnimationFrame` loop independent of the animation library and calls `render()` each frame (that file uses GSAP for DOM only and a raw loop for Three.js; the Duo prototype instead folds Anime.js's engine tick into that same loop).

**One timeline across the hinge, camera, and DOM.** A `Timeline` (`createTimeline()`) can `.add()` heterogeneous targets in one call graph: the two hinge bones' `rotateX`, the camera's `fov`/position, and a DOM pane's layout, all positioned on one shared time axis with relative offsets. For the DOM pane swap specifically, `animejs/layout`'s `createLayout(root, params).update(callback)` runs a FLIP-style measure → mutate → animate pass and returns a `Timeline` (verified in `layout.d.ts` [V]) — call it around the DOM change that shows the supporting pane (e.g., the agent panel appearing beside Today), and splice its returned `Timeline` into the master timeline as a normal child so hinge motion and pane motion stay on one clock.

**Performance.** The adapter's property resolvers are memoized per-name (`directColorCache`, `materialScalarCache`, etc. in `resolvers.js` [V]), so repeated animation of the same property name is not paying a fresh reflection cost every tween. `InstancedMesh` writes are coalesced and flushed once per render, not per instance per frame. The main cost surface is unrelated to Anime.js itself: it is however many CanvasTexture re-uploads and skinned-mesh bone updates the scene does per frame, both of which the timeline should drive at "on change," not "every frame," wherever the UI allows it.

**Minimal code sketch** (illustrative; not run against a live scene this session, but every API name below is confirmed against the 4.5.0 source):

```js
import * as THREE from 'three';
import { createTimeline, engine } from 'animejs';
import 'animejs/adapters/three'; // side-effect: registers threeAdapter

const renderer = new THREE.WebGLRenderer({ antialias: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);

// duo.glb exported from the Blender rig: SkinnedMesh "InnerScreen" with
// bones "HingeL".."HingeR" across the fold band, plus "OuterHalf" / "InnerHalf".
const { scene: duo, hingeBones } = await loadDuo(); // app-specific loader
scene.add(duo);

// Anime.js drives the engine's own animations without its own rAF loop.
engine.useDefaultMainLoop = false;

function openToSeated() {
  return createTimeline({ defaults: { ease: 'inOutQuad', duration: 900 } })
    .add(hingeBones, { rotateX: -55 }, 0)         // Object3D property, in degrees
    .add(camera.position, { y: 0.4, z: 2.1 }, 0)   // Vector3 fields, per-axis
    .add(camera, { fov: 38 }, 0)                   // triggers updateProjectionMatrix()
    .add(screenMaterial.color, { r: 1, g: 1, b: 1 }, '<'); // Color target
}

function tick() {
  engine.update();       // advance every active Anime.js timeline/animation
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

## 6. Hinge kinematics (placeholder angles — ASSUMPTION, not from Apple)

Apple publishes only `closed` / `partiallyOpen` / `fullyOpen` plus a raw angle, with no thresholds (per the geometry note, `UIHinge.angle`/`.Status` [A, developer.apple.com, already established]). The angles below are our own placeholders for the prototype, loosely bounded by two shipping precedents found this session: Samsung's Flex Mode free-stop range of 75°–115° [V, Samsung support docs] and Microsoft's Surface Duo 0–360° hinge-angle sensor convention, where 90° is "laptop/tabletop," 180° is flat, and 360° is fully reflexed [V, Microsoft Learn].

Define θ as the interior angle between the two half-planes, measured on the inner-screen side: 0° = fully closed, 180° = fully open flat.

| Posture | θ (ASSUMPTION) | Rationale |
| --- | --- | --- |
| Closed | 0° | Definitional |
| Book (partly folded) | ≈ 120°, usable range 100°–150° | Mid-range, hand-held reading angle; no mechanical precedent needed since nothing props it |
| Seated (propped like a laptop) | ≈ 115°, usable range 100°–130° | Modeled on Samsung's 75°–115° free-stop band for a self-supporting angle [V] |
| Standing (tent) | ≈ 60°, usable range 30°–90° | The tent posture shows the *outer* display, which (per the geometry note) has no fold; tenting folds the *inner* display inward, hidden, at a shallow angle so the device is self-supporting on its two "legs" the way a Surface Duo's tent mode props at a similar range [F, geometry note's Android Central hands-on] |
| Open | 180° | Definitional |

**Pivoting the two halves.** The hinge axis is not at either half's own center — it runs along the spine edge of both halves (the left edge of the closed device, per the geometry note's simulator read). Model each half as a pivot `Group` whose local origin sits on the shared hinge line, with the half's mesh offset away from that origin (not centered on it):

```js
const hinge = new THREE.Object3D();         // sits on the physical hinge line
const leftPivot = new THREE.Object3D();     // rotates about the hinge
const rightPivot = new THREE.Object3D();
hinge.add(leftPivot, rightPivot);
leftHalfMesh.position.x = -halfWidth / 2;   // offset AWAY from the pivot's own origin
rightHalfMesh.position.x = halfWidth / 2;
leftPivot.add(leftHalfMesh);
rightPivot.add(rightHalfMesh);

function setPosture(thetaDeg) {
  const half = (180 - thetaDeg) / 2;
  leftPivot.rotation.y = THREE.MathUtils.degToRad(half);
  rightPivot.rotation.y = -THREE.MathUtils.degToRad(half);
}
```

This keeps the device visually centered on its own hinge line as it opens (mirroring the symmetric coupling-link mechanism real foldable hinges use [D, patent search, general foldable-hinge literature, not Duo-specific]), rather than swinging one fixed half and one moving half. The `hingeBones` used for the flexible screen's skin (Section 2) sit on the same axis and should share the same `θ → rotation` function so the shell and the screen bend in lockstep.

## 7. Tooling

| | Import map + CDN, no build | npm + Vite (matches `design/site`) |
| --- | --- | --- |
| Iteration speed for a small demo | Fastest to a first pixel: no install step | One `npm install`, then Vite's HMR is fast per-save |
| TypeScript, `@types/three` | Not available without a build step | Native; `design/site` already pins `@types/three@^0.180.0` and `typescript@^5.6.0` |
| Asset pipeline (`.glb`, `.hdr`, GLSL) | Manual `fetch()`/`<script type="importmap">` wiring, no bundling of shader chunks | Vite handles binary asset imports and `?raw`/`?url` shader imports out of the box |
| Version pinning across `three` and `animejs/adapters/three` | Easy to drift (two `<script>` tags, or two CDN URLs, pointing at mismatched versions) | `package.json` pins both; `animejs`'s own `peerDependencies` require `three >= 0.150.0` [V, package.json], satisfied by 0.186.0 |
| Matches the sibling project | No | Yes — same Vite 7 / TypeScript / `three` combination `design/site` already runs, so the same `worlds/`-style pattern (a `scene.ts` with its own render loop, imported from a `main.ts`) transfers directly |

**Recommendation:** npm + Vite. A CDN import map is attractive for a single throwaway HTML file, but this prototype needs TypeScript for the timeline/posture code, a real asset pipeline for the glTF/skin, and version-pinned `three`/`animejs` — all of which Vite already gives `design/site` for free, and the two projects can share patterns and tooling knowledge.

## 8. Licensing (interpretation, not legal advice)

Apple's App Store marketing guidelines, read during the geometry check this session and re-summarized here for the 3D question specifically, say to use its bezel artwork "as is": no reflections, shadows, cropping, tilting, animating, or flipping, and no "rendering in 3D or creating any simulation of an Apple product" in marketing [A, developer.apple.com/app-store/marketing/guidelines, per the geometry note]. Read plainly, that rule governs Apple's *own* supplied artwork (the bezel PNG/PSD files) and App Store marketing materials — it does not, on its face, reach a team's own hand-modeled 3D geometry of a device shape, which is a different thing. Two consequences follow, as an interpretation:

- **Internal concept work:** modeling Duo's shape ourselves in Blender/Three.js, from public specs, for internal design exploration, is not "using Apple's bezels," so this specific rule does not appear to apply. It sits closer to any other third party building a device mockup, which Apple does not forbid outright.
- **Public presentation:** the same rule about *App Store marketing* artwork would clearly bite if the prototype were pitched as if it *were* Apple's own render (e.g., mixing our 3D model with Apple's real bezel images), or published in a context that reads as App Store marketing. A concept explicitly labeled as an independent design study is a different case, but that reading is untested, and Apple's trademark and product-likeness rights are a separate, broader concern from this one marketing-guidelines clause.

This section, like the license discussion in the geometry note, is our reading of public text, not legal advice.

## Open questions

- Whether `engine.useDefaultMainLoop = false` plus a manual `engine.update()` is Anime.js's documented, intended integration path, or just something the source structurally supports — the source confirms the mechanism, not the maintainer's stated best practice for Three.js specifically.
- Whether `animejs/adapters/three`'s per-instance `getInstances()` proxy is useful here at all — Duo's scene has no obvious `InstancedMesh` use case yet, unless the hub's UI later renders many repeated 3D elements.
- HTML-in-Canvas's real-world performance and hit-testing ergonomics are unverified; revisit if Duo later commits to a Chrome-only target, since it would remove the need for manual raycast-to-DOM hit-testing that CanvasTexture requires.
- The teardrop hinge curvature values here are generic foldable-hinge patent literature, not Duo-specific; there is no Apple-published bend radius to check against.
- Whether Draco or Meshopt compression on the Blender glTF export changes the recommendation in Section 1 meaningfully for load time has not been measured.

**Review notes (September 23):**

- **Chained bones add up their rotations.** The sketch in Section 5 gives every bone in `hingeBones` a rotation of −55°. In a chain of bones, each bone's rotation adds to its parent's, so N bones at −55° each would bend the screen N × 55°. The total bend, 180° − θ, has to be shared across the N bones, for example (180° − θ) / N each, or weighted so the ends ease into the curve. The pivots and the bones must also use the same θ-to-rotation function.
- **Animating the UI on a texture is the main unresolved cost.** CanvasTexture is cheap only when the UI is static. During a transition, a DOM-based UI animated by Anime.js would have to be turned back into pixels and uploaded to the GPU on every frame. At the inner canvas's 2853 × 2007 px, that is about 23 MB per frame, and snapshots through SVG `foreignObject` are slow and limited. Decide which of three options to use before building:
  - Render the screen UI as its own Three.js scene into a `WebGLRenderTarget`, with text drawn by a GPU text renderer such as MSDF. This keeps the work on the GPU, and Anime.js animates the UI's plain objects.
  - Use a hybrid. A real DOM overlay, aligned to the screen, handles head-on interactive views; a texture snapshot stands in only while the device is folding or seen at an angle.
  - Use HTML-in-Canvas, if the project accepts a Chrome-only target.
