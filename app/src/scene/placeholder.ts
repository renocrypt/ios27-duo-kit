/**
 * Placeholder screen images, drawn with Canvas 2D in our own artwork (no Apple wallpapers), until
 * the live UI arrives through HTML-in-Canvas.
 */
import type * as THREE from 'three';
import { canvasImage } from '../device/screen.ts';
import { DUO } from '../device/spec.ts';

function wallpaper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#9FB7D6');
  sky.addColorStop(0.55, '#E9D6C3');
  sky.addColorStop(1, '#C9A98C');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Two soft dunes.
  for (const [y, color] of [[0.72, '#B98F6F'], [0.84, '#9C7458']] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * y);
    ctx.bezierCurveTo(w * 0.3, h * (y - 0.08), w * 0.6, h * (y + 0.05), w, h * (y - 0.03));
    ctx.lineTo(w, h);
    ctx.fill();
  }
}

function clock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.textAlign = 'center';
  ctx.font = `600 ${size * 0.2}px system-ui`;
  ctx.fillText('Wednesday, September 23', x, y - size * 0.86);
  ctx.font = `700 ${size}px system-ui`;
  ctx.fillText('9:41', x, y);
}

export function placeholderImages(): { inner: THREE.CanvasTexture; outer: THREE.CanvasTexture } {
  const { inner, outer } = DUO;
  return {
    inner: canvasImage(inner.canvas.width, inner.canvas.height, 3, (ctx, w, h) => { wallpaper(ctx, w, h); clock(ctx, w * 0.5, h * 0.36, 118); }),
    outer: canvasImage(outer.canvas.width, outer.canvas.height, 3, (ctx, w, h) => { wallpaper(ctx, w, h); clock(ctx, w * 0.46, h * 0.3, 104); }),
  };
}
