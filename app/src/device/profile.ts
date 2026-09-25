/**
 * 2D profile curves (cross-sections), in millimetres. Reusable.
 *
 *   smoothProfile(points, perSpan)        centripetal Catmull-Rom through measured points (no overshoot)
 *   resampleSegments(points, anchors, n)  dense curve split at anchor points, each piece resampled at
 *                                         equal arc length, so two profiles with the same anchors and
 *                                         counts line up row by row for lofting
 *   lookup(table, x)                      piecewise-linear lookup in an [x, y] table sorted by x
 */

export type P2 = [number, number];

/** Centripetal Catmull-Rom spline through the points; returns the dense curve and each input point's index in it. */
export function smoothProfile(points: P2[], perSpan = 8): { curve: P2[]; at: number[] } {
  const n = points.length;
  if (n < 3) return { curve: points.slice(), at: points.map((_, i) => i) };
  const curve: P2[] = [];
  const at: number[] = [];
  const get = (i: number): P2 => {
    if (i < 0) return [2 * points[0][0] - points[1][0], 2 * points[0][1] - points[1][1]];
    if (i >= n) return [2 * points[n - 1][0] - points[n - 2][0], 2 * points[n - 1][1] - points[n - 2][1]];
    return points[i];
  };
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const knot = (a: P2, b: P2) => Math.max(1e-9, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    at.push(curve.length);
    for (let k = 0; k < perSpan; k++) {
      const t = t1 + (k / perSpan) * (t2 - t1);
      const lerp = (a: P2, b: P2, ta: number, tb: number): P2 => {
        const w = (t - ta) / (tb - ta);
        return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
      };
      const a1 = lerp(p0, p1, t0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, t0, t2), b2 = lerp(a2, a3, t1, t3);
      curve.push(lerp(b1, b2, t1, t2));
    }
  }
  at.push(curve.length);
  curve.push(points[n - 1]);
  return { curve, at };
}

/** Points at equal arc length along a polyline, both ends included (count + 1 points). */
export function resample(poly: P2[], count: number): P2[] {
  const acc = [0];
  for (let i = 1; i < poly.length; i++) acc.push(acc[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  const total = acc[acc.length - 1];
  const out: P2[] = [];
  let j = 0;
  for (let k = 0; k <= count; k++) {
    const target = (k / count) * total;
    while (j < poly.length - 2 && acc[j + 1] < target) j++;
    const w = (target - acc[j]) / Math.max(1e-12, acc[j + 1] - acc[j]);
    out.push([poly[j][0] + (poly[j + 1][0] - poly[j][0]) * w, poly[j][1] + (poly[j + 1][1] - poly[j][1]) * w]);
  }
  return out;
}

/**
 * Smooth the measured points, split the curve at the given anchor indices (into `points`), and
 * resample each piece with the given number of steps. Returns sum(counts) + 1 points; anchor k lands
 * exactly on output index counts[0] + ... + counts[k-1].
 */
export function resampleSegments(points: P2[], anchors: number[], counts: number[], perSpan = 8): P2[] {
  const { curve, at } = smoothProfile(points, perSpan);
  const cuts = [0, ...anchors.map((a) => at[a]), curve.length - 1];
  if (cuts.length - 1 !== counts.length) throw new Error('resampleSegments: counts must have one entry per piece');
  const out: P2[] = [];
  for (let k = 0; k < counts.length; k++) {
    const piece = resample(curve.slice(cuts[k], cuts[k + 1] + 1), counts[k]);
    out.push(...(k === 0 ? piece : piece.slice(1)));
  }
  return out;
}

/**
 * Monotone cubic interpolation (Fritsch-Carlson) through a table of [x, y] sorted by x: smooth
 * (C1) where the table is, never overshooting it, and clamped at the ends. Use it wherever normals
 * are taken from the curve, so measured tables do not shade as facets.
 */
export function monotone(table: readonly (readonly [number, number])[]): (x: number) => number {
  const n = table.length;
  const xs = table.map((p) => p[0]), ys = table.map((p) => p[1]);
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) delta.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = [delta[0]];
  for (let i = 1; i < n - 1; i++) m.push(delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2);
  m.push(delta[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / delta[i], b = m[i + 1] / delta[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * delta[i]; m[i + 1] = k * b * delta[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] > x) hi = mid; else lo = mid; }
    const h = xs[hi] - xs[lo], t = (x - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
  };
}

/** Piecewise-linear lookup in a table of [x, y] sorted by x; clamps at the ends. */
export function lookup(table: readonly (readonly [number, number])[], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
  }
  return table[table.length - 1][1];
}
