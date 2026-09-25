/**
 * The hinge in cross-section (the device's xz plane, away from the top and bottom walls), as 2D
 * shapes for any fold angle. Pure math on the spec and the fold solver: no Three.js. Used by the
 * collision checker (tools/check-hinge.ts) and any 2D view of the mechanism.
 *
 *   hingeSection(theta) -> { leaves: [left, right], spine, display, rim }
 *
 * Shapes are closed polygons (arrays of {x, z}) in the device frame, except the display and the
 * rim, which are polylines with a thickness. Only the region near the hinge is modelled (s up to
 * `reach` along each leaf), which is where parts can meet.
 */
import { DUO } from './spec.ts';
import { displayAt, solveFold, type FoldState, type LeafFrame, type Vec2 } from './fold.ts';
import { resampleSegments, type P2 } from './profile.ts';

const { leaf, frame, pocket, hinge, spine, bumper } = DUO;
const T = leaf.thickness, h = hinge.pivotHeight;

export interface Section {
  state: FoldState;
  /** Solid material of each leaf near the hinge: lip slab and chassis (with the rounded hinge-end lip). */
  leaves: [Vec2[], Vec2[]];
  /** Hinge cover: the U channel as one closed polygon (outer and inner surfaces). */
  spine: Vec2[];
  /** Inner display surface across the fold zone and beyond, with its thickness (mm). */
  display: { points: Vec2[]; thickness: number };
  /** Top of the flexible rim, a polyline offset from the display (at the top and bottom edges). */
  rim: { points: Vec2[]; thickness: number };
}

/** How far along each leaf the section goes, mm. */
export const REACH = 16;

/** A leaf's solid near the hinge, in leaf coordinates (s from the hinge line, w from the display surface). */
function leafPolygon(): P2[] {
  // The hinge-end lip from the back to the pocket's lip top, as measured.
  const lip = (frame.hinge as unknown as P2[]).slice(0, frame.anchors.hinge[0] + 1);
  const poly: P2[] = [];
  poly.push([REACH, -T]);
  for (const [s, w] of lip) poly.push([s, w === -5.234 ? -T : w]);
  poly.push([pocket.depth, pocket.lipZ]);
  poly.push([pocket.depth, pocket.ceilingZ]);
  poly.push([REACH, pocket.ceilingZ]);
  return poly;
}
const LEAF = leafPolygon();

/** Leaf coordinates to the device frame for a leaf pose. */
const toDevice = (f: LeafFrame, s: number, w: number): Vec2 => ({
  x: f.origin.x + s * f.t.x + w * f.n.x,
  z: f.origin.z + s * f.t.z + w * f.n.z,
});

/** The hinge cover's outer and inner outline at y = 0, bottom at z = zb. */
function spinePolygon(zb: number): Vec2[] {
  const hx = spine.width / 2, r = spine.radius, t = spine.wall, top = zb + spine.depth;
  const outer: Vec2[] = [], inner: Vec2[] = [];
  outer.push({ x: -hx, z: top });
  for (let i = 0; i <= 16; i++) { const a = Math.PI + (i / 16) * (Math.PI / 2); outer.push({ x: -hx + r + r * Math.cos(a), z: zb + r + r * Math.sin(a) }); }
  for (let i = 0; i <= 16; i++) { const a = 1.5 * Math.PI + (i / 16) * (Math.PI / 2); outer.push({ x: hx - r + r * Math.cos(a), z: zb + r + r * Math.sin(a) }); }
  outer.push({ x: hx, z: top });
  const ri = r - t;
  inner.push({ x: hx - t, z: top });
  for (let i = 0; i <= 16; i++) { const a = 2 * Math.PI - (i / 16) * (Math.PI / 2); inner.push({ x: hx - r + ri * Math.cos(a), z: zb + r + ri * Math.sin(a) }); }
  for (let i = 0; i <= 16; i++) { const a = 1.5 * Math.PI - (i / 16) * (Math.PI / 2); inner.push({ x: -hx + r + ri * Math.cos(a), z: zb + r + ri * Math.sin(a) }); }
  inner.push({ x: -hx + t, z: top });
  return [...outer, ...inner];
}

/** The cover's outer bottom relative to the axis for a leaf angle (0 open, π/2 closed). */
export function spineBottom(leafAngle: number): number {
  return spine.openBottom + (spine.closedBottom - spine.openBottom) * Math.sin(leafAngle);
}

const RIM_TOP = (() => {
  // The flexible rim's section (inner part): its highest point above the display.
  const rows = resampleSegments(bumper.section as unknown as P2[], [5], [8, 16]).slice(8);
  return Math.max(...rows.map((r) => r[1]));
})();

export function hingeSection(theta: number, samples = 240): Section {
  const state = solveFold(theta, hinge);
  const leaves: [Vec2[], Vec2[]] = [
    LEAF.map(([s, w]) => toDevice(state.left, s, w)),
    LEAF.map(([s, w]) => toDevice(state.right, s, w)),
  ];
  const zb = h + spineBottom(state.leafAngle);
  const display: Vec2[] = [], rim: Vec2[] = [];
  for (let i = 0; i <= samples; i++) {
    const s = -REACH + (i / samples) * 2 * REACH;
    const { p, n } = displayAt(state, s);
    display.push(p);
    if (Math.abs(s) <= hinge.foldLength / 2) rim.push({ x: p.x + n.x * RIM_TOP, z: p.z + n.z * RIM_TOP });
  }
  return { state, leaves, spine: spinePolygon(zb), display: { points: display, thickness: 0.1 }, rim: { points: rim, thickness: 0.05 } };
}

// ---- 2D queries ---------------------------------------------------------------------------------

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

/** Distance from a point to a polyline (open) or polygon boundary (closed). */
export function distanceToPath(p: Vec2, path: Vec2[], closed: boolean): number {
  let best = Infinity;
  const n = closed ? path.length : path.length - 1;
  for (let i = 0; i < n; i++) best = Math.min(best, segmentDistance(p, path[i], path[(i + 1) % path.length]));
  return best;
}

/**
 * Signed clearance between a polygon and another shape (polygon, or polyline with thickness):
 * negative when they overlap (by about that much), else the smallest gap. Sampled on vertices
 * densified to `step` mm.
 */
export function clearance(a: Vec2[], b: Vec2[], opts: { bClosed: boolean; bThickness?: number; step?: number }): number {
  const step = opts.step ?? 0.02;
  const dense = (path: Vec2[], closed: boolean) => {
    const out: Vec2[] = [];
    const n = closed ? path.length : path.length - 1;
    for (let i = 0; i < n; i++) {
      const p = path[i], q = path[(i + 1) % path.length];
      const k = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / step));
      for (let j = 0; j < k; j++) out.push({ x: p.x + ((q.x - p.x) * j) / k, z: p.z + ((q.z - p.z) * j) / k });
    }
    if (!closed) out.push(path[path.length - 1]);
    return out;
  };
  const half = (opts.bThickness ?? 0) / 2;
  let worst = Infinity;
  // b's points against polygon a.
  for (const p of dense(b, opts.bClosed)) {
    const d = distanceToPath(p, a, true) - half;
    worst = Math.min(worst, pointInPolygon(p, a) ? -Math.max(d + 2 * half, 1e-6) : d);
  }
  // a's points against b.
  for (const p of dense(a, true)) {
    const d = distanceToPath(p, b, opts.bClosed) - half;
    const inside = opts.bClosed && pointInPolygon(p, b);
    worst = Math.min(worst, inside ? -Math.max(d, 1e-6) : d);
  }
  return worst;
}
