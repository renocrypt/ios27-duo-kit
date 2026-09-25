/**
 * Glass probe lab (dev tool): Liquid Glass as iOS renders it (captures by tools/glass-probe/probe.ts,
 * listed in /tmp/duo/glass-probe/captures/catalog.json) against our compositor on the same scenes,
 * measured by the same code (measure.ts).
 *
 *   /labs/probe.html                 every scene of the default set: the two renders side by side,
 *                                    the numbers, and the lensing profiles (iOS solid, ours dashed)
 *   /labs/probe.html?scene=edge      one scene
 *   /labs/probe.html?set=duo-27.1-inner/tint-1
 *                                    another capture set (ours rendered at its slider position)
 *   /labs/probe.html?calibrate       derive every [SIM] token from the captures (calibrate.ts)
 *   await window.probe(overrides, ids)   { scenes, summary }; overrides patch material.glass (overrides.ts)
 *   await window.measureSet(set, ids)    iOS alone, per scene: tone curve, lensing, contrast, edges
 */
import { overrideGlass, type Overrides } from '../glass/overrides.ts';
import { crop, loadCapture, loadCatalog, measureShape, renderOurs, tintOf, type Measured, type Size } from './io.ts';
import { type Frame } from './measure.ts';
import { probeScene, SCENES, type Placed, type ProbeSceneModel } from './scene.ts';

declare global { interface Window { probeResult?: unknown; probeFrames?: unknown } }

const root = document.getElementById('probe')!;
const params = new URLSearchParams(location.search);
const only = params.get('scene');
const catalog = await loadCatalog();
/** The capture set to compare against: ?set=, else the first default set in the catalog. */
const SET = params.get('set') ?? Object.keys(catalog).find((k) => k.endsWith('/default')) ?? '';
const TINT = tintOf(catalog[SET]);
const DEFAULT_WINDOW: Size = { width: 466, height: 678 };
/** The last run's first frames per scene, for ad-hoc measurements: window.probeFrames[id].apple / .ours. */
const frames: Record<string, { apple?: Frame; ours: Frame; shapes: Placed[] }> = {};
window.probeFrames = frames;

interface ShapeResult { id: number; w: number; h: number; r?: number | null; glass: string; level?: number; apple?: Measured; ours: Measured }
interface SceneResult { id: string; window: Size; captured: boolean; colour?: { rmse: number; max: number }; shapes: ShapeResult[] }

/** How far the iOS reference capture is from the stimulus we asked for (the colour pipeline). */
function colourCheck(scene: ProbeSceneModel, ref: Frame, size: Size) {
  let sum = 0, max = 0, n = 0;
  for (let j = 0; j < ref.h; j += 7) for (let i = 0; i < ref.w; i += 7) {
    const c = scene.colour((i + 0.5) / ref.scale - size.width / 2, (j + 0.5) / ref.scale - size.height / 2, 0);
    const k = (j * ref.w + i) * 4;
    for (let q = 0; q < 3; q++) { const e = Math.abs(ref.px[k + q] - Math.round(c[q])); sum += e * e; max = Math.max(max, e); n++; }
  }
  return { rmse: +Math.sqrt(sum / n).toFixed(2), max };
}

/** Inward displacement against depth inside the rim: iOS solid, ours dashed, per shape. */
function lensPlot(shapes: ShapeResult[]) {
  const W = 320, H = 160, maxDepth = 30, maxD = 8;
  const X = (d: number) => 30 + (d / maxDepth) * (W - 40), Y = (v: number) => H / 2 - (v / maxD) * (H / 2 - 10);
  const colours = ['#6cf', '#fc6', '#f6c', '#6f9', '#ccc'];
  const lines = shapes.flatMap((s, k) => (['apple', 'ours'] as const).map((side) => {
    const m = s[side] as { profile?: { depth: number; inward: number | null }[] } | undefined;
    if (!m?.profile) return '';
    const pts = m.profile.filter((q) => q.depth <= maxDepth && q.inward !== null).map((q) => `${X(q.depth).toFixed(1)},${Y(Math.max(-maxD, Math.min(maxD, q.inward!))).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${colours[k % colours.length]}" stroke-width="1.5" ${side === 'ours' ? 'stroke-dasharray="4 3"' : ''}/>`;
  }));
  const grid = [0, 10, 20, 30].map((d) => `<line x1="${X(d)}" y1="10" x2="${X(d)}" y2="${H - 10}" stroke="#333"/><text x="${X(d)}" y="${H - 1}" fill="#777" font-size="9" text-anchor="middle">${d}</text>`).join('')
    + [-4, 0, 4].map((v) => `<line x1="30" y1="${Y(v)}" x2="${W - 10}" y2="${Y(v)}" stroke="${v ? '#333' : '#555'}"/><text x="26" y="${Y(v) + 3}" fill="#777" font-size="9" text-anchor="end">${v}</text>`).join('');
  const legend = shapes.map((s, k) => `<span style="color:${colours[k % colours.length]}">${s.w}×${s.h} ${s.glass}</span>`).join(' · ');
  return `<div><svg width="${W}" height="${H}" style="background:#181818">${grid}${lines.join('')}</svg><div style="color:#999">inward shift (pt) by depth inside the rim (pt): ${legend}</div></div>`;
}

const fmt = (m: Measured | undefined) => {
  if (!m) return '—';
  const o = m as Record<string, unknown>;
  if ('edge' in o) { const e = o.edge as { width: number }; const t = o.tone as { centre: number[]; rim: number[] }; return `edge ${e.width} pt · centre ${t.centre.map(Math.round).join(',')} · rim ${t.rim.join(',')}`; }
  if ('band' in o) return `band ${o.band} pt · peak ${o.peak} pt · modulation ${o.modulation}`;
  const t = o.tone as { centre: number[]; rim: number[]; below: number[] }; return `centre ${t.centre.map(Math.round).join(',')} · rim ${t.rim.join(',')} · below ${t.below.map(Math.round).join(',')}`;
};

/** Frost from two grating periods: modulation falls as exp(−2π²σ²/period²) for a Gaussian of σ. */
function frostSigma(results: SceneResult[], a: string, b: string, side: 'apple' | 'ours') {
  const A = results.find((r) => r.id === a), B = results.find((r) => r.id === b);
  if (!A || !B) return null;
  const pa = SCENES[a].stimulus.period!, pb = SCENES[b].stimulus.period!;
  return A.shapes.map((s, k) => {
    const ma = (s[side] as { modulation?: number } | undefined)?.modulation, mb = (B.shapes[k][side] as { modulation?: number } | undefined)?.modulation;
    if (!ma || !mb || mb <= ma) return { shape: `${s.w}×${s.h} ${s.glass}`, sigma: null };
    return { shape: `${s.w}×${s.h} ${s.glass}`, sigma: +Math.sqrt(Math.log(mb / ma) / (2 * Math.PI ** 2 * (1 / pa ** 2 - 1 / pb ** 2))).toFixed(2) };
  });
}

async function probe(overrides: Overrides = {}, ids?: string[]) {
  overrideGlass(overrides);
  root.innerHTML = `<h1 style="font:600 17px system-ui;margin:0 0 4px">Glass probe</h1><p style="color:#999;margin:0 0 16px">iOS (left, ${SET}) against our compositor (right, tint ${TINT}), same stimulus, same measurements.</p>`;
  const results: SceneResult[] = [];
  window.probeResult = undefined;
  for (const id of ids ?? Object.keys(SCENES)) {
    if (only && id !== only) continue;
    const apple = await loadCapture(SET, id);
    const size = apple?.window ?? DEFAULT_WINDOW;
    const scene = probeScene(id, size);
    const ours = renderOurs(scene, size, { tint: TINT });
    const kind = scene.def.stimulus.kind;
    const shapes: ShapeResult[] = scene.shapes.map((p, k) => ({
      id: p.id, w: p.w, h: p.h, r: p.r, glass: p.glass,
      level: kind === 'tiles' ? scene.colour(p.x + p.w / 2 - size.width / 2, p.y + p.h / 2 - size.height / 2, 0)[0] : undefined,
      apple: apple ? measureShape(scene, apple.glass, apple.shapes[k] ?? p, size) : undefined,
      ours: measureShape(scene, ours, p, size),
    }));
    const result: SceneResult = { id, window: size, captured: !!apple, colour: apple ? colourCheck(scene, apple.ref, size) : undefined, shapes };
    frames[id] = { apple: apple?.glass[0], ours: ours[0], shapes: scene.shapes };
    results.push(result);

    const section = document.createElement('section');
    section.style.cssText = 'margin:0 0 28px';
    section.innerHTML = `<h2 style="font:600 14px system-ui;margin:0 0 6px">${id} <span style="color:#999;font-weight:400">${kind} · ${scene.def.appearance ?? 'dark'} · ${size.width} × ${size.height} pt${apple ? ` · colour pipeline rmse ${result.colour!.rmse} (max ${result.colour!.max})` : ' · no iOS captures yet'}</span></h2>`;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;align-items:flex-start';
    const whole = { x: 0, y: 0, w: size.width, h: size.height };
    if (apple) row.append(crop(apple.glass[0], whole, 0.5));
    row.append(crop(ours[0], whole, 0.5));
    if (kind !== 'tiles') {
      const zooms = document.createElement('div');
      zooms.style.cssText = 'display:grid;grid-template-columns:auto auto;gap:6px;align-content:start';
      for (const p of scene.shapes.slice(0, 5)) {
        const box = { x: p.x - 10, y: p.y - 10, w: p.w + 20, h: p.h + 20 }, css = Math.min(2, 180 / box.w, 180 / box.h);
        zooms.append(apple ? crop(apple.glass[0], box, css) : document.createElement('span'), crop(ours[0], box, css));
      }
      row.append(zooms);
    }
    section.append(row);
    const table = shapes.slice(0, kind === 'tiles' ? 28 : 5).map((s) =>
      `<tr><td>${s.level !== undefined ? `level ${s.level}` : `${s.w}×${s.h} ${s.glass}`}</td><td>${fmt(s.apple)}</td><td>${fmt(s.ours)}</td></tr>`).join('');
    section.insertAdjacentHTML('beforeend', `<div style="display:flex;gap:20px;margin-top:8px;align-items:flex-start"><table style="border-spacing:12px 2px"><tr style="color:#999"><td></td><td>iOS</td><td>ours</td></tr>${table}</table>${kind === 'sine' ? lensPlot(shapes) : ''}</div>`);
    root.append(section);
    await new Promise((r) => setTimeout(r));
  }
  const summary = {
    frostDark: { apple: frostSigma(results, 'sine-dark-x24', 'sine-dark-x48', 'apple'), ours: frostSigma(results, 'sine-dark-x24', 'sine-dark-x48', 'ours') },
    frostLight: { apple: frostSigma(results, 'sine-light-x24', 'sine-light-x48', 'apple'), ours: frostSigma(results, 'sine-light-x24', 'sine-light-x48', 'ours') },
  };
  root.insertAdjacentHTML('beforeend', `<h2 style="font:600 14px system-ui">Frost σ (pt) from two grating periods</h2><pre>${JSON.stringify(summary, null, 1)}</pre>`);
  const out = { scenes: results, summary };
  window.probeResult = out;
  return out;
}

/**
 * iOS alone, for comparing capture sets (the tint slider's positions, appearances): per scene, the
 * tone curve (centre and rim by level), each shape's lensing band, peak and contrast, or the edge.
 */
async function measureSet(set: string, ids: string[] = Object.keys(SCENES)) {
  const out: Record<string, unknown> = {};
  for (const id of ids) {
    const apple = await loadCapture(set, id);
    if (!apple) continue;
    const scene = probeScene(id, apple.window);
    const kind = scene.def.stimulus.kind;
    const rows = apple.shapes.map((p) => ({ p, m: measureShape(scene, apple.glass, p, apple.window) as Record<string, unknown> }));
    if (kind === 'tiles') {
      const curve = new Map<number, [number, number]>();
      for (const { p, m } of rows) {
        const level = scene.colour(p.x + p.w / 2 - apple.window.width / 2, p.y + p.h / 2 - apple.window.height / 2, 0)[0];
        const t = m.tone as { centre: number[]; rim: number[] };
        if (!curve.has(level)) curve.set(level, [Math.round(t.centre[0]), t.rim[0]]);
      }
      out[id] = [...curve.entries()].sort((a, b) => a[0] - b[0]).map(([l, [c, r]]) => `${l}:${c}/${r}`).join(' ');
    } else if (kind === 'sine') {
      out[id] = rows.map(({ p, m }) => `${p.w}×${p.h} ${p.glass}: band ${m.band} peak ${m.peak} mod ${m.modulation}`);
    } else {
      out[id] = rows.map(({ p, m }) => { const e = m.edge as { width: number }; const t = m.tone as { centre: number[] }; return `${p.w}×${p.h} ${p.glass}: edge ${e.width} centre ${t.centre.map(Math.round)}`; });
    }
    await new Promise((r) => setTimeout(r));
  }
  return out;
}


(window as unknown as { measureSet: typeof measureSet }).measureSet = measureSet;
(window as unknown as { probe: typeof probe }).probe = probe;
if (params.has('calibrate')) import('./calibrate.ts').then((m) => m.calibrate(root, catalog));
else if (!params.has('fit')) probe();
