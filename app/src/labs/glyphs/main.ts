/**
 * Glyph lab (dev tool): measures our glyphs against Apple's iOS 27 UI Kit, so they are drawn to
 * numbers rather than by eye. The kit frames live in .references/ui-kit/ and reach this page only
 * through the dev server (/@reference/kit/, tools/vite-plugin-reference.ts); nothing of Apple's
 * enters the project.
 *
 *   /labs/glyphs.html                   each case: ours and the kit's at device scale (3x), and a diff
 *                                 at 16x (magenta: kit only, green: ours only)
 *   window.measure()              { cases: [{ id, parts: [{ part, iou, deviation }] }] }
 *                                 deviation: mismatched area / kit outline length, in points
 *   window.fit('wifi.bands.1.r', ...)  coordinate descent on RING values for one part; prints the
 *                                 fitted numbers (copy them into status.ts)
 */
import { RING, statusRing } from '../../kit/status.ts';

const SCALE = 16;
type Geometry = typeof RING;
interface Part { part: string; box: [number, number, number, number] }
interface Case { id: string; file: string; ring: [number, number]; parts: Part[] }

// The ring sits at (1, 35) in the kit's vertical status frame (48 x 86).
const CASES: Case[] = [{
  id: 'status-ring', file: 'Status Bars__iPhone Duo__Dark Background__Vertical.svg', ring: [1, 35],
  parts: [
    { part: 'battery', box: [0, 0, 46, 36] },
    { part: 'wifi', box: [14, 16, 18, 13.34] },
    { part: 'cell', box: [11, 36.5, 24, 7.5] },
  ],
}];

const root = document.getElementById('lab')!;
let geometry: Geometry = structuredClone(RING);

async function raster(svg: string, w: number, h: number, scale: number): Promise<Uint8ClampedArray> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image(); img.src = url; await img.decode();
  const c = new OffscreenCanvas(Math.round(w * scale), Math.round(h * scale));
  const g = c.getContext('2d')!; g.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return g.getImageData(0, 0, c.width, c.height).data;
}

/** The kit's ring: its shapes without the background and the time, cropped to the ring box. */
async function kitRing(file: string, [ox, oy]: [number, number]): Promise<string> {
  const text = await (await fetch(`/@reference/kit/${encodeURIComponent(file)}`)).text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const paths = [...doc.querySelectorAll('path')].filter((p) => p.getAttribute('transform') && !/translate\(0 11\)/.test(p.getAttribute('transform')!));
  const body = paths.map((p) => `<path transform="${p.getAttribute('transform')}" d="${p.getAttribute('d')}" fill="#fff" fill-rule="${p.getAttribute('fill-rule') ?? 'nonzero'}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="${ox} ${oy} 46 46">${body}</svg>`;
}

const oursSvg = (g: Geometry) => statusRing({}, g).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" style="color:#fff" ')
  .replace(/class="st-battery"/, 'fill="none" stroke="#fff" stroke-linecap="round"')
  .replace(/class="st-wifi-band"/g, 'fill="none" stroke="#fff" stroke-linecap="round"')
  .replace(/class="st-(wifi-wedge|cell-dot)"/g, 'fill="#fff"');

function score(a: Uint8ClampedArray, b: Uint8ClampedArray, W: number, box: Part['box']) {
  const [x0, y0, w, h] = box.map((v) => Math.round(v * SCALE));
  let inter = 0, union = 0, xor = 0, edge = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const i = (y * W + x) * 4 + 3, p = a[i] / 255, q = b[i] / 255;
    inter += Math.min(p, q); union += Math.max(p, q); xor += Math.abs(p - q);
    if (x > x0 && (a[i] > 127) !== (a[i - 4] > 127)) edge++;
    if (y > y0 && (a[i] > 127) !== (a[i - W * 4] > 127)) edge++;
  }
  // Outline length from crossings is ~4/pi too long on curves; close enough for a comparison.
  return { iou: +(inter / union).toFixed(4), deviation: +((xor / SCALE / SCALE) / ((edge * Math.PI / 4) / SCALE)).toFixed(4) };
}

async function measureCase(c: Case, g: Geometry) {
  const [kit, ours] = await Promise.all([raster(await kitRing(c.file, c.ring), 46, 46, SCALE), raster(oursSvg(g), 46, 46, SCALE)]);
  return { kit, ours, parts: c.parts.map((p) => ({ part: p.part, ...score(kit, ours, 46 * SCALE, p.box) })) };
}

function paint(kit: Uint8ClampedArray, ours: Uint8ClampedArray, W: number, H: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!; const img = g.createImageData(W, H);
  for (let i = 0; i < kit.length; i += 4) {
    const p = kit[i + 3], q = ours[i + 3];
    img.data[i] = p > q ? 255 : Math.min(p, q) * 0.8; img.data[i + 1] = q > p ? 230 : Math.min(p, q) * 0.8; img.data[i + 2] = p > q ? 200 : Math.min(p, q) * 0.8; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); c.style.cssText = 'width:460px;image-rendering:pixelated;border:1px solid #333';
  return c;
}

async function deviceScale(svg: string): Promise<HTMLCanvasElement> {
  const px = await raster(svg, 46, 46, 3);
  const c = document.createElement('canvas'); c.width = c.height = 138;
  const g = c.getContext('2d')!; const img = g.createImageData(138, 138);
  for (let i = 0; i < px.length; i += 4) { const v = px[i + 3]; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); c.style.cssText = 'width:276px;image-rendering:pixelated;border:1px solid #333';
  return c;
}

async function measure(render = true) {
  const cases = [];
  if (render) root.innerHTML = '<h1 style="font:600 17px system-ui;margin:0 0 12px">Glyph lab</h1>';
  for (const c of CASES) {
    const m = await measureCase(c, geometry);
    cases.push({ id: c.id, parts: m.parts });
    if (!render) continue;
    const sec = document.createElement('section'); sec.style.cssText = 'display:flex;gap:16px;align-items:flex-start;margin-bottom:24px';
    const table = m.parts.map((p) => `<tr><td>${p.part}</td><td>${p.iou}</td><td>${p.deviation} pt</td></tr>`).join('');
    const info = document.createElement('div');
    info.innerHTML = `<b>${c.id}</b><table style="margin-top:8px;border-spacing:12px 2px"><tr style="color:#999"><td>part</td><td>IoU</td><td>deviation</td></tr>${table}</table>
      <p style="color:#999">left: kit at 3x · middle: ours at 3x · right: diff at ${SCALE}x</p>`;
    sec.append(info, await deviceScale(await kitRing(c.file, c.ring)), await deviceScale(oursSvg(geometry)), paint(m.kit, m.ours, 46 * SCALE, 46 * SCALE));
    root.append(sec);
  }
  cases.push({ id: 'status-time', parts: [await measureTime(render)] });
  return { cases };
}

/** Coordinate descent on the named RING values (dot paths), minimizing the part's mismatch. */
async function fit(part: string, ...keys: string[]) {
  const c = CASES[0], p = c.parts.find((x) => x.part === part)!;
  const get = (o: any, k: string) => k.split('.').reduce((a, s) => a[s], o);
  const set = (o: any, k: string, v: number) => { const s = k.split('.'); const last = s.pop()!; s.reduce((a, t) => a[t], o)[last] = v; };
  const kit = await raster(await kitRing(c.file, c.ring), 46, 46, SCALE);
  const cost = async () => { const ours = await raster(oursSvg(geometry), 46, 46, SCALE); return score(kit, ours, 46 * SCALE, p.box).deviation; };
  let best = await cost();
  for (const step of [0.2, 0.05, 0.01]) for (let pass = 0; pass < 4; pass++) for (const k of keys) {
    for (const dir of [1, -1]) {
      for (;;) {
        const v = get(geometry, k); set(geometry, k, +(v + dir * step).toFixed(4));
        const e = await cost();
        if (e < best - 1e-5) best = e; else { set(geometry, k, v); break; }
      }
    }
  }
  const fitted = Object.fromEntries(keys.map((k) => [k, get(geometry, k)]));
  await measure();
  return { part, deviation: best, fitted };
}

/**
 * The time: the kit's outlined "9:41" against our text, SF Pro Rounded Bold 16 on a 19 pt line,
 * centred in 48 pt at y 11 (status.css). The canvas places the baseline the way CSS lays out a
 * line box: half the leading above the font's ascent.
 */
async function measureTime(render: boolean) {
  const file = CASES[0].file, W = 48, H = 34;
  const text = await (await fetch(`/@reference/kit/${encodeURIComponent(file)}`)).text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const p = [...doc.querySelectorAll('path')].find((x) => /translate\(0 11\)/.test(x.getAttribute('transform') ?? ''))!;
  const kit = await raster(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path transform="translate(0 11)" d="${p.getAttribute('d')}" fill="#fff"/></svg>`, W, H, SCALE);
  await document.fonts.load('700 16px "SF Pro Rounded"');
  const c = new OffscreenCanvas(W * SCALE, H * SCALE), g = c.getContext('2d')!;
  g.scale(SCALE, SCALE); g.font = '700 16px "SF Pro Rounded"'; g.fillStyle = '#fff'; g.textAlign = 'center';
  const m = g.measureText('9:41'), A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
  g.fillText('9:41', 24, 11 + (19 - (A + D)) / 2 + A);
  const ours = g.getImageData(0, 0, c.width, c.height).data;
  const part = { part: 'time', ...score(kit, ours, W * SCALE, [0, 0, W, H]) };
  if (render) {
    const sec = document.createElement('section'); sec.style.cssText = 'display:flex;gap:16px;align-items:flex-start;margin-bottom:24px';
    const info = document.createElement('div');
    info.innerHTML = `<b>status-time</b><table style="margin-top:8px;border-spacing:12px 2px"><tr><td>time</td><td>${part.iou}</td><td>${part.deviation} pt</td></tr></table>`;
    const canvas = paint(kit, ours, W * SCALE, H * SCALE); canvas.style.width = '480px';
    sec.append(info, canvas); root.append(sec);
  }
  return part;
}

Object.assign(window, { measureTime, measure, fit, reset: () => { geometry = structuredClone(RING); return measure(); } });
measure();
