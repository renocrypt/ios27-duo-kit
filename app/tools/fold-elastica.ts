/**
 * Display fold as an elastica: for every fold angle, the shape the inner display takes across its
 * free fold zone, solved from first principles and written as a table the app interpolates.
 *
 *   node tools/fold-elastica.ts                    # writes src/device/foldTable.json
 *   node tools/fold-elastica.ts --svg /tmp/x.svg   # also draws the family of curves for review
 *
 * Model. The display is an inextensible elastic strip. Across the fold zone (length L, centred on
 * the hinge) it minimises its bending energy, the integral of curvature squared, subject to:
 *   - clamped ends: it leaves each leaf tangent to the leaf's display plane at s = ±L/2;
 *   - symmetry: the two halves mirror about the hinge plane (x = 0), where the tangent is level;
 *   - the chassis: beyond the hinge pocket the display may not sink more than 0.2 mm into the leaf
 *     (Apple's closed model dips 0.22 there); over the pocket it may sink down to the pocket's lip
 *     plate, less a clearance for its own thickness.
 * Open flat, the solution is the straight display; partly folded, it rounds the corner above the
 * leaves; nearly closed, the pockets let it relax into the teardrop Apple's closed model shows.
 *
 * Method. Half the strip as N segments of equal length; unknowns are the segments' angles. The
 * energy is sum((phi[i+1] - phi[i])^2) / ds. The end-on-the-axis condition is an augmented
 * Lagrangian term; the chassis is a quadratic penalty that stiffens over the outer iterations.
 * L-BFGS minimises each subproblem. Angles are solved from open to closed, each warm-started from
 * the last, so the family is continuous.
 */
import { writeFileSync } from 'node:fs';
import { DUO } from '../src/device/spec.ts';

const { pivotHeight: h, foldLength: L } = DUO.hinge;
const N = 64;                       // segments per half
const ds = L / 2 / N;
const FLOOR_OUT = -0.2;             // beyond the pocket
const FLOOR_POCKET = DUO.pocket.lipZ + 0.35;
const POCKET_END = DUO.pocket.depth;

interface Frame { ox: number; oz: number; tx: number; tz: number; nx: number; nz: number }

/** The left leaf's frame at a leaf angle A (see fold.ts): origin on the display at the hinge line. */
function leftFrame(A: number): Frame {
  const s = Math.sin(A), c = Math.cos(A);
  return { ox: -h * s, oz: h - h * c, tx: -c, tz: s, nx: s, nz: c };
}

/** Allowed depth below the display plane at distance s from the hinge line (a smooth step at the pocket's end). */
function floor(s: number): number {
  const a = POCKET_END - 0.6, b = POCKET_END;
  if (s <= a) return FLOOR_POCKET;
  if (s >= b) return FLOOR_OUT;
  const t = (s - a) / (b - a), w = t * t * (3 - 2 * t);
  return FLOOR_POCKET + (FLOOR_OUT - FLOOR_POCKET) * w;
}

/** Positions of the half strip from the attachment (index 0) to the axis (index N). */
function positions(phi: Float64Array, f: Frame): { x: Float64Array; z: Float64Array } {
  const x = new Float64Array(N + 1), z = new Float64Array(N + 1);
  x[0] = f.ox + f.tx * (L / 2); z[0] = f.oz + f.tz * (L / 2);
  for (let i = 0; i < N; i++) { x[i + 1] = x[i] + ds * Math.cos(phi[i]); z[i + 1] = z[i] + ds * Math.sin(phi[i]); }
  return { x, z };
}

interface Weights { lambda: number; rho: number; mu: number }

/** Objective and gradient for the current multipliers. */
function objective(phi: Float64Array, f: Frame, w: Weights, grad: Float64Array): number {
  const start = Math.atan2(-f.tz, -f.tx); // heading from the attachment toward the hinge
  let e = 0;
  grad.fill(0);
  // Bending: clamped start angle, level end angle (0: heading +x at the axis).
  const angles = (i: number) => (i < 0 ? start : i >= N ? 0 : phi[i]);
  for (let i = -1; i < N; i++) {
    const d = angles(i + 1) - angles(i);
    e += (d * d) / ds;
    const g = (2 * d) / ds;
    if (i + 1 >= 0 && i + 1 < N) grad[i + 1] += g;
    if (i >= 0) grad[i] -= g;
  }
  const { x, z } = positions(phi, f);
  // Partial derivatives of the penalty with respect to each point, then back to angles by suffix sums.
  const gx = new Float64Array(N + 1), gz = new Float64Array(N + 1);
  // End on the axis: augmented Lagrangian on x[N] = 0.
  const c = x[N];
  e += w.lambda * c + 0.5 * w.rho * c * c;
  gx[N] += w.lambda + w.rho * c;
  // Chassis floor and the hinge plane (the half stays on its side).
  for (let k = 1; k <= N; k++) {
    const rx = x[k] - f.ox, rz = z[k] - f.oz;
    const s = rx * f.tx + rz * f.tz, dep = rx * f.nx + rz * f.nz; // along the leaf, and height above its display plane
    const v = floor(s) - dep;
    if (v > 0) { e += w.mu * v * v; const g = -2 * w.mu * v; gx[k] += g * f.nx; gz[k] += g * f.nz; }
    if (x[k] > 0) { e += w.mu * x[k] * x[k]; gx[k] += 2 * w.mu * x[k]; }
  }
  let sx = 0, sz = 0;
  for (let j = N - 1; j >= 0; j--) {
    sx += gx[j + 1]; sz += gz[j + 1];
    grad[j] += -ds * Math.sin(phi[j]) * sx + ds * Math.cos(phi[j]) * sz;
  }
  return e;
}

/** Limited-memory BFGS with a backtracking line search. */
function lbfgs(phi: Float64Array, fn: (p: Float64Array, g: Float64Array) => number, iterations: number): void {
  const m = 8, S: Float64Array[] = [], Y: Float64Array[] = [], R: number[] = [];
  const g = new Float64Array(N), gNew = new Float64Array(N), d = new Float64Array(N), trial = new Float64Array(N);
  let fx = fn(phi, g);
  for (let it = 0; it < iterations; it++) {
    // Two-loop recursion.
    d.set(g);
    const alpha: number[] = [];
    for (let i = S.length - 1; i >= 0; i--) { const a = R[i] * dot(S[i], d); alpha[i] = a; axpy(-a, Y[i], d); }
    if (S.length) { const k = S.length - 1; const gamma = dot(S[k], Y[k]) / dot(Y[k], Y[k]); scale(d, gamma); }
    for (let i = 0; i < S.length; i++) { const b = R[i] * dot(Y[i], d); axpy(alpha[i] - b, S[i], d); }
    scale(d, -1);
    let slope = dot(g, d);
    if (slope >= 0) { d.set(g); scale(d, -1); slope = dot(g, d); S.length = Y.length = R.length = 0; }
    let step = 1, fNew = 0;
    for (let k = 0; k < 40; k++) {
      for (let i = 0; i < N; i++) trial[i] = phi[i] + step * d[i];
      fNew = fn(trial, gNew);
      if (fNew <= fx + 1e-4 * step * slope) break;
      step *= 0.5;
    }
    const s = new Float64Array(N), y = new Float64Array(N);
    for (let i = 0; i < N; i++) { s[i] = trial[i] - phi[i]; y[i] = gNew[i] - g[i]; }
    const sy = dot(s, y);
    phi.set(trial); g.set(gNew);
    const improvement = fx - fNew;
    fx = fNew;
    if (sy > 1e-12) { S.push(s); Y.push(y); R.push(1 / sy); if (S.length > m) { S.shift(); Y.shift(); R.shift(); } }
    if (Math.abs(improvement) < 1e-12 && Math.sqrt(dot(g, g)) < 1e-7) break;
  }
}
const dot = (a: Float64Array, b: Float64Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const axpy = (a: number, x: Float64Array, y: Float64Array) => { for (let i = 0; i < y.length; i++) y[i] += a * x[i]; };
const scale = (x: Float64Array, a: number) => { for (let i = 0; i < x.length; i++) x[i] *= a; };

/** Solve one angle, warm-started from `phi`. Returns the residuals for the report. */
function solve(theta: number, phi: Float64Array): { gap: number; floor: number; energy: number } {
  const A = (Math.PI - theta) / 2;
  const f = leftFrame(A);
  const w: Weights = { lambda: 0, rho: 50, mu: 200 };
  const g = new Float64Array(N);
  for (let outer = 0; outer < 14; outer++) {
    lbfgs(phi, (p, grad) => objective(p, f, w, grad), 400);
    const { x } = positions(phi, f);
    w.lambda += w.rho * x[N];
    w.rho = Math.min(w.rho * 2, 1e7);
    w.mu = Math.min(w.mu * 2, 1e7);
  }
  const { x, z } = positions(phi, f);
  let worst = 0;
  for (let k = 1; k <= N; k++) {
    const rx = x[k] - f.ox, rz = z[k] - f.oz;
    worst = Math.max(worst, floor(rx * f.tx + rz * f.tz) - (rx * f.nx + rz * f.nz));
  }
  let energy = 0;
  const start = Math.atan2(-f.tz, -f.tx);
  for (let i = -1; i < N; i++) { const a = i < 0 ? start : phi[i], b = i + 1 >= N ? 0 : phi[i + 1]; energy += ((b - a) ** 2) / ds; }
  objective(phi, f, w, g);
  return { gap: Math.abs(x[N]), floor: worst, energy };
}

// ---- Solve every whole degree, open to closed ----------------------------------------------------

const table: { theta: number; x: number[]; z: number[] }[] = [];
const phi = new Float64Array(N); // open flat: every segment heads +x
let report = '';
for (let deg = 180; deg >= 0; deg--) {
  const theta = (deg * Math.PI) / 180;
  const r = solve(theta, phi);
  const { x, z } = positions(phi, leftFrame((Math.PI - theta) / 2));
  table.push({ theta: deg, x: Array.from(x, (v) => +v.toFixed(4)), z: Array.from(z, (v) => +v.toFixed(4)) });
  if (deg % 15 === 0 || deg < 6) report += `θ ${String(deg).padStart(3)}°  axis gap ${r.gap.toExponential(1)}  floor violation ${r.floor.toFixed(4)}  energy ${r.energy.toFixed(3)}  bottom z ${Math.min(...z).toFixed(3)}\n`;
}
table.reverse();
console.log(report);

const out = { $description: 'Generated by tools/fold-elastica.ts: the half fold curve (attachment to axis) for each whole degree of fold angle, device frame, mm. Do not edit.', segments: N, foldLength: L, pivotHeight: h, curves: table };
const args = process.argv.slice(2);
writeFileSync(new URL('../src/device/foldTable.json', import.meta.url), JSON.stringify(out));
console.log(`wrote src/device/foldTable.json (${table.length} angles × ${N + 1} points)`);

const svgAt = args.indexOf('--svg');
if (svgAt >= 0) {
  const S = 28, W = 900, H = 700, cx = W / 2, cy = 520;
  let paths = '';
  for (const c of table) {
    if (c.theta % 10 !== 0 && c.theta > 10) continue;
    const pts = c.x.map((x, i) => [x, c.z[i]]);
    const full = [...pts, ...pts.slice(0, -1).reverse().map(([x, z]) => [-x, z])];
    const hue = (c.theta / 180) * 240;
    paths += `<path d="M${full.map(([x, z]) => `${(cx + x * S).toFixed(1)},${(cy - z * S).toFixed(1)}`).join('L')}" fill="none" stroke="hsl(${hue},80%,45%)" stroke-width="1.4"/>`;
  }
  // Leaves (closed) for scale: display planes and pockets.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff">
    <line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke="#ddd"/><circle cx="${cx}" cy="${cy - h * S}" r="3" fill="#000"/>${paths}</svg>`;
  writeFileSync(args[svgAt + 1], svg);
  console.log('wrote', args[svgAt + 1]);
}
