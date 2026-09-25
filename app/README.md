# Duo app

The presentation and everything it is built from: a physically modelled iPhone Duo in Three.js, its screens running Duo's system UI through HTML-in-Canvas and a Liquid Glass compositor, motion by Anime.js. Chrome only (`../AGENTS.md`).

## Run

```sh
npm install
npm run dev     # http://127.0.0.1:5190/ (tokens compile on start and on every token edit)
npm run check   # everything: tokens, types, the hinge sweep, the production build
npm run fold    # re-solve the display's fold table (tools/fold-elastica.ts)
npm run probe   # capture Liquid Glass from the iPhone Duo simulator: every set in tools/glass-probe/scenes.json
                # (then open /labs/probe.html?calibrate to derive tokens/glass.sim.tokens.json from the captures)
```

The dev server must be able to listen on a local port; inside Claude Code's sandbox that needs `sandbox.network.allowLocalBinding: true`. The production build is the presentation alone; the labs are dev-server pages.

## Layout

Each module documents its API in its header. Dependencies run one way, with no cycles: `journey` → `hub`, `scene`, `surface`; `hub` → `kit`; `scene` → `device`, `glass`, `surface`; `surface` → `glass` (types); `device`, `glass` → `tokens`. `kit` depends on nothing but the tokens' CSS.

| Path | What |
| --- | --- |
| `index.html`, `src/main.ts` | The presentation, "a day with Duo" (`window.duo` = `{ stage, journey, surfaces }`) |
| `tokens/` | Design tokens (DTCG), the source of truth; compiled into `src/tokens/` (generated, do not edit). `glass.sim.tokens.json` is generated too: Liquid Glass as measured on iOS (`/labs/probe.html?calibrate`) |
| `src/kit/` | Duo's system UI, reusable: `chrome.ts` (rail, portrait top bar, outer sheet, island, controls as data, `glass()`), `status.ts` (the status indicator), `icons.ts` (our symbols, drawn to SF Symbols' extents and weights) |
| `src/hub/` | The hub's screens: content only, chrome from `kit/` |
| `src/surface/` | `ScreenSurface`: a screen's DOM rendered into textures with HTML-in-Canvas; `[data-glass]` boxes become glass shapes |
| `src/glass/` | The Liquid Glass compositor and its shaders (`../docs/liquid-glass.md`) |
| `src/device/` | The 3D device from `spec.ts` (mm, measured from Apple's AR model): outlines, lofts, height fields, parts, the fold (elastica, `foldTable.json` generated), the hinge section, the display material |
| `src/scene/` | The Three.js stage: studio light per mood (blended), framing camera, postures, the device's screens |
| `src/journey/` | The journey: scenes as data (`scenes.ts`) and the scroll controller |
| `src/labs/`, `labs/*.html` | Dev tools (below) |
| `tools/` | Token compiler, fold solver, hinge check, Vite plugins (tokens; fonts and reference files, dev only), `usd/` (Python: measure Apple's AR model), `glass-probe/` (capture Liquid Glass from the iOS simulator; the calibration's report), `apple-docs/` (Apple's documentation pages and talk transcripts as text) |

## Labs (dev server only)

| Page | What |
| --- | --- |
| `/labs/screens.html` | Every hub screen flat through the real pipeline; `?v=kitchen` shows one large |
| `/labs/stage.html` | The stage with controls: posture, mood, finish, camera, orbit, test patterns |
| `/labs/glass.html` | Liquid Glass review and tuning: shapes, light, accessibility modes, scenes, token export |
| `/labs/glyphs.html` | Our glyphs against Apple's UI Kit frames (`/tmp/duo/ios27-kit/`): IoU and outline deviation; `window.fit(...)` |
| `/labs/inspect.html` | Close-ups of the device at their own fold angles; `?only=N` |
| `/labs/compare.html` | Our model against Apple's AR model (`/tmp/duo/reference/`): overlay, silhouette diff, sections; `window.compare.metrics()` |
| `/labs/probe.html` | Liquid Glass as iOS renders it (captures in `/tmp/duo/glass-probe/captures/`, listed in `catalog.json`) against our compositor on the same scenes, measured by the same code: tone, rim, lensing and contrast against depth, frost σ, edges. `?set=<device>/<set>` picks a capture set; `?calibrate` derives every [SIM] glass token into `tokens/glass.sim.tokens.json` (generated; do not edit), writes a report of every residual to `tools/glass-probe/report.json` and each tint's iOS and ours side by side to `/tmp/duo/glass-probe/inspect/` |
| `/labs/specimen.html` | Every token in light and dark, and the spring check |

## Status (September 24, 2026)

Done and verified in Chrome:
- tokens and the compiler;
- the device model, rebuilt from measurements. Silhouettes match Apple's AR model at IoU 0.998 to 0.9999 in eight views and both poses, and the hinge sweep (`npm run hinge`) shows no overlap at any angle;
- Liquid Glass, fitted to iOS 27.1 itself with the glass probe (`tools/glass-probe/`, `/labs/probe.html`): the tone curves within 1.4 levels, lensing within 1.1 pt, two-scale frost in sRGB that grows with the glass's short side, the rim and hairline around the circumference; prominent (tinted) controls. The specimen shows it rendered by the compositor, next to the standard (blur) materials;
- live screens: DOM interfaces through HTML-in-Canvas and the glass compositor, oriented per posture (Seated turns the inner display 90°, Standing turns the outer 270°);
- the screens' system UI on Apple's iOS 27 UI Kit: rail, status (fitted within 0.02 pt; the time exact), groups, tab bar, portrait top bar, outer sheet; glass tone measured afresh on every new view (no hysteresis carried over from the view before);
- the presentation, "a day with Duo": nine scenes following `../docs/presentation.md`, including the framing rule (the device fills 50 to 64 percent of the short axis), a mood per scene, copy that waits for the frame to settle, and one scene where the viewer can turn the device by hand;
- the display fold as an elastica (see the geometry-pass note), and the inner display's physics: off when closed and waking as it opens (`DUO.inner.wake`), reflections traced within the fold;
- light that agrees with the set: what the device reflects behind it is the backdrop the viewer sees, so dark moods have no false veil on the screens and polished edges still draw their outline;
- performance on the development Mac at 2880 × 1724: idle frames render nothing (stage, glass, and screen repaints all at 0); a frame costs 1.2 to 1.4 ms of GPU time (the fold trace 0.07 ms, a light blend 0.02 ms); device moves hold 120 fps (unfold and fold: max frame 10.3 ms); a scene that swaps a screen's interface misses one or two vsyncs at the swap, when the new view is laid out (no frame reaches 50 ms).

Next, in order:
1. **Symbols to the pixel.** The rail's glyphs are redrawn to SF Symbols' extents and weights, but only the status is verified against the kit's vectors. Add glyph lab cases for the toolbar and tab symbols against measured references (Apple's Mail figures in `/tmp/duo/duo-hig/`), and fit them the way the ring was fitted.
2. **Portrait layouts from Apple's pose slide.** Seated has the kit's top bar; add the bottom toolbar on the lower half where a view needs one, and a portrait split scene (two apps stacked) if the journey calls for it.
3. **Liquid Glass: what is still guessed** (`../docs/liquid-glass.md`, "Refit to the probe"). The static material is done; its remaining gaps are parked there, measured, and not worked on unless the presentation shows them. One probe pass each, through the loop: capture (`npm run probe`), calibrate (`/labs/probe.html?calibrate`), look (`/tmp/duo/glass-probe/inspect/`).
   - glyphs and labels on glass: iOS adapts their colour to the content under the glass; ours are fixed CSS colours. Probe scenes with system controls (glass buttons, a toolbar, a tab bar), which also show whether controls flip;
   - motion: materialize, morph, press (`recordVideo`), and tint. The frost is built from the refracted content, so anything that animates a shape (presence, geometry) rebuilds it every frame: a refract pass and six blur passes per compositor, eight with large glass on screen. Time that before settling how motion drives the compositor.
4. **The inner Home Screen and the Split View multitasking scene.** These are the Duo layouts the journey does not show yet: 8 columns across the fold, the Dock in the rail, and each app's rail on its own outer edge.
5. **Findings from the second review (3/5).**
   - Lighting and materials:
     - neutral white balance on the device in every mood;
     - a satin, not porcelain, titanium frame;
     - back glass with falloff;
     - real lens stacks (iris rings, coating) instead of flat discs;
     - a soft glass sheen on lit screens in every scene;
     - a soft, symmetric crease sheen in Book.
   - Staging:
     - a three-quarter hero that shows the finish;
     - rim light and ground contact in the dark scenes (Standing, Seated);
     - fill of about 0.7 on the scenes that show the UI;
     - a scroll-scrubbed fold for the hinge thesis.
   - Close-ups: slivers at the frame's end caps by the hinge, the spine cap's height at the top edge, the back-glass edge at the camera corner, and the mic holes drawn as outlines.
   - Copy: headline breaks, the drag hint centred under the device, and the side-button glyph instead of Touch ID.
   - Fixed since: the dawn scrub. The copy's ink follows the sky's contrast, the ramp is even, and the clock runs from 6:41 to 6:58.
6. The Night Sky finish in the journey (a scene or a toggle). A sketch for the toggle: in the scene the viewer turns by hand (`scene.turn`), a radio group under the headline, Star White and Night Sky, each a 30 px swatch in the finish's back colour (`tokens.device.finish.*.back`), the checked one ringed.
7. Live details on the screens: the clock ticking, the status levels (`status.ts` animates battery, Wi-Fi, cellular), the Live Activity's progress, the timer.
8. Lay out the next scene's views ahead of the swap, so cuts keep every vsync too.
9. **Performance, after the look work is accepted** (review of September 24, read-only against the numbers above). Frames are inside the 120 fps budget; only these, in order:
   - `GlassCompositor.computeSignature` stringifies the shapes and every glass token on every tick, idle included. Return first when the quantized light, appearance, and content version are unchanged.
   - Both compositors follow the key light through every device or camera move, the inner one even while its display is dark, and each regenerates the output's whole mipmap pyramid after a scissored update. Skip a compositor while its display's emissive is 0; build mipmaps once, when the frost settles.
   - Do not change mesh density, MSAA, the pixel-ratio cap, the 24-frame tone settle, the fold-trace shader, or the frost resolution without a new trace that shows a regression.
