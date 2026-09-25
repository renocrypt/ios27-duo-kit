# Glass probe, first pass: iOS 27.0 (September 24, 2026)

Liquid Glass as iOS renders it, measured with the glass probe (`app/tools/glass-probe/`, `app/labs/probe.html`). The probe app was built with Xcode 27.1 beta's SDK and run on the iPhone 18 Pro simulator with iOS 27.0, before the iOS 27.1 runtime (and so the iPhone Duo simulator) was installed. The material does not depend on the device, and shapes are sized in points. Raw `glassEffect` views (`.regular`, `.clear`), with no toolbar or button styles. The captures are in `.references/glass-probe/captures/iphone18pro-27.0-main/default/`. The colour pipeline was checked: the reference captures match the requested stimulus to an RMSE of 0.1 to 0.8 of 255; the only outliers are the Dynamic Island's pixels. Values are sRGB 0 to 255, lengths are in points, and "ours" is the compositor as of this date.

## Frost: two scales, not one

The contrast of a sinusoidal grating left inside the shape (at 35% inset) is the modulation below. The stimulus amplitude is 35, dark, from 20 to 90.

| Shape | Modulation at 24 pt | Modulation at 48 pt | σ of the narrow blur | Narrow share |
| --- | --- | --- | --- | --- |
| 48 regular | 7.8 | 11.5 | 3.9 | about 0.44 |
| 56 × 150 regular | 8.0 | 11.7 | 3.8 | about 0.45 |
| 220 × 96 regular | 5.8 | 9.9 | 4.6 | about 0.43 |
| 360 × 180, r 40, regular | 1.5 | 7.2 | 7.8 | about 0.4 |
| 48 clear | 31.6 | 33.0 | 1.3 | about 0.95 |
| ours, any regular | 24.3 | 29.8 | 2.8 to 2.95 | 1 |

- A single Gaussian cannot give both periods. The fit that does is a mixture:
  - about 45% of the content blurred by σ ≈ 4 pt, with σ growing with size (7.8 on the panel);
  - the rest blurred so widely that it carries no grating at all.
- This matches Apple's words: larger glass has "softer scattering".
- The edge test says the same. An edge seen through the 76 × 220 capsule is 27 pt wide (10 to 90%), in dark and in light.
- Ours keeps 69% of the contrast at 24 pt; iOS keeps 22%.
- The R1-derived target, frost σ 2 to 3.5 and an edge 5 to 9 pt wide, fitted on September 24, is contradicted. Either the Dock is a different material, or the marketing image misled us.
- Clear is nearly transparent: σ 1.3 pt, with about 95% of the contrast kept.

## Lensing: a wide, gradual band

Below is the inward displacement across the shape's middle: where the content seen at a depth inside the rim comes from, in pt. It is the same along x and y, and in dark and in light.

| Depth → | 0.5 | 1.5 | 2.5 | 3.5 | 5.5 | 7.5 | 10.5 | 14.5 | Band (≥ 1 pt) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 48 regular | 13.9 | 11.5 | 9.0 | 6.9 | 4.1 | 2.0 | 0.1 | −0.3 | 8.5 |
| 56 × 150 regular (across 56) | 14.7 | 14.3 | 11.2 | 8.9 | 5.6 | 3.2 | 0.8 | −0.3 | 9.8 |
| 220 × 96 regular | 34.6 | 30.1 | 24.6 | 20.5 | 14.8 | 10.4 | 5.8 | 1.9 | 15.8 |
| 360 × 180 regular (across 180) | 33.9 | 35.3 | 31.3 | 27.3 | 20.0 | 13.0 | 6.5 | 1.5 | 25.8 |
| 48 clear | 23.7 | 18.5 | 15.0 | 12.4 | 8.4 | 5.5 | 2.5 | 0.4 | 12.8 |
| ours, 48 regular (depth + 0.25) | 18.9 | 9.7 | 5.5 | 3.0 | 0.7 | 0.1 | 0.1 | 0.0 | 4.8 |
| ours, 220 × 96 (depth + 0.25) | 22.2 | 20.6 | 16.2 | 12.7 | 7.5 | 4.1 | 1.3 | 0.1 | 10.8 |

- The sign is that of a magnifying lens: the rim shows content from further inside.
- iOS decays gradually, roughly exponentially with a length of about 4.5 pt on a 48 pt shape. Its band scales with the shape, at about 0.17 of the short side.
- Ours packs its bending into the outer 2 to 3 pt (profile k 4, bezel 8), so its band is about half of iOS's.
- Clear bends more than regular at the same size.

## Tone: a smooth curve per appearance, with no flip

Below is a 48 pt shape over a flat grey tile (96 pt), measured at the centre. With a raw `glassEffect`, iOS 27.0 did not flip between light and dark at any level. The output follows the appearance.

| Level under the glass | 0 | 28 | 57 | 85 | 113 | 142 | 170 | 198 | 227 | 255 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| regular, dark | 32 | 59 | 84 | 105 | 125 | 142 | 156 | 168 | 178 | 185 |
| regular, light | 132 | 146 | 161 | 174 | 188 | 201 | 214 | 227 | 240 | 253 |
| clear (either appearance) | 32 | 59 | 86 | 113 | 140 | 168 | 194 | 221 | 249 | 255 |
| ours, regular (either) | 25 | 53 | 82 | 107 | 123 | 194 | 206 | 228 | 254 | 255 |
| ours, clear, dark | 7 | 36 | 64 | 92 | 119 | 146 | 172 | 199 | 191 | 214 |

- Regular in light is linear: out ≈ 132 + 0.476 · level.
- Regular in dark lifts black by 32 and compresses toward 185; its slope is 1 at black and 0.25 at white.
- Clear adds about 32 at black and about 22 near white, and dims nothing. The HIG's 35% dimming layer is the app's choice, not automatic; ours adds it automatically.
- Whether system controls (toolbars, glass buttons) flip where raw glass does not is open. The next pass adds them.

## Rim and shadow

- The rim is a bright line just inside the silhouette, with a dark hairline outside it.
- Brightest pixel within 1.5 pt of the top edge:
  - regular, dark: 90 over black, 168 over 113, 255 from 227;
  - regular, light: 175 over black;
  - clear: 131 over black, 255 from 94.
- Ours: 46 over black (regular), 38 (clear).
- There is almost no shadow: 6 pt below the shape, the content is darkened by 1 to 3 levels. Ours is darkened by about 1 in dark and about 6 in light.

## Confirmed on iOS 27.1, iPhone Duo (same day)

Every scene was repeated on the iPhone Duo simulator (iOS 27.1, build 24A94401, the outer display at 466 × 678 pt, 3x); the captures are in `.references/glass-probe/captures/duo-27.1-outer/default/`. The numbers match the table above to the first decimal: frost σ 3.89 (48 regular) and 1.3 (clear); the lensing profiles within 0.1 pt; the tone curves and the rims level for level. The only differences are on the 360 × 180 panel, whose modulation is so low that its phase is noise. So the material is the same in 27.0 and 27.1 and does not depend on the device, and the renderer is deterministic.

## The clear-to-tinted slider (Settings > Liquid Glass)

The slider is UIKit's `UIViewGlassTintAmount`, from 0 (clear) to 1 (tinted), in `com.apple.UIKit`. The probe sets it with `simctl spawn … defaults write` (`probe.ts --tint`). Five positions were captured on the iPhone Duo, which was open, so these are on the inner display. The captures are in `.references/glass-probe/captures/duo-27.1-inner/tint-*/`.

**The default is the middle.** An untouched device matches 0.5 in every measurement, and every table above was measured at 0.5.

| Tint | 0 | 0.25 | 0.5 | 0.75 | 1 |
| --- | --- | --- | --- | --- | --- |
| regular dark, level 0 → 255 | 32 → 185 | 32 → 185 | 32 → 185 | 28 → 142 | 32 → 108 |
| regular light, level 0 → 255 | 102 → 252 | 117 → 252 | 132 → 253 | 155 → 253 | 178 → 253 |
| 48 regular, grating contrast at 24 / 48 pt | 19.6 / 21.4 | 13.2 / 16.1 | 7.8 / 11.5 | 2.8 / 6.1 | 0.5 / 2.5 |
| edge through the 48 regular | 6 pt | 8.7 | 17 | 18.7 | 20 |
| 48 clear, grating contrast at 24 / 48 pt | 33.3 / 33.5 | 32.3 / 33.2 | 31.6 / 33.0 | 15.5 / 19.2 | 0.7 / 5.5 |
| saturation, regular / clear | 1.21 / 1.05 | 1.18 / 1.05 | 1.18 / 1.05 | 0.90 / 0.97 | 0.63 / 0.92 |

- Toward tinted, regular glass frosts more: σ 1.8 → 7.7 pt, and the wide share rises 0.25 → 0.8.
- The dark curve holds until 0.5, then compresses toward a dark grey.
- The light curve lifts throughout.
- The colour desaturates past the middle.
- Clear glass keeps its tone curve at every tint, but frosts past 0.5.
- The lensing does not change.
