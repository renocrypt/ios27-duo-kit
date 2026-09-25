/**
 * Fold kinematics for a book-style foldable with an inextensible inner display.
 *
 * Pure 2D math in the device's cross-section plane (x across the fold, z out of the inner display),
 * in millimetres. No Three.js dependency, so it can be reused and tested anywhere.
 *
 * Model (first principles, fitted to Apple's AR model of iPhone Duo; see the geometry-pass note):
 *   - Both leaves rotate about one hinge axis at (0, pivotHeight), slightly above the display surface
 *     (z = 0 when open). Open, the leaves meet at x = 0; closed, the display surfaces sit
 *     2 · pivotHeight apart. With pivotHeight = 0.27 mm this reproduces the measured 0.54 mm display
 *     gap and 11.0 mm closed stack.
 *   - Theta is the interior angle between the leaves on the display side: 0 closed, π open flat.
 *   - The display is flat on each leaf and free across a fold zone of fixed length `foldLength`
 *     centred on the hinge. Across the zone it takes the shape of an elastica: the curve of least
 *     bending energy at that length, clamped tangent to both leaves, kept out of the chassis but
 *     free to sink into the hinge pockets. Closed, that is Apple's teardrop. The shapes are solved
 *     offline for every whole degree (tools/fold-elastica.ts, into foldTable.json) and interpolated
 *     here; the tabulated curve is then resampled at equal arc length.
 *
 * API:
 *   solveFold(theta, params) -> FoldState
 *   displayAt(state, s)      -> point and normal of the display at unfolded coordinate s
 *                               (arc length from the display's centre line; negative = left leaf)
 */
import foldTable from './foldTable.json' with { type: 'json' };

export interface Vec2 { x: number; z: number }

export interface FoldParams {
  /** Height of the hinge axis above the open display surface, mm. */
  pivotHeight: number;
  /** Arc length of the display's free fold zone, mm. */
  foldLength: number;
  /** Samples used to tabulate the fold curve by arc length. */
  samples?: number;
}

/** A leaf's rigid frame: origin on the display surface at the hinge line, t toward the free edge, n out of the display. */
export interface LeafFrame { origin: Vec2; t: Vec2; n: Vec2 }

export interface FoldState {
  theta: number;
  /** Rotation of each leaf away from flat, (π - theta) / 2. */
  leafAngle: number;
  left: LeafFrame;
  right: LeafFrame;
  /** Fold-zone curve, left attachment to right, tabulated at equal arc-length steps. */
  curve: { points: Vec2[]; normals: Vec2[]; length: number };
  params: Required<FoldParams>;
}

const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, z: a.z * k });
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

function leafFrames(leafAngle: number, h: number): { left: LeafFrame; right: LeafFrame } {
  const s = Math.sin(leafAngle), c = Math.cos(leafAngle);
  // Left leaf turns clockwise and right leaf counter-clockwise about (0, h), so the free edges rise
  // and the display faces meet.
  return {
    left: { origin: { x: -h * s, z: h - h * c }, t: { x: -c, z: s }, n: { x: s, z: c } },
    right: { origin: { x: h * s, z: h - h * c }, t: { x: c, z: s }, n: { x: -s, z: c } },
  };
}

interface FoldTable { segments: number; foldLength: number; pivotHeight: number; curves: { theta: number; x: number[]; z: number[] }[] }
const TABLE = foldTable as FoldTable;

/** The half curve (attachment to axis) at a fold angle, interpolated between whole degrees. */
function halfCurve(thetaDeg: number): Vec2[] {
  const c = TABLE.curves;
  const i = Math.min(c.length - 2, Math.max(0, Math.floor(thetaDeg)));
  const f = Math.min(1, Math.max(0, thetaDeg - i));
  const a = c[i], b = c[i + 1];
  return a.x.map((x, k) => ({ x: x + (b.x[k] - x) * f, z: a.z[k] + (b.z[k] - a.z[k]) * f }));
}

export function solveFold(theta: number, params: FoldParams): FoldState {
  const full: Required<FoldParams> = { samples: 96, ...params };
  const { pivotHeight: h, foldLength: L, samples } = full;
  if (Math.abs(L - TABLE.foldLength) > 1e-9 || Math.abs(h - TABLE.pivotHeight) > 1e-9) {
    throw new Error('fold: foldTable.json is stale for these hinge parameters; run node tools/fold-elastica.ts');
  }
  const clamped = Math.min(Math.PI, Math.max(0, theta));
  const leafAngle = (Math.PI - clamped) / 2;
  const { left, right } = leafFrames(leafAngle, h);

  // Whole curve, left attachment to right attachment: the half, then its mirror.
  const half = halfCurve((clamped * 180) / Math.PI);
  const pts: Vec2[] = [...half, ...half.slice(0, -1).reverse().map((p) => ({ x: -p.x, z: p.z }))];
  // Pin the ends to this angle's exact attachments (interpolation between degrees moves them by ~1e-4 mm).
  const aL = add(left.origin, scale(left.t, L / 2)), aR = add(right.origin, scale(right.t, L / 2));
  const n = pts.length - 1;
  const dL = { x: aL.x - pts[0].x, z: aL.z - pts[0].z }, dR = { x: aR.x - pts[n].x, z: aR.z - pts[n].z };
  for (let i = 0; i <= n; i++) {
    const w = i / n;
    pts[i] = { x: pts[i].x + dL.x * (1 - w) + dR.x * w, z: pts[i].z + dL.z * (1 - w) + dR.z * w };
  }

  // Tabulate by arc length.
  const acc: number[] = [0];
  for (let i = 1; i <= n; i++) acc.push(acc[i - 1] + dist(pts[i - 1], pts[i]));
  const total = acc[n];
  const points: Vec2[] = [], normals: Vec2[] = [];
  let j = 0;
  for (let i = 0; i <= samples; i++) {
    const target = (i / samples) * total;
    while (j < n - 1 && acc[j + 1] < target) j++;
    const f = (target - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j]);
    points.push({ x: pts[j].x + f * (pts[j + 1].x - pts[j].x), z: pts[j].z + f * (pts[j + 1].z - pts[j].z) });
  }
  for (let i = 0; i <= samples; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(samples, i + 1)];
    const len = Math.max(1e-9, dist(a, b));
    const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
    normals.push({ x: -tz, z: tx }); // Left normal of the left-to-right tangent: out of the display.
  }
  // The end normals are exactly the leaf normals; use them to avoid one-sided difference error.
  normals[0] = left.n; normals[samples] = right.n;
  return { theta: clamped, leafAngle, left, right, curve: { points, normals, length: total }, params: full };
}

/** Display point and normal at unfolded coordinate s (mm from the display's centre line). */
export function displayAt(state: FoldState, s: number): { p: Vec2; n: Vec2 } {
  const L = state.params.foldLength;
  if (s <= -L / 2) return { p: add(state.left.origin, scale(state.left.t, -s)), n: state.left.n };
  if (s >= L / 2) return { p: add(state.right.origin, scale(state.right.t, s)), n: state.right.n };
  const { points, normals } = state.curve;
  const x = ((s + L / 2) / L) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(x));
  const f = x - i;
  const n = { x: normals[i].x + f * (normals[i + 1].x - normals[i].x), z: normals[i].z + f * (normals[i + 1].z - normals[i].z) };
  const len = Math.hypot(n.x, n.z) || 1;
  return {
    p: { x: points[i].x + f * (points[i + 1].x - points[i].x), z: points[i].z + f * (points[i + 1].z - points[i].z) },
    n: { x: n.x / len, z: n.z / len },
  };
}

/** How far the fold curve dips below a leaf's display plane (mm, positive = into the leaf body). */
export function sagIntoLeaf(state: FoldState): number {
  let worst = 0;
  for (const p of state.curve.points) {
    for (const leaf of [state.left, state.right]) {
      const v = (p.x - leaf.origin.x) * leaf.n.x + (p.z - leaf.origin.z) * leaf.n.z;
      const u = (p.x - leaf.origin.x) * leaf.t.x + (p.z - leaf.origin.z) * leaf.t.z;
      if (u >= 0 && -v > worst) worst = -v;
    }
  }
  return worst;
}
