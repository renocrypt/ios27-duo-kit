/**
 * Glass calibration (labs/probe.html?calibrate): derives every [SIM] token in
 * tokens/glass.sim.tokens.json from the glass probe's captures of iOS, so what we learn about Liquid
 * Glass reaches the compositor by measurement, never by hand. Recalibrate after `npm run probe`.
 *
 * Measured directly from iOS: the slider positions captured, which one iOS defaults to, the tone
 * curves at each, and the saturation. Fitted through our compositor, on renders of the shapes'
 * surroundings only: the lensing (at the default tint), the frost at each tint, how large glass
 * frosts more (the sizes scenes, captured on either display), the rim, and the hairline. It then
 * writes the tokens, a report of every residual to tools/glass-probe/report.json (kept with the
 * tokens), and each tint's iOS and ours side by side to the page and to
 * /tmp/duo/glass-probe/inspect/<date>/.
 *
 *   /labs/probe.html?calibrate                  the device with the most slider positions
 *   /labs/probe.html?calibrate=duo-27.1-inner   a given device
 */
import { tokens } from '../../tokens/tokens.ts';
import { overrideGlass } from '../glass/overrides.ts';
import { around, crop, loadCapture, renderOurs, type Capture, type CaptureSet, type Region, type Size } from './io.ts';
import { edgeWidth, fieldRms, interiorModulation, lensProfile, meanDisc, phaseField, rimAround, type Frame } from './measure.ts';
import { probeScene, SCENES, type Placed } from './scene.ts';

type Variant = 'regular' | 'clear';
const DEPTHS = [0.5, 1.5, 2.5, 3.5, 5.5, 7.5, 10.5, 14.5];
/**
 * Glass up to this short side (pt) frosts as the 48 pt button does, at every tint (iOS: 360 × 56 and
 * 56 × 150 against 48): the frost per tint is fitted on it, and frost by size starts here.
 */
const SIZE_BASE = 56;
const Y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hex = (h: string) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const round = (v: number, d = 3) => +v.toFixed(d);
const tick = () => new Promise((r) => setTimeout(r));

/** Coordinate descent on named values: `apply` sets them (token overrides), `error` scores the result. */
async function descend(start: Record<string, number>, apply: (v: Record<string, number>) => void, error: () => number, rounds = 2) {
  const current = { ...start };
  apply(current);
  let best = error();
  for (let round = 0; round < rounds; round++) {
    for (const k of Object.keys(current)) {
      let step = (Math.abs(current[k]) * 0.25 || 0.1) / (round + 1);
      for (let tries = 0; tries < 6; tries++) {
        let improved = false;
        for (const dir of [1, -1]) {
          const trial = { ...current, [k]: +(current[k] + dir * step).toFixed(4) };
          if (trial[k] < 0) continue;
          apply(trial);
          const e = error();
          if (e < best) { best = e; Object.assign(current, trial); improved = true; break; }
        }
        if (!improved) step /= 2;
        await tick();
      }
    }
  }
  apply(current);
  return { values: current, error: best };
}

/** The glass centre at each grey level of a tone scene (the curve iOS applies to the luma). */
function curveOf(cap: Capture, id: string) {
  const scene = probeScene(id, cap.window);
  const byLevel = new Map<number, number>();
  for (const p of cap.shapes) {
    const level = scene.colour(p.x + p.w / 2 - cap.window.width / 2, p.y + p.h / 2 - cap.window.height / 2, 0)[0];
    if (!byLevel.has(level)) byLevel.set(level, Math.round(Y(meanDisc(cap.glass[0], p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) * 0.2))));
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  return { levels, values: levels.map((l) => byLevel.get(l)!) };
}

/** How much of the violet's colour around its luma survives under each variant (edge scene). */
function saturationOf(cap: Capture, variant: Variant) {
  const top = hex(SCENES.edge.stimulus.top!);
  const p = variant === 'regular' ? cap.shapes.find((s) => s.glass === 'regular' && s.h > 100)! : cap.shapes.find((s) => s.glass === 'clear')!;
  const out = meanDisc(cap.glass[0], p.x + p.w / 2, p.y + p.h / 2 - p.h * 0.33, 2);
  return (out[2] - Y(out)) / (top[2] - Y(top));
}

/** Our lensing profile and interior contrast for a shape of a grating scene, rendered around it. */
function oursGrating(id: string, size: Size, p: Placed, tint: number) {
  const scene = probeScene(id, size), s = scene.def.stimulus;
  const field = phaseField(renderOurs(scene, size, { tint, region: around(p, size), settle: 2 }), p, s.period!, s.axis!, size);
  return { profile: lensProfile(field, p, s.axis!).profile, modulation: interiorModulation(field, p, Math.min(p.w, p.h) * 0.35) };
}
function iosGrating(cap: Capture, id: string, p: Placed) {
  const s = SCENES[id].stimulus;
  const field = phaseField(cap.glass, p, s.period!, s.axis!, cap.window);
  return { profile: lensProfile(field, p, s.axis!).profile, modulation: interiorModulation(field, p, Math.min(p.w, p.h) * 0.35) };
}
const atDepths = (profile: { depth: number; inward: number | null }[]) => DEPTHS.map((d) => profile.find((q) => Math.abs(q.depth - d) < 0.2)?.inward ?? NaN);
const rms = (a: number[], b: number[]) => { let s = 0, n = 0; a.forEach((v, i) => { if (Number.isFinite(v) && Number.isFinite(b[i])) { s += (v - b[i]) ** 2; n++; } }); return Math.sqrt(s / Math.max(n, 1)); };

/** Rim brightness at 12 and 6 o'clock, and the hairline's darkening at 3 and 9, for a tile's shape. */
function rimOf(frame: Frame, p: Placed) {
  const r = rimAround(frame, p), at = (deg: number) => r.find((q) => q.deg === deg)!;
  return { bright: (at(0).bright + at(180).bright) / 2, dark: (at(90).dark + at(270).dark) / 2, clipped: Math.max(at(0).peak, at(180).peak) >= 250 };
}

function row(root: HTMLElement, html: string) { root.insertAdjacentHTML('beforeend', `<div style="margin:2px 0">${html}</div>`); }

export async function calibrate(root: HTMLElement, catalog: Record<string, CaptureSet>) {
  const glass = tokens.material.glass;
  // Frost by size is fitted after the frost per tint; on a first calibration it is off until then.
  if (!('sizeStops' in glass)) overrideGlass({ sizeStops: [SIZE_BASE, SIZE_BASE + 1], sizeBlur: 9, regular: { sizeShare: [0, 0] }, clear: { sizeShare: [0, 0] } });
  root.innerHTML = '<h1 style="font:600 17px system-ui;margin:0 0 8px">Glass calibration</h1>';
  window.probeResult = undefined;

  // The captures: the device with the most slider positions, unless one is named.
  const asked = new URLSearchParams(location.search).get('calibrate');
  const slugs = [...new Set(Object.keys(catalog).map((k) => k.split('/')[0]))];
  const positions = (slug: string) => Object.entries(catalog).filter(([k, v]) => k.startsWith(slug + '/') && typeof v.tint === 'number');
  const slug = asked || slugs.sort((a, b) => positions(b).length - positions(a).length)[0];
  const sets = positions(slug).sort((a, b) => (a[1].tint as number) - (b[1].tint as number));
  const stops = sets.map(([, v]) => v.tint as number);
  const load = async (set: string, id: string) => { const c = await loadCapture(set, id); if (!c) throw new Error(`missing capture ${set}/${id}`); return c; };
  row(root, `Captures: <b>${slug}</b>, slider positions ${stops.join(', ')}, and its default set.`);

  // ---- Direct measurements ------------------------------------------------------------------
  const report: Record<string, unknown> = { captures: slug, date: new Date().toISOString(), stops };
  const curves = { regularDark: [] as number[][], regularLight: [] as number[][] };
  const saturation: Record<Variant, number[]> = { regular: [], clear: [] };
  let levels: number[] = [];
  for (const [set] of sets) {
    const dark = curveOf(await load(set, 'tone-regular-dark'), 'tone-regular-dark');
    const light = curveOf(await load(set, 'tone-regular-light'), 'tone-regular-light');
    levels = dark.levels; curves.regularDark.push(dark.values); curves.regularLight.push(light.values);
    const edge = await load(set, 'edge');
    saturation.regular.push(round(saturationOf(edge, 'regular'), 2)); saturation.clear.push(round(saturationOf(edge, 'clear'), 2));
  }
  const defaultSet = `${slug}/default`;
  const defaultLight = curveOf(await load(defaultSet, 'tone-regular-light'), 'tone-regular-light').values;
  const distance = curves.regularLight.map((c) => c.reduce((s, v, i) => s + Math.abs(v - defaultLight[i]), 0) / c.length);
  const defaultIndex = distance.indexOf(Math.min(...distance));
  const defaultTint = stops[defaultIndex];
  const clearCurve = curveOf(await load(defaultSet, 'tone-clear-dark'), 'tone-clear-dark').values;
  const clearLight = curveOf(await load(defaultSet, 'tone-clear-light'), 'tone-clear-light').values;
  const clearSpread = Math.max(...clearCurve.map((v, i) => Math.abs(v - clearLight[i])));
  Object.assign(report, { defaultTint, defaultDistance: round(distance[defaultIndex], 2), clearAppearanceSpread: clearSpread, saturation });
  row(root, `Default slider position: <b>${defaultTint}</b> (its light curve within ${round(distance[defaultIndex], 1)} levels of the default set's). Clear glass: the same curve in both appearances within ${clearSpread} levels.`);
  row(root, `Saturation by tint: regular ${saturation.regular.join(', ')}; clear ${saturation.clear.join(', ')}.`);
  overrideGlass({ tint: defaultTint, tintStops: stops, curve: { levels, regularDark: curves.regularDark, regularLight: curves.regularLight, clear: clearCurve },
    regular: { saturation: saturation.regular }, clear: { saturation: saturation.clear } });

  // ---- Lensing, at the default tint: the whole displacement field over each shape -------------
  const lens: Record<Variant, Record<string, number>> = { regular: {}, clear: {} };
  let soften: number = glass.lensSoften;
  const grating = await load(`${slug}/tint-${defaultTint}`, 'sine-dark-x24');
  const gs = SCENES['sine-dark-x24'].stimulus;
  const fieldOf = (frames: Frame[], p: Placed) => phaseField(frames, p, gs.period!, gs.axis!, grating.window);
  for (const variant of ['regular', 'clear'] as Variant[]) {
    const shapes = grating.shapes.filter((p) => p.glass === variant && p.w * p.h < 30000); // a panel's contrast is too low to read
    const target = shapes.map((p) => fieldOf(grating.glass, p));
    const v = glass[variant] as unknown as Record<string, number>;
    // The normal's softening is a property of the shapes' outline, fitted once, with regular glass.
    const keys = variant === 'regular' ? ['lens', 'lensPower', 'bezelRatio', 'profile', 'soften'] : ['lens', 'bezelRatio', 'profile'];
    const start = Object.fromEntries(keys.map((k) => [k, k === 'soften' ? soften : v[k]]));
    const fit = await descend(start, ({ soften: sv, ...vals }) => overrideGlass({ [variant]: vals, ...(sv === undefined ? {} : { lensSoften: sv }) }),
      () => Math.sqrt(shapes.reduce((sum, p, k) => sum + fieldRms(target[k], fieldOf(renderOurs(probeScene('sine-dark-x24', grating.window), grating.window, { tint: defaultTint, region: around(p, grating.window), settle: 2 }), p), p) ** 2, 0) / shapes.length));
    if (variant === 'regular') soften = fit.values.soften;
    const { soften: _s, ...values } = fit.values;
    lens[variant] = values;
    const profiles = shapes.map((p) => rms(atDepths(oursGrating('sine-dark-x24', grating.window, p, defaultTint).profile), atDepths(iosGrating(grating, 'sine-dark-x24', p).profile)));
    report[`lens.${variant}`] = { ...fit.values, fieldRmsPt: round(fit.error, 2), profileRmsPt: profiles.map((x) => round(x, 2)) };
    row(root, `Lensing, ${variant}: ${keys.map((k) => `${k} ${round(fit.values[k], 3)}`).join(', ')} · field ${round(fit.error, 2)} pt rms over ${shapes.length} shapes (centre lines ${profiles.map((x) => round(x, 2)).join(', ')}).`);
  }

  // ---- Frost, at each tint ------------------------------------------------------------------
  const frost: Record<Variant, { blur: number[]; wideShare: number[] }> = { regular: { blur: [...glass.regular.blur], wideShare: [...glass.regular.wideShare] }, clear: { blur: [...glass.clear.blur], wideShare: [...glass.clear.wideShare] } };
  const frostError: Record<Variant, number[]> = { regular: [], clear: [] };
  for (const [i, [set]] of sets.entries()) {
    const x24 = await load(set, 'sine-dark-x24'), x48 = await load(set, 'sine-dark-x48'), edge = await load(set, 'edge');
    for (const variant of ['regular', 'clear'] as Variant[]) {
      // The small shapes (buttons, groups); larger ones frost more, fitted below.
      const shapes = x24.shapes.filter((p) => p.glass === variant && Math.min(p.w, p.h) <= SIZE_BASE);
      const target = [x24, x48].flatMap((cap, k) => shapes.map((p) => iosGrating(cap, k ? 'sine-dark-x48' : 'sine-dark-x24', p).modulation));
      const edgeShape = edge.shapes.find((p) => p.glass === variant && p.w === 48)!;
      const edgeTarget = edgeWidth(edge.glass[0], edgeShape, edge.window.height / 2).width;
      const apply = (vals: Record<string, number>) => {
        frost[variant].blur[i] = vals.blur; frost[variant].wideShare[i] = Math.min(vals.wideShare, 1);
        overrideGlass({ [variant]: { blur: [...frost[variant].blur], wideShare: [...frost[variant].wideShare] } });
      };
      const tint = stops[i];
      const fit = await descend({ blur: frost[variant].blur[i], wideShare: frost[variant].wideShare[i] }, apply, () => {
        const got = [['sine-dark-x24', x24], ['sine-dark-x48', x48]].flatMap(([id]) => shapes.map((p) => oursGrating(id as string, x24.window, p, tint).modulation));
        const edgeScene = probeScene('edge', edge.window);
        const ours = edgeWidth(renderOurs(edgeScene, edge.window, { tint, region: around(edgeShape, edge.window), settle: 2 })[0], edgeShape, edge.window.height / 2).width;
        const rel = got.map((g, k) => (g - target[k]) / Math.max(target[k], 1));
        return Math.sqrt((rel.reduce((s, r) => s + r * r, 0) + ((ours - edgeTarget) / 10) ** 2) / (rel.length + 1));
      });
      frostError[variant].push(round(fit.error, 3));
      row(root, `Frost at tint ${tint}, ${variant}: σ ${round(fit.values.blur, 2)} pt, wide share ${round(fit.values.wideShare, 2)} · error ${round(fit.error, 3)}.`);
    }
  }
  report.frost = { ...frost, error: frostError };

  // ---- Frost by size ------------------------------------------------------------------------
  // Large regular glass frosts more, by its short side, not its area: a share of its narrow frost
  // is blurred by sizeBlur more. Fitted on the contrast each large shape keeps against the 48 pt
  // button in the same capture, iOS's against ours: the grating's capsule and panel at the default
  // tint and at the lowest, and the sizes scenes (on any display of this device and OS: the material
  // does not depend on the display). The effect does not depend on the tint. A shape's contrast is
  // linear in its share (a mix of two frosts), so for each sizeBlur tried every large shape is
  // rendered at shares 0 and 1 and the shares are solved for; the residuals reported are rendered.
  // Residuals are in levels, ours scaled by iOS's 48 pt button: a contrast of 2 levels, as a panel
  // keeps at the default tint, is off by a few tenths from 8-bit rounding alone (the interior's
  // mean is uniform, so it does not average out), and the lowest tint's larger contrast weighs more.
  const { device: probeDevice, os: probeOs } = catalog[sets[0][0]];
  const sizeCases = [
    ...[...new Set([defaultTint, stops[0]])].map((t) => ({ set: `${slug}/tint-${t}`, base: 'sine-dark', tint: t })),
    ...Object.entries(catalog).filter(([, v]) => v.device === probeDevice && v.os === probeOs && ['sizes-dark-x24', 'sizes-dark-x48'].every((id) => v.scenes.includes(id)))
      .map(([set, v]) => ({ set, base: 'sizes-dark', tint: typeof v.tint === 'number' ? v.tint : defaultTint })),
  ];
  const sizeRows: { set: string; id: string; tint: number; cap: Capture; p: Placed; short: number; ios: number; iosRef: number; ref0: number; o0: number; o1: number }[] = [];
  const sizeRefs: { id: string; tint: number; cap: Capture; ref: Placed }[] = [];
  for (const c of sizeCases) for (const period of ['x24', 'x48']) {
    const id = `${c.base}-${period}`, cap = await load(c.set, id);
    const ref = cap.shapes.find((p) => p.glass === 'regular' && p.w === 48 && p.h === 48)!;
    sizeRefs.push({ id, tint: c.tint, cap, ref });
    for (const p of cap.shapes.filter((q) => q.glass === 'regular' && Math.min(q.w, q.h) > SIZE_BASE))
      sizeRows.push({ set: c.set, id, tint: c.tint, cap, p, short: Math.min(p.w, p.h), ios: iosGrating(cap, id, p).modulation, iosRef: iosGrating(cap, id, ref).modulation, ref0: 0, o0: 0, o1: 0 });
  }
  const sizeStops = [SIZE_BASE, ...[...new Set(sizeRows.map((r) => r.short))].sort((a, b) => a - b)];
  const flat = (v: number) => sizeStops.map((_, k) => (k ? v : 0));
  const oursOf = (r: { id: string; cap: Capture; tint: number }, p: Placed) => oursGrating(r.id, r.cap.window, p, r.tint).modulation;
  overrideGlass({ sizeStops, regular: { sizeShare: flat(0) }, clear: { sizeShare: sizeStops.map(() => 0) } });
  for (const r of sizeRows) {
    r.o0 = oursOf(r, r.p);
    r.ref0 = oursOf(r, sizeRefs.find((q) => q.cap === r.cap)!.ref);
  }
  // The shares that fit best for the contrast rendered at share 1 (least squares, in levels).
  const solve = () => sizeStops.map((stop, k) => {
    if (!k) return 0;
    let num = 0, den = 0;
    for (const r of sizeRows.filter((q) => q.short === stop)) {
      const scale = r.iosRef / r.ref0, c = r.o0 * scale - r.ios, d = (r.o1 - r.o0) * scale;
      num += c * d; den += d * d;
    }
    return den ? Math.min(Math.max(-num / den, 0), 1) : 0;
  });
  const predictedError = (share: number[]) => Math.sqrt(sizeRows.reduce((sum, r) => {
    const a = share[sizeStops.indexOf(r.short)];
    return sum + (((1 - a) * r.o0 + a * r.o1) * (r.iosRef / r.ref0) - r.ios) ** 2;
  }, 0) / sizeRows.length);
  const sizeFit = await descend({ sizeBlur: ('sizeBlur' in glass ? glass.sizeBlur : 9) as number }, ({ sizeBlur }) => {
    overrideGlass({ sizeBlur, regular: { sizeShare: flat(1) } });
    for (const r of sizeRows) r.o1 = oursOf(r, r.p);
  }, () => predictedError(solve()), 1);
  const sizeShares = solve().map((v) => round(v, 3));
  overrideGlass({ sizeBlur: sizeFit.values.sizeBlur, regular: { sizeShare: sizeShares } });
  const sizeCheck = sizeRows.map((r) => ({ set: r.set, id: r.id, shape: `${r.p.w}×${r.p.h}`, ios: round(r.ios / r.iosRef), ours: round(oursOf(r, r.p) / r.ref0), levels: round(r.ios, 1) }));
  const sizeRms = Math.sqrt(sizeCheck.reduce((sum, c) => sum + ((c.ours - c.ios) * (c.levels / c.ios)) ** 2, 0) / sizeCheck.length);
  // Clear glass: its large panel against its 48 pt shape in the grating at the same tint.
  const clearSize: { set: string; id: string; ratio: number }[] = [];
  for (const c of sizeCases.filter((q) => q.base === 'sizes-dark')) for (const period of ['x24', 'x48']) {
    const cap = await load(c.set, `sizes-dark-${period}`), grating = await load(`${slug}/tint-${c.tint}`, `sine-dark-${period}`);
    const panel = cap.shapes.find((p) => p.glass === 'clear'), small = grating.shapes.find((p) => p.glass === 'clear' && p.w === 48);
    if (panel && small) clearSize.push({ set: c.set, id: `sizes-dark-${period}`, ratio: round(iosGrating(cap, `sizes-dark-${period}`, panel).modulation / iosGrating(grating, `sine-dark-${period}`, small).modulation) });
  }
  report['frost.size'] = { stops: sizeStops, sizeBlur: round(sizeFit.values.sizeBlur, 2), share: sizeShares, rmsLevels: round(sizeRms, 2), predictedRmsLevels: round(sizeFit.error, 2), shapes: sizeCheck, clear: clearSize };
  row(root, `Frost by size, regular: σ ${round(sizeFit.values.sizeBlur, 2)} pt on top, share ${sizeShares.join(', ')} at short sides ${sizeStops.join(', ')} pt · contrast within ${round(sizeRms, 2)} levels rms over ${sizeCheck.length} cases. Clear: a panel keeps ${clearSize.map((c) => c.ratio).join(', ')} of a 48 pt shape's contrast.`);

  // ---- Rim and hairline, at the default tint -------------------------------------------------
  const tiles = async (id: string) => {
    const cap = await load(`${slug}/tint-${defaultTint}`, id), scene = probeScene(id, cap.window);
    const wanted = [0, 57, 113, 170, 255], chosen: Placed[] = [];
    for (const p of cap.shapes) {
      const level = scene.colour(p.x + p.w / 2 - cap.window.width / 2, p.y + p.h / 2 - cap.window.height / 2, 0)[0];
      if (wanted.includes(level) && !chosen.some((q) => scene.colour(q.x + q.w / 2 - cap.window.width / 2, q.y + q.h / 2 - cap.window.height / 2, 0)[0] === level)) chosen.push(p);
    }
    return { cap, scene, chosen, ios: chosen.map((p) => rimOf(cap.glass[0], p)) };
  };
  const ourRims = (t: Awaited<ReturnType<typeof tiles>>) => t.chosen.map((p) => rimOf(renderOurs(t.scene, t.cap.window, { tint: defaultTint, region: around(p, t.cap.window, 30), settle: 2 })[0], p));
  const rim: Record<Variant, number> = { regular: glass.regular.rim, clear: glass.clear.rim };
  for (const variant of ['regular', 'clear'] as Variant[]) {
    const t = await tiles(variant === 'regular' ? 'tone-regular-dark' : 'tone-clear-dark');
    // Only where iOS's rim is not clipped at white: a clipped rim says how bright the body is, not the rim.
    const open = t.ios.map((r) => !r.clipped);
    const fit = await descend({ rim: rim[variant] }, (v) => overrideGlass({ [variant]: { rim: v.rim } }),
      () => rms(ourRims(t).map((r, k) => (open[k] ? r.bright : NaN)), t.ios.map((r) => r.bright)));
    rim[variant] = fit.values.rim;
    report[`rim.${variant}`] = { rim: fit.values.rim, rmsLevels: round(fit.error, 1), ios: t.ios.map((r) => round(r.bright, 1)), clipped: t.ios.map((r) => r.clipped) };
    row(root, `Rim, ${variant}: ${round(fit.values.rim, 3)} · ${round(fit.error, 1)} levels rms.`);
  }
  const hairline: Record<'multiply' | 'subtract', number> = { multiply: glass.hairline.multiply, subtract: glass.hairline.subtract };
  for (const [key, id] of [['multiply', 'tone-regular-dark'], ['subtract', 'tone-regular-light']] as const) {
    const t = await tiles(id);
    const fit = await descend({ [key]: hairline[key] }, (v) => overrideGlass({ hairline: v }),
      () => rms(ourRims(t).map((r) => r.dark), t.ios.map((r) => r.dark)));
    hairline[key] = fit.values[key];
    report[`hairline.${key}`] = { value: fit.values[key], rmsLevels: round(fit.error, 1), ios: t.ios.map((r) => round(r.dark, 1)) };
    row(root, `Hairline ${key}: ${round(fit.values[key], 3)} · ${round(fit.error, 1)} levels rms.`);
  }

  // ---- Look: each tint's iOS and ours, the edge scene and the grating ---------------------------
  root.insertAdjacentHTML('beforeend', '<h2 style="font:600 14px system-ui;margin:16px 0 6px">iOS (left) and ours (right) at each tint, calibrated</h2>');
  for (const [i, [set]] of sets.entries()) {
    const line = document.createElement('div');
    line.style.cssText = 'display:flex;gap:8px;align-items:center;margin:0 0 8px';
    line.insertAdjacentHTML('beforeend', `<span style="width:64px;color:#999">tint ${stops[i]}</span>`);
    const pictures: HTMLCanvasElement[] = [];
    for (const id of ['edge', 'sine-dark-x24']) {
      const cap = await load(set, id), scene = probeScene(id, cap.window);
      const xs = cap.shapes.filter((p) => p.w * p.h < 30000);
      const x0 = Math.min(...xs.map((p) => p.x)) - 12, y0 = Math.min(...xs.map((p) => p.y)) - 12;
      const box: Region = { x: x0, y: y0, w: Math.max(...xs.map((p) => p.x + p.w)) + 12 - x0, h: Math.max(...xs.map((p) => p.y + p.h)) + 12 - y0 };
      const ours = renderOurs(scene, cap.window, { tint: stops[i], region: around({ id: 0, x: box.x, y: box.y, w: box.w, h: box.h, glass: 'regular' }, cap.window, 60), settle: 20 });
      const css = Math.min(0.9, 240 / box.w);
      const pair = [crop(cap.glass[0], box, css), crop(ours[0], box, css)];
      line.append(...pair); pictures.push(...pair);
    }
    root.append(line);
    // Kept for looking at later: iOS and ours side by side, per scene, in the inspect folder.
    const sheet = document.createElement('canvas'), gap = 12;
    sheet.width = pictures.reduce((w, c) => w + c.width + gap, 0); sheet.height = Math.max(...pictures.map((c) => c.height));
    const g = sheet.getContext('2d')!; g.fillStyle = '#111'; g.fillRect(0, 0, sheet.width, sheet.height);
    pictures.reduce((x, c) => { g.drawImage(c, x, 0); return x + c.width + gap; }, 0);
    await fetch(`/@probe/image?name=${String(report.date).slice(0, 10)}/calibrated-${slug}-tint-${stops[i]}`, { method: 'POST', body: JSON.stringify({ png: sheet.toDataURL('image/png') }) });
    await tick();
  }

  // The sizes scenes, whole: iOS (left) and ours.
  for (const c of sizeCases.filter((q) => q.base === 'sizes-dark')) {
    const cap = await load(c.set, 'sizes-dark-x24'), whole = { x: 0, y: 0, w: cap.window.width, h: cap.window.height };
    const ours = renderOurs(probeScene('sizes-dark-x24', cap.window), cap.window, { tint: c.tint, settle: 20 });
    const pair = [crop(cap.glass[0], whole, 0.5), crop(ours[0], whole, 0.5)];
    const line = document.createElement('div');
    line.style.cssText = 'display:flex;gap:8px;align-items:center;margin:0 0 8px';
    line.insertAdjacentHTML('beforeend', `<span style="width:64px;color:#999">sizes ${c.tint}</span>`);
    line.append(...pair); root.append(line);
    const sheet = document.createElement('canvas'), gap = 12;
    sheet.width = pair[0].width + gap + pair[1].width; sheet.height = Math.max(pair[0].height, pair[1].height);
    const g = sheet.getContext('2d')!; g.fillStyle = '#111'; g.fillRect(0, 0, sheet.width, sheet.height);
    g.drawImage(pair[0], 0, 0); g.drawImage(pair[1], pair[0].width + gap, 0);
    await fetch(`/@probe/image?name=${String(report.date).slice(0, 10)}/calibrated-sizes-${c.set.replace('/', '-')}`, { method: 'POST', body: JSON.stringify({ png: sheet.toDataURL('image/png') }) });
    await tick();
  }

  // ---- Write --------------------------------------------------------------------------------
  const from = `from ${slug} (${catalog[sets[0][0]].device}, iOS ${catalog[sets[0][0]].os}, ${catalog[sets[0][0]].display} display), calibrated ${String(report.date).slice(0, 10)}`;
  const n = (value: unknown, description: string) => ({ $type: typeof value === 'number' ? 'number' : 'duo.curve', $value: value, $description: description });
  // One shape cannot show how lensing grows with size: clear glass takes regular's growth.
  lens.clear.lensPower = lens.regular.lensPower;
  const variantTokens = (variant: Variant) => ({
    blur: n(frost[variant].blur.map((v) => round(v, 2)), `σ of the narrow blur at each tintStop, pt, fitted to the grating's contrast at 24 and 48 pt and an edge's width (error ${frostError[variant].join(', ')})`),
    wideShare: n(frost[variant].wideShare.map((v) => round(v, 3)), 'Share of the content blurred by blurWide at each tintStop, fitted with blur'),
    saturation: n(saturation[variant], 'The body keeps the content\'s colour around its luma, times this, at each tintStop: measured on the edge scene\'s violet'),
    sizeShare: variant === 'regular'
      ? n(sizeShares, `Share of the narrow frost blurred by sizeBlur more, at each sizeStop (the shape's short side), fitted with sizeBlur (the contrast kept against the 48 pt button within ${round(sizeRms, 2)} levels rms)`)
      : n(sizeStops.map(() => 0), `Clear glass keeps its frost at every size: a 360 × 180 panel keeps ${clearSize.map((c) => c.ratio).join(', ')} of a 48 pt shape's contrast`),
    ...Object.fromEntries(Object.entries(lens[variant]).map(([k, v]) => [k, n(round(v, 4), `Lensing, fitted to the grating's whole displacement field at the default tint (${(report[`lens.${variant}`] as { fieldRmsPt: number }).fieldRmsPt} pt rms)`)])),
    rim: n(round(rim[variant], 4), `Rim brightness, fitted at 12 and 6 o'clock over grey levels 0 to 255 (${(report[`rim.${variant}`] as { rmsLevels: number }).rmsLevels} levels rms)`),
  });
  const file = {
    $description: `Generated by app/labs/probe.html?calibrate ${from}. Do not edit; recapture (npm run probe) and recalibrate. Every value is [SIM]; the report with every residual is app/tools/glass-probe/report.json.`,
    material: { glass: {
      tint: n(defaultTint, `iOS's default position of Settings > Liquid Glass's slider (UIViewGlassTintAmount): the tintStop whose curves match an untouched device's`),
      tintStops: n(stops, 'The slider positions measured; per-tint values are listed at these and interpolated between'),
      sizeStops: n(sizeStops, `Short sides (pt) at which sizeShare is listed: glass up to ${SIZE_BASE} pt frosts as the 48 pt button does; linear in between, held beyond the last`),
      sizeBlur: n(round(sizeFit.values.sizeBlur, 2), 'σ (pt) by which large glass blurs a share of its narrow frost more, on top of regular\'s σ at the tint (the two convolved), fitted with sizeShare'),
      lensSoften: n(round(soften, 3), `How gradually the lens's normal turns where a cap meets a straight side (the gradient's step as a share of the band), fitted with regular glass's lensing to the whole displacement field (${(report['lens.regular'] as { fieldRmsPt: number }).fieldRmsPt} pt rms)`),
      curve: { $type: 'duo.curve', $description: 'Tone curves: the glass centre over grey tiles, as sRGB luma, at `levels`; regular glass per appearance at each tintStop, clear glass one curve for every tint and appearance',
        levels: { $value: levels }, regularDark: { $value: curves.regularDark }, regularLight: { $value: curves.regularLight }, clear: { $value: clearCurve } },
      regular: variantTokens('regular'),
      clear: variantTokens('clear'),
      hairline: {
        multiply: n(round(hairline.multiply, 4), `Dark appearance, regular glass: the content outside the silhouette times this at full strength, fitted at 3 and 9 o'clock (${(report['hairline.multiply'] as { rmsLevels: number }).rmsLevels} levels rms)`),
        subtract: n(round(hairline.subtract, 4), `Light appearance and clear glass: this much taken off, fitted at 3 and 9 o'clock (${(report['hairline.subtract'] as { rmsLevels: number }).rmsLevels} levels rms)`),
      },
    } },
  };
  await fetch('/@probe/report', { method: 'POST', body: JSON.stringify(report) });
  row(root, 'Report: tools/glass-probe/report.json. Writing tokens/glass.sim.tokens.json …');
  window.probeResult = { report, tokens: file };
  // The new tokens reload this page (the token plugin); drop ?calibrate first so it does not run again.
  history.replaceState(null, '', `${location.pathname}?set=${slug}/default`);
  await fetch('/@probe/tokens', { method: 'POST', body: JSON.stringify(file) });
}
