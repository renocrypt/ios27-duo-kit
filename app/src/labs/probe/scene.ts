/**
 * The glass probe's scenes (tools/glass-probe/scenes.json) on our side: the same stimulus,
 * pixel for pixel, as Probe.swift draws it, and the same shapes, so our compositor and iOS render
 * one scene and can be measured alike.
 *
 *   const scene = probeScene('edge', { width: 466, height: 678 });
 *   scene.paint(canvas, scale, phase);   // the stimulus at device pixels
 *   scene.shapes                         // placed shapes: pt, top-left origin
 */
import file from '../../../tools/glass-probe/scenes.json';

export interface ProbeShape { w: number; h: number; r?: number; x?: number; y?: number; glass?: string; tint?: string }
export interface Stimulus {
  kind: 'flat' | 'edge' | 'sine' | 'tiles';
  color?: string; top?: string; bottom?: string;
  low?: string; high?: string; period?: number; axis?: 'x' | 'y';
  levels?: number[]; tile?: number;
}
export interface SceneDef { appearance?: 'light' | 'dark'; phases?: number; stimulus: Stimulus; shapes: ProbeShape[] | string }
/** A shape placed in the window: pt, top-left origin (the probe's ready.json uses the same form). */
export interface Placed { id: number; x: number; y: number; w: number; h: number; r?: number | null; glass: string; tint?: string | null }

const FILE = file as unknown as { scenes: Record<string, SceneDef>; layouts: Record<string, ProbeShape[]> };
export const SCENES = FILE.scenes;

type RGB = [number, number, number];
const rgb = (hex: string): RGB => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

export function probeScene(id: string, size: { width: number; height: number }) {
  const def = SCENES[id];
  const s = def.stimulus;
  const shapesDef = typeof def.shapes === 'string' ? FILE.layouts[def.shapes] : def.shapes;
  const phases = Math.max(def.phases ?? 1, 1);
  const tile = s.tile ?? 96;
  const cols = Math.floor(size.width / tile), rows = Math.floor(size.height / tile);
  const x0 = -cols * tile / 2, y0 = -rows * tile / 2;
  const cx = size.width / 2, cy = size.height / 2;

  /** The stimulus at a point (pt from the window's centre), sRGB 0..255. */
  const colour = (x: number, y: number, phase: number): RGB => {
    switch (s.kind) {
      case 'edge': return rgb(y < 0 ? s.top! : s.bottom!);
      case 'sine': {
        const t = s.axis === 'y' ? y : x;
        const v = 0.5 + 0.5 * Math.cos(2 * Math.PI * (t / s.period! - phase / phases));
        const lo = rgb(s.low!), hi = rgb(s.high!);
        return [0, 1, 2].map((k) => lo[k] + (hi[k] - lo[k]) * v) as RGB;
      }
      case 'tiles': {
        const c = Math.floor((x - x0) / tile), r = Math.floor((y - y0) / tile);
        if (c < 0 || c >= cols || r < 0 || r >= rows || !s.levels) return rgb(s.color ?? '#808080');
        const l = s.levels[(r * cols + c) % s.levels.length];
        return [l, l, l];
      }
      default: return rgb(s.color ?? '#808080');
    }
  };

  const place = (d: ProbeShape, id: number, x: number, y: number): Placed =>
    ({ id, x: cx + x - d.w / 2, y: cy + y - d.h / 2, w: d.w, h: d.h, r: d.r, glass: d.glass ?? 'regular', tint: d.tint });
  const shapes: Placed[] = s.kind === 'tiles' && shapesDef[0]
    ? Array.from({ length: cols * rows }, (_, k) => place(shapesDef[0], k, x0 + (k % cols + 0.5) * tile, y0 + (Math.floor(k / cols) + 0.5) * tile))
    : shapesDef.map((d, k) => place(d, k, d.x ?? 0, d.y ?? 0));

  return {
    id, def, phases, shapes, colour,
    appearance: def.appearance === 'light' ? 1 : 0,
    /**
     * Paints the stimulus at device pixels, each pixel sampled at its centre, as Probe.swift does;
     * `region` (pt) paints only part of the window.
     */
    paint(canvas: HTMLCanvasElement, scale: number, phase: number, region = { x: 0, y: 0, w: size.width, h: size.height }) {
      const w = Math.round(region.w * scale), h = Math.round(region.h * scale);
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })!;
      const image = ctx.createImageData(w, h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const c = colour((i + 0.5) / scale + region.x - cx, (j + 0.5) / scale + region.y - cy, phase);
        const k = (j * w + i) * 4;
        image.data[k] = Math.round(c[0]); image.data[k + 1] = Math.round(c[1]); image.data[k + 2] = Math.round(c[2]); image.data[k + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    },
  };
}
export type ProbeSceneModel = ReturnType<typeof probeScene>;
