/**
 * Measurements of glass over a known stimulus, on any RGBA frame (an iOS capture or our render),
 * so both sides are measured by the same code. Frames are device pixels; every argument and result
 * is in points unless it says otherwise; colours are sRGB 0..255.
 *
 *   tone(frame, shape)                 body (centre), rim (top), and the shadow below
 *   edgeWidth(frame, shape, edgeY)     10–90% width of a horizontal edge seen through the shape
 *   phaseField(frames, shape, period, axis, window)
 *                                      N-step phase shifting over a sinusoidal grating: at every pixel
 *                                      the displacement (where the content seen there comes from), the
 *                                      modulation, and the mean. Immune to any per-pixel gain and offset
 *                                      (tone fill, lift), and a blur does not move the phase
 *   lensProfile(field, shape, axis)    inward displacement and modulation (the grating's contrast left)
 *                                      against distance inside the rim, across the shape's middle
 */
import type { Placed } from './scene.ts';

/** Device pixels; a frame may cover only part of the window, from (ox, oy) pt. */
export interface Frame { px: Uint8ClampedArray | Uint8Array; w: number; h: number; scale: number; ox?: number; oy?: number }
type RGB = [number, number, number];

export const luma = (f: Frame, i: number) => 0.2126 * f.px[i] + 0.7152 * f.px[i + 1] + 0.0722 * f.px[i + 2];
const index = (f: Frame, x: number, y: number) => (Math.min(f.h - 1, Math.max(0, Math.floor((y - (f.oy ?? 0)) * f.scale))) * f.w + Math.min(f.w - 1, Math.max(0, Math.floor((x - (f.ox ?? 0)) * f.scale)))) * 4;

/** Mean colour over a disc (pt). */
export function meanDisc(f: Frame, cx: number, cy: number, r: number): RGB {
  const s = [0, 0, 0]; let n = 0;
  cx -= f.ox ?? 0; cy -= f.oy ?? 0;
  for (let j = Math.floor((cy - r) * f.scale); j <= Math.ceil((cy + r) * f.scale); j++)
    for (let i = Math.floor((cx - r) * f.scale); i <= Math.ceil((cx + r) * f.scale); i++) {
      const x = (i + 0.5) / f.scale - cx, y = (j + 0.5) / f.scale - cy;
      if (x * x + y * y > r * r || i < 0 || j < 0 || i >= f.w || j >= f.h) continue;
      const k = (j * f.w + i) * 4; s[0] += f.px[k]; s[1] += f.px[k + 1]; s[2] += f.px[k + 2]; n++;
    }
  return s.map((v) => +(v / Math.max(n, 1)).toFixed(1)) as RGB;
}

export function tone(f: Frame, p: Placed) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  let rim: RGB = [0, 0, 0], best = -1;
  for (let d = -1.5; d <= 1.5; d += 1 / f.scale) {
    const k = index(f, cx, p.y + d), l = luma(f, k);
    if (l > best) { best = l; rim = [f.px[k], f.px[k + 1], f.px[k + 2]]; }
  }
  return { centre: meanDisc(f, cx, cy, Math.min(p.w, p.h) * 0.2), rim, below: meanDisc(f, cx, p.y + p.h + 6, 2) };
}

/**
 * Along the shape's vertical centre line, around the edge at edgeY: 10% to 90% of the step. The
 * window is ±30 pt, kept 8 pt inside the shape, so on small shapes it stays out of the rim.
 */
export function edgeWidth(f: Frame, p: Placed, edgeY: number) {
  const cx = p.x + p.w / 2, ys: number[] = [], ls: number[] = [];
  const reach = Math.min(30, edgeY - p.y - 8, p.y + p.h - edgeY - 8);
  for (let y = edgeY - reach; y <= edgeY + reach; y += 1 / f.scale) { ys.push(y); ls.push(luma(f, index(f, cx, y))); }
  const n = Math.round(4 * f.scale);
  const a = ls.slice(0, n).reduce((s, v) => s + v, 0) / n, b = ls.slice(-n).reduce((s, v) => s + v, 0) / n;
  const cross = (q: number) => { const l = a + (b - a) * q; const i = ls.findIndex((v) => (b < a ? v <= l : v >= l)); return ys[Math.max(0, i)]; };
  return { width: +(cross(0.9) - cross(0.1)).toFixed(2), from: +a.toFixed(1), to: +b.toFixed(1) };
}

export interface Field { x0: number; y0: number; w: number; h: number; scale: number; period: number; d: Float32Array; mod: Float32Array; mean: Float32Array }

/**
 * Phase shifting over frames k = 0..N-1 of a grating I = M + A cos(2π(t/period − k/N)), t along axis
 * from the window's centre. Covers the shape's box plus a margin.
 */
export function phaseField(frames: Frame[], p: Placed, period: number, axis: 'x' | 'y', window: { width: number; height: number }, margin = 8): Field {
  const f0 = frames[0], s = f0.scale, N = frames.length, ox = f0.ox ?? 0, oy = f0.oy ?? 0;
  const x0 = Math.max(ox, p.x - margin), y0 = Math.max(oy, p.y - margin);
  const w = Math.round((Math.min(window.width, ox + f0.w / s, p.x + p.w + margin) - x0) * s), h = Math.round((Math.min(window.height, oy + f0.h / s, p.y + p.h + margin) - y0) * s);
  const d = new Float32Array(w * h), mod = new Float32Array(w * h), mean = new Float32Array(w * h);
  const cos = Array.from({ length: N }, (_, k) => Math.cos(2 * Math.PI * k / N)), sin = Array.from({ length: N }, (_, k) => Math.sin(2 * Math.PI * k / N));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = Math.round(x0 * s) + i, Y = Math.round(y0 * s) + j; // window pixels
    const k4 = ((Y - Math.round(oy * s)) * f0.w + X - Math.round(ox * s)) * 4;
    let S = 0, C = 0, M = 0;
    for (let k = 0; k < N; k++) { const l = luma(frames[k], k4); S += l * sin[k]; C += l * cos[k]; M += l; }
    const t = axis === 'x' ? (X + 0.5) / s - window.width / 2 : (Y + 0.5) / s - window.height / 2;
    let dp = Math.atan2(S, C) / (2 * Math.PI) - t / period;
    dp -= Math.round(dp);
    const o = j * w + i;
    d[o] = dp * period; mod[o] = 2 * Math.hypot(S, C) / N; mean[o] = M / N;
  }
  return { x0: Math.round(x0 * s) / s, y0: Math.round(y0 * s) / s, w, h, scale: s, period, d, mod, mean };
}

/** Field value at a point (pt). */
export const fieldAt = (fd: Field, arr: Float32Array, x: number, y: number) =>
  arr[Math.min(fd.h - 1, Math.max(0, Math.floor((y - fd.y0) * fd.scale))) * fd.w + Math.min(fd.w - 1, Math.max(0, Math.floor((x - fd.x0) * fd.scale)))];

/**
 * Across the shape's middle (a row for axis x, a column for y): inward displacement against
 * distance inside the rim, both sides averaged, in 1/scale pt steps. The phase is unwrapped from the
 * centre outward, so shifts beyond half a period are followed, and points whose modulation is below
 * a fifth of the interior's (the rim's highlight, where the phase is noise) are left out (null).
 * The band is the farthest depth still displaced by 1 pt or more.
 */
export function lensProfile(fd: Field, p: Placed, axis: 'x' | 'y') {
  const len = axis === 'x' ? p.w : p.h, step = 1 / fd.scale;
  const at = (arr: Float32Array, u: number) => axis === 'x' ? fieldAt(fd, arr, p.x + u, p.y + p.h / 2) : fieldAt(fd, arr, p.x + p.w / 2, p.y + u);
  const floor = 0.2 * at(fd.mod, len / 2);
  const side = (sign: 1 | -1) => {
    const out = new Map<number, number | null>();
    let prev = 0;
    for (let depth = len / 2 - step / 2; depth > 0; depth -= step) {
      const u = sign > 0 ? depth : len - depth;
      if (at(fd.mod, u) < floor) { out.set(+depth.toFixed(2), null); continue; }
      let v = at(fd.d, u);
      v += Math.round((prev - v) / fd.period) * fd.period;
      prev = v;
      out.set(+depth.toFixed(2), sign * v);
    }
    return out;
  };
  const a = side(1), b = side(-1), profile: { depth: number; inward: number | null; mod: number }[] = [];
  let band = 0, peak = 0;
  for (const [depth, va] of a) {
    const vb = b.get(depth) ?? null;
    const inward = va === null || vb === null ? null : +((va + vb) / 2).toFixed(2);
    const mod = +((at(fd.mod, depth) + at(fd.mod, len - depth)) / 2).toFixed(2);
    profile.push({ depth, inward, mod });
    if (inward === null) continue;
    if (Math.abs(inward) >= 1) band = Math.max(band, depth);
    peak = Math.max(peak, Math.abs(inward));
  }
  profile.sort((x, y) => x.depth - y.depth);
  return { band: +band.toFixed(1), peak: +peak.toFixed(2), profile };
}

/** Mean modulation deep inside the shape (at least `inset` pt from every edge). */
export function interiorModulation(fd: Field, p: Placed, inset: number) {
  let s = 0, n = 0;
  for (let y = p.y + inset; y <= p.y + p.h - inset; y += 1 / fd.scale)
    for (let x = p.x + inset; x <= p.x + p.w - inset; x += 1 / fd.scale) { s += fieldAt(fd, fd.mod, x, y); n++; }
  return n ? s / n : NaN;
}

/**
 * The rim of a round shape, around its circumference (θ from 12 o'clock, clockwise, in 15° steps):
 * how far the brightest pixel within 2 pt inside the silhouette rises above the body (the glass
 * 8 pt inside), and how far the darkest pixel within 2 pt outside falls below the content (4 pt out);
 * `peak` is the brightest pixel's own luma (at 255 the rim is clipped). Luma, 0..255.
 */
export function rimAround(f: Frame, p: Placed) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = Math.min(p.w, p.h) / 2, step = 1 / f.scale;
  const at = (a: number, rad: number) => luma(f, index(f, cx + Math.sin(a) * rad, cy - Math.cos(a) * rad));
  const out: { deg: number; bright: number; dark: number; peak: number }[] = [];
  for (let deg = 0; deg < 360; deg += 15) {
    const a = (deg * Math.PI) / 180;
    const body = at(a, r - 8), bg = at(a, r + 4);
    let hi = -Infinity, lo = Infinity;
    for (let u = r - 2; u <= r; u += step) hi = Math.max(hi, at(a, u));
    for (let u = r; u <= r + 2; u += step) lo = Math.min(lo, at(a, u));
    out.push({ deg, bright: +(hi - body).toFixed(1), dark: +(lo - bg).toFixed(1), peak: +hi.toFixed(1) });
  }
  return out;
}

/** Whether a point (pt) lies inside a placed shape (a rounded rectangle; a capsule without r). */
export function inside(p: Placed, x: number, y: number, inset = 0) {
  const r = Math.min(p.r ?? Math.min(p.w, p.h) / 2, p.w / 2, p.h / 2);
  const qx = Math.abs(x - (p.x + p.w / 2)) - (p.w / 2 - r), qy = Math.abs(y - (p.y + p.h / 2)) - (p.h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r < -inset;
}

/**
 * The displacement fields of two renders compared over a whole shape (pt rms), wherever both still
 * carry a fifth of the interior's contrast: the lens's two-dimensional shape, not one line of it.
 */
export function fieldRms(a: Field, b: Field, p: Placed) {
  const step = 1 / 3, floorA = 0.2 * fieldAt(a, a.mod, p.x + p.w / 2, p.y + p.h / 2), floorB = 0.2 * fieldAt(b, b.mod, p.x + p.w / 2, p.y + p.h / 2);
  let sum = 0, n = 0;
  for (let y = p.y + step / 2; y < p.y + p.h; y += step) for (let x = p.x + step / 2; x < p.x + p.w; x += step) {
    if (!inside(p, x, y, 0.5) || fieldAt(a, a.mod, x, y) < floorA || fieldAt(b, b.mod, x, y) < floorB) continue;
    let dd = fieldAt(a, a.d, x, y) - fieldAt(b, b.d, x, y);
    dd -= Math.round(dd / a.period) * a.period;
    sum += dd * dd; n++;
  }
  return Math.sqrt(sum / Math.max(n, 1));
}
