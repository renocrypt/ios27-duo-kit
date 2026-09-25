/**
 * Token specimen: renders every token in light and dark appearance scopes, so the UI system can be
 * reviewed in Chrome. The motion lane runs each spring twice, once as a CSS transition with the
 * compiled linear() easing and once through Anime.js spring(), to prove the two curves agree.
 */
import '../../base.css';
import './specimen.css';
import { animate, spring } from 'animejs';
import * as THREE from 'three';
import { tokens, springs, type SpringName } from '../../tokens/tokens.ts';
import { GlassCompositor, type GlassShape } from '../../glass/GlassCompositor.ts';
import { drawContent, type LabContent } from '../glass/content.ts';

const root = document.getElementById('specimen')!;
root.setAttribute('data-appearance', 'light');

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html !== undefined) node.innerHTML = html;
  return node;
};
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function section(index: string, title: string, note?: string) {
  const s = el('section', 'spec-section');
  s.append(el('h2', 'spec-h2', `<span>${index}</span>${title}`));
  if (note) s.append(el('p', 'spec-note type-footnote', note));
  root.append(s);
  return s;
}

// ---- Header -----------------------------------------------------------------------------------

const header = el('header', 'spec-header');
header.innerHTML = `
  <h1 class="type-large-title is-emphasized">Duo token specimen</h1>
  <p class="type-body spec-muted">Every value from <code>app/tokens/</code>, compiled by <code>tools/tokens.ts</code>.
  Left column light, right column dark. Values are read back from the computed CSS.</p>
  <label class="spec-toggle type-subheadline"><input type="checkbox" id="contrast"> Increase contrast</label>`;
root.append(header);
header.querySelector<HTMLInputElement>('#contrast')!.addEventListener('change', (e) => {
  const on = (e.target as HTMLInputElement).checked;
  document.querySelectorAll('.spec-scope').forEach((s) => (on ? s.setAttribute('data-contrast', 'high') : s.removeAttribute('data-contrast')));
  refreshValues();
});

/** Two appearance scopes side by side, filled by the same builder. */
function scopes(build: (scope: HTMLElement, appearance: 'light' | 'dark') => void) {
  const row = el('div', 'spec-scopes');
  for (const appearance of ['light', 'dark'] as const) {
    const scope = el('div', 'spec-scope');
    scope.setAttribute('data-appearance', appearance);
    build(scope, appearance);
    row.append(scope);
  }
  return row;
}

// ---- Color ------------------------------------------------------------------------------------

const colorGroups = tokens.color as unknown as Record<string, Record<string, string> | string>;
const colorSection = section('01', 'Color', 'System colors and grays: Apple HIG values. Labels, fills, backgrounds, separators: UIKit runtime values, to recheck in the simulator.');
for (const [group, entries] of Object.entries(colorGroups)) {
  if (typeof entries === 'string') continue;
  colorSection.append(el('h3', 'spec-h3 type-headline', group));
  colorSection.append(scopes((scope) => {
    const grid = el('div', 'spec-swatches');
    for (const name of Object.keys(entries)) {
      const cssVar = `--color-${kebab(group)}-${kebab(name)}`;
      const swatch = el('div', 'spec-swatch');
      swatch.innerHTML = `<span class="spec-chip" style="--chip: var(${cssVar})"></span>
        <span class="type-footnote is-emphasized">${name}</span>
        <code class="type-caption2 spec-value" data-var="${cssVar}"></code>`;
      grid.append(swatch);
    }
    scope.append(grid);
  }));
}

function refreshValues() {
  document.querySelectorAll<HTMLElement>('.spec-value[data-var]').forEach((v) => {
    v.textContent = getComputedStyle(v).getPropertyValue(v.dataset.var!).trim();
  });
}

// ---- Typography -------------------------------------------------------------------------------

const typeSection = section('02', 'Typography', 'iOS Dynamic Type, Large (default). Tracking from Apple’s SF Pro table. The system font renders SF Pro in Chrome on macOS.');
const textStyles = tokens.text as unknown as Record<string, { fontSize: string; lineHeight: string; fontWeight: number; letterSpacing: string }>;
typeSection.append(scopes((scope) => {
  for (const [name, v] of Object.entries(textStyles)) {
    const row = el('div', 'spec-type-row');
    row.innerHTML = `<div class="type-${kebab(name)}">Hub, at the depth you choose</div>
      <code class="type-caption2 spec-muted">${name} · ${v.fontSize}/${v.lineHeight} · ${v.fontWeight} · ${v.letterSpacing}</code>`;
    scope.append(row);
  }
}));
const families = el('div', 'spec-families');
for (const family of ['sans', 'rounded', 'serif', 'mono']) {
  const probe = el('div', 'spec-family');
  probe.innerHTML = `<span style="font-family: var(--font-family-${family}); font-size: 28px">9:41 Wed 23</span>
    <code class="type-caption2 spec-muted">${family}</code>`;
  families.append(probe);
}
typeSection.append(families);

// ---- Space and radius ---------------------------------------------------------------------------

const spaceSection = section('03', 'Space, size, radius');
const bars = el('div', 'spec-bars');
for (const [name, value] of Object.entries(tokens.space as unknown as Record<string, string | object>)) {
  if (typeof value !== 'string') continue;
  bars.append(el('div', 'spec-bar', `<span style="width: var(--space-${name})"></span><code class="type-caption2">space.${name} · ${value}</code>`));
}
spaceSection.append(bars);
const radii = el('div', 'spec-radii');
for (const [name, value] of Object.entries(tokens.radius as unknown as Record<string, string>)) {
  radii.append(el('div', 'spec-radius', `<span style="border-radius: var(--radius-${kebab(name)})"></span><code class="type-caption2">${name} · ${value}</code>`));
}
spaceSection.append(radii);

// ---- Material ---------------------------------------------------------------------------------

const materialSection = section('04', 'Material', 'Liquid Glass is an optical model, rendered here by the same compositor as the device\'s screens: frost, lensing at the rim, tone, and light, over content with edges (flat content cannot show them). Tune it in /labs/glass.html; its fit to iOS itself is measured in /labs/probe.html.');

/** Liquid Glass through the real compositor, read back into a 2D canvas. */
const glassRenderer = new THREE.WebGLRenderer({ antialias: false });
glassRenderer.outputColorSpace = THREE.SRGBColorSpace;
function glassSpecimen(kind: LabContent, appearance: number): HTMLCanvasElement {
  const width = 360, height = 220, scale = 2;
  const content = document.createElement('canvas');
  drawContent(content, kind, width, height, scale);
  const texture = new THREE.CanvasTexture(content); texture.colorSpace = THREE.SRGBColorSpace;
  const glass = new GlassCompositor(glassRenderer, { width, height, scale });
  glass.setContent(texture);
  glass.environment.appearance = appearance;
  const shapes: GlassShape[] = [
    { id: 'regular', x: 28, y: 40, width: 48, height: 48, radius: 'capsule', variant: 'regular' },
    { id: 'group', x: 100, y: 22, width: 48, height: 164, radius: 'capsule', variant: 'regular' },
    { id: 'clear', x: 172, y: 40, width: 48, height: 48, radius: 'capsule', variant: 'clear' },
    { id: 'tinted', x: 28, y: 128, width: 48, height: 48, radius: 'capsule', variant: 'regular', tint: { color: '#0088FF', strength: 1 } },
    { id: 'panel', x: 172, y: 112, width: 164, height: 84, radius: 28, variant: 'regular' },
  ];
  glass.shapes = shapes;
  for (let i = 0; i < 30; i++) { glass.markContentDirty(); glass.render(); }
  const px = glass.readPixels(0, 0, width, height);
  const out = document.createElement('canvas'); out.width = width * scale; out.height = height * scale;
  out.getContext('2d')!.putImageData(new ImageData(Uint8ClampedArray.from(px), out.width, out.height), 0, 0);
  out.className = 'spec-glass';
  glass.dispose(); texture.dispose();
  return out;
}
materialSection.append(el('h3', 'spec-h3 type-headline', 'Liquid Glass'));
const glassRow = el('div', 'spec-glass-row');
glassRow.append(glassSpecimen('landscape', 1), glassSpecimen('text', 1), glassSpecimen('space', 0));
materialSection.append(glassRow, el('p', 'spec-note type-footnote', 'Left to right in each: regular button, a regular group, clear, tinted (prominent), a regular panel.'));

// ---- Motion -----------------------------------------------------------------------------------

const motionSection = section('05', 'Motion', 'Top dot: CSS transition with the compiled linear() easing. Bottom dot: Anime.js spring({ bounce, duration }). They should land together.');
const lanes: { name: SpringName; css: HTMLElement; js: HTMLElement }[] = [];
for (const name of Object.keys(springs) as SpringName[]) {
  const s = springs[name];
  const lane = el('div', 'spec-lane');
  lane.innerHTML = `<div class="spec-lane-meta"><span class="type-headline">${name}</span>
      <code class="type-caption2 spec-muted">bounce ${s.bounce} · ${s.duration} ms · settles ${s.settleMs} ms</code></div>
    <svg class="spec-curve" viewBox="0 -0.3 1 1.6" preserveAspectRatio="none"><polyline points="${curvePoints(s.easing)}"/></svg>
    <div class="spec-track"><span class="spec-dot spec-dot--css"></span><span class="spec-dot spec-dot--js"></span></div>`;
  motionSection.append(lane);
  lanes.push({ name, css: lane.querySelector('.spec-dot--css')!, js: lane.querySelector('.spec-dot--js')! });
}
const play = el('button', 'spec-play type-headline', 'Play');
motionSection.prepend(play);
let forward = true;
play.addEventListener('click', () => {
  const distance = forward ? 'calc(100% - 20px)' : '0px';
  for (const { name, css, js } of lanes) {
    const s = springs[name];
    css.style.transition = `left ${s.settleMs}ms ${s.easing}`;
    css.style.left = distance;
    const track = js.parentElement!.getBoundingClientRect().width - 20;
    animate(js, { left: forward ? track : 0, ease: spring({ bounce: s.bounce, duration: s.duration }) });
  }
  forward = !forward;
});

/** Plot a CSS linear() easing as SVG points (x = progress, y inverted). */
function curvePoints(easing: string): string {
  const stops = easing.slice(7, -1).split(',').map((s) => s.trim().split(/\s+/));
  return stops.map(([v, p], i) => {
    const x = p ? parseFloat(p) / 100 : i === 0 ? 0 : 1;
    return `${x},${1 - parseFloat(v)}`;
  }).join(' ');
}

refreshValues();
