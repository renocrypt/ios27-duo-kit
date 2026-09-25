/**
 * GLSL for the Liquid Glass compositor (docs/liquid-glass.md).
 * Coordinates in the glass passes are screen points (pt), origin top-left, y down, z out of the screen.
 */

export const MAX_SHAPES = 16;

const SDF = /* glsl */ `
// Inigo Quilez: rounded box with per-corner radii r = (tr, br, tl, bl), in a y-down frame
// (so "top" here means smaller y: we swap the vertical corner pairs to keep the names honest).
float sdRoundBox(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x  = (p.y < 0.0) ? r.x  : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}
// Polynomial smooth minimum (iq); returns the blend weight in h.
float smin(float a, float b, float k, out float h) {
  if (k <= 0.0) { h = a < b ? 0.0 : 1.0; return min(a, b); }
  float kk = 4.0 * k;
  float m = max(kk - abs(a - b), 0.0) / kk;
  h = a < b ? 0.5 * m * m : 1.0 - 0.5 * m * m; // weight toward b
  return min(a, b) - m * m * kk * 0.25;
}
`;

const SHAPES = /* glsl */ `
#define MAX_SHAPES ${MAX_SHAPES}
uniform int uCount;
uniform vec4 uRect[MAX_SHAPES];    // centre.xy, half-size.xy (pt)
uniform vec4 uRadii[MAX_SHAPES];   // tr, br, tl, bl (pt)
uniform vec4 uOptA[MAX_SHAPES];    // ior (dispersion only), rim shift (pt), band (pt), profile
uniform vec4 uOptB[MAX_SHAPES];    // size share (large glass's further blur), dispersion, frost, blur mix (0 clear's blur .. 1 regular's)
uniform vec4 uOptC[MAX_SHAPES];    // rim, wide share, saturation, shadow
uniform vec4 uTint[MAX_SHAPES];    // rgb, custom tint strength (0 = content-derived tone only)
uniform vec4 uState[MAX_SHAPES];   // presence, clear (0/1), group, may flip (0/1)
uniform vec4 uTouch[MAX_SHAPES];   // x, y (pt), strength, radius (pt)
uniform float uSpacing;            // container spacing (pt): merge radius within a group

uniform vec2 uSize;               // screen size in pt
vec2 toUv(vec2 p) { return vec2(p.x, uSize.y - p.y) / uSize; }

float shapeSDF(int i, vec2 p) {
  return sdRoundBox(p - uRect[i].xy, uRect[i].zw, uRadii[i]);
}

// Scene SDF: the nearest shape's group is smooth-unioned (container spacing), other groups join
// with a hard min. w[] receives each shape's share of the material at p (softmax on distance
// within the group), so merging shapes also blend their parameters. Shapes must be sorted by group.
float sceneSDF(vec2 p, out float w[MAX_SHAPES]) {
  float di[MAX_SHAPES];
  float dmin = 1e5; int nearest = -1;
  for (int i = 0; i < MAX_SHAPES; i++) {
    di[i] = 1e5; w[i] = 0.0;
    if (i >= uCount || uState[i].x <= 0.001) continue;
    di[i] = shapeSDF(i, p);
    if (di[i] < dmin) { dmin = di[i]; nearest = i; }
  }
  if (nearest < 0) return 1e5;
  float group = uState[nearest].z;
  float dg = 1e5, dother = 1e5;
  bool first = true;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (di[i] >= 1e5) continue;
    if (uState[i].z == group) {
      if (first) { dg = di[i]; first = false; }
      else { float h; dg = smin(dg, di[i], uSpacing * 0.5, h); } // bridges once the gap < spacing
    } else {
      dother = min(dother, di[i]);
    }
  }
  float tau = max(uSpacing * 0.5, 0.5), sum = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (di[i] < 1e5 && uState[i].z == group) { w[i] = exp(-(di[i] - dmin) / tau); sum += w[i]; }
  }
  for (int i = 0; i < MAX_SHAPES; i++) w[i] /= max(sum, 1e-6);
  return min(dg, dother);
}

float sceneD(vec2 p) { float w[MAX_SHAPES]; return sceneSDF(p, w); }
`;

export const fullscreenVertex = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const SRGB = /* glsl */ `
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
`;

// Lensing as iOS draws it (glass probe): the content seen at depth u inside the rim comes from
// D(u) further in, along the SDF's normal g. D is largest at the rim and falls exponentially
// (e-fold λ = profile × band) to zero at the band's inner edge, so the interior is flat.
// Dispersion splits it per channel by n - 1. A: ior, rim shift, band, profile (blended).
const LENS = /* glsl */ `
// The lens's normal: the SDF's gradient over a step of uSoften × the band, so it turns gradually where
// a cap meets a straight side, as on iOS's continuous-curvature shapes (the probe's capsules keep
// bending content well past the cap); on a circle it is the exact radial normal.
uniform float uSoften;
vec2 lensNormal(vec2 p, float band) {
  vec2 e = vec2(max(uSoften * band, 0.5), 0.0);
  vec2 g = vec2(sceneD(p + e.xy) - sceneD(p - e.xy), sceneD(p + e.yx) - sceneD(p - e.yx));
  return length(g) > 1e-5 ? normalize(g) : vec2(0.0);
}
void lensSources(vec2 p, float d, vec2 g, vec4 A, float dispersion, float presence, out vec2 q[3]) {
  float ior = A.x, lens = A.y * presence, bezel = max(A.z, 0.5), k = A.w;
  float u = clamp(-d, 0.0, bezel);
  float lam = max(k * bezel, 0.05);
  float eb = exp(-bezel / lam);
  float shift = lens * max(exp(-u / lam) - eb, 0.0) / (1.0 - eb);
  float halfSpread = (ior - 1.0) * 0.025 * dispersion;
  vec3 iors = vec3(ior - halfSpread, ior, ior + halfSpread);
  for (int ch = 0; ch < 3; ch++) q[ch] = p - g * shift * (iors[ch] - 1.0) / max(ior - 1.0, 1e-3);
}
`;

/**
 * Separable Gaussian blur, one axis per pass: the frost. `uStep` is one destination texel along the
 * axis (in uv), `uSigma` the standard deviation in those texels. A true Gaussian, so the frost has
 * the physical width its token states (a Kawase pyramid only doubles). It averages in sRGB, as iOS
 * does (an edge between two colours blurs to their sRGB midpoint), and stores linear light.
 */
export const gaussian = /* glsl */ `
uniform sampler2D uSource; uniform vec2 uStep; uniform float uSigma;
in vec2 vUv; out vec4 outColor;
${SRGB}
vec3 at(vec2 uv) { return toSrgb(texture(uSource, uv).rgb); }
void main() {
  float s = max(uSigma, 0.35);
  float r = min(ceil(3.0 * s), 64.0);
  vec3 sum = at(vUv); float wsum = 1.0;
  for (int i = 1; i <= 64; i++) {
    if (float(i) > r) break;
    float w = exp(-0.5 * float(i * i) / (s * s));
    sum += (at(vUv + uStep * float(i)) + at(vUv - uStep * float(i))) * w;
    wsum += 2.0 * w;
  }
  outColor = vec4(toLinear(sum / wsum), 1.0);
}`;

/**
 * Refract pass: the content as the glass shows it, displaced by the lensing (per channel), and the
 * plain content outside the glass. The narrow frost blurs this, in screen space: iOS scatters after
 * refracting, so content the rim compresses blurs into smooth bands (glass probe).
 */
export const refractFragment = /* glsl */ `
${SDF}
${SHAPES}
${LENS}
uniform sampler2D uContent;
uniform float uReach;           // pt beyond the silhouette the narrow blur reaches (3σ)
in vec2 vUv; out vec4 outColor;
void main() {
  vec2 p = vUv * uSize;
  p.y = uSize.y - p.y;
  float w[MAX_SHAPES];
  float d = sceneSDF(p, w);
  // Just outside the glass, within the blur's reach, the rim's own refraction continues, so the
  // frost at the rim sees only what the glass shows (iOS keeps the full shift at the rim).
  if (d >= uReach) { outColor = vec4(texture(uContent, vUv).rgb, 1.0); return; }
  d = min(d, 0.0);
  vec4 A = vec4(0.0); float dispersion = 0.0, presence = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uCount || w[i] <= 0.0) continue;
    A += uOptA[i] * w[i]; dispersion += uOptB[i].y * w[i]; presence += uState[i].x * w[i];
  }
  vec2 q[3];
  lensSources(p, d, lensNormal(p, A.z), A, dispersion, presence, q);
  outColor = vec4(texture(uContent, toUv(q[0])).r, texture(uContent, toUv(q[1])).g, texture(uContent, toUv(q[2])).b, 1.0);
}`;

/**
 * Measure pass: one texel per shape. Records the mean luminance (r) and local contrast (g) of the
 * content under the shape, smoothed over time against the previous frame (b = tone, 0 dark .. 1 light,
 * with hysteresis). The compositor reads it; the CPU can read it back to flip glyph colours.
 */
export const measureFragment = /* glsl */ `
${SDF}
${SHAPES}
uniform sampler2D uContent; uniform sampler2D uFrostLarge; uniform sampler2D uPrevious;
uniform float uBlend;
uniform float uFresh;            // 1 on the first measure of a new view: decide at mid grey, no memory
in vec2 vUv; out vec4 outColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  int i = int(floor(vUv.x * float(MAX_SHAPES)));
  vec4 prev = texture(uPrevious, vUv);
  if (i >= uCount) { outColor = vec4(0.5, 0.0, 0.5, 1.0); return; }
  vec2 c = uRect[i].xy, h = uRect[i].zw * 0.7;
  vec2 taps[9] = vec2[9](vec2(0.0), vec2(-h.x, -h.y), vec2(h.x, -h.y), vec2(-h.x, h.y), vec2(h.x, h.y),
                         vec2(0.0, -h.y), vec2(0.0, h.y), vec2(-h.x, 0.0), vec2(h.x, 0.0));
  float L = 0.0, C = 0.0;
  for (int k = 0; k < 9; k++) {
    vec2 uv = toUv(c + taps[k]);
    float sharp = luma(texture(uContent, uv).rgb);
    float soft = luma(texture(uFrostLarge, uv).rgb);
    L += soft; C += abs(sharp - soft);
  }
  L /= 9.0; C = clamp(C / 9.0 * 6.0, 0.0, 1.0);
  // Tone with hysteresis, in perceptual terms: linear luminance 0.184 is L* 50 (mid grey).
  // Flip to light above L* 56 (0.24), to dark below L* 44 (0.14).
  // A new view starts fresh: a control's tone never carries over from whatever held its slot before.
  if (uFresh > 0.5) { outColor = vec4(L, C, L > 0.184 ? 1.0 : 0.0, 1.0); return; }
  float tone = prev.b;
  if (L > 0.24) tone = 1.0; else if (L < 0.14) tone = 0.0;
  vec3 next = vec3(L, C, tone);
  outColor = vec4(mix(prev.rgb, next, uBlend), 1.0);
}`;

/** The glass composite: content, then every glass shape on the screen in one pass. */
export const compositeFragment = /* glsl */ `
${SDF}
${SHAPES}
${LENS}
uniform sampler2D uContent;      // sharp content layer
uniform sampler2D uFrostSmall;   // the refracted content blurred by clear glass's σ (screen space)
uniform sampler2D uFrostLarge;   // the refracted content blurred by regular glass's σ (screen space)
uniform sampler2D uFrostSize;    // the content blurred by regular glass's σ and sizeBlur on top, for large glass
uniform sampler2D uFrostWide;    // the wide blur: the colour around, no detail (blurWide)
uniform sampler2D uCurve;        // tone curves, sRGB in (x) to sRGB out (r): rows regular dark, regular light, clear
uniform vec4 uHair;              // hairline: width (pt), multiply (dark), subtract (light, clear), light-top share
uniform vec3 uToneLight;         // light-toned glass colour (linear)
uniform vec3 uToneDark;          // dark-toned glass colour (linear)
uniform sampler2D uMeasure;      // per-shape luminance, contrast, tone
uniform sampler2D uForeground;   // glyphs and labels above the glass (premultiplied alpha)
uniform float uHasForeground;
uniform vec3 uLight;             // key light direction in screen space (x right, y down, z out): its xy is the rim's axis
uniform float uAppearance;       // 0 dark, 1 light: the tone of large (non-flipping) glass
uniform float uContrast;         // Increase Contrast
uniform float uTransparency;     // Reduce Transparency
uniform float uFlipArea;         // pt^2
in vec2 vUv; out vec4 outColor;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
${SRGB}
vec3 content(vec2 p) { return texture(uContent, toUv(p)).rgb; }
// The frost in two scales (docs/liquid-glass.md): the narrow blur (clear's or regular's σ) of the
// refracted content, read at the pixel p, keeps the shapes of the content; the wide blur of the
// content, read at the source q, only its colour. Large glass blurs a share of the narrow further,
// before the lensing (read at the source too): the rim's squeezed content keeps its contrast.
vec3 frosted(vec2 p, vec2 q, float narrowMix, float sized, float wide) {
  vec3 narrow = mix(toSrgb(texture(uFrostSmall, toUv(p)).rgb), toSrgb(texture(uFrostLarge, toUv(p)).rgb), narrowMix);
  narrow = mix(narrow, toSrgb(texture(uFrostSize, toUv(q)).rgb), sized);
  return toLinear(mix(narrow, toSrgb(texture(uFrostWide, toUv(q)).rgb), wide)); // mixed in sRGB, as the blurs
}
// A tone curve on sRGB luma (row: 0 regular dark, 1 regular light, 2 clear).
float curve1(float x, float row) { return texture(uCurve, vec2((clamp(x, 0.0, 1.0) * 255.0 + 0.5) / 256.0, (row + 0.5) / 3.0)).r; }

void main() {
  vec2 p = vUv * uSize;
  p.y = uSize.y - p.y; // texture v runs up; points run down

  float w[MAX_SHAPES];
  float d = sceneSDF(p, w);
  vec3 base = content(p);

  // Blend the per-shape parameters with the merge weights.
  vec4 A = vec4(0.0), B = vec4(0.0), C = vec4(0.0), T = vec4(0.0), S = vec4(0.0), M = vec4(0.0);
  float presence = 0.0, touch = 0.0, area = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uCount || w[i] <= 0.0) continue;
    A += uOptA[i] * w[i]; B += uOptB[i] * w[i]; C += uOptC[i] * w[i]; T += uTint[i] * w[i]; S += uState[i] * w[i];
    M += texture(uMeasure, vec2((float(i) + 0.5) / float(MAX_SHAPES), 0.5)) * w[i];
    presence += uState[i].x * w[i];
    area += 4.0 * uRect[i].z * uRect[i].w * w[i];
  }
  // Touch light spreads across the touched shape and onto its merged neighbours (same group).
  int nearestGroupShape = 0; float best = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) if (w[i] > best) { best = w[i]; nearestGroupShape = i; }
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uCount || uState[i].z != uState[nearestGroupShape].z) continue;
    float tr = max(uTouch[i].w, 1.0);
    touch += uTouch[i].z * exp(-pow(length(p - uTouch[i].xy) / tr, 2.0));
  }

  // Outside the glass: content with the glass's adaptive shadow, cast slightly down.
  float shadowStrength = C.w * mix(0.7, 1.4, M.g) * presence; // deeper over text, lighter over calm fields (A6)
  vec2 shadowOffset = vec2(0.0, 3.0);
  float ds = sceneD(p - shadowOffset);
  float shadow = shadowStrength * (1.0 - smoothstep(-2.0, 14.0, ds));
  vec3 outside = base * (1.0 - shadow);

  // Tone and the rim's axis, shared by the hairline outside and the body inside. Small glass may
  // flip with the content under it (measured, with hysteresis); clear glass ignores the appearance.
  float clearGlass = S.y;
  float mayFlip = S.w * (1.0 - clearGlass);
  float tone = mix(uAppearance, M.b, mayFlip);
  float lightness = max(tone, clearGlass);
  if (d >= uHair.x) { // beyond the hairline: nothing of the glass but its shadow
    vec4 fg = texture(uForeground, vUv) * uHasForeground;
    outColor = vec4(outside * (1.0 - fg.a) + fg.rgb, 1.0);
    return;
  }
  vec2 e = vec2(0.5, 0.0);
  vec2 g = vec2(sceneD(p + e.xy) - sceneD(p - e.xy), sceneD(p + e.yx) - sceneD(p - e.yx));
  g = length(g) > 1e-5 ? normalize(g) : vec2(0.0);
  // The rim's axis: vertical at rest (as iOS draws it), turning with the light once the light leans
  // clearly across the screen, so a frontal light never makes it spin.
  float lean = length(uLight.xy);
  vec2 axis = normalize(mix(vec2(0.0, -1.0), lean > 1e-4 ? uLight.xy / lean : vec2(0.0, -1.0), smoothstep(0.15, 0.6, lean)));
  float facing = dot(g, axis); facing *= facing; // cos² of the angle between the rim's normal and the light axis

  // The hairline: a dark line just outside the silhouette where the rim runs along the axis.
  if (d > 0.0 && d < uHair.x) {
    float k = (1.0 - smoothstep(0.4 * uHair.x, uHair.x, d)) * ((1.0 - facing) + lightness * uHair.w * facing) * presence;
    vec3 o = toSrgb(outside);
    o = mix(o * (1.0 - (1.0 - uHair.y) * k), max(o - uHair.z * k, 0.0), lightness);
    outside = toLinear(o);
  }

  // Coverage over one pixel, as iOS draws the silhouette: crisp, so the rim and hairline keep their width.
  float aa = max(fwidth(d), 1e-3);
  float coverage = clamp(0.5 - d / aa, 0.0, 1.0);
  if (coverage <= 0.0) {
    vec4 fg = texture(uForeground, vUv) * uHasForeground;
    outColor = vec4(outside * (1.0 - fg.a) + fg.rgb, 1.0);
    return;
  }

  // Materialise by scaling the optics (presence scales the lensing), never by fading.
  float sized = B.x, dispersion = B.y, frost = B.z, narrowMix = B.w, wide = C.y;
  frost = mix(frost, 1.0, uTransparency);
  vec2 q[3];
  lensSources(p, d, lensNormal(p, A.z), A, dispersion, presence, q);
  vec3 refracted = vec3(0.0);
  for (int ch = 0; ch < 3; ch++) refracted[ch] = mix(content(q[ch]), frosted(p, q[ch], narrowMix, sized, wide), frost)[ch];

  // The body: the tone curve of the variant and tone applied to the frosted content (measured on
  // iOS: docs/research/2026-09-24-glass-probe-ios27.0.md). The clear-to-tinted slider changes the
  // curves and the frost, both rebuilt on the CPU for its position.
  // The curve maps the luma; the colour around it is kept and slightly saturated (iOS: violet
  // 58, 59, 97 under regular dark glass reads 82, 83, 128).
  vec3 under = toSrgb(refracted);
  float Y = luma(under);
  float Yt = clearGlass > 0.5 ? curve1(Y, 2.0) : mix(curve1(Y, 0.0), curve1(Y, 1.0), tone);
  vec3 toned = clamp(vec3(Yt) + C.z * (under - Y), 0.0, 1.0);
  vec3 bodyS = toned;
  // Prominent (tinted) controls, Reduce Transparency, and Increase Contrast cover the body with a
  // fill: the tint, or the tone's colour.
  vec3 toneColor = mix(uToneDark, uToneLight, tone);
  vec3 tinted = T.rgb * mix(0.86, 1.04, M.r);
  toneColor = mix(toneColor, tinted, T.a);
  float fill = max(T.a * 0.97, max(uTransparency * 0.8, uContrast * 0.94));
  vec3 body = mix(toLinear(bodyS), toneColor, clamp(fill, 0.0, 0.97));

  // The rim: a bright line along the silhouette where it faces the light axis (cos⁴),
  // added in sRGB. With the stage's light the pattern turns as the device moves.
  // It adds less over a brighter body (iOS: +50, +39, +30 of 255 over bodies of 39, 130, 189) and
  // e-folds over 0.65 pt inward.
  vec3 bodyOut = toSrgb(body);
  float rimLine = C.x * (1.0 - 0.55 * luma(bodyOut)) * facing * facing * exp(-max(-d, 0.0) / 0.65) * presence;
  vec3 color = toLinear(min(bodyOut + rimLine, 1.0));

  // Touch: light spreading from the finger, inside the glass.
  color += vec3(touch) * 0.35;

  // Increase Contrast: a contrasting 1 pt border.
  float border = (1.0 - smoothstep(0.0, 1.0, -d)) * uContrast;
  color = mix(color, vec3(1.0 - tone), border);

  vec3 result = mix(outside, color, coverage);
  vec4 fg = texture(uForeground, vUv) * uHasForeground;
  outColor = vec4(result * (1.0 - fg.a) + fg.rgb, 1.0);
}`;
