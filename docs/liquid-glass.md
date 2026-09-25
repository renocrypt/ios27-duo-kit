# Liquid Glass: implementation specification

Status: version 0.2, September 24, 2026 (fitted to iOS 27.1 with the glass probe). This is how Duo renders Liquid Glass. It is built from the two research notes:

- [Apple's own specification](research/2026-09-23-liquid-glass-apple-spec.md), cited as **A1** to **A15** for its implementation requirements.
- [The optics and rendering technique](research/2026-09-23-liquid-glass-rendering.md), cited as **R §n**.

The rule is "no cheap tricks." A blur, a translucent fill, and a border is not Liquid Glass (A1).

## Where it runs

**One path: a WebGL compositor.** The compositor takes a screen's content layer as a texture, renders every glass shape on that screen in one pass, and then draws the foreground layer (glyphs and labels on the glass) on top. The result is the texture shown on the 3D device's display. The Glass Lab review page runs the same compositor, so what we review is what we ship.

The SVG `backdrop-filter` path is not used. It works only at 8-bit precision, has no dispersion, Fresnel, or specular, and nobody has established whether it survives HTML-in-Canvas (R §3).

## Optical model

Version 0.2, September 24, 2026: refitted to Liquid Glass as iOS renders it, measured with the glass probe (last section; numbers in [the probe note](research/2026-09-24-glass-probe-ios27.0.md)). iOS does not trace a glass slab: its lensing is a displacement field that is largest at the rim, and its body is a tone curve on the frosted content. The model follows what it measures. Every value comes from the shape's signed distance field (SDF) `d(p)`, which is negative inside the shape, and each is a token in `material.glass`, labelled [SIM].

| Step | Model | Source |
| --- | --- | --- |
| Footprint | Exact rounded-box SDF with per-corner radii. Capsules are rounded boxes whose radius is half their height | R §1.1, §1.6 |
| Merging | Polynomial smooth-min of the shapes in one container, blend radius = container spacing. The blend weight also blends material parameters | A2, R §1.6 |
| Lensing | The content seen at depth `u` inside the rim comes from `D(u)` further in, along the lens's normal: the SDF's gradient over a step of `lensSoften` × the band, so it turns gradually where a cap meets a straight side, as on iOS's continuous-curvature shapes. `D` is largest at the rim and falls as `exp(-u/λ)` to zero at the band's inner edge, so the interior is flat. The band is `bezelRatio` × the corner radius (capped by the half height); `λ = profile` × the band; the rim's shift is `lens · (band/bezel)^lensPower · (half height/corner radius)^lensSizePower`. Fitted to iOS's whole displacement field over each shape (not a line through it): 0.78 pt rms (regular), 0.47 (clear) | [SIM] |
| Dispersion | The shift split per channel by `n - 1`, with `n = ior ± (ior - 1) · 0.025 · dispersion` | R §1.2, [C] |
| Frost | Two scales, averaged in sRGB as iOS does: a narrow Gaussian (`blur`) of the content as the glass shows it (lensed first, then blurred in screen space, as iOS scatters after refracting; just outside the silhouette the rim's refraction continues, so the blur at the rim sees only glass) keeps the content's shapes, and a wide one (`blurWide`, 16 pt) of the plain content, read at the source, keeps only its colour; mixed by `wideShare`. At the default tint: regular σ 3.9 pt with a wide share of 0.58, clear σ 1.3 with none; both frost further toward tinted (per tint, below). Large regular glass frosts more, by its short side and not its area: a share of its narrow frost (`sizeShare` at `sizeStops`: 0 up to 56 pt, 0.07 at 76, 0.26 at 96, 0.77 at 150, 0.85 at 180, held beyond) is the plain content blurred by regular's σ and `sizeBlur` (9.8 pt) on top, read at the source, before the lensing; clear glass does not ([the sizes note](research/2026-09-24-glass-probe-sizes.md); within 0.21 levels of contrast). Sampled at the displaced position; half, quarter (the size blur, built only when a screen has such glass), and eighth resolution, rebuilt only when the content, the shapes, or the tint change | [SIM] |
| Body | A tone curve on the frosted content's luma, one per variant, appearance, and tint (`curve`, 28 measured levels), with the colour around the luma kept and scaled by `saturation` (at the default tint: regular 1.18, clear 1.05). Regular dark lifts black to 32 and compresses white to 185; regular light is 132 + 0.476 × the level; clear adds 32 to 22 and ignores the appearance. Within 1.4 levels of iOS over 112 grey tiles | [SIM] |
| Rim | A bright line along the silhouette where the rim faces the light axis: `rim · (1 - 0.55 · body luma) · cos⁴θ · exp(-u/0.65 pt)`, added in sRGB. The axis is vertical at rest and turns with the stage's light once it leans across the screen | [SIM], A7 |
| Hairline | A dark line just outside the silhouette where the rim runs along the axis (`sin²θ`), 0.75 pt wide: dark regular glass multiplies the content by 0.38, light and clear glass subtract 0.31 (plus-darker) | [SIM] |
| Shadow | 0.02: iOS darkens the content 6 pt below by 1 to 3 levels | [SIM] |

The silhouette is antialiased over one pixel, as iOS draws it, so the rim and hairline keep their widths.

## Behavior

| Apple requirement | Implementation |
| --- | --- |
| A3 Regular vs. Clear | Regular: two-scale frost and the appearance's tone curve. Clear: 1.3 pt frost, its own tone curve in either appearance, stronger lensing and rim. The HIG's 35% dimming layer is the app's to add; iOS never adds it (glass probe) |
| A4 Light/dark flip for small elements | Raw iOS glass never flips (glass probe: a 48 pt shape over grey from 0 to 255, both appearances), so no shape flips by area (`flipArea` 0). An interface can still ask per shape (`mayFlip`): the compositor measures the luminance under it, flips with hysteresis, uses the light or dark curve, and sends the tone back to the DOM so glyphs match. Whether system controls flip is not measured yet |
| A5 Tint from content | The tint's hue is kept, and its brightness follows the content's luminance under the shape (stained-glass behavior), not a flat fill |
| A6 Adaptive shadow | Shadow opacity rises with the luminance contrast (variance) under the shape, from a measured base of almost none |
| A8 Touch illumination | A radial glow grows from the touch point, spreads across the shape, and reaches merged neighbours through the blend weight |
| A9 Press | Scale and bounce on `motion.spring.bouncy`, plus a shimmer: a highlight sweep driven by the same touch uniform |
| A10 Materialize | Appearing and disappearing animate the lensing's strength (the rim's shift) from 0 to 1 on a spring. Nothing fades opacity. Shapes within the container spacing morph through the SDF |
| A11 One layer | Glass lives in the compositor's control layer only; the content layer never holds glass, and glass never stacks on glass |
| A12 Scroll edge | A soft or hard band where the content meets a bar: the content dissolves toward the background under glass, or dims when the glass has flipped dark |
| A13 Accessibility | Reduce Transparency raises frost and tint. Increase Contrast switches to a near-black or near-white fill with a border. Reduce Motion drops the bounce and elasticity and holds highlights still |
| A14 Clear-to-tinted slider | `environment.tint` is Settings > Liquid Glass's slider (UIKit's `UIViewGlassTintAmount`, 0 clear to 1 tinted, iOS's default 0.5). The tone curves, both blurs, the wide share, and the saturation are measured at five positions (`tintStops`) and interpolated; the frost and the curve lookup are rebuilt when it moves [SIM] |

## Parameters

Every parameter is a token. Apple publishes no numbers here except the 35% dimming layer (A-§8). What the glass probe measures lives in `app/tokens/glass.sim.tokens.json`, generated by `app/labs/probe.html?calibrate` from the captures (never edited by hand): the slider's default and positions, the tone curves, per-tint frost and saturation, frost by size, lensing, rim, and hairline. Our choices [C] and the few values still read by hand from the probe (the wide blur, the hairline's width, the panel's lensing growth) live in `material.tokens.json`, each description saying which.

To recalibrate (after an iOS update, or new scenes): `npm run probe` captures every set in `app/tools/glass-probe/scenes.json`; open `/labs/probe.html?calibrate`; look at `/tmp/duo/glass-probe/inspect/<date>/` and the report in `reports/`; `npm run check`.

## Verification

`app/labs/probe.html` is the measure: every probe scene rendered by iOS and by our compositor, measured by the same code (tone, rim around the circumference, lensing and contrast against depth, frost σ, edge width). Every change to the glass is checked there. The Glass Lab (`app/labs/glass.html`) is the checklist for behaviour: each of A1 to A15 gets a switchable scene and a screenshot check in Chrome through the chrome-devtools MCP.

## Calibration: what the references can and cannot see

A flat colour under the glass looks the same at any blur and any refraction, so flat references pin only the body's colour, the rim, and the shadow. Fitted only against them, the glass drifted into frosted glass (an edge seen through it spread over 44 pt) while every flat probe still passed (September 24 self-check). A calibration lab (removed on September 24, superseded by the probe) therefore also measured structure: `edgeWidth` (the 10–90% width of an edge seen through the interior, target 5–9 pt) and `lensBand` (how far inside the rim straight lines are still displaced by 1 pt or more, target 7–14 pt). Its targets came from marketing images, and the probe later contradicted the frost target.

### What the evidence pinned before the probe, and where ground truth is

As of September 24, the model rests on Apple's words (A1 to A15, with one number, the 35% dimming layer) and on measurements from Apple's marketing and HIG images. Those images are compressed, their content is not under our control, their scale is inferred, and the HIG figures may be drawn in design tools rather than rendered by the material. They give about six independent constraints, all on dark regular glass: the body's lift over black and over a wallpaper, the rim, no shadow over dark content, one frost width, and one lensing band. The model has 16 parameters per variant, plus tone, container, and light settings. The fit is therefore not unique: the probes rule out gross errors (they caught the frost) but do not determine the material. Light glass, clear glass, tint, how glass changes with size, the flip threshold, dispersion, specular, and all motion remain our choices [C].

Ground truth is the renderer itself. The development Mac has Xcode 27.1 beta (build 27A9269), the version Apple's iPhone Duo developer page names, and the iOS 27.1 simulator runtime (24A94401) with the iPhone Duo simulator. The probe app runs on the outer display (466 × 678 pt), and the driver captures the display that shows it. The glass probe is a SwiftUI app of our own (`app/tools/glass-probe/`, `npm run probe`), built against the iOS 27.1 SDK. It places `glassEffect` shapes at Duo's sizes over stimuli we control, drawn pixel-exact, and captures them losslessly with `simctl io screenshot`. `app/labs/probe.html` then renders the same scenes (`scenes.json`, shared) through our compositor and measures both sides with the same code. It measures functions, not single points:

- displacement against distance from the rim, which gives the profile, bezel, thickness, and ior. The grating is sinusoidal and shifted over 8 phases, so the phase at each pixel says where the content seen there comes from; a tone fill, a lift, or a blur cannot move it. The phase is unwrapped from the shape's centre outward. On a synthetic field with shifts up to 16 pt, the measurement is within 0.03 pt;
- the frost kernel, from how much of the grating's contrast survives at two periods (24 and 48 pt), and how it changes with the shape's size (the sizes scenes). For a Gaussian of σ, contrast falls as exp(−2π²σ²/period²). On our own glass (σ 2.75) it reads 2.8 to 2.95;
- the edge-spread function, which cross-checks the frost;
- output luminance against input luminance in each appearance, which gives the tone curve, the flip threshold, and the hysteresis;
- colour patches, which give tint and dispersion;
- frame-by-frame curves for materialize, morph, and press, which give the springs (planned; `recordVideo`).

Captures stay in `/tmp/duo/`, and only the numbers come in, cited to the simulator. One limit: the simulator has no device motion, so how the specular responds to tilt stays [C].

### Refit to the probe (September 24)

The first probe pass found four structural gaps: frost in one scale, lensing packed into the outer 2 to 3 pt, a tone flip where iOS has a curve, and a dim rim. Version 0.2 above closes them. Against iOS, with every scene measured the same way:

- tone within 1.4 levels over 112 grey tiles in four scenes;
- colour: violet 58, 59, 97 reads 83, 85, 128 against iOS's 82, 83, 128;
- lensing within 1.1 pt (regular) and 0.5 pt (clear) across the profile;
- an edge through the capsule 26 pt wide against 27;
- the rim and hairline within a few levels around the circumference.

Four things were learned by fitting, not assumed:

- the lensing band follows the corner radius, not the shape's size;
- the rim's shift grows faster than the band;
- the tone curve maps luma and keeps the colour;
- iOS blurs in sRGB.

Frost by size (September 24, [the sizes note](research/2026-09-24-glass-probe-sizes.md)): large glass frosts more by its short side, not its area, and clear glass does not. A share of the narrow frost moves into a blur about 10 pt wider, the same at every size and slider position. It is applied before the lensing, which keeps the band's contrast where iOS keeps it.

What remains:

- **The narrow frost at the rim.** Blurred after the lensing (the first refit's choice), it loses half the contrast in the outer 5 pt, where the lens squeezes the content; iOS keeps it, as a blur before the lensing does. At full size the two look alike, so decide by looking at the ends at several tints, then recalibrate. This loss also makes our phase unreadable at the rim, which is the calibration's large centre-line lensing error on the 220 × 96 capsule, not the lensing.
- **A faint vignette** inside the band on flat content (2 to 4 levels darker at the sides). Large round glass shows dark crescents in the band that ours draws faintly; possibly the same thing, larger on large shapes.
- **Clear glass's rim** follows another law (99, 123, 115 over levels 0, 57, 113); ours fits regular's rim to 1.5 levels but clear's only to 26.
- **Whether system controls flip** between light and dark.
- **Motion:** materialize, morph, and press.

### First probe results (iOS 27.0, September 24; before the refit)

[The note](research/2026-09-24-glass-probe-ios27.0.md) has the numbers. Four things in the model are structurally wrong, and one image-derived target was wrong:

- **Frost has two scales.** About 45% of the content is blurred by σ ≈ 4 pt (more on large shapes: 7.8 on a 360 × 180 panel); the rest is blurred so widely that it carries no detail. Ours has one σ (2.75) and keeps three times the contrast. The R1-derived target (σ 2 to 3.5, an edge 5 to 9 pt wide) is contradicted: iOS spreads an edge over 27 pt.
- **Lensing is wide and gradual.** A magnifying band about 0.17 of the short side deep (8.5 pt on a 48 pt button, 16 pt on a 96 pt capsule), decaying roughly exponentially from 14 to 35 pt at the rim. Ours bends only the outer 2 to 3 pt.
- **Tone is a curve per appearance, not a flip.** With a raw `glassEffect` it never flipped. In dark it lifts black by 32 and compresses toward 185. In light it follows 132 + 0.476 · level. Clear adds 32 to 22 and never dims (the 35% layer is the app's choice).
- **The rim is bright** (90 over black on regular, 131 on clear), with a dark hairline outside, and there is almost no shadow.

iOS 27.1 on the iPhone Duo simulator gives the same numbers to the first decimal (same note), so these are the targets for refitting the compositor.
