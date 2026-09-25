/**
 * Height-field plates: a surface z = f(x, y) over an outline, meshed adaptively. Reusable for glass
 * backs with 2.5D edges, camera plateaus, or any surface described by distances to outlines.
 *
 *   heightFieldPlate({ outline, height, rings, grid, facing }) -> THREE.BufferGeometry
 *
 * Points are placed where the surface changes: on rings (offsets of feature outlines, given as
 * distances) and on a sparse grid elsewhere. They are triangulated with Delaunay (the outline must
 * be convex, which a rounded rectangle is), and every vertex gets the analytic normal of f by
 * central differences, so shading is smooth even where triangles are large.
 *
 * UVs map the outline's bounds to [0, 1]² (u along +x, v along +y).
 */
import * as THREE from 'three';
import Delaunator from 'delaunator';
import { evalStation, signedDistance, stations, uniformEdges, type Outline, type PerEdge } from './outline.ts';

/** Offsets inward (negative = outward), uniform or per edge (blended across corners like a loft row). */
export interface Ring { outline: Outline; offsets: (number | PerEdge<number>)[]; spacing: number }

export interface HeightFieldOptions {
  /** Boundary of the plate (convex). */
  outline: Outline;
  /** Surface height at (x, y). */
  height: (x: number, y: number) => number;
  /** Feature rings: each outline offset by each value, sampled every `spacing` mm. */
  rings: Ring[];
  /** Grid spacing for the rest, mm; grid points closer than `clearance` to any ring point are dropped. */
  grid: number;
  clearance: number;
  /** +1: the plate faces +z; -1: it faces -z (a back). */
  facing: 1 | -1;
}

export function heightFieldPlate(o: HeightFieldOptions): THREE.BufferGeometry {
  const xy: number[] = [];
  const inside = (x: number, y: number) => signedDistance(o.outline, x, y) <= 1e-6;
  // Spatial hash for spacing checks.
  const cell = o.clearance, hash = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const near = (x: number, y: number, r: number) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const k of hash.get(`${cx + i},${cy + j}`) ?? []) if (Math.hypot(xy[k] - x, xy[k + 1] - y) < r) return true;
    }
    return false;
  };
  const add = (x: number, y: number, minGap: number) => {
    if (minGap > 0 && near(x, y, minGap)) return;
    const k = key(x, y);
    if (!hash.has(k)) hash.set(k, []);
    hash.get(k)!.push(xy.length);
    xy.push(x, y);
  };

  // Boundary first (offset 0 of the plate outline), then the rings.
  const ringSets: Ring[] = [{ outline: o.outline, offsets: [0], spacing: o.rings[0]?.spacing ?? o.grid / 4 }, ...o.rings];
  ringSets.forEach((ring, ri) => {
    for (const d of ring.offsets) {
      const list = stations(ring.outline, { edgeStep: ring.spacing, cornerSteps: 48 });
      for (const s of list) {
        const p = evalStation(ring.outline, s, typeof d === 'number' ? uniformEdges(d) : d, uniformEdges(0));
        if (ri === 0) { add(p.x, p.y, 1e-4); continue; }
        if (signedDistance(o.outline, p.x, p.y) > -0.02) continue; // keep ring points strictly inside
        add(p.x, p.y, ring.spacing * 0.45);
      }
    }
  });
  // Sparse grid.
  for (let x = o.outline.x0 + o.grid / 2; x < o.outline.x1; x += o.grid) {
    for (let y = o.outline.y0 + o.grid / 2; y < o.outline.y1; y += o.grid) {
      if (inside(x, y) && signedDistance(o.outline, x, y) < -o.clearance) add(x, y, o.clearance);
    }
  }

  const coords = new Float64Array(xy);
  const tri = new Delaunator(coords).triangles;
  const n = coords.length / 2;
  const position = new Float32Array(n * 3), normal = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const w = o.outline.x1 - o.outline.x0, h = o.outline.y1 - o.outline.y0, e = 0.01;
  for (let i = 0; i < n; i++) {
    const x = coords[i * 2], y = coords[i * 2 + 1];
    const z = o.height(x, y);
    const dzdx = (o.height(x + e, y) - o.height(x - e, y)) / (2 * e);
    const dzdy = (o.height(x, y + e) - o.height(x, y - e)) / (2 * e);
    // Surface z - f(x, y) = 0; its normal (-fx, -fy, 1) faces +z. Flip for a back.
    let nx = -dzdx, ny = -dzdy, nz = 1;
    const len = Math.hypot(nx, ny, nz);
    nx = (nx / len) * o.facing; ny = (ny / len) * o.facing; nz = (nz / len) * o.facing;
    position.set([x, y, z], i * 3);
    normal.set([nx, ny, nz], i * 3);
    uv.set([(x - o.outline.x0) / w, (y - o.outline.y0) / h], i * 2);
  }
  // Orient every triangle to the requested facing (checked, not assumed).
  const index = new Uint32Array(tri.length);
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t], b = tri[t + 1], c = tri[t + 2];
    const cross = (coords[b * 2] - coords[a * 2]) * (coords[c * 2 + 1] - coords[a * 2 + 1]) - (coords[b * 2 + 1] - coords[a * 2 + 1]) * (coords[c * 2] - coords[a * 2]);
    const flip = (cross > 0) !== (o.facing > 0);
    index[t] = a; index[t + 1] = flip ? c : b; index[t + 2] = flip ? b : c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}
