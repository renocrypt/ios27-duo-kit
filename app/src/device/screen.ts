/**
 * Device displays as physically based glass with a lit image beneath.
 *
 *   createScreenMaterial(opts)   MeshPhysicalMaterial whose emission is the UI texture, clipped to
 *                                the active area (a continuous-corner outline, outline.ts), black
 *                                elsewhere, with an optional camera cutout and cover-glass discard
 *   FoldableScreen               the inner display: a strip mesh in unfolded coordinates, bent every
 *                                frame by the fold solver (fold.ts), so the image never stretches
 *
 * Facing halves. An environment map knows nothing of the device, so a folded display would reflect
 * the sky even where it faces its own other half (closed, it would glow through the gap between
 * the rims). With `facing`, each reflected ray is traced through the space between the leaves:
 * where it lands on the other half, the display reflects that half's image (black where it is dark
 * or off); where it would leave under a rim, it sees the rim (black); only rays that leave over
 * both rims see the environment. Exact for the flat parts, close across the fold.
 *
 * Coordinates are millimetres in the mesh's plane. `uvToPlane` says how the mesh's UVs map to that
 * plane; the image spans the active outline's bounds, so the UI texture covers exactly what Apple
 * lights, with Apple's corner shape.
 */
import * as THREE from 'three';
import { displayAt, type FoldState } from './fold.ts';
import type { Outline } from './outline.ts';

export interface ScreenMaterialOptions {
  /** plane = origin + uv * size (mm). */
  uvToPlane: { origin: [number, number]; size: [number, number] };
  /** The lit area; the image spans its bounds. */
  active: Outline;
  /** Discard outside this outline (the cover glass), when the mesh is larger than the glass. */
  cover?: Outline;
  /** Camera cutout (black), in plane coordinates. */
  hole?: { x: number; y: number; radius: number };
  image: THREE.Texture;
  /** Glass finish. */
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  brightness?: number;
  /**
   * Trace reflections within the fold (the inner display): the rim line's reach from the hinge line
   * and from the centre line, and the rim's height above the display, mm.
   */
  facing?: { reach: number; halfHeight: number; rim: number };
}

/** GLSL: approximate signed distance to an outline with superellipse corners (exact on straight edges). */
export const OUTLINE_SDF = /* glsl */ `
  // Corners in the order bl, br, tr, tl; a = extents (x in .xy of cornerA, y in cornerB), n = exponents.
  float duoOutline(vec2 p, vec2 lo, vec2 hi, vec4 ax, vec4 ay, vec4 cn) {
    vec2 c = 0.5 * (lo + hi);
    int k = p.x < c.x ? (p.y < c.y ? 0 : 3) : (p.y < c.y ? 1 : 2);
    vec2 a = vec2(ax[k], ay[k]);
    float n = cn[k];
    vec2 dir = vec2(p.x < c.x ? -1.0 : 1.0, p.y < c.y ? -1.0 : 1.0);
    vec2 corner = vec2(p.x < c.x ? lo.x : hi.x, p.y < c.y ? lo.y : hi.y);
    vec2 q = (p - (corner - dir * a)) * dir;
    if (q.x > 0.0 && q.y > 0.0) {
      vec2 u = q / a;
      float g = pow(pow(u.x, n) + pow(u.y, n), 1.0 / n);
      vec2 grad = vec2(pow(u.x, n - 1.0) / a.x, pow(u.y, n - 1.0) / a.y) * pow(g, 1.0 - n);
      return (g - 1.0) / max(length(grad), 1e-5);
    }
    vec2 d = max(lo - p, p - hi);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
`;

const outlineUniforms = (o: Outline) => ({
  lo: new THREE.Vector2(o.x0, o.y0),
  hi: new THREE.Vector2(o.x1, o.y1),
  ax: new THREE.Vector4(o.corners.bl.ax, o.corners.br.ax, o.corners.tr.ax, o.corners.tl.ax),
  ay: new THREE.Vector4(o.corners.bl.ay, o.corners.br.ay, o.corners.tr.ay, o.corners.tl.ay),
  n: new THREE.Vector4(o.corners.bl.n, o.corners.br.n, o.corners.tr.n, o.corners.tl.n),
});

type ScreenUniforms = {
  uViewToDevice: { value: THREE.Matrix4 };
  uLeafL: { value: THREE.Vector4 }; uLeafLN: { value: THREE.Vector2 };
  uLeafR: { value: THREE.Vector4 }; uLeafRN: { value: THREE.Vector2 };
};

export function createScreenMaterial(o: ScreenMaterialOptions): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    roughness: o.roughness,
    metalness: 0,
    clearcoat: o.clearcoat,
    clearcoatRoughness: o.clearcoatRoughness,
    emissive: 0xffffff,
    emissiveMap: o.image,
    emissiveIntensity: o.brightness ?? 1,
    // The cover's reflection is the clearcoat (one sharp surface). Under it, an OLED behind a
    // circular polariser returns about 0.5 % as haze, so the rough base lobe (F0 0.04) is scaled to
    // match instead of veiling the image with 4 % of the room. [C, from typical OLED reflectance]
    specularIntensity: 0.12,
    side: THREE.DoubleSide,
  });
  const a = outlineUniforms(o.active);
  const c = outlineUniforms(o.cover ?? o.active);
  const uniforms = {
    uUvOrigin: { value: new THREE.Vector2(...o.uvToPlane.origin) },
    uUvSize: { value: new THREE.Vector2(...o.uvToPlane.size) },
    uActiveLo: { value: a.lo }, uActiveHi: { value: a.hi }, uActiveAx: { value: a.ax }, uActiveAy: { value: a.ay }, uActiveN: { value: a.n },
    uCoverOn: { value: o.cover ? 1 : 0 },
    uCoverLo: { value: c.lo }, uCoverHi: { value: c.hi }, uCoverAx: { value: c.ax }, uCoverAy: { value: c.ay }, uCoverN: { value: c.n },
    uHole: { value: new THREE.Vector3(o.hole?.x ?? 0, o.hole?.y ?? 0, o.hole?.radius ?? 0) },
    // Facing halves (see the header): view to device frame, and each leaf's frame (origin.xz, t.xz; n.xz).
    uViewToDevice: { value: new THREE.Matrix4() },
    uLeafL: { value: new THREE.Vector4(0, 0, -1, 0) }, uLeafLN: { value: new THREE.Vector2(0, 1) },
    uLeafR: { value: new THREE.Vector4(0, 0, 1, 0) }, uLeafRN: { value: new THREE.Vector2(0, 1) },
    uFacingBox: { value: new THREE.Vector3(o.facing?.reach ?? 0, o.facing?.halfHeight ?? 0, o.facing?.rim ?? 0) },
  };
  material.userData.uniforms = uniforms;
  if (o.facing) material.defines = { DUO_FACING: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec2 uUvOrigin; uniform vec2 uUvSize;
        uniform vec2 uActiveLo; uniform vec2 uActiveHi; uniform vec4 uActiveAx; uniform vec4 uActiveAy; uniform vec4 uActiveN;
        uniform float uCoverOn; uniform vec2 uCoverLo; uniform vec2 uCoverHi; uniform vec4 uCoverAx; uniform vec4 uCoverAy; uniform vec4 uCoverN;
        uniform vec3 uHole;
        uniform mat4 uViewToDevice; uniform vec4 uLeafL; uniform vec2 uLeafLN; uniform vec4 uLeafR; uniform vec2 uLeafRN; uniform vec3 uFacingBox;
        ${OUTLINE_SDF}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec2 duoP = uUvOrigin + vEmissiveMapUv * uUvSize;
        if (uCoverOn > 0.5 && duoOutline(duoP, uCoverLo, uCoverHi, uCoverAx, uCoverAy, uCoverN) > 0.0) discard;`)
      .replace('#include <emissivemap_fragment>', `
        float duoActive = duoOutline(duoP, uActiveLo, uActiveHi, uActiveAx, uActiveAy, uActiveN);
        float duoPixel = max(fwidth(duoActive), 1e-4);
        float duoLit = 1.0 - smoothstep(-duoPixel, duoPixel, duoActive);
        if (uHole.z > 0.0) {
          float duoHole = length(duoP - uHole.xy) - uHole.z;
          duoLit *= smoothstep(-duoPixel, duoPixel, duoHole);
        }
        vec2 duoUv = (duoP - uActiveLo) / (uActiveHi - uActiveLo);
        vec4 duoImage = texture2D(emissiveMap, clamp(duoUv, 0.0, 1.0));
        totalEmissiveRadiance *= duoImage.rgb * duoLit;`)
      .replace('#include <emissivemap_pars_fragment>', `#include <emissivemap_pars_fragment>
        // The lit image at plane point p (mm), blurred by lod: what the other half shows there.
        vec3 duoImageAt(vec2 p, float lod) {
          float lit = 1.0 - smoothstep(-0.05, 0.05, duoOutline(p, uActiveLo, uActiveHi, uActiveAx, uActiveAy, uActiveN));
          if (uHole.z > 0.0) lit *= smoothstep(-0.05, 0.05, length(p - uHole.xy) - uHole.z);
          return textureLod(emissiveMap, clamp((p - uActiveLo) / (uActiveHi - uActiveLo), 0.0, 1.0), lod).rgb * lit;
        }`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        #if defined( DUO_FACING ) && defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
        {
          // The mirror ray, in the device frame, from this leaf (A) into the space between the leaves.
          // Occluders: the other leaf's display (B), and both leaves' rims, walls of height box.z on
          // their display planes along the top, bottom and free edges (box.xy: rim line from the
          // hinge line and from the centre line). It reaches the environment only if it leaves
          // over both rims.
          vec3 P = (uViewToDevice * vec4(-vViewPosition, 1.0)).xyz;
          vec3 R = normalize(mat3(uViewToDevice) * reflect(-geometryViewDir, geometryNormal));
          bool onLeft = duoP.x < 0.0;
          vec4 fa = onLeft ? uLeafL : uLeafR, fb = onLeft ? uLeafR : uLeafL;
          vec2 na = onLeft ? uLeafLN : uLeafRN, nb = onLeft ? uLeafRN : uLeafLN;
          vec3 OA = vec3(fa.x, 0.0, fa.y), TA = vec3(fa.z, 0.0, fa.w), NA = vec3(na.x, 0.0, na.y);
          vec3 OB = vec3(fb.x, 0.0, fb.y), TB = vec3(fb.z, 0.0, fb.w), NB = vec3(nb.x, 0.0, nb.y);
          vec3 box = uFacingBox;
          const float FAR = 1e6;
          float den = dot(R, NB);
          float tB = den < -1e-5 ? dot(OB - P, NB) / den : FAR;
          if (tB < 0.02) tB = FAR;
          float tY = abs(R.y) > 1e-5 ? (sign(R.y) * box.y - P.y) / R.y : FAR;
          float dA = dot(R, TA), dB = dot(R, TB);
          float tFA = dA > 1e-5 ? (box.x - dot(P - OA, TA)) / dA : FAR;
          float tFB = dB > 1e-5 ? (box.x - dot(P - OB, TB)) / dB : FAR;
          float tExit = max(0.0, min(tY, min(tFA, tFB)));
          #ifdef USE_CLEARCOAT
          float gloss = material.clearcoatRoughness;
          #else
          float gloss = material.roughness;
          #endif
          float hit = 0.0;
          vec3 seen = vec3(0.0);
          if (tB < tExit) {
            // Lands on the other display: it shows that half's image (nothing past the hinge line).
            vec3 H = P + tB * R - OB;
            float sB = dot(H, TB), blur = 0.05 + tB * gloss * 0.5;
            float texels = float(textureSize(emissiveMap, 0).x) / (uActiveHi.x - uActiveLo.x);
            seen = emissive * duoImageAt(vec2(onLeft ? sB : -sB, H.y), log2(max(1.0, blur * texels))) * step(0.0, sB);
            hit = 1.0;
          } else if (tExit < FAR) {
            // Leaves through an edge: blocked by a rim it passes under, over either leaf.
            vec3 X = P + tExit * R;
            float w = 0.02 + tExit * gloss * 0.25;
            float sA = dot(X - OA, TA), sB = dot(X - OB, TB);
            float inA = step(sA, box.x + 1e-3) * step(abs(X.y), box.y + 1e-3);
            float inB = step(sB, box.x + 1e-3) * step(abs(X.y), box.y + 1e-3);
            float underA = 1.0 - smoothstep(box.z - w, box.z + w, dot(X - OA, NA));
            float underB = 1.0 - smoothstep(box.z - w, box.z + w, dot(X - OB, NB));
            hit = max(inA * underA, inB * underB);
          }
          radiance = mix(radiance, seen, hit);
          #ifdef USE_CLEARCOAT
          clearcoatRadiance = mix(clearcoatRadiance, seen, hit);
          #endif
        }
        #endif`);
  };
  material.customProgramCacheKey = () => (o.facing ? 'duo-screen-v3-facing' : 'duo-screen-v3');
  return material;
}

/**
 * The inner display as a strip in unfolded coordinates: columns across x (dense in the fold zone
 * and around the corners), two rows along y that follow the cover outline, so the mesh has the
 * glass's exact shape. `update(state)` bends it with the fold solver. `columns` is shared with
 * other parts that fold with the display (the flexible rim).
 */
export class FoldableScreen {
  readonly mesh: THREE.Mesh;
  readonly columns: number[];
  private readonly geometry: THREE.BufferGeometry;
  private readonly halves: number[];

  constructor(cover: Outline, foldLength: number, material: THREE.Material, private readonly lift = 0.02) {
    const half = cover.x1, hh = cover.y1;
    const corner = cover.corners.tr;
    const cols = new Set(foldColumns(half, foldLength));
    for (let i = 0; i <= 32; i++) {
      // Dense in the corner zone, where the outline curves (denser toward the end).
      const f = 1 - Math.pow(1 - i / 32, 2);
      const s = half - corner.ax + f * corner.ax;
      cols.add(s); cols.add(-s);
    }
    this.columns = [...cols].sort((a, b) => a - b);
    // Half-height of the cover outline at each column.
    this.halves = this.columns.map((s) => {
      const u = (Math.abs(s) - (half - corner.ax)) / corner.ax;
      if (u <= 0) return hh;
      const v = Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, u), corner.n)), 1 / corner.n);
      return hh - corner.ay + corner.ay * v;
    });
    const n = this.columns.length;
    const pos = new Float32Array(n * 2 * 3), nor = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2);
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      const u = (this.columns[i] + half) / (2 * half);
      const v0 = (hh - this.halves[i]) / (2 * hh), v1 = (hh + this.halves[i]) / (2 * hh);
      uv.set([u, v0, u, v1], i * 4);
      if (i < n - 1) { const a = i * 2, b = (i + 1) * 2; index.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry.setIndex(index);
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false; // bounds change as it folds
    const u = material.userData.uniforms as ScreenUniforms | undefined;
    if (u) this.mesh.onBeforeRender = (_r, _s, camera) => {
      u.uViewToDevice.value.multiplyMatrices(camera.matrixWorldInverse, this.mesh.matrixWorld).invert();
    };
  }

  update(state: FoldState): void {
    const u = (this.mesh.material as THREE.Material).userData.uniforms as ScreenUniforms | undefined;
    if (u) {
      const { left: l, right: r } = state;
      u.uLeafL.value.set(l.origin.x, l.origin.z, l.t.x, l.t.z); u.uLeafLN.value.set(l.n.x, l.n.z);
      u.uLeafR.value.set(r.origin.x, r.origin.z, r.t.x, r.t.z); u.uLeafRN.value.set(r.n.x, r.n.z);
    }
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const nor = this.geometry.getAttribute('normal') as THREE.BufferAttribute;
    this.columns.forEach((s, i) => {
      const { p, n } = displayAt(state, s);
      const x = p.x + n.x * this.lift, z = p.z + n.z * this.lift, hh = this.halves[i];
      pos.setXYZ(i * 2, x, -hh, z); pos.setXYZ(i * 2 + 1, x, hh, z);
      nor.setXYZ(i * 2, n.x, 0, n.z); nor.setXYZ(i * 2 + 1, n.x, 0, n.z);
    });
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }
}

/** Unfolded column positions: sparse on the flat parts, dense across the fold zone, hitting its ends. */
export function foldColumns(half: number, foldLength: number, dense = 120): number[] {
  const cols = new Set<number>([-half, half]);
  for (let i = 0; i <= 8; i++) { cols.add(-half + (i / 8) * (half - foldLength / 2)); cols.add(foldLength / 2 + (i / 8) * (half - foldLength / 2)); }
  for (let i = 0; i <= dense; i++) cols.add(-foldLength / 2 + (i / dense) * foldLength);
  return [...cols].sort((a, b) => a - b);
}

/**
 * A placeholder screen image drawn with Canvas 2D, at the display's point size times `scale`.
 */
export function canvasImage(width: number, height: number, scale: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}
