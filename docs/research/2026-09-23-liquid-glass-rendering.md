# Liquid Glass: optics and rendering technique

Checked: September 23, 2026. Scope: the physical optics of a refractive glass bezel (Snell's law, dispersion, frosting, Fresnel, specular, SDF-derived normals, shape merging), a read of the actual code behind several existing "Liquid Glass" implementations (not just their claims), the DOM/SVG-filter path in Chrome (`backdrop-filter: url(#svgFilter)`, `feDisplacementMap`, `feImage`), a WebGL shader design that implements the physics for arbitrary glass shapes, and a shared parameter model for both paths. This note does not cover Apple's own definition of Liquid Glass (marketing copy, HIG wording, adaptive behavior spec) — that is a separate research note; this one is optics and rendering technique only. Evidence tiers, matching the project convention: **V** = primary source opened directly (spec, vendor docs, source code) · **F** = firsthand/practitioner report opened directly · **D** = secondary summary or opinion · own derivations are labeled **[derivation]**. Scratch downloads live under `/tmp/duo/liquid-glass-research/tech/`.

## Short answer

- The physically defensible model is a **refractive slab with a curved (lens-like) bezel profile**: an SDF gives distance-to-edge, a height field built on top of that SDF gives the bezel's cross-section, and the height field's gradient gives a per-pixel surface normal. That normal drives Snell's-law refraction (with a small per-channel IOR spread for dispersion), a Schlick Fresnel term, and a specular highlight from an externally supplied light direction. None of this requires a fake "blur + fill + border": the refraction, the rim highlight, and the frosting all fall out of the same normal field.
- **WebGL is the only path that can do this faithfully.** It can evaluate the SDF, the normal field, real per-channel refraction, and a genuine frost (a pre-filtered content mip, sampled at the refracted UV, not a blur of the unrefracted background) per pixel, at the 2853 × 2007 px screen resolution, for plausibly low cost.
- **The DOM/SVG path (`backdrop-filter: url(#svgFilter)`) is real in Chrome** and can carry a genuine displacement-map refraction with `feDisplacementMap`, but it is fundamentally 8-bit, resampled, and has no native dispersion, Fresnel, or specular primitive — those would need extra filter primitives stacked by hand and quantization will show. Whether this path survives Duo's HTML-in-Canvas rasterization is **not established by any source found**; treat it as unknown.
- **Recommendation:** build the WebGL shader as the source of truth for the 3D device's screens (the actual deliverable), and use the DOM/SVG path only for the plain-DOM review pages, sharing one design-token parameter set (IOR, thickness, bezel width, profile, dispersion, frost, specular, tint) between both, with the DOM path explicitly documented as a lower-fidelity stand-in.

## 1. Physics

### 1.1 Refraction through a curved bezel — Snell's law and profile [derivation]

A glass panel is modeled as a slab: flat on the side facing the content, thickness `t` in its interior, with a curved bezel of width `w` near its silhouette edge where the top surface domes down to meet the content plane — a plano-convex lens edge, which is why real glass bezels bend and magnify content near their border and look flat in the middle.

Take a 2D signed distance field `d(p)` for the panel's footprint (negative inside, per the SDF convention below). Define the normalized inward bezel coordinate:

```
t = clamp(-d / w, 0, 1)   // 0 at the silhouette edge, 1 where the flat interior begins
```

and a height field over that coordinate, `h(t) ∈ [0, thickness]`, for the bezel's cross-section. Two profiles:

- **Circular / elliptical arc** (a literal rounded/lens edge): `h(t) = thickness · sqrt(1 − t²)`. At `t = 1` (interior) this gives `h = thickness`; at `t = 0` (silhouette) `h → 0` with the tangent going vertical — physically correct, since the very edge of a lens is where the surface is tangent to the viewing ray. `dh/dt → −∞` there, so implementations must clamp `t` short of 1 (e.g. `t ≤ 0.999`) or clamp the resulting tilt angle, and treat the last sliver as a near-total-reflection rim (see Fresnel, §1.4).
- **Convex / superellipse cross-section**: `h(t) = thickness · (1 − tᵏ)^(1/k)` for exponent `k`. `k = 2` reproduces the circular arc above; `k > 2` flattens the interior further and sharpens the roll-off near the edge, for a more "squared" bezel feel. This `k` is independent of the plan-view corner shape below — one governs the edge's cross-section, the other its footprint outline.

This is distinct from the **plan-view corner profile** (circular-arc rounded corners vs. Apple-style squircles), which only changes where `d(p) = 0` sits, not the bezel's cross-section:

- **Circular rounded-rectangle corners** have an exact SDF (below).
- **Squircles (superellipses)**, `|x/a|ⁿ + |y/b|ⁿ = 1`, have **no closed-form SDF** — this was confirmed directly: the superellipse math reference describes only the implicit curve, not a distance function, and notes Bézier curves only approximate a Lamé curve, not reproduce it exactly [F, squircle.js.org/blog/math-behind-squircles]. Apple's own icon shape is not a pure superellipse either — it is Bézier-built to approximate one, with roughly a 22% corner radius and 60% "corner smoothing" reproducing the iOS look [D, via search, citing Wikipedia's Squircle entry]. Raph Levien's write-up on blurred rounded rectangles takes the practical route also usable here: keep the exact rounded-box SDF machinery, but raise the corner exponent from 2 toward a higher value to bias the corner toward a superellipse-like silhouette, accepting it as an approximation rather than an exact distance field [F, raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html]. **Recommendation:** use the exact rounded-box SDF for the plan-view outline (cheap, exact, and Apple's own squircle is itself only a close Bézier approximation, so an approximation-of-an-approximation is an acceptable trade), and reserve the superellipse exponent knob for the bezel's cross-section, where it has a real optical meaning.

**Bezel width vs. thickness.** In this model these are two independent tokens with distinct effects: `thickness` sets how much optical path length (and thus how much lateral shift, §1.1.1) the glass has at its thickest; `w` (bezel width) sets how much of the panel's footprint is "active" refracting surface versus flat pass-through. A wide, shallow bezel (`w` large relative to `thickness`) gives a gentle, wide refraction zone; a narrow, deep bezel gives a sharp, thin "glint" band right at the edge — this is a tunable knob, not something with one correct physical answer, since real Liquid Glass elements vary in both across Apple's own UI.

#### 1.1.1 From tilt to apparent shift — the parallel-slab formula [derivation, confirmed against standard optics]

For a ray meeting a locally tilted interface at incidence angle `α` (relative to the true, non-tilted normal) and refracting through a slab of thickness `t` and relative index `n` to a refraction angle `β = asin(sin α / n)`, the ray's lateral displacement on exit is the classic result for a plane-parallel slab:

```
displacement = t · sin(α − β) / cos β
```

This is standard optics (verified consistently across multiple worked-example sources: GeeksforGeeks and Vedantu's derivations of "lateral displacement through a glass slab" both give this exact form [D, corroborating, not a single canonical citation]). It is only exact for a slab whose two faces are parallel; inside the curved bezel the "bottom" face is the flat content plane and the "top" face is locally tilted by the bezel's own slope, so this formula is applied per-pixel using the *local* tilt angle `α` derived from the SDF/height-field normal (§1.5), not a single global angle. This is the mechanism that turns the SDF-derived normal directly into a UV offset for sampling the content texture — no separate "displacement strength" magic number is needed once IOR, thickness, and bezel width are fixed; the displacement is a derived quantity, not an independent knob.

### 1.2 Chromatic dispersion

Real glass has wavelength-dependent IOR (Cauchy's equation, `n(λ) = A + B/λ²`, with published `A`, `B` coefficients per glass type, e.g. fused silica `A=1.4580, B=0.00354 µm²` [F, Wikipedia's Cauchy's equation entry, opened directly]). For real-time rendering, Khronos's glTF `KHR_materials_dispersion` extension specifies exactly the practical shortcut worth reusing here — verified by opening the extension's own README:

```glsl
float halfSpread = (ior - 1.0) * 0.025 * dispersion;
vec3 iors = vec3(ior - halfSpread, ior, ior + halfSpread); // R, G, B
```

with the base `ior` treated as the green channel's value and `dispersion` a 0–1(+) artistic knob rather than a physical Abbe number lookup [V, github.com/KhronosGroup/glTF, `KHR_materials_dispersion/README.md`]. The extension also notes the red channel may need clamping above 1.0 in extreme cases [V, same source]. Applied here: compute three refracted UV offsets (§1.1.1) using `iors.r/g/b`, sample the content texture three times, and recombine — real per-channel Snell's law, not a fixed-offset RGB-split filter.

### 1.3 Frosting (surface scattering) vs. blur

Physically, a frosted (rough) dielectric doesn't refract every ray to the same exit direction — the surface is microfacet-rough, and each microfacet has its own normal, so transmission is a distribution of directions per point, not a single sharp ray. This is exactly how a physically based renderer's rough-dielectric BTDF works: it samples a **generalized half-vector** `ωm = (η·ωi + ωo) / ‖η·ωi + ωo‖` from a microfacet normal distribution, and refracts according to *that* facet's normal, not the mean geometric normal — "transmission occurs at the level of the microgeometry," with each microfacet independently obeying Snell's law [V, pbr-book.org/4ed/Reflection_Models/Rough_Dielectric_BSDF, opened directly].

A real-time frost cannot afford per-pixel multi-sample microfacet integration, so the standard (and the honest) approximation is: still refract (§1.1.1) to find the correct sample center, then integrate a *pre-filtered* neighborhood of the content around that refracted point — i.e., sample a blurred/mipped version of the content texture **at the refracted UV**, not a blur of the unrefracted background. That pre-filtering approximates the solid-angle integral a rough BTDF would perform; it is a real approximation of a real physical integral, not a "blur instead of refraction." The failure mode this note is told to avoid — "blur plus translucent fill plus border" — is specifically blurring the background *without* first refracting it; that skips the optics entirely rather than approximating one term of it.

### 1.4 The Fresnel term

Exact dielectric Fresnel reflectance (unpolarized, average of s/p polarizations), confirmed directly from PBRT's online text:

```
r∥ = (η cosθᵢ − cosθₜ) / (η cosθᵢ + cosθₜ)
r⊥ = (cosθᵢ − η cosθₜ) / (cosθᵢ + η cosθₜ)
Fᵣ = ½(r∥² + r⊥²)
```

[V, pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission, `FrDielectric`]. For real time, Schlick's approximation is the standard stand-in — confirmed formula:

```
R(θ) = R₀ + (1 − R₀)(1 − cosθ)⁵,   R₀ = ((n₁ − n₂)/(n₁ + n₂))²
```

[F, Wikipedia's Schlick's approximation entry, opened directly]. Because `θ` here is measured against the *SDF-derived* local normal (§1.5), Fresnel automatically strengthens near the bezel's silhouette, where the normal tilts toward grazing — this is what produces the bright rim highlight without a separate hand-authored "rim light" layer.

### 1.5 Specular highlights, and deriving the normal field from an SDF [derivation]

**Normal from a height field over an SDF.** For a 2D SDF `d(p)`, the in-plane gradient direction is found by the same finite-difference technique used for 3D SDF normals (confirmed method, adapted to 2D): central differences,

```glsl
vec3 calcNormal(vec3 p) {           // 3D reference technique
  const float eps = 0.0001;
  const vec2 h = vec2(eps, 0);
  return normalize(vec3(
    f(p+h.xyy) - f(p-h.xyy),
    f(p+h.yxy) - f(p-h.yxy),
    f(p+h.yyx) - f(p-h.yyx)));
}
```

with a cheaper 4-tap "tetrahedron" variant also given, and the note that the finite-difference epsilon should track pixel footprint, not be arbitrarily small [V, iquilezles.org/articles/normalsSDF/, opened directly]. In 2D, `g = normalize(vec2(d(p+εx)-d(p-εx), d(p+εy)-d(p-εy)))` is the same idea with two taps (or the SDF's own analytic gradient, which is closed-form and cheaper for the rounded-box/capsule primitives below). Composing that in-plane gradient with the bezel height field `h(t)` from §1.1 via the standard height-field-to-normal (bump-mapping) identity, `N = normalize(−∂h/∂x, −∂h/∂y, 1)`, and the chain rule through `t = −d/w`, gives:

```glsl
float slope = dhdt(t) / w;              // dh/dt from the chosen profile, e.g. -thickness*t/sqrt(1-t*t)
vec3 N = normalize(vec3(g * slope, 1.0));
```

**Specular.** Standard Blinn-Phong (or GGX, if the extra cost is worth it) against a light direction supplied as a uniform, transformed into the same local frame as the SDF/UV space:

```glsl
vec3 H = normalize(V + L);
float spec = pow(max(dot(N, H), 0.0), shininess) * fresnel(N, V);
```

Modulating `spec` by the same Fresnel factor as §1.4 ties the highlight's strength to the same physical quantity as the rim brightening, instead of an independently tuned specular exponent.

### 1.6 Merging shapes: smooth-min / metaballs

Confirmed exact polynomial smooth-min, directly from source:

```glsl
float smin(float a, float b, float k) {
  k *= 4.0;
  float h = max(k - abs(a-b), 0.0) / k;
  return min(a, b) - h*h*k*(1.0/4.0);
}
```

[V, iquilezles.org/articles/smin/, opened directly — the page also gives exponential and root/power variants, both noted to lack "rigidity," i.e. they distort the shapes even far from the join, unlike the polynomial form]. Metaballs are the same construction specialized to circles/spheres. The useful extra step for a material system (not in the source, **[derivation]**): reuse the same blend weight `h` computed above to also interpolate *material* parameters (tint, frost, dispersion) of the two merging shapes, so two glass elements with different tint or frost fade into each other smoothly across the join, rather than snapping at the distance-field boundary.

**SDF primitives used above**, confirmed from source:

```glsl
// 2D rounded box, r = per-corner radii (vec4)
float sdRoundedBox(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x>0.0) ? r.xy : r.zw;
  r.x  = (p.y>0.0) ? r.x  : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
}
// capsule (uneven, r1/r2 per end)
float sdUnevenCapsule(vec2 p, float r1, float r2, float h) {
  p.x = abs(p.x);
  float b = (r1-r2)/h, a = sqrt(1.0-b*b);
  float k = dot(p, vec2(-b,a));
  if (k < 0.0)   return length(p) - r1;
  if (k > a*h)   return length(p-vec2(0.0,h)) - r2;
  return dot(p, vec2(a,b)) - r1;
}
```

[V, iquilezles.org/articles/distfunctions2d/, opened directly].

## 2. Analysis of existing implementations

The common pattern across every serious attempt below: an SDF-derived surface normal displaces a background sample (real refraction), then three things are consistently faked — dispersion as an arbitrary small per-channel offset rather than true per-wavelength IOR, Fresnel/specular as a fixed-light approximation or omitted, and (in the weakest case) a static pre-baked displacement bitmap standing in for per-instance geometry. That last split — computed-per-instance-from-geometry vs. pre-baked-bitmap — is the clearest technical line onto the "no cheap tricks" bar.

**kube.io, "Liquid Glass in the Browser: Refraction with CSS and SVG"** [F, kube.io/blog/liquid-glass-css-svg/, opened]. Correct: defines a height/thickness function per profile (circular, squircle, concave), differentiates it for a surface normal, ray-traces via real Snell's law, exploits radial symmetry to precompute ~127 rays per radius and rotate them, encodes the resulting vector field as an R/G displacement map consumed by real `<feImage>`→`<feDisplacementMap>` under `backdrop-filter: url(#filter)`, plus a directional specular/rim term via `<feBlend>`. Faked: no chromatic dispersion; no explicit two-surface Fresnel, only a single refraction event. Cost: no numbers published; author states shape/size changes force a full displacement-map rebuild, and only filter `scale` can animate cheaply; Chrome-only by construction (SVG filters as `backdrop-filter`). License: none stated; code not released.

**shuding/liquid-glass** [V, raw source read in full]. Correct: real per-pixel geometry — a rounded-rect SDF run through a double `smoothStep` to a fall-off factor, used to warp UV, computed in a CPU `for` loop over every canvas pixel, exported via `canvas.toDataURL()` into the same `<feImage>`+`<feDisplacementMap>` primitives as kube.io. Faked: the displacement is a geometric heuristic, not derived from an IOR or Snell's law anywhere in the code; no dispersion, no Fresnel, no specular primitive; the rest of the "glass" look is ordinary chained `backdrop-filter` (contrast/brightness/saturate/blur) plus a CSS `box-shadow`. Cost: O(width×height) synchronous JS on every drag/resize; a corroborating third-party report calls derived work "absolutely cooked on low/med-end hardware" [D]. License: **MIT**.

**rdev/liquid-glass-react** [V, raw source read in full]. Correct: an opt-in `mode="shader"` ports shuding's SDF/smoothstep approach per-instance; a real per-RGB-channel `feDisplacementMap` chain (three separate nodes, distinct `scale` per channel) recombined with `<feBlend mode="screen">`. Faked: the **default** mode returns a static, pre-baked ~9KB base64 JPEG displacement map regardless of the panel's actual shape — the one clear "cheap trick" instance in this survey — and the README admits shader mode is "the most accurate but not the most stable"; "dispersion" is the same image at three arbitrary per-channel scales, not per-wavelength IOR; no Fresnel. License: MIT-equivalent (OSI template text, title line omitted).

**Standalone GLSL — github.com/LihnNH/liquid-glsl** (Shadertoy pages `wccSDf`/`3cdXDX` were located but blocked by a Cloudflare interstitial for both WebFetch and curl; not read, reported as such rather than guessed) [V, raw source read in full]. Correct: analytic (not finite-difference) SDF and normal for the capsule geometry; builds a real 3D normal from the SDF slope and calls GLSL's actual `refract()` intrinsic against a uniform `ior`; dispersion splits R/G/B into three offset samples; directional specular gated to the bevel band; an explicit anti-artifact "fold" detector (radial supersampling + component-median) to suppress color smearing at geometry folds. Faked: dispersion is a single offset scaled ±(1±k) per channel, not per-wavelength; no Fresnel term, just `pow(facing, sharpness)`; one fixed light, no environment map. Cost: no figures; code comments reference a prior version that caused a hang ("the V19 freeze") from over-multiplying blur/dispersion kernels. License: MIT.

**Figma's "Glass" effect** [V, Figma's own help doc, help.figma.com, opened]. Figma's own words: parameters are light angle/intensity/splay, "Refraction: the degree of optical distortion along the curved edge," "Depth: how far the curved edge extends inward... higher values create a more domed appearance," "Dispersion: the intensity of chromatic splitting," "Frost: the amount of background blur." Figma discloses its own limits directly: **"Environmental reflections are unsupported"**; glass won't render over another glass layer's background; can't coexist with background blur on the same layer; needs <100% fill opacity to show; no SVG export. No implementation/shader details published. Proprietary; not open source.

**Three.js/WebGL — github.com/ybouane/liquidglass** [V, `shaders.ts` read in full, 287 lines]. Correct: captures live DOM into WebGL textures, then blit → Gaussian blur → composite; a bevel height field from the rounded-rect SDF, `bevelHeight(d,zR) = sqrt(d·(2·zR − d))` (a real circular/spherical bevel cross-section), normal via finite differences of that field; a "biconvex" mode explicitly commented "physically-based dual-surface refraction" (entry+exit); real angle-dependent Fresnel, `pow(1 − |N.z|, 4) · u_fresnel`; 4-light Blinn-Phong specular. Faked: refraction uses `1 − 1/ior` applied twice — a *linear* approximation of Snell's law, not a true `refract()` call; chromatic aberration is the normal's XY scaled per channel, not per-wavelength IOR; the author's own comment admits `// ── Environment-like reflection (fake) ──` for a term added to fake a reflection. Cost: static DOM children are captured once and cached, only `data-dynamic`/`<video>` children re-captured per frame — a real, disclosed optimization directly relevant to Duo's own CanvasTexture strategy. License: MIT. A related Codrops/WebGPU-TSL piece (tympanus.net, read directly) describes the same SDF→height→normal→multi-tap-dispersion→grazing-angle-Fresnel recipe on a flat plane, explicitly "refraction [is] faked in the material," reporting "a couple hundred cards" at once with no formal benchmark [F].

**Reverse-engineering of real iOS 26 Liquid Glass** — **no rigorous, quantified measurement was found.** What exists is a Photoshop tutorial's suggested manual blur setting (30–40 px, a recreation recipe, not a measurement), conceptual explainer articles describing their own reimplementations' parameters, and an uncited battery-drain claim; none measure Apple's actual displacement magnitude, blur radius, or specular parameters. Reported plainly as a gap, not filled with invented numbers.

## 3. The DOM path in Chrome

**`backdrop-filter: url(#svgFilter)` support.** Confirmed real and Chrome-specific. MDN's syntax section documents the SVG-filter form directly (`backdrop-filter: url("common-filters.svg#filter")`) alongside CSS `<filter-function>`s [V, developer.mozilla.org/.../backdrop-filter, opened]. Direct Chromium bug-tracker testimony confirms Chrome uniquely supports it: a live chromatic-aberration effect built from `feColorMatrix`/`feOffset`/`feBlend` under `backdrop-filter: blur(4px) url(#filter)` drew a maintainer comment, quoted directly: **"Firefox doesn't have the expected behaviour because it doesn't support SVG filters with backdrop-filter. Only Chrome does"** [V, issues.chromium.org/issues/41496487, opened]. The fix landed in `filter_effect_builder.cc`/`paint_layer.cc`, confirming Blink builds a real SVG-primitive filter chain for `backdrop-filter`, handed to the Skia/compositor renderer, not a CSS-only approximation [V, same bug, commit referenced directly].

**`feDisplacementMap`/`feImage` limits**, from the spec text and Chromium source directly:

- No intrinsic resolution cap: the displacement map is filtered like any other primitive result, in the device-pixel operating coordinate space — ordinary filter-region rasterization, not a fixed-resolution buffer [V, w3.org/TR/filter-effects-1/, opened].
- Channel selectors default to **alpha (`A`)**, not R/G, and `color-interpolation-filters` defaults to **linearRGB** for the displacement source, so an 8-bit sRGB-authored map is read through a nonlinear remap unless `color-interpolation-filters="sRGB"` is set explicitly [V, W3C spec + MDN's feDisplacementMap page, both opened].
- **`edgeMode` does not exist on `feDisplacementMap`** — confirmed by grepping the full spec text; it is defined only for `feConvolveMatrix`/`feGaussianBlur`. A displaced sample landing outside the source image reads as **transparent black** (spec's general undefined-pixel rule), not a clamped or wrapped edge [V, w3.org/TR/filter-effects-1/ §9.1, opened].
- Precision is spec-silent (implementation-defined); no Chromium source confirming an explicit 8-bit buffer was found — **treat 8-bit banding as a well-supported inference, not a confirmed fact** [unverified, explicitly].
- A real, current, source-level limitation: Chromium's `fe_displacement_map.cc` (HEAD) carries the comment **"FIXME: Only applyHorizontalScale is used and applyVerticalScale is ignored"** — today's Chrome applies one scalar `scale` to both axes of a Skia `DisplacementMapEffectPaintFilter`, which matters directly for a non-square, resizable glass panel [V, Chromium source, opened directly].

**Generating a displacement map for arbitrary sizes.** Spec-legal and standard: `feImage href` accepts a data URI, so a `<canvas>`-rendered SDF/normal map via `canvas.toDataURL()` is a valid `in2` source, resampled bilinear/bicubic to the filter region on resize [V, w3.org/TR/filter-effects-1/, feImage section, opened]. The cost is not the canvas draw — it's `toDataURL()`'s synchronous PNG re-encode (commonly several ms, on the main thread) plus the fact that reassigning the `feImage` href invalidates and reruns the whole filter chain, forcing a repaint **[estimate, not spec fact]**; a live-resize implementation should debounce regeneration (coalesce to resize-end or a small set of pre-baked tile sizes) rather than regenerate every frame.

**Survival through HTML-in-Canvas: unknown, stated plainly.** The WICG explainer names `feImage` exactly once, in the context of excluding *cross-origin* content from `drawElementImage()`'s output — same-origin/data-URI `feImage` (our own generated map) falls outside that specific exclusion, but the explainer says nothing about whether `backdrop-filter`'s composited output or `feDisplacementMap` in general survives, degrades, or is dropped when the element is drawn into a canvas texture [V, github.com/WICG/html-in-canvas, opened]. The Intent-to-Experiment thread and the feature's Chromium tracking bug do not mention filters or `backdrop-filter` at all [V, both opened]. **No source addresses this either way — it is unverified, and needs a small isolated spike once the flag is enabled, not an assumption.**

## 4. The WebGL path

A single fragment shader pass over the content render target, taking the content texture (plus a small mip/Kawase pyramid of it for frost) and a small uniform array of glass shapes, produces the composite. Core, in GLSL, composing §1 directly:

```glsl
uniform sampler2D uContent;       // sharp content
uniform sampler2D uContentFrost;  // pre-filtered (mip or dual-Kawase) content, same UV space
uniform vec3 uLightDir;           // from the device's orientation in the 3D scene, in screen-local space
uniform int uShapeCount;
uniform GlassShape uShapes[MAX_SHAPES]; // center, halfSize, cornerRadii, bezelWidth, thickness,
                                          // ior, dispersion, frost, tint, specularStrength, mergeGroup

float sceneSDF(vec2 p, out int nearest, out float blendH) {
  float d = 1e5; blendH = 0.0;
  for (int i = 0; i < uShapeCount; i++) {
    float di = sdRoundedBox(p - uShapes[i].center, uShapes[i].halfSize, uShapes[i].cornerRadii);
    if (uShapes[i].mergeGroup == uShapes[max(i-1,0)].mergeGroup) {
      float h = max(4.0*K - abs(d-di), 0.0) / (4.0*K);   // opSmoothUnion's h, reused below
      d = min(d, di) - h*h*K; blendH = max(blendH, h);
    } else { if (di < d) { d = di; nearest = i; } }
  }
  return d;
}

vec3 bezelNormal(vec2 p, float d, GlassShape s) {
  vec2 e = vec2(0.001, 0.0);
  vec2 g = normalize(vec2(sceneSDFAt(p+e.xy) - sceneSDFAt(p-e.xy),
                           sceneSDFAt(p+e.yx) - sceneSDFAt(p-e.yx)));   // 2D gradient, central differences
  float t = clamp(-d / s.bezelWidth, 0.0, 0.999);                       // 0 edge .. 1 flat interior
  float slope = s.thickness * t / (s.bezelWidth * sqrt(1.0 - t*t));     // dh/dx of the elliptical profile
  return normalize(vec3(g * slope, 1.0));
}

vec3 shade(vec2 uv, vec2 p) {
  int i; float blendH; float d = sceneSDF(p, i, blendH);
  if (d > 0.0) return texture(uContent, uv).rgb;                       // outside all glass: pass through

  GlassShape s = uShapes[i];
  vec3 N = bezelNormal(p, d, s);
  vec3 V = vec3(0.0, 0.0, 1.0);                                        // straight-on; screen content has no camera parallax
  float halfSpread = (s.ior - 1.0) * 0.025 * s.dispersion;              // KHR_materials_dispersion's own formula
  vec3 iors = vec3(s.ior - halfSpread, s.ior, s.ior + halfSpread);

  vec3 refr;
  for (int c = 0; c < 3; c++) {
    vec3 R = refract(-V, N, 1.0/iors[c]);
    float alpha = acos(N.z), beta = asin(sin(alpha)/iors[c]);
    float shift = s.thickness * sin(alpha-beta)/max(cos(beta),1e-3);    // §1.1.1, per channel
    vec2 uvC = uv + R.xy * shift;
    vec3 sharp = texture(uContent, uvC).rgb;
    vec3 frost = texture(uContentFrost, uvC).rgb;
    refr[c] = mix(sharp, frost, s.frost)[c];                           // frost samples AT the refracted UV
  }

  float cosI = max(dot(N, V), 0.0);
  float R0 = pow((iors.g-1.0)/(iors.g+1.0), 2.0);
  float fresnel = R0 + (1.0-R0) * pow(1.0-cosI, 5.0);                   // Schlick, §1.4
  vec3 H = normalize(V + uLightDir);
  float spec = pow(max(dot(N,H),0.0), 48.0) * fresnel;

  float lumaUnder = dot(texture(uContentFrost, uv).rgb, vec3(0.299,0.587,0.114));
  vec3 tint = mix(s.tint.rgb, vec3(1.0)-s.tint.rgb, step(0.5, lumaUnder)); // adaptive tint, [derivation]
  float shadow = mix(0.12, 0.04, lumaUnder);                            // darker contact shadow on light content

  vec3 color = mix(refr, tint, s.tint.a * (1.0-fresnel));
  color = mix(color, color*(1.0-shadow), smoothstep(0.0, -s.bezelWidth, d));
  return color + spec * uLightDir.z;                                   // rim/specular add, gated by facing
}
```

`opSmoothUnion`'s blend weight (`h` above) is reused as the material-blend weight between merging shapes — **[derivation]**, not in any source read, but a direct extension of the confirmed smooth-min math in §1.6.

**Cost at 2853 × 2007 px (~5.73 Mpx), order-of-magnitude only — not measured, no browser access available for this task:**

- *SDF evaluation*: `sdRoundedBox` is ~10–15 ALU ops; for a realistic UI (5–20 glass elements per screen, not all overlapping every pixel) this is comparable to a handful of per-pixel lights in a forward renderer — a well-understood, cheap workload on a tile-based Apple GPU. **[estimate]**
- *Normal*: the 2-tap analytic-gradient version is two extra SDF evaluations per pixel; the finite-difference version in the code above is 4 (2D, ± each axis). Either is cheap relative to texture bandwidth. **[estimate]**
- *Dispersion*: 3 content-texture samples instead of 1 (plus 3 frost samples if frosted) — this is the actual bandwidth cost, not the SDF math; content texture at 2853×2007 RGBA8 is ~23 MB, so this is ordinary multi-tap texture bandwidth, the same order as a 3-tap chromatic-aberration post effect already common in real-time engines. **[estimate]**
- *Frost*: computed **once per content-texture update**, not per glass-shader invocation, by reusing the "redraw the canvas only on change" discipline already adopted for the DOM UI (per `2026-09-23-device-3d-approach.md` §3) — a dual-Kawase pyramid (downsample/upsample, 4 taps/pass) is reported to be faster than a comparable-quality Gaussian blur by roughly 1.5–15× depending on radius and hardware, per ARM's own published SIGGRAPH results on Mali GPUs [F, community.arm.com, ARM's "Bandwidth-Efficient Rendering" SIGGRAPH 2015 notes, corroborated by multiple independent secondhand summaries of the same talk — the PDF's own text could not be machine-extracted, so the specific multiplier is reported from secondary summaries, not read verbatim from the PDF itself]. Apple M-series GPUs were not benchmarked directly by any source found; treat the multiplier as directional, not Apple-GPU-specific.
- *Smooth-min merging*: negligible — one extra `min`/`max`/multiply chain per shape pair.
- Overall, the dominant cost is texture bandwidth (multi-tap dispersion and frost), not ALU; a single composite pass at this resolution is very likely sub-millisecond to low-single-digit milliseconds on the target M-series GPU, but this is our own reasoned estimate, not a measurement, and should be confirmed with `chrome-devtools`'s performance trace once the shader exists.

## 5. Recommendation: one parameter model, two paths

A single design-token schema both paths read from, matching the project's DTCG token convention:

```jsonc
{
  "ior":       { "$value": 1.5,  "$description": "derived: typical glass/acrylic; green-channel reference for dispersion" },
  "thickness": { "$value": 12,   "$description": "our own design choice, px at 1x; peak height of the bezel dome" },
  "bezelWidth":{ "$value": 18,   "$description": "our own design choice, px at 1x; width of the active refracting band" },
  "profile":   { "$value": "elliptical", "$description": "derived: elliptical | superellipse(k); cross-section only, independent of corner shape" },
  "cornerShape": { "$value": "roundedBox", "$description": "derived: exact SDF; squircle has no closed-form SDF (kube.io/Levien, §1.1), approximated by raising the corner exponent" },
  "dispersion":{ "$value": 0.3,  "$description": "derived: 0-1 knob into KHR_materials_dispersion's halfSpread formula, not a physical Abbe number" },
  "frost":     { "$value": 0.25, "$description": "our own design choice: 0 = clear, 1 = fully pre-filtered at the refracted UV" },
  "specular":  { "$value": 0.6,  "$description": "our own design choice: multiplier on the Fresnel-gated specular term" },
  "tint":      { "$value": { "color": "#ffffff", "alpha": 0.08 }, "$description": "our own design choice: adaptive base tint, luminance-mixed at render time" }
}
```

**Which path where:**

- **WebGL, for the 3D device's screens (the actual deliverable).** It is the only path confirmed able to do real per-channel refraction, a genuine SDF-derived normal, dispersion, Fresnel, and specular from an externally supplied light direction, at the target resolution, at plausible cost (§4). It also composes naturally with the project's existing CanvasTexture pipeline: the glass pass reads the same content texture the DOM UI is already rasterized into.
- **DOM/SVG (`backdrop-filter: url(#svgFilter)`), for the plain-DOM review pages only**, generating the displacement map the same way kube.io and shuding do (§2) — computed per-instance from the shape's own SDF, never a pre-baked bitmap, to stay off the "cheap trick" side of that line. Document it plainly as **lower-fidelity**: 8-bit, no native dispersion/Fresnel/specular primitives (§3), and its survival through HTML-in-Canvas rasterization is unverified (§3) — so it must never be the thing actually shown on the 3D device, only a same-tokens stand-in for reviewing layout and shape merging in a plain browser tab.
- Both paths take the same tokens above; the WebGL shader implements them as physics (§4), the SVG filter implements them as its own best available approximation (§3) — same numbers in, deliberately different fidelity out, and that gap should be called out in the review UI rather than hidden.

## Open questions

- Whether the DOM/SVG path survives HTML-in-Canvas rasterization at all is unverified by any source found (§3) — worth a small isolated spike once the flag is enabled, before relying on it even for review pages rendered through that pipeline.
- No source measures real iOS 26 Liquid Glass's actual displacement magnitude, blur radius, or specular parameters (§2) — the token defaults above are our own starting choices, to be tuned by eye against Apple's shipped UI, not derived from a measurement.
- The Apple M-series-specific cost of a dual-Kawase frost pyramid was not found in any source; the ARM figures are Mali-GPU-specific and only directionally transferable.

