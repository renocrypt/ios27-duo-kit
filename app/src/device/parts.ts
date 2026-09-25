/**
 * iPhone Duo parts, built from the spec (spec.ts) with the outline, loft and height-field tools.
 *
 * Every part is authored for the right (camera) leaf in the flat device frame, where s = x. The
 * left leaf reuses them under a group mirrored in x (Three.js flips the winding for a negative
 * determinant). Materials are assigned by the caller, per geometry group where a part has several.
 *
 *   outlines                     master plan outlines: leaf, back plate, camera plateau top
 *   frameGeometry()              the titanium frame with its antenna bands (groups: 0 metal, 1 band)
 *   bumperGeometry()             the black rim around the inner display, rigid part (+ section rows
 *                                of the flexible part that folds with the display near the hinge)
 *   pocketGeometry()             the dark cavity at the hinge end that houses the hinge cover
 *   backPlateGeometry(kind)      back glass with the camera plateau, or the outer display's glass
 *   plateEdgeGeometry()          the plates' vertical edge, seen in the gap to the frame lip
 *   spineGeometry()              the hinge cover (a rounded U channel), bottom face at z = 0
 *   lensGeometries()             one camera: ring, bezel with housing, element, cover glass
 *   buttonGeometry(...)          a stadium button in its own frame (groups: 0 body, 1 face insert)
 *   wallDecal(...)               a hole or port drawn onto the curved wall (groups: 0 chamfer, 1 opening)
 *   wallInset(z)                 the wall's inset at height z (free, top and bottom walls)
 */
import * as THREE from 'three';
import { DUO } from './spec.ts';
import {
  evalStation, findStation, nearest, stationCoordinate, stations, uniformEdges,
  type Corner, type EdgeName, type Outline, type PerEdge, type Station,
} from './outline.ts';
import { cap, loft, type LoftRow } from './loft.ts';
import { heightFieldPlate, type Ring } from './heightField.ts';
import { monotone, resampleSegments, type P2 } from './profile.ts';

const { leaf, frame, back, bumper, pocket, hinge, spine, camera } = DUO;
const W = leaf.width, hH = leaf.height / 2, T = leaf.thickness;
const HALF_FOLD = hinge.foldLength / 2;
const POCKET_Y = hH - pocket.side;
/** [C] The rigid rim ends where the hinge corner begins (Apple's stops 0.5 from the hinge line, inside the corner). */
const RIM_END = Math.max(bumper.hingeGap, leaf.corners.hinge.ax);

const corner = (c: { ax: number; ay: number; n: number }): Corner => ({ ax: c.ax, ay: c.ay, n: c.n });

export const outlines = {
  /** The leaf at mid-thickness: the master outline. */
  leaf: {
    x0: 0, y0: -hH, x1: W, y1: hH,
    corners: { br: corner(leaf.corners.free), tr: corner(leaf.corners.free), tl: corner(leaf.corners.hinge), bl: corner(leaf.corners.hinge) },
  } as Outline,
  /** Back glass (camera leaf) and outer display cover glass (other leaf, mirrored). */
  back: {
    x0: back.inset.hinge, y0: -hH + back.inset.bottom, x1: W - back.inset.free, y1: hH - back.inset.top,
    corners: { br: corner(back.corners.free), tr: corner(back.corners.free), tl: corner(back.corners.hinge), bl: corner(back.corners.hinge) },
  } as Outline,
  /** Flat top of the camera plateau. */
  plateau: (() => {
    const p = camera.plateau, x1 = W - p.fromFree, y1 = hH - p.fromTop, c = corner(p.corner);
    return { x0: x1 - p.width, y0: y1 - p.height, x1, y1, corners: { br: c, tr: c, tl: c, bl: c } } as Outline;
  })(),
};

// ---- Frame ------------------------------------------------------------------------------------------

/** Rows per profile segment: back rounding to the pocket lip, wall to the bead top, bead inner face. */
const FRAME_SEGMENTS = [14, 22, 5];

const bands = (starts: readonly number[]) => starts.flatMap((s) => [s, s + frame.antenna.width]);

/** Frame stations: antenna band edges, the pocket's ends, and the rim's hinge-side ends are all stations. */
export const frameStations: Station[] = stations(outlines.leaf, {
  edgeStep: 3,
  cornerSteps: { br: 28, tr: 28, tl: 10, bl: 10 },
  extra: {
    b: [...bands(frame.antenna.bottom), RIM_END + 1e-3, HALF_FOLD],
    t: [...bands(frame.antenna.top), RIM_END + 1e-3, HALF_FOLD],
    r: bands(frame.antenna.free),
    l: [POCKET_Y, -POCKET_Y, 0],
  },
});

const coord = (i: number) => stationCoordinate(outlines.leaf, frameStations[i]);
const edgeOf = (i: number): EdgeName | null => { const s = frameStations[i % frameStations.length]; return 'edge' in s ? s.edge : null; };

export function frameRows(): { rows: LoftRow[]; pocketRow: number } {
  const w = resampleSegments(frame.wall as unknown as P2[], [...frame.anchors.wall], FRAME_SEGMENTS);
  const h = resampleSegments(frame.hinge as unknown as P2[], [...frame.anchors.hinge], FRAME_SEGMENTS);
  const rows: LoftRow[] = [{
    // The flat back lip follows the glass, a hair outside it.
    outline: outlines.back, d: uniformEdges(-frame.glassGap),
    z: { b: frame.lipZ, r: frame.lipZ, t: frame.lipZ, l: h[0][1] },
  }];
  for (let k = 0; k < w.length; k++) {
    rows.push({
      outline: outlines.leaf,
      d: { b: w[k][0], r: w[k][0], t: w[k][0], l: h[k][0] },
      z: { b: w[k][1], r: w[k][1], t: w[k][1], l: h[k][1] },
    });
  }
  return { rows, pocketRow: 1 + FRAME_SEGMENTS[0] };
}

export function frameGeometry(): THREE.BufferGeometry {
  const { rows, pocketRow } = frameRows();
  const n = frameStations.length;
  const inBand = (e: EdgeName, x: number) => {
    const list = e === 'b' ? frame.antenna.bottom : e === 't' ? frame.antenna.top : e === 'r' ? frame.antenna.free : [];
    return list.some((s) => x > s && x < s + frame.antenna.width);
  };
  return loft(rows, frameStations, {
    closed: true,
    creases: [1],
    // The pocket opens the hinge face above its lip, between the top and bottom walls.
    keep: (i, j) => {
      if (j < pocketRow) return true;
      const e0 = edgeOf(i), e1 = edgeOf(i + 1);
      if (e0 !== 'l' || e1 !== 'l') return true;
      return !(Math.abs(coord(i)) <= POCKET_Y + 1e-6 && Math.abs(coord((i + 1) % n)) <= POCKET_Y + 1e-6);
    },
    material: (i) => {
      const e0 = edgeOf(i), e1 = edgeOf(i + 1);
      if (!e0 || e0 !== e1) return 0;
      return inBand(e0, (coord(i) + coord((i + 1) % n)) / 2) ? 1 : 0;
    },
    uvScale: 1,
  });
}

// ---- Rim (bumper) -----------------------------------------------------------------------------------

const RIM_SEGMENTS = [8, 16];
/** The rim's section; its top is raised the last few microns to the axis height so twin rims meet exactly when closed. */
const rimRows = () => {
  const rows = resampleSegments(bumper.section as unknown as P2[], [5], RIM_SEGMENTS);
  const top = Math.max(...rows.map((r) => r[1])), lift = hinge.pivotHeight - top;
  return rows.map(([d, z]) => [d, z + lift * Math.max(0, Math.min(1, (z + 0.2) / (top + 0.2)))] as P2);
};

/** The rim's stations: from the bottom edge at the hinge gap, around the free side, to the top edge. */
const rimStations: Station[] = (() => {
  const a = findStation(frameStations, 'b', RIM_END + 1e-3), b = findStation(frameStations, 't', RIM_END + 1e-3);
  return frameStations.slice(a, b + 1);
})();

export function bumperGeometry(): { rigid: THREE.BufferGeometry; flexRows: P2[] } {
  const section = rimRows();
  const split = RIM_SEGMENTS[0];
  const rows: LoftRow[] = section.map(([d, z]) => ({ outline: outlines.leaf, d: uniformEdges(d), z: uniformEdges(z) }));
  const x = (i: number) => stationCoordinate(outlines.leaf, rimStations[i]);
  const onFoldEdge = (i: number) => { const s = rimStations[i]; return 'edge' in s && (s.edge === 'b' || s.edge === 't'); };
  const rigid = loft(rows, rimStations, {
    closed: false,
    // Near the hinge only the outer strip is rigid; the inner rim belongs to the flexible part.
    keep: (i, j) => !(j >= split && onFoldEdge(i) && onFoldEdge(i + 1) && (x(i) + x(i + 1)) / 2 < HALF_FOLD),
  });
  // Close the cut ends: the outer strip at the hinge gap, the inner rim where the flexible part begins.
  const caps: THREE.BufferGeometry[] = [];
  for (const sign of [1, -1] as const) {
    caps.push(sectionCap(section.slice(0, split + 1), RIM_END + 1e-3, sign));
    caps.push(sectionCap(section.slice(split), HALF_FOLD, sign));
  }
  // The flexible part adds an outer wall down into the pocket, as Apple's strip has, so nothing
  // behind it shows between the rigid rims' ends.
  const [d0, z0] = section[split];
  const wall: P2[] = [];
  for (let k = 0; k < 5; k++) wall.push([d0, bumper.flexWallZ + ((z0 - bumper.flexWallZ) * k) / 5]);
  return { rigid: merge([rigid, ...caps]), flexRows: [...wall, ...section.slice(split)] };
}

/** A flat cap across a section [inset, z] at x, on the top (sign 1) or bottom (-1) edge, facing -x. */
function sectionCap(section: P2[], x: number, sign: 1 | -1): THREE.BufferGeometry {
  const position: number[] = [], normal: number[] = [];
  for (const [d, z] of section) { position.push(x, sign * (hH - d), z); normal.push(-1, 0, 0); }
  const index: number[] = [];
  for (let k = 1; k < section.length - 1; k++) {
    // Facing -x: order so that (b - a) x (c - a) points to -x.
    if (sign > 0) index.push(0, k, k + 1); else index.push(0, k + 1, k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((position.length / 3) * 2).fill(0), 2));
  g.setIndex(index);
  return orientTo(g, new THREE.Vector3(-1, 0, 0));
}

// ---- Hinge pocket -----------------------------------------------------------------------------------

export function pocketGeometry(): THREE.BufferGeometry {
  const quads: THREE.BufferGeometry[] = [];
  const { depth, lipZ, ceilingZ } = pocket;
  const y = POCKET_Y;
  // Lip slab top, facing +z.
  quads.push(quad([0, -y, lipZ], [depth, -y, lipZ], [depth, y, lipZ], [0, y, lipZ]));
  // Chassis end wall, facing the hinge (-x).
  quads.push(quad([depth, -y, lipZ], [depth, -y, ceilingZ], [depth, y, ceilingZ], [depth, y, lipZ]));
  // Side walls (the inner faces of the top and bottom walls), facing into the pocket.
  quads.push(quad([0, y, lipZ], [depth, y, lipZ], [depth, y, -0.52], [0, y, -0.52]));
  quads.push(quad([0, -y, lipZ], [0, -y, -0.52], [depth, -y, -0.52], [depth, -y, lipZ]));
  return merge(quads);
}

/** A planar quad a-b-c-d (counter-clockwise seen from its front). */
function quad(a: number[], b: number[], c: number[], d: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
  const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a))
    .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...d), new THREE.Vector3(...a))).normalize();
  g.setAttribute('normal', new THREE.Float32BufferAttribute([...n.toArray(), ...n.toArray(), ...n.toArray(), ...n.toArray()], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// ---- Back plates ------------------------------------------------------------------------------------

const ramp = (e: number) => back.edge.rise * Math.pow(Math.max(0, 1 - e / back.edge.width), back.edge.exponent);

/** Height of the camera plateau above the back at (x, y), from its measured flank sections. */
export const plateauHeight = (() => {
  const p = camera.plateau;
  const inverse = (table: [number, number][]) => monotone(table.map(([t, h]) => [h, t] as [number, number]).reverse());
  // Per edge of the plateau outline: toward the bottom and the hinge it is open; top and free sides run into the glass edge.
  const tOf: PerEdge<(h: number) => number> = { b: inverse(p.flank.open), l: inverse(p.flank.open), t: inverse(p.flank.top), r: inverse(p.flank.free) };
  return (x: number, y: number): number => {
    const { distance, weights } = nearest(outlines.plateau, x, y);
    if (distance <= 0) return p.rise;
    const reach = (h: number) => weights.b * tOf.b(h) + weights.l * tOf.l(h) + weights.t * tOf.t(h) + weights.r * tOf.r(h);
    if (distance >= reach(0)) return 0;
    let lo = 0, hi: number = p.rise; // reach decreases with height
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (reach(mid) > distance) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
})();

/** Back plate height field: the glass with its 2.5D edge, plus the plateau on the camera leaf. */
export function backPlateGeometry(kind: 'camera' | 'display'): THREE.BufferGeometry {
  const o = outlines.back;
  const height = (x: number, y: number) => {
    const e = -nearest(o, x, y).distance;
    return -T + ramp(e) - (kind === 'camera' ? plateauHeight(x, y) : 0);
  };
  const rings: Ring[] = [{ outline: o, offsets: [0.06, 0.16, 0.3, 0.48, 0.7, 0.96, 1.26, 1.6, 2.0], spacing: 0.5 }];
  if (kind === 'camera') {
    const p = camera.plateau;
    const levels: number[] = [];
    for (let i = 0; i <= 40; i++) levels.push(p.rise * (1 - Math.pow(i / 40, 1.35)));
    const table = (t: [number, number][]) => monotone(t.map(([a, b]) => [b, a] as [number, number]).reverse());
    const open = table(p.flank.open), top = table(p.flank.top), free = table(p.flank.free);
    rings.push({
      outline: outlines.plateau,
      offsets: [0.5, 0.25, 0.1, 0.03, ...levels.map((h) => ({ b: -open(h), l: -open(h), t: -top(h), r: -free(h) }))],
      spacing: 0.45,
    });
  }
  return heightFieldPlate({ outline: o, height, rings, grid: 2.2, clearance: 0.6, facing: -1 });
}

/** The plates' vertical edge (from the rolled edge up into the frame lip), facing outward. */
export function plateEdgeGeometry(): THREE.BufferGeometry {
  const list = stations(outlines.back, { edgeStep: 4, cornerSteps: 24 });
  const z0 = -T + ramp(0);
  return loft([
    { outline: outlines.back, d: uniformEdges(0), z: uniformEdges(z0) },
    { outline: outlines.back, d: uniformEdges(0), z: uniformEdges(back.sideTop) },
  ], list, { closed: true });
}

// ---- Hinge cover ------------------------------------------------------------------------------------

/** The hinge cover in its own frame: centred in x and y, outer bottom face at z = 0, open toward +z. */
export function spineGeometry(): THREE.BufferGeometry {
  const hy = hH - spine.endInset, hx = spine.width / 2;
  const c: Corner = { ax: spine.radius, ay: spine.radius, n: 2 };
  const outline: Outline = { x0: -hx, y0: -hy, x1: hx, y1: hy, corners: { br: c, tr: c, tl: c, bl: c } };
  const list = stations(outline, { edgeStep: 6, cornerSteps: 14 });
  const surface = (inset: number) => {
    const rows: LoftRow[] = [];
    const N = 14;
    const arc = (r: number, a: number): [number, number] => [inset + (r - inset) * (1 - Math.sin(a)), inset + (r - inset) * (1 - Math.cos(a))];
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI / 2;
      const [ds, zs] = arc(spine.radius, a), [de, ze] = arc(spine.endRadius, a);
      rows.push({ outline, d: { l: ds, r: ds, b: de, t: de }, z: { l: zs, r: zs, b: ze, t: ze } });
    }
    for (let k = 1; k <= 3; k++) {
      const f = k / 3;
      const zs = spine.radius + (spine.depth - spine.radius) * f, ze = spine.endRadius + (spine.depth - spine.endRadius) * f;
      rows.push({ outline, d: uniformEdges(inset), z: { l: zs, r: zs, b: ze, t: ze } });
    }
    return rows;
  };
  const outer = surface(0), inner = surface(spine.wall);
  const parts = [
    loft(outer, list, { closed: true }),
    cap(outer[0], list, -1),
    loft(inner, list, { closed: true, flip: true }),
    cap(inner[0], list, 1),
    // Rim across the sheet at the top of the arms.
    loft([outer[outer.length - 1], inner[inner.length - 1]], list, { closed: true }),
  ];
  return merge(parts);
}

export { spineBottom } from './hingeSection.ts';

// ---- Cameras ----------------------------------------------------------------------------------------

export function lensGeometries(): Record<'ring' | 'bezel' | 'housing' | 'element' | 'cover', THREE.BufferGeometry> {
  const l = camera.lens;
  const v = (p: readonly [number, number]) => new THREE.Vector2(p[0], p[1]);
  const ring = new THREE.LatheGeometry(l.ring.map(v), 128);
  const bezel = new THREE.LatheGeometry(l.bezel.map(v), 128);
  // Housing: down the inner wall from the cover glass to the floor, then the floor to the centre.
  const [inner, top] = l.bezel[l.bezel.length - 1];
  const housing = new THREE.LatheGeometry(([[inner, top], [inner, l.floor + 0.12], [inner - 0.12, l.floor], [0.001, l.floor]] as [number, number][]).map(v), 96);
  // First lens element: a shallow dome on the floor.
  const dome: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; dome.push([l.element * Math.cos(a) + 0.001, l.floor + 0.02 + 0.32 * Math.sin(a)]); }
  const element = new THREE.LatheGeometry(dome.map(v), 96);
  const cover = new THREE.CircleGeometry(inner, 96);
  cover.rotateX(-Math.PI / 2); // face +y, out of the lens
  cover.translate(0, top, 0);
  return { ring, bezel, housing, element, cover };
}

// ---- Buttons and wall decals ------------------------------------------------------------------------

/**
 * A stadium button in its own frame: x along its length, y across, z out of the wall (the wall's
 * outermost line at z = 0). Its edge rounds with `edge` into a flat face; a face insert (inset by
 * `border`) is group 1 when border > 0.
 */
export function buttonGeometry(length: number, height: number, protrusion: number, border = 0): THREE.BufferGeometry {
  const r = height / 2;
  const c: Corner = { ax: r, ay: r, n: 2 };
  const outline: Outline = { x0: -length / 2, y0: -r, x1: length / 2, y1: r, corners: { br: c, tr: c, tl: c, bl: c } };
  const list = stations(outline, { edgeStep: 1.5, cornerSteps: 20 });
  const edge = Math.min(0.13, protrusion * 0.5);
  const rows: LoftRow[] = [{ outline, d: uniformEdges(0), z: uniformEdges(-0.6) }];
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * Math.PI / 2;
    rows.push({ outline, d: uniformEdges(edge * (1 - Math.cos(a))), z: uniformEdges(protrusion - edge + edge * Math.sin(a)) });
  }
  const parts = [loft(rows, list, { closed: true })];
  if (border > 0) {
    parts.push(loft([rows[rows.length - 1], { outline, d: uniformEdges(border), z: uniformEdges(protrusion) }], list, { closed: true }));
    const insert = cap({ outline, d: uniformEdges(border), z: uniformEdges(protrusion + 0.002) }, list, 1);
    insert.clearGroups(); insert.addGroup(0, insert.getIndex()!.count, 1);
    parts.push(insert);
  } else {
    parts.push(cap(rows[rows.length - 1], list, 1));
  }
  return merge(parts);
}

/** The free, top and bottom walls' inset from the outline at height z (the measured section). */
export const wallInset = (() => {
  const table = (frame.wall as unknown as P2[]).slice(0, frame.anchors.wall[1] + 1).map(([d, z]) => [z, d] as [number, number]);
  const f = monotone(table);
  return (z: number) => Math.max(0, f(z));
})();

/**
 * An opening drawn onto the curved wall: a stadium (circle when width = height) centred at `at`
 * along the edge and height z, lying on the wall, with a chamfer ring (group 0, normals tilted
 * into the hole) around the dark opening (group 1). Edge 'b' or 't' runs along x, 'r' along y.
 */
export function wallDecal(edge: 'b' | 't' | 'r', at: number, z: number, width: number, height: number, chamfer: number): THREE.BufferGeometry {
  const position: number[] = [], normal: number[] = [], index: number[] = [];
  const segments = 48;
  // Stadium outline points (u along the edge, v along z) at an offset `grow` from the opening.
  const outlineAt = (grow: number) => {
    const r = height / 2 + grow, half = Math.max(0, width / 2 - height / 2);
    const pts: [number, number, number, number][] = []; // u, v, nu, nv
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const nu = Math.cos(a), nv = Math.sin(a);
      pts.push([(nu >= 0 ? half : -half) + r * nu, r * nv, nu, nv]);
    }
    return pts;
  };
  const place = (u: number, v: number, lift: number, nu: number, nv: number, tilt: number) => {
    const zz = z + v, d = wallInset(zz);
    const slope = (wallInset(zz + 0.01) - wallInset(zz - 0.01)) / 0.02;
    // Wall normal in (outward, z): (1, slope) normalised; tilt it into the hole for the chamfer.
    let on = 1, oz = slope;
    const l = Math.hypot(on, oz); on /= l; oz /= l;
    const tu = -nu * tilt, tv = -nv * tilt, k = Math.sqrt(Math.max(0, 1 - tilt * tilt));
    const out = d - lift; // inset of the decal surface
    let p: number[], n: number[];
    const nz = oz * k + tv;
    if (edge === 'r') { p = [W - out, at + u, zz]; n = [on * k, tu, nz]; }
    else if (edge === 't') { p = [at + u, hH - out, zz]; n = [tu, on * k, nz]; }
    else { p = [at + u, -hH + out, zz]; n = [tu, -on * k, nz]; }
    position.push(...p); normal.push(...n);
  };
  const inner = outlineAt(0), outer = outlineAt(chamfer);
  const lift = 0.004;
  // Chamfer ring (group 0).
  for (let i = 0; i < segments; i++) {
    place(outer[i][0], outer[i][1], lift, outer[i][2], outer[i][3], 0.7);
    place(inner[i][0], inner[i][1], lift, inner[i][2], inner[i][3], 0.7);
  }
  const ringCount: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = ((i + 1) % segments) * 2;
    ringCount.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // Opening (group 1): horizontal strips, so every vertex sits on the curved wall (a fan's large
  // triangles would cut inside the convex wall and let the frame show through).
  const base = position.length / 3;
  const r = height / 2, half = Math.max(0, width / 2 - r);
  const rowsN = Math.max(8, Math.ceil(height / 0.06));
  for (let k = 0; k <= rowsN; k++) {
    const v = -r + (k / rowsN) * height;
    const reach = half + Math.sqrt(Math.max(0, r * r - v * v));
    place(-reach, v, lift * 1.5, 0, 0, 0);
    place(reach, v, lift * 1.5, 0, 0, 0);
  }
  const fan: number[] = [];
  for (let k = 0; k < rowsN; k++) {
    const a = base + k * 2, b = a + 1, c = a + 2, d = a + 3;
    fan.push(a, b, c, b, d, c);
  }
  index.push(...ringCount, ...fan);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((position.length / 3) * 2).fill(0), 2));
  g.setIndex(index);
  g.addGroup(0, ringCount.length, 0);
  g.addGroup(ringCount.length, fan.length, 1);
  // Make every triangle face the way its normals do.
  return orientTo(g);
}

// ---- Geometry utilities -----------------------------------------------------------------------------

/** Merge indexed geometries with position, normal and uv, keeping their groups (or one group each at 0). */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const position: number[] = [], normal: number[] = [], uv: number[] = [];
  const groups: { start: number; count: number; materialIndex: number }[] = [];
  const index: number[] = [];
  const byMaterial = new Map<number, number[]>();
  for (const g of parts) {
    const base = position.length / 3;
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), t = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      position.push(p.getX(i), p.getY(i), p.getZ(i));
      normal.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
    }
    const idx = g.getIndex()!;
    const list = g.groups.length ? g.groups : [{ start: 0, count: idx.count, materialIndex: 0 }];
    for (const grp of list) {
      const m = grp.materialIndex ?? 0;
      if (!byMaterial.has(m)) byMaterial.set(m, []);
      const bucket = byMaterial.get(m)!;
      for (let i = grp.start; i < grp.start + grp.count; i++) bucket.push(base + idx.getX(i));
    }
  }
  for (const m of [...byMaterial.keys()].sort((a, b) => a - b)) {
    const b = byMaterial.get(m)!;
    groups.push({ start: index.length, count: b.length, materialIndex: m });
    for (const i of b) index.push(i);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(index);
  for (const g of groups) out.addGroup(g.start, g.count, g.materialIndex);
  return out;
}

/** Flip triangles whose winding disagrees with their vertex normals (or with a given direction). */
function orientTo(g: THREE.BufferGeometry, direction?: THREE.Vector3): THREE.BufferGeometry {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), idx = g.getIndex()!;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
  const arr = idx.array as Uint16Array | Uint32Array;
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(p, arr[i]); b.fromBufferAttribute(p, arr[i + 1]); c.fromBufferAttribute(p, arr[i + 2]);
    const face = b.sub(a).cross(c.sub(a));
    if (direction) m.copy(direction);
    else m.fromBufferAttribute(n, arr[i]).add(c.fromBufferAttribute(n, arr[i + 1])).add(a.fromBufferAttribute(n, arr[i + 2]));
    if (face.dot(m) < 0) { const t = arr[i + 1]; arr[i + 1] = arr[i + 2]; arr[i + 2] = t; }
  }
  idx.needsUpdate = true;
  return g;
}

/** Stations for evaluation outside this module (tests, tools). */
export { frameStations as stationsOfFrame, evalStation };
