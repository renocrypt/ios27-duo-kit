/**
 * Loft: a surface through a stack of outline rows. Reusable for any product body, bezel or button.
 *
 *   loft(rows, stations, opts) -> THREE.BufferGeometry
 *
 * Each row is an outline (outline.ts) offset inward per edge by d and lifted per edge to z. The
 * same station list is evaluated on every row, so rows connect point to point even when their
 * outlines differ (a frame lip that follows the glass, then a wall that follows the chassis).
 * Rows run from the back of a part to its front; the surface faces outward for a CCW station list.
 *
 * Normals are exact where it matters: the plan tangent is analytic, the profile tangent is a
 * central difference within a smooth group. Rows listed in `creases` start a new smooth group
 * (their vertices are duplicated), for crisp edges such as a chamfer or a lip.
 *
 * Options:
 *   closed    the station list wraps around (a full outline); false for an open strip
 *   keep      quad filter (col, row) -> boolean, to cut openings such as the hinge pocket
 *   material  quad material index (col, row) -> number, emitted as geometry groups
 *   uvScale   u = plan arc length and v = profile arc length, both in mm times this
 *   flip      face inward instead (the inside of a shell)
 */
import * as THREE from 'three';
import { evalStation, type Outline, type PerEdge, type Station } from './outline.ts';

export interface LoftRow { outline: Outline; d: PerEdge<number>; z: PerEdge<number> }

export interface LoftOptions {
  closed: boolean;
  creases?: number[];
  keep?: (col: number, row: number) => boolean;
  material?: (col: number, row: number) => number;
  uvScale?: number;
  flip?: boolean;
}

export function loft(rows: LoftRow[], list: Station[], opts: LoftOptions): THREE.BufferGeometry {
  const cols = list.length, nRows = rows.length;
  const pts = rows.map((r) => list.map((s) => evalStation(r.outline, s, r.d, r.z)));

  // Smooth groups: [start, end] row ranges sharing vertices.
  const cuts = [...new Set([0, ...(opts.creases ?? []), nRows - 1])].sort((a, b) => a - b);
  const groups: [number, number][] = [];
  for (let k = 0; k < cuts.length - 1; k++) groups.push([cuts[k], cuts[k + 1]]);

  const position: number[] = [], normal: number[] = [], uv: number[] = [];
  const vIndex: number[][] = []; // per group, row-major vertex index base
  // Plan arc length along the first row, for u.
  const u: number[] = [0];
  for (let i = 1; i < cols; i++) u.push(u[i - 1] + Math.hypot(pts[0][i].x - pts[0][i - 1].x, pts[0][i].y - pts[0][i - 1].y));
  const scale = opts.uvScale ?? 1;

  groups.forEach(([r0, r1], g) => {
    vIndex[g] = [];
    for (let j = r0; j <= r1; j++) {
      vIndex[g][j] = position.length / 3;
      for (let i = 0; i < cols; i++) {
        const p = pts[j][i];
        const a = pts[Math.max(r0, j - 1)][i], b = pts[Math.min(r1, j + 1)][i];
        // Profile tangent (row direction) and analytic plan tangent (CCW).
        let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
        if (tx * tx + ty * ty + tz * tz < 1e-16) { tx = p.nx; ty = p.ny; tz = 0; }
        const cx = -p.ny, cy = p.nx; // cz = 0
        // n = c × t
        let nx = cy * tz, ny = -cx * tz, nz = cx * ty - cy * tx;
        const len = (Math.hypot(nx, ny, nz) || 1) * (opts.flip ? -1 : 1);
        nx /= len; ny /= len; nz /= len;
        position.push(p.x, p.y, p.z);
        normal.push(nx, ny, nz);
        uv.push(u[i] * scale, 0);
      }
    }
    // v: profile arc length within the group, continued across groups.
    for (let i = 0; i < cols; i++) {
      let acc = g === 0 ? 0 : uv[(vIndex[g - 1][r0] + i) * 2 + 1];
      for (let j = r0; j <= r1; j++) {
        if (j > r0) acc += Math.hypot(pts[j][i].x - pts[j - 1][i].x, pts[j][i].y - pts[j - 1][i].y, pts[j][i].z - pts[j - 1][i].z);
        uv[(vIndex[g][j] + i) * 2 + 1] = acc * scale;
      }
    }
  });

  // Quads, bucketed by material.
  const buckets = new Map<number, number[]>();
  const lastCol = opts.closed ? cols : cols - 1;
  groups.forEach(([r0, r1], g) => {
    for (let j = r0; j < r1; j++) {
      for (let i = 0; i < lastCol; i++) {
        if (opts.keep && !opts.keep(i, j)) continue;
        const i1 = (i + 1) % cols;
        const a = vIndex[g][j] + i, b = vIndex[g][j] + i1, c = vIndex[g][j + 1] + i, d = vIndex[g][j + 1] + i1;
        const m = opts.material ? opts.material(i, j) : 0;
        if (!buckets.has(m)) buckets.set(m, []);
        if (opts.flip) buckets.get(m)!.push(a, c, b, b, c, d);
        else buckets.get(m)!.push(a, b, c, b, d, c);
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const index: number[] = [];
  for (const m of [...buckets.keys()].sort((a, b) => a - b)) {
    const tris = buckets.get(m)!;
    geometry.addGroup(index.length, tris.length, m);
    for (const t of tris) index.push(t);
  }
  geometry.setIndex(index);
  return geometry;
}

/**
 * Close a loft row with a flat cap (a fan from the centroid; the outline must be star-shaped from
 * its centroid, which every convex outline is). `facing` is +1 for a cap facing +z, -1 for -z.
 */
export function cap(row: LoftRow, list: Station[], facing: 1 | -1): THREE.BufferGeometry {
  const pts = list.map((s) => evalStation(row.outline, s, row.d, row.z));
  let cx = 0, cy = 0, cz = 0;
  for (const p of pts) { cx += p.x; cy += p.y; cz += p.z; }
  cx /= pts.length; cy /= pts.length; cz /= pts.length;
  const position = [cx, cy, cz], normal = [0, 0, facing], uv = [0.5, 0.5];
  const o = row.outline, w = o.x1 - o.x0, h = o.y1 - o.y0;
  for (const p of pts) { position.push(p.x, p.y, p.z); normal.push(0, 0, facing); uv.push((p.x - o.x0) / w, (p.y - o.y0) / h); }
  const index: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = 1 + i, b = 1 + ((i + 1) % pts.length);
    if (facing > 0) index.push(0, a, b); else index.push(0, b, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}
