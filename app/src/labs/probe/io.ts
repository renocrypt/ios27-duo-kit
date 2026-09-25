/**
 * The glass probe's inputs and our side of it, shared by the comparison view (main.ts) and the
 * calibration (calibrate.ts): iOS's captures (served from /tmp/duo/glass-probe/captures/ by the
 * reference plugin), our compositor over the same scene, and one shape's measurements.
 *
 *   const catalog = await loadCatalog();           // { "duo-27.1-inner/tint-0.5": { tint, window, ... } }
 *   const ios = await loadCapture(set, id);        // { window, shapes, ref, glass: Frame[] } | null
 *   const ours = renderOurs(scene, size, { tint, region });
 *   measureShape(scene, frames, shape, size)       // by stimulus: edge and tone, lensing and contrast, or tone and rim
 */
import * as THREE from 'three';
import { GlassCompositor } from '../../glass/GlassCompositor.ts';
import { MAX_SHAPES } from '../../glass/shaders.ts';
import { tokens } from '../../tokens/tokens.ts';
import { edgeWidth, interiorModulation, lensProfile, phaseField, rimAround, tone, type Frame } from './measure.ts';
import { SCENES, type Placed, type ProbeSceneModel } from './scene.ts';

export type Size = { width: number; height: number };
export type Region = { x: number; y: number; w: number; h: number };
/** A capture set as probe.ts records it in captures/catalog.json. */
export interface CaptureSet { tint: number | 'default'; device: string; os: string; display: string; window: [number, number]; scale: number; date: string; scenes: string[] }

/** Our renders at the scale iOS renders Duo: the rim and hairline are a pixel or two wide. */
export const OURS_SCALE = 3;
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;

export async function loadCatalog(): Promise<Record<string, CaptureSet>> {
  return fetch('/@reference/probe/catalog.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
}

/** The slider position to render ours at for a set: its own, or iOS's default (measured, a token). */
export const tintOf = (set?: CaptureSet) => (set && typeof set.tint === 'number' ? set.tint : tokens.material.glass.tint);

async function loadFrame(url: string, scale: number): Promise<Frame | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })!;
  ctx.drawImage(bitmap, 0, 0);
  return { px: ctx.getImageData(0, 0, bitmap.width, bitmap.height, { colorSpace: 'srgb' }).data, w: bitmap.width, h: bitmap.height, scale };
}

/** iOS's captures of a scene in a set: the reference and each phase, with the window from the probe's report. */
export async function loadCapture(set: string, id: string) {
  const phases = Math.max(SCENES[id]?.phases ?? 1, 1);
  const report = await fetch(`/@reference/probe/${set}/${id}/ref.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!report) return null;
  const ref = await loadFrame(`/@reference/probe/${set}/${id}/ref.png`, report.scale);
  const glass: Frame[] = [];
  for (let p = 0; p < phases; p++) { const f = await loadFrame(`/@reference/probe/${set}/${id}/glass-${p}.png`, report.scale); if (f) glass.push(f); }
  return ref && glass.length === phases ? { window: { width: report.width, height: report.height } as Size, shapes: report.shapes as Placed[], ref, glass } : null;
}
export type Capture = NonNullable<Awaited<ReturnType<typeof loadCapture>>>;

const stimuli = new Map<string, HTMLCanvasElement>();

/**
 * Our compositor over the same stimulus, every phase, at a slider position. `region` (pt) renders
 * only that part of the window (give it room for the wide blur); the frames then carry its origin.
 * A screen draws at most MAX_SHAPES; scenes with more (the tone tiles, which sit apart) are drawn in
 * batches and each shape's tile taken from its batch.
 */
export function renderOurs(scene: ProbeSceneModel, size: Size, options: { tint?: number; region?: Region; settle?: number } = {}): Frame[] {
  const { tint = tokens.material.glass.tint, settle = 40 } = options;
  const region = options.region ?? { x: 0, y: 0, w: size.width, h: size.height };
  const inside = scene.shapes.filter((p) => p.x + p.w > region.x && p.x < region.x + region.w && p.y + p.h > region.y && p.y < region.y + region.h);
  const batches: Placed[][] = [];
  for (let i = 0; i < inside.length; i += MAX_SHAPES) batches.push(inside.slice(i, i + MAX_SHAPES));
  if (!batches.length) batches.push([]);
  const W = Math.round(region.w * OURS_SCALE), H = Math.round(region.h * OURS_SCALE);
  const glass = new GlassCompositor(renderer, { width: region.w, height: region.h, scale: OURS_SCALE });
  glass.environment.appearance = scene.appearance;
  glass.environment.tint = tint;
  glass.light.set(0, -0.8, 0.6); // iOS at rest: the rim's axis is vertical
  const frames: Frame[] = [];
  for (let phase = 0; phase < scene.phases; phase++) {
    const key = `${scene.id}:${phase}:${size.width}x${size.height}:${region.x},${region.y},${region.w},${region.h}`;
    let canvas = stimuli.get(key);
    if (!canvas) { canvas = document.createElement('canvas'); scene.paint(canvas, OURS_SCALE, phase, region); stimuli.set(key, canvas); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    glass.setContent(texture);
    let px: Uint8Array | null = null;
    batches.forEach((batch) => {
      glass.shapes = batch.map((p) => ({
        id: String(p.id), x: p.x - region.x, y: p.y - region.y, width: p.w, height: p.h, radius: p.r ?? 'capsule',
        variant: p.glass === 'clear' ? 'clear' : 'regular', presence: 1,
        tint: p.tint ? { color: p.tint, strength: 1 } : undefined,
      }));
      glass.resetTones();
      // The tone measurement eases over frames; render until it settles.
      for (let i = 0; i < settle; i++) { glass.markContentDirty(); glass.render(); }
      const out = glass.readPixels(0, 0, region.w, region.h);
      if (!px) { px = out; return; }
      for (const p of batch) {
        const x0 = Math.max(0, Math.floor((p.x - region.x - 20) * OURS_SCALE)), x1 = Math.min(W, Math.ceil((p.x - region.x + p.w + 20) * OURS_SCALE));
        const y0 = Math.max(0, Math.floor((p.y - region.y - 20) * OURS_SCALE)), y1 = Math.min(H, Math.ceil((p.y - region.y + p.h + 20) * OURS_SCALE));
        for (let y = y0; y < y1; y++) px.set(out.subarray((y * W + x0) * 4, (y * W + x1) * 4), (y * W + x0) * 4);
      }
    });
    frames.push({ px: px!, w: W, h: H, scale: OURS_SCALE, ox: region.x, oy: region.y });
    texture.dispose();
  }
  glass.dispose();
  return frames;
}

/** The region around a shape with room for the wide blur (3σ) and the lensing, inside the window. */
export function around(p: Placed, size: Size, margin = 3 * tokens.material.glass.blurWide + 12): Region {
  const x = Math.max(0, Math.floor(p.x - margin)), y = Math.max(0, Math.floor(p.y - margin));
  return { x, y, w: Math.min(size.width, Math.ceil(p.x + p.w + margin)) - x, h: Math.min(size.height, Math.ceil(p.y + p.h + margin)) - y };
}

/** One shape's measurements, by the scene's stimulus. */
export function measureShape(scene: ProbeSceneModel, frames: Frame[], p: Placed, size: Size) {
  const s = scene.def.stimulus;
  if (s.kind === 'edge') return { edge: edgeWidth(frames[0], p, size.height / 2), tone: tone(frames[0], p) };
  if (s.kind === 'sine') {
    const field = phaseField(frames, p, s.period!, s.axis!, size);
    const lens = lensProfile(field, p, s.axis!);
    return { band: lens.band, peak: lens.peak, modulation: +interiorModulation(field, p, Math.min(p.w, p.h) * 0.35).toFixed(2), profile: lens.profile };
  }
  return { tone: tone(frames[0], p), rim: p.w === p.h ? rimAround(frames[0], p) : undefined };
}
export type Measured = ReturnType<typeof measureShape>;

/** A region (pt, window coordinates) of a frame as a canvas, shown at `cssScale` CSS px per pt. */
export function crop(frame: Frame, region: Region, cssScale: number) {
  const canvas = document.createElement('canvas');
  const sx = Math.round((region.x - (frame.ox ?? 0)) * frame.scale), sy = Math.round((region.y - (frame.oy ?? 0)) * frame.scale);
  canvas.width = Math.round(region.w * frame.scale); canvas.height = Math.round(region.h * frame.scale);
  const image = new ImageData(canvas.width, canvas.height);
  for (let j = 0; j < canvas.height; j++) for (let i = 0; i < canvas.width; i++) {
    const x = sx + i, y = sy + j, b = (j * canvas.width + i) * 4;
    if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) continue;
    const a = (y * frame.w + x) * 4;
    for (let q = 0; q < 4; q++) image.data[b + q] = q === 3 ? 255 : frame.px[a + q];
  }
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  canvas.style.cssText = `width:${region.w * cssScale}px;border:1px solid #333`;
  return canvas;
}
