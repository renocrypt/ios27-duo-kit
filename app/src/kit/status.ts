/**
 * iPhone Duo's status indicator, drawn by us from the numbers in Apple's iOS 27 UI Kit
 * ("Status Bars / iPhone Duo", docs/duo-ui.md section 2): the time, and a
 * 46 pt ring whose arc is the battery charge, with Wi-Fi at its centre and cellular strength as
 * four dots in the ring's opening. Vertical in the rail (48 x 86 pt), horizontal in a top bar
 * (104 x 48 pt, the inner display in portrait).
 *
 *   statusBar({ layout: 'vertical', time: '9:41' })                 -> HTML string
 *   statusBar({ layout: 'horizontal', time: '6:52', battery: 0.62, wifi: 2, cell: 3 })
 *   statusRing({ battery: 1, wifi: 3, cell: 4 })                    -> the 46 x 46 SVG alone
 *   RING                                                            the geometry, for tools
 *
 * Colour is currentColor (white on dark content, black on light, as the kit's two variants).
 * Levels: the kit draws only the full state. Lower levels are ours [C]: the battery arc shortens
 * from its trailing end, and unlit Wi-Fi bands and cellular dots drop to UNLIT opacity, the way the
 * iPhone status bar dims its empty bars. Every element carries a class, so levels can animate in
 * CSS (stroke-dashoffset, opacity).
 */
import './status.css';

/**
 * Ring geometry in points, in the kit's 46 x 46 ring box (origin top left, y down). Measured from
 * the kit's vector frame and fitted in labs/glyphs.html: every part is within 0.02 pt (mean outline
 * deviation) of the kit, a twentieth of a pixel at 3x.
 */
export const RING = {
  size: 46,
  /** Battery arc: centre, centreline radius, stroke width, and where each round cap is centred,
   *  in degrees below the horizontal (the arc runs over the top between them). Kit: outer radius
   *  20.5, inner 17.4, the caps' centres 30.8 degrees below the horizontal. */
  battery: { cx: 23, cy: 22.8, r: 18.94, width: 3.09, endBelow: 30.79 },
  /** Cellular: four dots of radius 2, at 60, 80, 100 and 120 degrees (y down) from the arc's
   *  centre; the outer pair sits 18.73 from it, the inner pair 19.20. */
  cell: { r: 2, dots: [[13.671, 39.001], [19.671, 41.671], [26.329, 41.671], [32.329, 39.001]] as [number, number][] },
  /** Wi-Fi: three elements about one centre, the apex of the wedge. Box: 18 x 13.33 at (14, 16).
   *  Bands: centreline radius, width, and half-angle to the cap centres; the wedge: radius,
   *  its apex below the centre, half-angle, and corner radii (tip, outer corners). Fitted to the
   *  kit by the glyph lab. */
  wifi: {
    cx: 23, cy: 28.7,
    wedge: { r: 3.31, drop: 1.15, half: 44.35, tip: 1.27, corner: 0.9 },
    bands: [{ r: 6.745, width: 2.55, half: 40.8 }, { r: 11.45, width: 2.52, half: 42.6 }],
  },
};

/** Opacity of an unlit Wi-Fi band or cellular dot [C]. */
export const UNLIT = 0.3;

const f = (n: number) => +n.toFixed(3);
const rad = (deg: number) => (deg * Math.PI) / 180;

/** The battery arc as a path from its leading (lower left) cap over the top to its trailing cap. */
function batteryPath(g = RING.battery): { d: string; length: number } {
  const { cx, cy, r, endBelow } = g;
  const a0 = rad(180 - endBelow), a1 = rad(endBelow);
  const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  const span = 360 - (180 - 2 * endBelow);
  return { d: `M${f(p0[0])} ${f(p0[1])}A${r} ${r} 0 1 1 ${f(p1[0])} ${f(p1[1])}`, length: (rad(span) * r) };
}

/** An arc of radius r about (cx, cy), symmetric about the vertical, over the top: half-angle `half`. */
function bandPath(cx: number, cy: number, r: number, half: number): string {
  const a = rad(half);
  const x0 = cx - r * Math.sin(a), x1 = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
  return `M${f(x0)} ${f(y)}A${r} ${r} 0 0 1 ${f(x1)} ${f(y)}`;
}

/**
 * The Wi-Fi wedge: a sector opening upward from its apex (cx, cy + drop), cut by the circle of
 * radius r about the bands' centre (cx, cy), its tip and outer corners rounded.
 */
function wedgePath(cx: number, cy: number, w = RING.wifi.wedge): string {
  const phi = rad(w.half), R = w.r, A = [cx, cy + w.drop];
  const uL = [-Math.sin(phi), -Math.cos(phi)], uR = [Math.sin(phi), -Math.cos(phi)];
  // Tip: a circle tangent to both sides, its centre on the axis.
  const d = w.tip / Math.sin(phi), L = d * Math.cos(phi);
  const tL = [A[0] + L * uL[0], A[1] + L * uL[1]], tR = [A[0] + L * uR[0], A[1] + L * uR[1]];
  // Outer corners: circles tangent to a side and, from inside, to the top circle.
  const corner = (u: number[], n: number[]) => {
    const a = [A[0] + w.corner * n[0] - cx, A[1] + w.corner * n[1] - cy];
    const b = u[0] * a[0] + u[1] * a[1], c = a[0] ** 2 + a[1] ** 2 - (R - w.corner) ** 2;
    const t = -b + Math.sqrt(b * b - c);
    const q = [cx + a[0] + t * u[0], cy + a[1] + t * u[1]], k = R / (R - w.corner);
    return { side: [A[0] + t * u[0], A[1] + t * u[1]], arc: [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k] };
  };
  const cR = corner(uR, [-Math.cos(phi), -Math.sin(phi)]), cL = corner(uL, [Math.cos(phi), -Math.sin(phi)]);
  const P = (p: number[]) => `${f(p[0])} ${f(p[1])}`;
  return `M${P(tL)}A${w.tip} ${w.tip} 0 0 0 ${P(tR)}L${P(cR.side)}A${w.corner} ${w.corner} 0 0 0 ${P(cR.arc)}`
    + `A${R} ${R} 0 0 0 ${P(cL.arc)}A${w.corner} ${w.corner} 0 0 0 ${P(cL.side)}Z`;
}

export interface Levels {
  /** Battery charge, 0..1. Default full. */
  battery?: number;
  /** Wi-Fi bars lit, 0..3 (the wedge counts as one). Default 3. */
  wifi?: number;
  /** Cellular dots lit, 0..4. Default 4. */
  cell?: number;
}

/** The 46 x 46 pt ring, as an SVG sized in points. */
export function statusRing(levels: Levels = {}, geometry = RING): string {
  const { battery = 1, wifi = 3, cell = 4 } = levels;
  const b = batteryPath(geometry.battery), { cx, cy } = geometry.wifi;
  const lit = (on: boolean) => (on ? '' : ` opacity="${UNLIT}"`);
  const bands = geometry.wifi.bands.map((band, i) =>
    `<path class="st-wifi-band" d="${bandPath(cx, cy, band.r, band.half)}" stroke-width="${band.width}"${lit(wifi >= i + 2)}/>`).join('');
  const dots = geometry.cell.dots.map(([x, y], i) => `<circle class="st-cell-dot" cx="${x}" cy="${y}" r="${geometry.cell.r}"${lit(cell >= i + 1)}/>`).join('');
  const charge = Math.max(0, Math.min(1, battery));
  return `<svg class="st-ring" width="${geometry.size}" height="${geometry.size}" viewBox="0 0 ${geometry.size} ${geometry.size}" aria-hidden="true">`
    + `<path class="st-battery" d="${b.d}" stroke-width="${geometry.battery.width}" pathLength="1" stroke-dasharray="${charge >= 1 ? '1.01 0' : `${f(charge)} 1`}"/>`
    + `<path class="st-wifi-wedge" d="${wedgePath(cx, cy, geometry.wifi.wedge)}"${lit(wifi >= 1)}/>${bands}${dots}</svg>`;
}

export interface StatusOptions extends Levels {
  layout: 'vertical' | 'horizontal';
  time: string;
}

/** The status indicator: the time and the ring, stacked (rail) or side by side (top bar). */
export function statusBar(o: StatusOptions): string {
  return `<div class="duo-status duo-status--${o.layout}" role="img" aria-label="${o.time}">`
    + `<span class="st-time">${o.time}</span>${statusRing(o)}</div>`;
}
