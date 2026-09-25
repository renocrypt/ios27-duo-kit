/**
 * iPhone Duo geometry in millimetres: the single source for the 3D model.
 *
 * Provenance keys (see duo/research/):
 *   [A]  Apple published (apple.com/iphone-duo/specs)
 *   [M]  measured by us from Apple's AR Quick Look model (Pose variants "Landscape" and "Closed"),
 *        by cutting it with planes and fitting curves (device-physical-reference note, geometry pass
 *        of 2026-09-23). Sections are simplified to 0.004 mm; corner fits are within 0.02 mm.
 *   [D]  derived from the above
 *   [SIM] Xcode 27.1 beta's iPhone Duo simulator profile (displays: pixels, scale, corner radii, ppi)
 *   [C]  our design choice, where Apple's model shows nothing; tune freely
 *
 * Device frame (flat, open): x across the fold (left leaf x < 0 carries the outer display on its
 * back; right leaf x > 0 carries the rear cameras), y along the hinge (top edge +y), z out of the
 * inner display (inner display surface at z = 0, backs at z = -thickness). Per-leaf values use s,
 * the distance from the hinge line (s = |x|), and are given for the right leaf; the left mirrors.
 *
 * Sections are [inset, z] pairs listed from the back to the front, where inset is the distance
 * inward from the leaf's plan outline (the outline is the widest point, at mid-thickness).
 */

/** A superellipse corner (outline.ts): extents from the corner box and exponent. */
export interface CornerSpec { ax: number; ay: number; n: number }

export const DUO = {
  leaf: {
    width: 82.45,              // [M] hinge line to free edge (spec: 164.6 open)
    height: 117.95,            // [M] (spec 117.8)
    thickness: 5.236,          // [M] back glass to the inner display surface (spec 5.2)
    corners: {
      free: { ax: 14.36, ay: 14.36, n: 2.38 },   // [M] plan outline at mid-thickness
      hinge: { ax: 0.95, ay: 0.89, n: 2.21 },    // [M]
    },
  },

  frame: {
    /** [M] Free, top and bottom walls, from the flat back lip to the front bead and down its inner face. */
    wall: [
      [1.141, -5.101], [0.993, -5.044], [0.723, -4.894], [0.474, -4.681], [0.281, -4.427], [0.144, -4.14],
      [0.0975, -3.966], [0.062, -3.833], [0.017, -3.469], [0.0, -3.018], [0.0, -2.566], [0.0, -2.068],
      [0.014, -1.57], [0.066, -1.176], [0.155, -0.871], [0.294, -0.585], [0.483, -0.328], [0.559, -0.249],
      [0.628, -0.207], [0.661, -0.222], [0.677, -0.254], [0.678, -0.517],
    ],
    /** [M] Hinge end, [s, z]: the rounded back lip, the flat end face, and the front bead. */
    hinge: [
      [0.907, -5.234], [0.634, -5.228], [0.45, -5.197], [0.294, -5.126], [0.162, -5.013], [0.081, -4.892],
      [0.024, -4.733], [0.002, -4.532], [0.0, -3.966], [0.0, -2.2], [0.0, -0.513], [0.017, -0.365],
      [0.076, -0.261], [0.154, -0.218], [0.221, -0.207], [0.299, -0.218], [0.367, -0.254], [0.42, -0.31],
      [0.451, -0.382], [0.461, -0.517],
    ],
    /** Indices into `wall` and `hinge` of the pocket lip height and the bead top: rows line up there. */
    anchors: { wall: [6, 18], hinge: [8, 14] },
    lipZ: -5.101,              // [M] flat back lip of the free, top and bottom walls
    glassGap: 0.05,            // [M] frame lip to glass edge
    /** [M] Antenna bands (grey polymer, full wall height), 1.253 wide, by start position along each edge. */
    antenna: { width: 1.253, bottom: [28.0, 52.778], top: [14.829, 66.361], free: [-44.149, 42.894] },
  },

  back: {
    /** [M] Both back plates (camera leaf glass, outer display cover glass): inset from the leaf outline. */
    inset: { free: 1.332, top: 1.332, bottom: 1.332, hinge: 0.957 },
    corners: { free: { ax: 13.05, ay: 13.05, n: 2.43 }, hinge: { ax: 2.73, ay: 2.73, n: 2.49 } }, // [M]
    edge: { rise: 0.086, width: 1.6, exponent: 3.7 }, // [M] 2.5D edge: rolls 0.086 toward the front over 1.6 mm
    sideTop: -4.836,           // [M] top of the plate's vertical edge (hidden inside the frame lip)
  },

  bumper: {
    /** [M] Black raised rim around the inner display: 0.264 above the display, touching its twin when closed. */
    section: [
      [0.729, -0.517], [0.738, -0.327], [0.783, -0.141], [0.855, -0.011], [0.975, 0.108], [1.14, 0.203],
      [1.39, 0.253], [1.668, 0.264], [2.25, 0.265], [2.854, 0.265], [2.911, 0.258], [2.957, 0.226],
      [2.975, 0.172], [2.977, 0.115], [2.895, 0.115], [2.852, 0.105], [2.825, 0.076], [2.779, 0.065],
    ],
    flexWallZ: -1.31,          // [M] the flexible part's outer wall reaches this far below the display (closes the view past the rim ends)
    flexInset: 1.14,           // [M] 1.10, snapped to the section vertex: inside it, near the hinge, the rim is a flexible strip that folds with the display
    hingeGap: 0.5,             // [M] the rigid rim stops 0.5 mm from the hinge line
  },

  pocket: {
    /** [M] Open cavity at each leaf's hinge end that houses the hinge cover and, closed, the display's bulb. */
    depth: 5.72,               // chassis end wall, from the hinge line
    lipZ: -3.966,              // top of the back lip slab
    side: 1.054,               // the top and bottom walls are this thick at the hinge end
    ceilingZ: -0.54,           // underside of the display stack beyond the pocket
  },

  hinge: {
    pivotHeight: 0.27,         // [D] axis above the display surface: the rims (0.264 high) nearly touch when closed; 11.0 mm stack
    foldLength: 23.77,         // [M] span of the flexible rim across the fold (±11.885)
  },

  spine: {
    /** [M] Hinge cover: a rigid U channel that stays level and rises toward the axis as the leaves close. */
    width: 8.224,
    depth: 2.894,
    radius: 2.1,               // [M] bottom edges along the hinge
    endRadius: 1.9,            // [M] the ends curl up with this radius
    endInset: 1.186,           // [M] ends stop this far inside the top and bottom edges
    wall: 0.35,                // [C] sheet thickness (Apple's model is a single surface)
    openBottom: -3.892,        // [M] outer bottom face relative to the axis, open flat
    closedBottom: -2.32,       // [M] closed
  },

  inner: {
    active: { width: 157.99, height: 111.03 }, // [M] centred on the open device
    corner: { ax: 11.105, ay: 11.105, n: 2.58 }, // [M] (the UI's 55 pt corner)
    coverInset: 2.34,          // [M] cover glass edge from the leaf outline (under the rim)
    canvas: { width: 951, height: 669 },        // [A/M] points, landscape-native (tokens: device.display.inner). [SIM] 2007 × 2853 px at 3x, corners 55 pt, 460 ppi nominal (the active area above implies 459)
    wake: [8, 30],             // [C] fold angle, degrees: the panel is off when closed, wakes past the first and is at full brightness by the second
  },

  outer: {
    active: { width: 77.39, height: 112.51 },   // [M]
    border: { hinge: 2.34, free: 2.72, top: 2.72, bottom: 2.72 }, // [M] leaf edge to active area
    corners: { free: { ax: 11.785, ay: 11.785, n: 2.52 }, hinge: { ax: 1.57, ay: 1.57, n: 2.43 } }, // [M] (59 pt, 8 pt)
    canvas: { width: 466, height: 678 },        // points, portrait. [SIM] 1398 × 2034 px at 3x, corners 59 pt free and 8 pt hinge
    camera: { fromFree: 10.651, fromTop: 10.648, cutout: 6.105, ring: 3.59, aperture: 1.56 }, // [M]
  },

  camera: {
    plateau: {
      width: 55.792, height: 21.152, fromFree: 4.935, fromTop: 4.708, rise: 3.64, // [M] flat top (a glass window)
      corner: { ax: 12.2, ay: 10.576, n: 2.2 }, // [M] each end is one continuous curve
      /**
       * [M] Flank sections, [distance out from the top's edge, height above the back]. Open toward
       * the hinge and the bottom; on the top and free sides the flank runs into the glass edge, so
       * it is steeper and has no foot (it reaches the back's level just before the glass edge).
       */
      flank: {
        open: [[0, 3.64], [0.35, 3.092], [0.754, 2.538], [1.211, 2.016], [1.719, 1.528], [2.226, 1.139],
          [2.786, 0.794], [3.39, 0.506], [4.201, 0.268], [5.222, 0.083], [6.378, 0.014], [7.9, 0]] as [number, number][],
        top: [[0, 3.64], [0.298, 3.094], [0.629, 2.54], [0.985, 2.021], [1.364, 1.534], [1.731, 1.134],
          [2.029, 0.847], [2.383, 0.546], [2.685, 0.322], [3.07, 0.079], [3.216, 0]] as [number, number][],
        free: [[0, 3.64], [0.298, 3.094], [0.629, 2.541], [0.988, 2.021], [1.376, 1.534], [1.758, 1.133],
          [2.077, 0.843], [2.439, 0.559], [2.817, 0.308], [3.226, 0.086], [3.419, 0]] as [number, number][],
      },
    },
    lens: {
      fromTop: 15.285, fromFree: [15.295, 33.065], // [M] centres
      /** [M] Polished ring, [radius, height above the plateau], then the black inner ring up to the cover glass. */
      ring: [[8.015, 0], [8.117, 0.2], [8.114, 1.543], [8.087, 1.687], [8.017, 1.796], [7.91, 1.869], [7.765, 1.899], [7.04, 1.901]] as [number, number][],
      bezel: [[7.04, 1.901], [7.034, 1.997], [7.004, 2.049], [6.952, 2.08], [6.871, 2.086], [6.622, 2.086]] as [number, number][],
      floor: 1.111,            // [M] black lens housing below the cover glass
      element: 2.035,          // [M] radius of the first lens element
    },
    flash: { diameter: 4.05, fromFree: 49.725, fromTop: 19.74 },      // [M] under the plateau glass
    sensor: { width: 3.41, height: 1.59, fromFree: 49.725, fromTop: 10.975 }, // [M]
  },

  controls: {
    /** [M] All buttons are stadiums centred at z = -2.566, sitting in openings 0.05 larger. */
    centerZ: -2.566,
    sideButton: { length: 18.71, height: 3.06, protrusion: 0.455, fromTop: 33.61, border: 0.2 },      // [M] Touch ID, free edge
    cameraControl: { length: 17.13, height: 2.534, protrusion: 0.079, fromBottom: 24.23, border: 0.2 }, // [M] sapphire, free edge
    volume: { length: 10.91, height: 2.35, protrusion: 0.449, fromFree: 20.9, gap: 2.51 },            // [M] camera leaf, top edge
    clearance: 0.05,           // [M] opening minus button, all round
    usbC: { centerFromHinge: 41.016, width: 8.43, height: 2.5, z: -2.411 },             // [M] outer-display leaf, bottom edge
    screws: { diameter: 1.6, left: [33.652, 48.38], right: [33.651, 48.38], z: -2.407 }, // [M] pentalobe, both bottom edges
    speaker: { diameter: 1.355, z: -2.566, pitch: 2.2615, right: [16.025, 59.221] },     // [M] camera leaf bottom: two rows of four, by first hole
    topHoles: { diameter: 1.355, z: -2.566, pitch: 2.6626, left: 34.354, count: 6 },     // [M] outer-display leaf top edge, by first hole
    chamfer: 0.09,             // [M] every opening's edge chamfer
  },
} as const;

export type DuoSpec = typeof DUO;

/** Handy derived values. */
export const derived = {
  halfHeight: DUO.leaf.height / 2,
};
