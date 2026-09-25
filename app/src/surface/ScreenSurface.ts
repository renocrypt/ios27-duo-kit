/**
 * ScreenSurface: a device screen's interface written as real DOM (HTML, CSS, SVG) and rendered
 * into textures with HTML-in-Canvas (Chrome, `chrome://flags/#canvas-draw-element`).
 *
 *   const s = new ScreenSurface({ native: { width: 951, height: 669 }, scale: 2 });
 *   s.show(html, { rotation: 90 });   // lay out in the posture's orientation, draw into the native canvas
 *   s.content / s.foreground          // THREE.CanvasTexture, native orientation
 *   s.shapes                          // Liquid Glass shapes (native points), from [data-glass] elements
 *   s.onChange = () => ...            // fires after every repaint
 *
 * One template becomes two stacked layers, both direct children of a `layoutsubtree` canvas (only
 * direct children can be drawn): the content layer, with every `[data-glass]` control hidden, and
 * the foreground layer, with only the glyphs on those controls. The glass compositor draws the
 * glass between them. Mark a control `data-glass="regular"` (or "clear"), optionally with
 * `data-glass-group="n"` to merge neighbours, `data-glass-tint="#hex"` (and `-tint-strength`) for
 * a prominent control, `data-glass-flip="false"` to keep its tone; its box and border radius
 * become the glass shape.
 *
 * Rotation is the angle, clockwise, from the native canvas's up to the interface's up, for
 * postures that hold the display sideways (Seated turns the inner display, Standing the outer).
 * DOM mutations repaint automatically (the canvas fires `paint`); nothing redraws otherwise.
 */
import * as THREE from 'three';
import type { GlassShape } from '../glass/GlassCompositor.ts';
import './surface.css';

export type Rotation = 0 | 90 | 180 | 270;

export interface ScreenSurfaceOptions {
  /** Native canvas size in points (the display's own orientation). */
  native: { width: number; height: number };
  /** Pixels per point for the textures. */
  scale: number;
  /** Class names for the root, e.g. an appearance scope. */
  className?: string;
}

export class ScreenSurface {
  readonly content: THREE.CanvasTexture;
  readonly foreground: THREE.CanvasTexture;
  shapes: GlassShape[] = [];
  onChange?: () => void;
  rotation: Rotation = 0;
  /** Repaints so far, for profiling. */
  paints = 0;
  /** Views shown so far: changes when show() replaces the interface (not on DOM updates within it). */
  views = 0;
  private warned = false;

  private readonly host: HTMLCanvasElement;
  private readonly contentLayer: HTMLDivElement;
  private readonly fgLayer: HTMLDivElement;
  private readonly contentCanvas: HTMLCanvasElement;
  private readonly fgCanvas: HTMLCanvasElement;

  constructor(private readonly o: ScreenSurfaceOptions) {
    const { width, height } = o.native;
    const side = Math.max(width, height);
    this.host = document.createElement('canvas');
    this.host.setAttribute('layoutsubtree', '');
    this.host.className = 'screen-host';
    // The host lays out the layers and is the only canvas allowed to draw them; each layer is
    // drawn into it and copied out. It must be in the viewport to paint, so it is clipped to nothing.
    this.host.width = Math.round(width * o.scale); this.host.height = Math.round(height * o.scale);
    this.host.style.width = `${side}px`; this.host.style.height = `${side}px`;
    this.contentLayer = document.createElement('div');
    this.fgLayer = document.createElement('div');
    for (const [layer, role] of [[this.contentLayer, 'content'], [this.fgLayer, 'foreground']] as const) {
      layer.className = `screen-layer screen-layer--${role} ${o.className ?? ''}`;
      this.host.append(layer);
    }
    document.body.append(this.host);

    const make = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(width * o.scale); c.height = Math.round(height * o.scale);
      return c;
    };
    this.contentCanvas = make();
    this.fgCanvas = make();
    this.content = texture(this.contentCanvas);
    this.foreground = texture(this.fgCanvas);
    this.host.addEventListener('paint', () => this.paint());
  }

  /** Logical (interface) size in points for the current rotation. */
  get logical(): { width: number; height: number } {
    const { width, height } = this.o.native;
    return this.rotation % 180 === 0 ? { width, height } : { width: height, height: width };
  }

  /** Replace the interface. `html` is laid out at the logical size for `rotation`. */
  show(html: string, opts: { rotation?: Rotation; className?: string } = {}): void {
    this.views++;
    this.rotation = opts.rotation ?? 0;
    const { width, height } = this.logical;
    for (const layer of [this.contentLayer, this.fgLayer]) {
      layer.style.width = `${width}px`;
      layer.style.height = `${height}px`;
      layer.innerHTML = html;
      layer.dataset.view = opts.className ?? '';
    }
    this.requestPaint();
  }

  /** Run the same update on both layers (for live values such as a clock). */
  update(fn: (layer: HTMLElement) => void): void {
    fn(this.contentLayer);
    fn(this.fgLayer);
  }

  requestPaint(): void {
    (this.host as HTMLCanvasElement & { requestPaint?: () => void }).requestPaint?.();
  }

  static get supported(): boolean {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D & { drawElementImage?: unknown };
    return typeof ctx?.drawElementImage === 'function';
  }

  private paint(): void {
    const { width, height } = this.o.native;
    const s = this.o.scale;
    const ctx = this.host.getContext('2d') as CanvasRenderingContext2D & { drawElementImage: (el: Element, x: number, y: number, w: number, h: number) => void };
    for (const [canvas, layer] of [[this.contentCanvas, this.contentLayer], [this.fgCanvas, this.fgLayer]] as const) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.host.width, this.host.height);
      // Native frame: x right, y down. Rotate the interface about the canvas centre.
      ctx.translate((width * s) / 2, (height * s) / 2);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.scale(s, s);
      const l = this.logical;
      ctx.translate(-l.width / 2, -l.height / 2);
      const out = canvas.getContext('2d')!;
      out.clearRect(0, 0, canvas.width, canvas.height);
      try {
        // Explicit size: the element's snapshot resolution follows the page's pixel ratio, not ours.
        ctx.drawElementImage(layer, 0, 0, l.width, l.height);
        out.drawImage(this.host, 0, 0);
      } catch (error) {
        // A layer with nothing rendered cannot be drawn; leave it empty rather than lose the frame.
        if (!this.warned) { console.warn('ScreenSurface: layer not drawn', error); this.warned = true; }
      }
    }
    this.content.needsUpdate = true;
    this.foreground.needsUpdate = true;
    this.shapes = this.readShapes();
    this.paints++;
    this.onChange?.();
  }

  /** Glass shapes from the content layer's `[data-glass]` boxes, mapped into native points. */
  private readShapes(): GlassShape[] {
    const origin = this.contentLayer.getBoundingClientRect();
    const l = this.logical, n = this.o.native;
    const shapes: GlassShape[] = [];
    this.contentLayer.querySelectorAll<HTMLElement>('[data-glass]').forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      let x = r.left - origin.left, y = r.top - origin.top, w = r.width, h = r.height;
      // Logical to native: rotate the box about the canvas centres.
      const cx = x + w / 2 - l.width / 2, cy = y + h / 2 - l.height / 2;
      const a = (this.rotation * Math.PI) / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
      const nx = c * cx - s * cy + n.width / 2, ny = s * cx + c * cy + n.height / 2;
      if (this.rotation % 180 !== 0) [w, h] = [h, w];
      x = nx - w / 2; y = ny - h / 2;
      const radiusPx = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const radius: GlassShape['radius'] = radiusPx >= Math.min(w, h) / 2 - 0.5 ? 'capsule' : radiusPx;
      shapes.push({
        id: el.dataset.glassId ?? `g${i}`,
        x, y, width: w, height: h, radius,
        variant: el.dataset.glass === 'clear' ? 'clear' : 'regular',
        group: el.dataset.glassGroup ? Number(el.dataset.glassGroup) : i + 100,
        tint: el.dataset.glassTint ? { color: el.dataset.glassTint, strength: Number(el.dataset.glassTintStrength ?? 0.6) } : undefined,
        mayFlip: el.dataset.glassFlip === 'false' ? false : undefined,
      });
    });
    return shapes;
  }
}

function texture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.premultiplyAlpha = true; // the glass compositor blends its foreground as premultiplied alpha
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}
