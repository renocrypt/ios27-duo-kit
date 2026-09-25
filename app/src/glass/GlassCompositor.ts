/**
 * GlassCompositor: renders one screen's content layer plus all of its Liquid Glass in one pass,
 * following docs/liquid-glass.md. Reusable for any screen size.
 *
 *   const glass = new GlassCompositor(renderer, { width: 951, height: 669, scale: 3 });
 *   glass.setContent(texture);                   // the content layer (a texture in screen space)
 *   glass.shapes = [{ id: 'tabs', x, y, width, height, radius: 'capsule', variant: 'regular' }];
 *   glass.light.set(-0.4, -0.6, 0.7);            // key light in screen space (x right, y down, z out)
 *   glass.render();                              // each frame
 *   material.map = glass.texture;                // the composited screen
 *
 * Content changes are cheap to signal: call markContentDirty() and the frost is rebuilt once.
 * When the content is a new view, call resetTones() as well: tones are then measured afresh.
 * Units are screen points (pt).
 */
import * as THREE from 'three';
import { tokens } from '../tokens/tokens.ts';
import { MAX_SHAPES, compositeFragment, fullscreenVertex, gaussian, measureFragment, refractFragment } from './shaders.ts';

export type GlassVariant = 'regular' | 'clear';

export interface GlassShape {
  id: string;
  /** Top-left corner and size, in pt. */
  x: number; y: number; width: number; height: number;
  /** Corner radius in pt, per corner [tr, br, tl, bl], or 'capsule' (half the shorter side). */
  radius: number | [number, number, number, number] | 'capsule';
  variant: GlassVariant;
  /** Container group: shapes in one group merge within the container spacing. Default 0. */
  group?: number;
  /** Materialisation, 0..1: scales the optics (lensing), never opacity. Default 1. */
  presence?: number;
  /** Optional tint colour and strength (0..1). */
  tint?: { color: string; strength: number };
  /** Touch light: position in pt, strength 0..1, radius in pt. */
  touch?: { x: number; y: number; strength: number; radius: number };
  /** Whether the shape may flip light/dark with its content (small controls). Default: by area. */
  mayFlip?: boolean;
}

export interface GlassEnvironment {
  /** 0 dark, 1 light: tone for large glass that does not flip. */
  appearance: number;
  /** Settings > Liquid Glass: 0 clear .. 1 tinted (UIKit's UIViewGlassTintAmount; iOS's default 0.5). */
  tint: number;
  reduceTransparency: boolean;
  increaseContrast: boolean;
}

/** Either variant's tokens: a key missing from one (the generated glass.sim.tokens.json) fails the type check. */
type Variant = typeof tokens.material.glass.regular | typeof tokens.material.glass.clear;

const quad = new THREE.PlaneGeometry(2, 2);

function pass(fragment: string, uniforms: Record<string, THREE.IUniform>): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: fullscreenVertex, fragmentShader: fragment, uniforms,
    depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(quad, material);
  mesh.frustumCulled = false;
  return mesh;
}

function target(width: number, height: number, type: THREE.TextureDataType = THREE.HalfFloatType): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), {
    type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
  });
  rt.texture.generateMipmaps = false;
  return rt;
}

/** A table of values listed at `stops`, at x: linear in between, held beyond the ends. */
function atStops(stops: readonly number[], values: readonly number[], x: number): number {
  const t = Math.min(Math.max(x, stops[0]), stops[stops.length - 1]);
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1] < t) i++;
  const f = (t - stops[i]) / (stops[i + 1] - stops[i]);
  return values[i] + (values[i + 1] - values[i]) * f;
}

/** A per-tint table (listed at tokens.material.glass.tintStops) at a tint, linear in between. */
const atTint = (values: readonly number[], tint: number) => atStops(tokens.material.glass.tintStops, values, tint);

/**
 * How much of a shape's narrow frost is blurred further by `sizeBlur`: large glass frosts more, by
 * its short side, not its area (sizeStops, sizeShare; clear glass does not).
 */
function sizeShare(s: GlassShape): number {
  const glass = tokens.material.glass;
  return atStops(glass.sizeStops, (glass[s.variant] as Variant).sizeShare, Math.min(s.width, s.height));
}

/**
 * The tone curves at a tint (tokens.material.glass.curve, sRGB 0..255 at `levels`) as a 256 × 3
 * lookup: rows regular dark, regular light, clear; linear in between the measured levels.
 */
function curveTexture(tint: number, texture?: THREE.DataTexture): THREE.DataTexture {
  const c = tokens.material.glass.curve;
  const byTint = (rows: readonly (readonly number[])[]) => rows[0].map((_, i) => atTint(rows.map((r) => r[i]), tint));
  const rows = [byTint(c.regularDark), byTint(c.regularLight), c.clear];
  const data = texture ? (texture.image.data as Uint8Array) : new Uint8Array(256 * 3 * 4);
  rows.forEach((row, r) => {
    for (let x = 0; x < 256; x++) {
      let i = 0;
      while (i < c.levels.length - 2 && c.levels[i + 1] < x) i++;
      const t = (x - c.levels[i]) / (c.levels[i + 1] - c.levels[i]);
      const v = row[i] + (row[i + 1] - row[i]) * Math.min(Math.max(t, 0), 1);
      data.set([Math.round(v), 0, 0, 255], (r * 256 + x) * 4);
    }
  });
  if (texture) { texture.needsUpdate = true; return texture; }
  const created = new THREE.DataTexture(data, 256, 3);
  created.magFilter = THREE.LinearFilter; created.minFilter = THREE.LinearFilter;
  created.needsUpdate = true;
  return created;
}

export class GlassCompositor {
  shapes: GlassShape[] = [];
  private warned = false;
  /** Key light (screen space); its xy is the rim's axis. At rest iOS lights the rim from above and below. */
  readonly light = new THREE.Vector3(0, -0.8, 0.6);
  environment: GlassEnvironment = {
    appearance: 1, tint: tokens.material.glass.tint, reduceTransparency: false, increaseContrast: false,
  };

  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly output: THREE.WebGLRenderTarget;
  private readonly frostTargets: THREE.WebGLRenderTarget[];
  private readonly wideTargets: THREE.WebGLRenderTarget[];
  private readonly sizeTargets: THREE.WebGLRenderTarget[];
  /** The content as the glass shows it (lensed), which the narrow frost blurs. */
  private readonly refracted: THREE.WebGLRenderTarget;
  private readonly refractPass: THREE.Mesh;
  /** What the frost depends on (content, shapes, tint, tokens); it is rebuilt when this changes. */
  private optics = '';
  private readonly curve: THREE.DataTexture;
  /** The tint the frost and curves were built for; the slider rebuilds them. */
  private builtTint: number;
  private readonly measure: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private readonly blurPass: THREE.Mesh;
  private readonly measurePass: THREE.Mesh;
  private freshTones = true;
  private readonly compositePass: THREE.Mesh;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private content: THREE.Texture | null = null;
  private frostSmall: THREE.Texture | null = null;
  private frostLarge: THREE.Texture | null = null;
  private frostWide: THREE.Texture | null = null;
  private frostSize: THREE.Texture | null = null;
  private dirty = true;
  private flip = 0;
  /** Signature of everything that affects the output; unchanged input means no work. */
  private signature = '';
  /** Screen-space rectangles (pt) the glass covered on the last render, to restore when it moves. */
  private previousRects: { x: number; y: number; w: number; h: number }[] = [];
  private needsFullPass = true;
  /** Frames still to render after a change, so the time-smoothed tone measurement can settle. */
  private settle = 0;
  /** Frames rendered, for profiling and tests. */
  renders = 0;
  private readonly blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);

  constructor(private readonly renderer: THREE.WebGLRenderer, readonly size: { width: number; height: number; scale: number }) {
    const { width, height, scale } = size;
    this.output = target(width * scale, height * scale, THREE.UnsignedByteType);
    this.output.texture.colorSpace = THREE.SRGBColorSpace;
    this.output.texture.generateMipmaps = true;
    this.output.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.measure = [target(MAX_SHAPES, 1, THREE.FloatType), target(MAX_SHAPES, 1, THREE.FloatType)];
    this.measure.forEach((m) => { m.texture.minFilter = THREE.NearestFilter; m.texture.magFilter = THREE.NearestFilter; });
    this.blank.needsUpdate = true;

    this.blurPass = pass(gaussian, { uSource: { value: null }, uStep: { value: new THREE.Vector2() }, uSigma: { value: 1 } });
    // The frost: the narrow blurs at half resolution (a scratch target, then clear's and regular's),
    // large glass's further blur at a quarter, the wide blur at an eighth (each a scratch target, then the result).
    this.frostTargets = [0, 1, 2].map(() => target((width * scale) / 2, (height * scale) / 2));
    this.refracted = target((width * scale) / 2, (height * scale) / 2);
    this.sizeTargets = [0, 1].map(() => target((width * scale) / 4, (height * scale) / 4));
    this.wideTargets = [0, 1].map(() => target((width * scale) / 8, (height * scale) / 8));
    this.curve = curveTexture(this.environment.tint);
    this.builtTint = this.environment.tint;

    const arr = () => Array.from({ length: MAX_SHAPES }, () => new THREE.Vector4());
    this.uniforms = {
      uCount: { value: 0 }, uRect: { value: arr() }, uRadii: { value: arr() }, uOptA: { value: arr() }, uOptB: { value: arr() },
      uOptC: { value: arr() }, uTint: { value: arr() }, uState: { value: arr() }, uTouch: { value: arr() },
      uSpacing: { value: tokens.material.glass.container.spacing },
      uContent: { value: this.blank }, uFrostSmall: { value: this.blank }, uFrostLarge: { value: this.blank }, uFrostSize: { value: this.blank }, uFrostWide: { value: this.blank },
      uCurve: { value: this.curve }, uHair: { value: new THREE.Vector4() }, uReach: { value: 12 }, uSoften: { value: 0.5 }, uMeasure: { value: this.blank },
      uToneLight: { value: new THREE.Color(tokens.material.glass.toneLight) }, uToneDark: { value: new THREE.Color(tokens.material.glass.toneDark) },
      uForeground: { value: this.blank }, uHasForeground: { value: 0 }, uPrevious: { value: this.blank },
      uSize: { value: new THREE.Vector2(width, height) }, uLight: { value: this.light },
      uAppearance: { value: 1 }, uContrast: { value: 0 }, uTransparency: { value: 0 },
      uFlipArea: { value: tokens.material.glass.flipArea }, uBlend: { value: 0.18 }, uFresh: { value: 0 },
    };
    this.measurePass = pass(measureFragment, this.uniforms);
    this.refractPass = pass(refractFragment, this.uniforms);
    this.compositePass = pass(compositeFragment, this.uniforms);
  }

  /** The composited screen image. */
  get texture(): THREE.Texture { return this.output.texture; }

  setContent(texture: THREE.Texture): void { this.content = texture; this.dirty = true; this.needsFullPass = true; }
  setForeground(texture: THREE.Texture | null): void {
    this.uniforms.uForeground.value = texture ?? this.blank;
    this.uniforms.uHasForeground.value = texture ? 1 : 0;
  }
  markContentDirty(): void { this.dirty = true; this.needsFullPass = true; }
  /** A new view: measure every control's tone afresh (no hysteresis from the view before). */
  resetTones(): void { this.freshTones = true; this.markContentDirty(); }

  /**
   * Read back the composited output (sRGB, 0..255) over a rectangle in pt, row by row from the top.
   * For calibration tools; it stalls the GPU, so never call it per frame.
   */
  readPixels(x: number, y: number, width: number, height: number): Uint8Array {
    const { height: H, scale } = this.size;
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    const px = Math.round(x * scale), py = Math.round((H - y - height) * scale);
    const raw = new Uint8Array(w * h * 4);
    this.renderer.readRenderTargetPixels(this.output, px, py, w, h, raw);
    const out = new Uint8Array(w * h * 4); // flip to top-down rows
    for (let row = 0; row < h; row++) out.set(raw.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
    return out;
  }

  /**
   * Render if anything changed. Only the regions the glass covers now or covered last time are
   * recomposited (scissor); everything else in the output already holds the plain content.
   * Returns whether it rendered.
   */
  render(): boolean {
    if (!this.content) return false;
    const signature = this.computeSignature();
    const changed = signature !== this.signature || this.dirty || this.needsFullPass;
    if (changed) this.settle = 24;
    else if (this.settle > 0) this.settle--;
    else return false;
    this.signature = signature;
    const r = this.renderer;
    const previousTarget = r.getRenderTarget();
    const previousScissorTest = r.getScissorTest();
    if (this.environment.tint !== this.builtTint) {
      this.builtTint = this.environment.tint;
      curveTexture(this.builtTint, this.curve);
      this.dirty = true;
    }
    this.upload();
    const optics = JSON.stringify([this.shapes, this.builtTint, this.content.version, tokens.material.glass]);
    if (this.dirty || optics !== this.optics) { this.optics = optics; this.buildFrost(); this.dirty = false; }

    // Measure: ping-pong so tone changes ease in over a few frames (hysteresis lives in the shader).
    const [read, write] = this.flip ? [this.measure[1], this.measure[0]] : [this.measure[0], this.measure[1]];
    this.uniforms.uPrevious.value = read.texture;
    this.uniforms.uFresh.value = this.freshTones ? 1 : 0;
    this.freshTones = false;
    r.setRenderTarget(write);
    r.render(this.measurePass, this.camera);
    this.uniforms.uMeasure.value = write.texture;
    this.flip ^= 1;

    r.setRenderTarget(this.output);
    const rects = this.coverage();
    if (this.needsFullPass) {
      r.setScissorTest(false);
      r.render(this.compositePass, this.camera);
      this.needsFullPass = false;
    } else {
      r.setScissorTest(true);
      const { height, scale } = this.size;
      for (const rect of [...this.previousRects, ...rects]) {
        // Scissor is in pixels with the origin at the bottom left.
        r.setScissor(Math.floor(rect.x * scale), Math.floor((height - rect.y - rect.h) * scale), Math.ceil(rect.w * scale), Math.ceil(rect.h * scale));
        r.render(this.compositePass, this.camera);
      }
    }
    this.previousRects = rects;
    r.setScissorTest(previousScissorTest);
    r.setRenderTarget(previousTarget);
    this.renders++;
    return true;
  }

  /** Padded rectangles around every materialised shape: bezel, merge bridges, and shadow. */
  private coverage(): { x: number; y: number; w: number; h: number }[] {
    const pad = tokens.material.glass.container.spacing + 18; // merge swell plus the cast shadow
    return this.shapes.filter((s) => (s.presence ?? 1) > 0.001).map((s) => {
      const x = Math.max(0, s.x - pad), y = Math.max(0, s.y - pad);
      return { x, y, w: Math.min(this.size.width, s.x + s.width + pad) - x, h: Math.min(this.size.height, s.y + s.height + pad) - y };
    });
  }

  private computeSignature(): string {
    const e = this.environment;
    const l = this.light;
    const round = (v: number) => Math.round(v * 1000);
    return JSON.stringify([this.shapes, round(l.x), round(l.y), round(l.z), e.appearance, e.tint, e.reduceTransparency, e.increaseContrast,
      this.content?.version, this.uniforms.uForeground.value.version, tokens.material.glass]);
  }

  /**
   * The frost (tokens, pt): the lensed content blurred in screen space by clear glass's and regular
   * glass's σ at the tint, and the plain content by the wide σ (its colour, read at the source).
   * Only when the screen has large glass: the plain content blurred by regular's σ and `sizeBlur` on
   * top (the two convolved), read at the source as the wide blur is, so the rim's squeezed content
   * keeps the interior's contrast (iOS); large glass mixes it into its narrow frost.
   */
  private buildFrost(): void {
    const glass = tokens.material.glass, tint = this.builtTint, u = this.uniforms;
    const sized = this.shapes.some((s) => sizeShare(s) > 0);
    u.uReach.value = 3 * Math.max(atTint(glass.clear.blur, tint), atTint(glass.regular.blur, tint));
    this.renderer.setRenderTarget(this.refracted);
    this.renderer.render(this.refractPass, this.camera);
    this.frostSmall = this.blur(this.frostTargets[1], atTint(glass.clear.blur, tint), this.frostTargets[0], this.refracted.texture);
    this.frostLarge = this.blur(this.frostTargets[2], atTint(glass.regular.blur, tint), this.frostTargets[0], this.refracted.texture);
    this.frostSize = sized ? this.blur(this.sizeTargets[1], Math.hypot(atTint(glass.regular.blur, tint), glass.sizeBlur), this.sizeTargets[0], this.content!) : this.frostLarge;
    this.frostWide = this.blur(this.wideTargets[1], glass.blurWide, this.wideTargets[0], this.content!);
    u.uFrostSmall.value = this.frostSmall; u.uFrostLarge.value = this.frostLarge; u.uFrostSize.value = this.frostSize; u.uFrostWide.value = this.frostWide;
  }

  private blur(out: THREE.WebGLRenderTarget, sigmaPt: number, scratch: THREE.WebGLRenderTarget, source: THREE.Texture): THREE.Texture {
    const r = this.renderer;
    const m = (this.blurPass.material as THREE.ShaderMaterial).uniforms;
    m.uSigma.value = sigmaPt * (scratch.width / this.size.width); // in the target's texels
    m.uSource.value = source; m.uStep.value.set(1 / scratch.width, 0);
    r.setRenderTarget(scratch); r.render(this.blurPass, this.camera);
    m.uSource.value = scratch.texture; m.uStep.value.set(0, 1 / scratch.height);
    r.setRenderTarget(out); r.render(this.blurPass, this.camera);
    return out.texture;
  }

  private upload(): void {
    const u = this.uniforms;
    if (this.shapes.length > MAX_SHAPES && !this.warned) {
      this.warned = true;
      console.warn(`GlassCompositor: ${this.shapes.length} shapes, only the first ${MAX_SHAPES} are drawn`);
    }
    const shapes = [...this.shapes].sort((a, b) => (a.group ?? 0) - (b.group ?? 0)).slice(0, MAX_SHAPES);
    u.uCount.value = shapes.length;
    shapes.forEach((s, i) => {
      const v = tokens.material.glass[s.variant] as Variant;
      const hw = s.width / 2, hh = s.height / 2;
      const radii = s.radius === 'capsule' ? Array(4).fill(Math.min(hw, hh)) : typeof s.radius === 'number' ? Array(4).fill(s.radius) : s.radius;
      const clampR = radii.map((x: number) => Math.min(x, hw, hh));
      u.uRect.value[i].set(s.x + hw, s.y + hh, hw, hh);
      u.uRadii.value[i].set(clampR[0], clampR[1], clampR[2], clampR[3]);
      // Larger glass lenses more (WWDC25 219). The lensing band follows the corner's radius, capped
      // by the shape (a capsule's radius is its half height), and the rim's shift grows faster than
      // the band (docs/research/2026-09-24-glass-probe-ios27.0.md).
      const half = Math.min(hw, hh);
      const bezel = Math.min(v.bezelRatio * Math.min(half, Math.max(...clampR)), half * 0.9);
      const radius = Math.min(half, Math.max(...clampR));
      const lens = v.lens * Math.pow(bezel / v.bezel, v.lensPower) * Math.pow(half / radius, v.lensSizePower);
      const level = this.builtTint;
      const small = atTint(tokens.material.glass.clear.blur, level), large = atTint(tokens.material.glass.regular.blur, level), own = atTint(v.blur, level);
      u.uOptA.value[i].set(v.ior, lens, bezel, v.profile);
      u.uOptB.value[i].set(sizeShare(s), v.dispersion, v.frost, large > small ? THREE.MathUtils.clamp((own - small) / (large - small), 0, 1) : own >= large ? 1 : 0);
      u.uOptC.value[i].set(v.rim, atTint(v.wideShare, level), atTint(v.saturation, level), v.shadow);
      const tint = s.tint ? new THREE.Color(s.tint.color) : new THREE.Color(1, 1, 1);
      u.uTint.value[i].set(tint.r, tint.g, tint.b, s.tint?.strength ?? 0);
      const flipByArea = s.width * s.height <= tokens.material.glass.flipArea;
      u.uState.value[i].set(s.presence ?? 1, s.variant === 'clear' ? 1 : 0, s.group ?? 0, (s.mayFlip ?? flipByArea) ? 1 : 0);
      u.uTouch.value[i].set(s.touch?.x ?? 0, s.touch?.y ?? 0, s.touch?.strength ?? 0, s.touch?.radius ?? 1);
    });
    const env = this.environment, hair = tokens.material.glass.hairline;
    u.uHair.value.set(hair.width, hair.multiply, hair.subtract, hair.lightTop);
    u.uSoften.value = tokens.material.glass.lensSoften;
    u.uToneLight.value.set(tokens.material.glass.toneLight);
    u.uToneDark.value.set(tokens.material.glass.toneDark);
    u.uAppearance.value = env.appearance;
    u.uContrast.value = env.increaseContrast ? 1 : 0;
    u.uTransparency.value = env.reduceTransparency ? 1 : 0;
    u.uContent.value = this.content;
    u.uFrostSmall.value = this.frostSmall ?? this.content;
    u.uFrostLarge.value = this.frostLarge ?? this.content;
    u.uFrostSize.value = this.frostSize ?? this.content;
    u.uFrostWide.value = this.frostWide ?? this.content;
  }

  /** Read back per-shape measurements (luminance, contrast, tone) in shape order, e.g. to flip glyphs. */
  readTones(): { id: string; luminance: number; contrast: number; tone: number }[] {
    const buffer = new Float32Array(MAX_SHAPES * 4);
    const current = this.flip ? this.measure[0] : this.measure[1];
    this.renderer.readRenderTargetPixels(current, 0, 0, MAX_SHAPES, 1, buffer);
    const shapes = [...this.shapes].sort((a, b) => (a.group ?? 0) - (b.group ?? 0)).slice(0, MAX_SHAPES);
    return shapes.map((s, i) => ({ id: s.id, luminance: buffer[i * 4], contrast: buffer[i * 4 + 1], tone: buffer[i * 4 + 2] }));
  }

  dispose(): void {
    [this.output, this.refracted, ...this.frostTargets, ...this.sizeTargets, ...this.wideTargets, ...this.measure].forEach((t) => t.dispose());
    this.curve.dispose();
    [this.blurPass, this.measurePass, this.refractPass, this.compositePass].forEach((m) => (m.material as THREE.Material).dispose());
  }
}
