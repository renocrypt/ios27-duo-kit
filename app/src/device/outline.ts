/**
 * Outlines with continuous-curvature corners, in millimetres. Reusable for any Apple-style product.
 *
 * Apple draws its hardware and display outlines with superellipse corners. Measured on iPhone Duo,
 * every outline (frame, glass, bumper, both displays) fits |x/ax|^n + |y/ay|^n = 1 with
 * n ≈ 2.2 to 2.6 to within 0.02 mm, and the inner outlines are offsets of one master outline.
 * This module evaluates such outlines, their per-edge offsets and their signed distance.
 *
 *   cornerPoint(corner, phi)             point on a first-quadrant corner by its normal's angle
 *   stations(outline, opts)              a canonical CCW sampling that lines up across outlines
 *   evalStation(outline, s, d, z)        a station's point on the outline offset inward per edge
 *   signedDistance(outline, x, y)        exact Euclidean distance, negative inside
 *
 * Stations make lofting possible: the same station list evaluated on different outlines gives
 * corresponding points (corners by normal angle, edges by position), so rows of a loft connect
 * even when the corner shapes differ from row to row.
 */

export interface Corner {
  /** Extent of the corner along x and y, from where the straight edges end to the corner box. */
  ax: number;
  ay: number;
  /** Superellipse exponent: 2 is a circle (ax = ay); Apple's hardware uses about 2.4. */
  n: number;
}

export type EdgeName = 'b' | 'r' | 't' | 'l';
export type CornerName = 'br' | 'tr' | 'tl' | 'bl';
export type PerEdge<T> = Record<EdgeName, T>;

export interface Outline {
  x0: number; y0: number; x1: number; y1: number;
  corners: Record<CornerName, Corner>;
}

/** A place on an outline: an edge position (x on b/t, y on l/r, or its straight ends), or a corner fraction. */
export type Station =
  | { edge: EdgeName; at: number | 'start' | 'end' }
  | { corner: CornerName; t: number };

export interface StationPoint { x: number; y: number; z: number; nx: number; ny: number }

/** CCW order: bottom edge, bottom-right corner, right edge, ... The corner after each edge. */
const ORDER: (EdgeName | CornerName)[] = ['b', 'br', 'r', 'tr', 't', 'tl', 'l', 'bl'];
const CORNER_EDGES: Record<CornerName, [EdgeName, EdgeName]> = { br: ['b', 'r'], tr: ['r', 't'], tl: ['t', 'l'], bl: ['l', 'b'] };
/** Global normal angle at the start of each corner (CCW sweep of a quarter turn). */
const CORNER_START: Record<CornerName, number> = { br: -Math.PI / 2, tr: 0, tl: Math.PI / 2, bl: Math.PI };

export const uniformEdges = <T>(v: T): PerEdge<T> => ({ b: v, r: v, t: v, l: v });

/**
 * Point of the superellipse (x/ax)^n + (y/ay)^n = 1 in the first quadrant whose outward normal
 * makes the angle phi (0 = +x, π/2 = +y) with the x axis.
 */
export function cornerPoint(c: Corner, phi: number): { x: number; y: number } {
  const { ax, ay, n } = c;
  const cs = Math.max(0, Math.cos(phi)), sn = Math.max(0, Math.sin(phi));
  // Normal ∝ (x^(n-1)/ax^n, y^(n-1)/ay^n). With x = ax·p, y = ay·q: q/p = (tan φ · ay/ax)^(1/(n-1)).
  if (sn <= cs) {
    const k = Math.pow((sn * ay) / (cs * ax), 1 / (n - 1));
    const p = Math.pow(1 + Math.pow(k, n), -1 / n);
    return { x: ax * p, y: ay * k * p };
  }
  const k = Math.pow((cs * ax) / (sn * ay), 1 / (n - 1));
  const q = Math.pow(1 + Math.pow(k, n), -1 / n);
  return { x: ax * k * q, y: ay * q };
}

function cornerCentre(o: Outline, name: CornerName): { cx: number; cy: number; sx: number; sy: number } {
  const c = o.corners[name];
  switch (name) {
    case 'br': return { cx: o.x1 - c.ax, cy: o.y0 + c.ay, sx: 1, sy: -1 };
    case 'tr': return { cx: o.x1 - c.ax, cy: o.y1 - c.ay, sx: 1, sy: 1 };
    case 'tl': return { cx: o.x0 + c.ax, cy: o.y1 - c.ay, sx: -1, sy: 1 };
    case 'bl': return { cx: o.x0 + c.ax, cy: o.y0 + c.ay, sx: -1, sy: -1 };
  }
}

/** The straight part of an edge, in its own coordinate (x for b/t, y for l/r), in CCW direction. */
export function edgeExtent(o: Outline, e: EdgeName): [number, number] {
  const k = o.corners;
  switch (e) {
    case 'b': return [o.x0 + k.bl.ax, o.x1 - k.br.ax];
    case 'r': return [o.y0 + k.br.ay, o.y1 - k.tr.ay];
    case 't': return [o.x1 - k.tr.ax, o.x0 + k.tl.ax];
    case 'l': return [o.y1 - k.tl.ay, o.y0 + k.bl.ay];
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Evaluate a station on the outline, offset inward by d (per edge; blended across corners with a
 * smoothstep so the surface stays tangent-continuous) and lifted to z (per edge, blended the same way).
 */
export function evalStation(o: Outline, s: Station, d: PerEdge<number>, z: PerEdge<number>): StationPoint {
  if ('edge' in s) {
    const [a, b] = edgeExtent(o, s.edge);
    const at = s.at === 'start' ? a : s.at === 'end' ? b : Math.min(Math.max(s.at, Math.min(a, b)), Math.max(a, b));
    const off = d[s.edge], h = z[s.edge];
    switch (s.edge) {
      case 'b': return { x: at, y: o.y0 + off, z: h, nx: 0, ny: -1 };
      case 'r': return { x: o.x1 - off, y: at, z: h, nx: 1, ny: 0 };
      case 't': return { x: at, y: o.y1 - off, z: h, nx: 0, ny: 1 };
      case 'l': return { x: o.x0 + off, y: at, z: h, nx: -1, ny: 0 };
    }
  }
  const c = o.corners[s.corner];
  const [e0, e1] = CORNER_EDGES[s.corner];
  const psi = CORNER_START[s.corner] + s.t * Math.PI / 2;
  const nx = Math.cos(psi), ny = Math.sin(psi);
  const { cx, cy, sx, sy } = cornerCentre(o, s.corner);
  const local = cornerPoint(c, Math.atan2(Math.abs(ny), Math.abs(nx)));
  const w = smooth(s.t);
  const off = d[e0] + (d[e1] - d[e0]) * w;
  return { x: cx + sx * local.x - off * nx, y: cy + sy * local.y - off * ny, z: z[e0] + (z[e1] - z[e0]) * w, nx, ny };
}

export interface StationOptions {
  /** Maximum spacing of stations along straight edges, mm. */
  edgeStep: number;
  /** Samples inside each corner (excluding its ends), per corner or one number for all. */
  cornerSteps: number | Partial<Record<CornerName, number>>;
  /** Extra edge positions that must be stations (material boundaries, trims). */
  extra?: Partial<PerEdge<number[]>>;
}

/** Canonical CCW stations of an outline: every edge's straight ends, its extras, and even corner samples. */
export function stations(o: Outline, opts: StationOptions): Station[] {
  const out: Station[] = [];
  for (const part of ORDER) {
    if (part.length === 1) {
      const e = part as EdgeName;
      const [a, b] = edgeExtent(o, e);
      const len = Math.abs(b - a), dir = Math.sign(b - a) || 1;
      const count = Math.max(1, Math.ceil(len / opts.edgeStep));
      const positions = new Set<number>();
      for (let i = 1; i < count; i++) positions.add(a + dir * (i / count) * len);
      for (const p of opts.extra?.[e] ?? []) if ((p - a) * dir > 1e-6 && (b - p) * dir > 1e-6) positions.add(p);
      out.push({ edge: e, at: 'start' });
      [...positions].sort((p, q) => (p - q) * dir).forEach((p) => out.push({ edge: e, at: p }));
      out.push({ edge: e, at: 'end' });
    } else {
      const c = part as CornerName;
      const n = typeof opts.cornerSteps === 'number' ? opts.cornerSteps : opts.cornerSteps[c] ?? 8;
      for (let i = 1; i <= n; i++) out.push({ corner: c, t: i / (n + 1) });
    }
  }
  return out;
}

/** Index of the station that equals `s` (an edge position), for slicing open contours. */
export function findStation(list: Station[], edge: EdgeName, at: number): number {
  const i = list.findIndex((s) => 'edge' in s && s.edge === edge && s.at === at);
  if (i < 0) throw new Error(`station ${edge}@${at} not in the list; add it through opts.extra`);
  return i;
}

/** Position of a station along its edge (x on b/t, y on l/r) for the given outline; NaN for corners. */
export function stationCoordinate(o: Outline, s: Station): number {
  if (!('edge' in s)) return NaN;
  const [a, b] = edgeExtent(o, s.edge);
  return s.at === 'start' ? a : s.at === 'end' ? b : s.at;
}

/** Offset an outline outward by `grow` (negative shrinks), keeping corner shapes: a new master outline. */
export function grownOutline(o: Outline, grow: number): Outline {
  const g = (c: Corner): Corner => ({ ax: c.ax + grow, ay: c.ay + grow, n: c.n });
  return {
    x0: o.x0 - grow, y0: o.y0 - grow, x1: o.x1 + grow, y1: o.y1 + grow,
    corners: { br: g(o.corners.br), tr: g(o.corners.tr), tl: g(o.corners.tl), bl: g(o.corners.bl) },
  };
}

/** Exact Euclidean signed distance to the outline (negative inside). */
export function signedDistance(o: Outline, x: number, y: number): number {
  return nearest(o, x, y).distance;
}

/**
 * Signed distance and the nearest place on the outline, with per-edge weights that match how
 * evalStation blends per-edge values across corners (weights sum to 1).
 */
export function nearest(o: Outline, x: number, y: number): { distance: number; weights: PerEdge<number> } {
  const weights = uniformEdges(0);
  for (const name of ['br', 'tr', 'tl', 'bl'] as CornerName[]) {
    const { cx, cy, sx, sy } = cornerCentre(o, name);
    const lx = (x - cx) * sx, ly = (y - cy) * sy;
    if (lx > 0 && ly > 0) {
      const { distance, phi } = cornerDistance(o.corners[name], lx, ly);
      // Local angle phi runs from the x-facing edge (0) to the y-facing edge (π/2); CCW t may run either way.
      const global = Math.atan2(sy * Math.sin(phi), sx * Math.cos(phi));
      let d = (((global - CORNER_START[name]) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (d > 1.5 * Math.PI) d -= 2 * Math.PI;
      const w = smooth(Math.min(1, Math.max(0, d / (Math.PI / 2))));
      const [e0, e1] = CORNER_EDGES[name];
      weights[e0] = 1 - w; weights[e1] = w;
      return { distance, weights };
    }
  }
  const dx = Math.max(o.x0 - x, x - o.x1), dy = Math.max(o.y0 - y, y - o.y1);
  // Nearest straight edge.
  const gaps: [EdgeName, number][] = [['l', x - o.x0], ['r', o.x1 - x], ['b', y - o.y0], ['t', o.y1 - y]];
  const edge = gaps.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  weights[edge] = 1;
  const distance = dx <= 0 && dy <= 0 ? Math.max(dx, dy) : Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return { distance, weights };
}

/** Distance from a first-quadrant point (relative to the corner centre) to the corner curve, signed, and the nearest point's normal angle. */
function cornerDistance(c: Corner, px: number, py: number): { distance: number; phi: number } {
  const f = (phi: number) => { const q = cornerPoint(c, phi); return (q.x - px) ** 2 + (q.y - py) ** 2; };
  // Coarse scan, then golden-section refinement around the best sample.
  let best = 0, bestF = Infinity;
  const N = 16;
  for (let i = 0; i <= N; i++) { const phi = (i / N) * Math.PI / 2; const v = f(phi); if (v < bestF) { bestF = v; best = phi; } }
  let lo = Math.max(0, best - Math.PI / 2 / N), hi = Math.min(Math.PI / 2, best + Math.PI / 2 / N);
  const g = 0.6180339887;
  let a = hi - g * (hi - lo), b = lo + g * (hi - lo), fa = f(a), fb = f(b);
  for (let i = 0; i < 24; i++) {
    if (fa < fb) { hi = b; b = a; fb = fa; a = hi - g * (hi - lo); fa = f(a); }
    else { lo = a; a = b; fa = fb; b = lo + g * (hi - lo); fb = f(b); }
  }
  const [v, phi] = fa < fb ? [fa, a] : [fb, b];
  const [dist2, at] = v < bestF ? [v, phi] : [bestF, best];
  const inside = Math.pow(px / c.ax, c.n) + Math.pow(py / c.ay, c.n) < 1;
  return { distance: inside ? -Math.sqrt(dist2) : Math.sqrt(dist2), phi: at };
}
