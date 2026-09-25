/**
 * Hinge collision check: sweeps the fold angle from closed to open and reports, for every pair of
 * parts that could meet, the smallest clearance (mm; negative = overlap) and where it happens.
 *
 *   node tools/check-hinge.ts            # 0.5° steps
 *   node tools/check-hinge.ts 0.1        # finer
 *
 * Exits non-zero if any pair overlaps, so it can gate changes to the spec or the fold model.
 */
import { clearance, hingeSection } from '../src/device/hingeSection.ts';
import { DUO } from '../src/device/spec.ts';

const step = Number(process.argv[2] ?? 0.5);
type Pair = { name: string; min: number; at: number; overlaps: number[] };
const pairs: Record<string, Pair> = {};
const record = (name: string, value: number, deg: number) => {
  const p = (pairs[name] ??= { name, min: Infinity, at: NaN, overlaps: [] });
  if (value < p.min) { p.min = value; p.at = deg; }
  if (value < 0) p.overlaps.push(deg);
};

for (let deg = 0; deg <= 180 + 1e-9; deg += step) {
  const s = hingeSection((deg * Math.PI) / 180);
  const [L, R] = s.leaves;
  record('spine · left leaf', clearance(L, s.spine, { bClosed: true }), deg);
  record('spine · right leaf', clearance(R, s.spine, { bClosed: true }), deg);
  record('display · left leaf', clearance(L, s.display.points, { bClosed: false, bThickness: s.display.thickness }), deg);
  record('display · right leaf', clearance(R, s.display.points, { bClosed: false, bThickness: s.display.thickness }), deg);
  record('display · spine', clearance(s.spine, s.display.points, { bClosed: false, bThickness: s.display.thickness }), deg);
  record('rim · spine', clearance(s.spine, s.rim.points, { bClosed: false, bThickness: s.rim.thickness }), deg);
  record('left leaf · right leaf', clearance(L, R, { bClosed: true }), deg);
  // The flexible rim's outer wall hangs below the display near the top and bottom edges; over the
  // pocket it must stay above the pocket's lip plate.
  const f = s.state.left;
  let wall = Infinity;
  s.state.curve.points.forEach((p, i) => {
    const n = s.state.curve.normals[i];
    const wx = p.x + n.x * DUO.bumper.flexWallZ, wz = p.z + n.z * DUO.bumper.flexWallZ;
    const rx = wx - f.origin.x, rz = wz - f.origin.z;
    const along = rx * f.t.x + rz * f.t.z, depth = rx * f.n.x + rz * f.n.z;
    if (wx <= 0 && along >= 0 && along <= DUO.pocket.depth) wall = Math.min(wall, depth - DUO.pocket.lipZ);
  });
  if (wall < Infinity) record('rim wall · pocket lip', wall, deg);
}

let failed = false;
console.log(`hinge check, ${step}° steps (clearance in mm, negative = overlap)`);
for (const p of Object.values(pairs)) {
  const bad = p.overlaps.length > 0;
  failed ||= bad;
  const range = bad ? `  OVERLAP at ${p.overlaps[0]}°..${p.overlaps[p.overlaps.length - 1]}° (${p.overlaps.length} steps)` : '';
  console.log(`${bad ? '✗' : '✓'} ${p.name.padEnd(24)} min ${p.min.toFixed(3).padStart(7)} at ${p.at.toFixed(1).padStart(5)}°${range}`);
}
process.exit(failed ? 1 : 0);
