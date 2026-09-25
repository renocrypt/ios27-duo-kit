/**
 * Test content for the Glass Lab, in our own artwork. Each scene stresses a different part of the
 * optics: colour and edges (refraction, dispersion), text (legibility, adaptive shadow), flat light
 * and dark fields (tone flipping, clear-glass dimming).
 */
import * as THREE from 'three';

export type LabContent = 'landscape' | 'text' | 'light' | 'dark' | 'stripes' | 'beach' | 'space' | 'bricks';

function landscape(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2E5FA8'); sky.addColorStop(0.5, '#F2B48A'); sky.addColorStop(1, '#F7E1C4');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#FFF4D6'; ctx.beginPath(); ctx.arc(w * 0.68, h * 0.42, 46, 0, Math.PI * 2); ctx.fill();
  const hills: [number, string][] = [[0.62, '#6D4C7D'], [0.72, '#3F3A6B'], [0.84, '#1F2447']];
  for (const [y, color] of hills) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, h * y + Math.sin(x / 57 + y * 9) * 18 + Math.sin(x / 23) * 6);
    ctx.lineTo(w, h); ctx.fill();
  }
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 90; i++) ctx.fillRect((i * 97) % w, (i * 53) % (h * 0.35), 1.4, 1.4);
}

function text(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000000'; ctx.font = '700 34px system-ui'; ctx.fillText('The hinge is the attention dial', 40, 70);
  ctx.font = '400 17px system-ui';
  const body = 'On a phone with one screen, every item competes for the same surface. On Duo, the way the device is held or placed shows how much attention the person is giving it. Closed and in hand is a glance; open is work; set down is ambient. The hub reads that signal and answers at the same depth. ';
  let y = 110;
  for (let para = 0; para < 6; para++) {
    const words = body.split(' ');
    let line = '';
    for (const word of words) {
      if (ctx.measureText(line + word).width > w - 180) { ctx.fillText(line, 40, y); y += 22; line = ''; }
      line += `${word} `;
    }
    ctx.fillText(line, 40, y); y += 36;
    ctx.fillStyle = para % 2 ? '#000000' : '#3C3C43';
  }
  ctx.fillStyle = '#0088FF'; ctx.fillRect(40, h - 110, 220, 64);
  ctx.fillStyle = '#FF383C'; ctx.fillRect(280, h - 110, 220, 64);
}

function flat(color: string) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color === '#FFFFFF' ? '#E5E5EA' : '#1C1C1E';
    for (let y = 60; y < h; y += 56) ctx.fillRect(24, y, w - 48, 44);
    ctx.fillStyle = color === '#FFFFFF' ? '#000000' : '#FFFFFF';
    ctx.font = '600 17px system-ui';
    for (let y = 60, i = 0; y < h; y += 56, i++) ctx.fillText(['Today', 'Memory', 'Home', 'Agent', 'Now playing', 'Focus', 'Inbox', 'Plan', 'Notes', 'Lights', 'Timer'][i % 11], 40, y + 28);
  };
}

function stripes(ctx: CanvasRenderingContext2D, w: number, h: number) {
  for (let x = 0; x < w; x += 12) { ctx.fillStyle = (x / 12) % 2 ? '#111111' : '#F5F5F5'; ctx.fillRect(x, 0, 12, h); }
  ctx.strokeStyle = '#FF383C'; ctx.lineWidth = 2;
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

// Calibration scenes: our own approximations of the backgrounds in Apple's HIG Materials art.
function beach(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  sky.addColorStop(0, '#2F6FCB'); sky.addColorStop(1, '#8CC3EC');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.45);
  ctx.fillStyle = '#FFFFFF';
  for (const [x, y, r] of [[0.2, 0.08, 40], [0.3, 0.1, 30], [0.78, 0.16, 52], [0.86, 0.12, 36]]) { ctx.beginPath(); ctx.arc(w * x, h * y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#3FC1C0'; ctx.fillRect(0, h * 0.42, w, h * 0.06);
  const sand = ctx.createLinearGradient(0, h * 0.48, 0, h);
  sand.addColorStop(0, '#EDE3CF'); sand.addColorStop(1, '#E2CFAE');
  ctx.fillStyle = sand; ctx.fillRect(0, h * 0.48, w, h * 0.52);
  ctx.strokeStyle = '#6E6152'; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.5); ctx.lineTo(w * 0.55, h * 0.56); ctx.lineTo(w * 0.62, h * 0.47); ctx.stroke();
}
function space(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#05050A'; ctx.fillRect(0, 0, w, h);
  const neb = ctx.createRadialGradient(w * 0.45, h * 0.75, 10, w * 0.45, h * 0.75, 320);
  neb.addColorStop(0, 'rgba(120,90,180,0.55)'); neb.addColorStop(1, 'rgba(10,10,30,0)');
  ctx.fillStyle = neb; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 160; i++) { const r = (i % 7 === 0) ? 1.8 : 0.9; ctx.beginPath(); ctx.arc((i * 211) % w, (i * 97) % h, r, 0, Math.PI * 2); ctx.fill(); }
}
function bricks(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2A1A14'; ctx.fillRect(0, 0, w, h);
  const colors = ['#B5543A', '#8E3F2C', '#C66A4A', '#7A4A3A', '#A0624F', '#5C4A45'];
  for (let row = 0, y = 0; y < h; row++, y += 30) {
    for (let x = row % 2 ? -32 : 0; x < w; x += 64) {
      ctx.fillStyle = colors[(row * 7 + Math.floor(x / 64) * 3) % colors.length];
      ctx.fillRect(x + 2, y + 2, 60, 26);
    }
  }
}

const DRAW: Record<LabContent, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  landscape, text, light: flat('#FFFFFF'), dark: flat('#000000'), stripes, beach, space, bricks,
};

export function drawContent(canvas: HTMLCanvasElement, kind: LabContent, width: number, height: number, scale: number): void {
  canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  DRAW[kind](ctx, width, height);
}

export function contentTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}
