/**
 * Glass Lab: the review and tuning tool for Liquid Glass. It runs the same GlassCompositor that
 * renders the device screens, on the inner display's canvas (951 x 669 pt), with draggable shapes,
 * touch illumination, press feedback, materialisation, accessibility modes, live parameter tuning,
 * and a light that follows the pointer (the stand-in for device motion).
 */
import '../../base.css';
import './lab.css';
import * as THREE from 'three';
import { animate, engine, spring } from 'animejs';
import { GlassCompositor, type GlassShape } from '../../glass/GlassCompositor.ts';
import { tokens, springs } from '../../tokens/tokens.ts';
import { contentTexture, drawContent, type LabContent } from './content.ts';

const SCREEN = { width: 951, height: 669, scale: 2 };
const RAIL = tokens.size.rail ? parseFloat(tokens.size.rail) : 80;

const root = document.getElementById('lab')!;
root.setAttribute('data-appearance', 'dark');
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.append(renderer.domElement);

const glass = new GlassCompositor(renderer, SCREEN);
const contentCanvas = document.createElement('canvas');
let contentKind: LabContent = 'landscape';
drawContent(contentCanvas, contentKind, SCREEN.width, SCREEN.height, SCREEN.scale);
const content = contentTexture(contentCanvas);
glass.setContent(content);

// Foreground glyphs (our own simple marks, no SF Symbols), recoloured by each shape's measured tone.
const fgCanvas = document.createElement('canvas');
fgCanvas.width = SCREEN.width * SCREEN.scale; fgCanvas.height = SCREEN.height * SCREEN.scale;
const fg = new THREE.CanvasTexture(fgCanvas);
fg.colorSpace = THREE.SRGBColorSpace;
fg.premultiplyAlpha = true;
glass.setForeground(fg);

// Duo inner display, landscape: a vertical rail on the right edge, plus test shapes.
const railX = SCREEN.width - RAIL / 2 - 22;
const shapes: GlassShape[] = [
  { id: 'back', x: railX, y: 22, width: 44, height: 44, radius: 'capsule', variant: 'regular', group: 1 },
  { id: 'share', x: railX, y: 78, width: 44, height: 44, radius: 'capsule', variant: 'regular', group: 1 },
  { id: 'tabs', x: railX, y: 200, width: 44, height: 196, radius: 'capsule', variant: 'regular', group: 2 },
  { id: 'search', x: railX, y: 412, width: 44, height: 44, radius: 'capsule', variant: 'regular', group: 2 },
  { id: 'toolbar', x: 28, y: 22, width: 236, height: 48, radius: 'capsule', variant: 'regular', group: 3 },
  { id: 'panel', x: 470, y: 360, width: 360, height: 268, radius: 30, variant: 'regular', group: 4 },
  { id: 'dropA', x: 110, y: 520, width: 60, height: 60, radius: 'capsule', variant: 'clear', group: 5 },
  { id: 'dropB', x: 250, y: 520, width: 60, height: 60, radius: 'capsule', variant: 'clear', group: 5 },
];
shapes.forEach((s) => { s.presence = 1; });
glass.shapes = shapes;

// ---- Display quad -------------------------------------------------------------------------------

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const display = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { uMap: { value: glass.texture }, uSize: { value: new THREE.Vector2(SCREEN.width, SCREEN.height) }, uRadius: { value: parseFloat(tokens.device.display.inner.radius) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D uMap; uniform vec2 uSize; uniform float uRadius; varying vec2 vUv;
    void main(){ vec2 p = (vUv - 0.5) * uSize; vec2 q = abs(p) - uSize * 0.5 + uRadius;
      float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius; float a = 1.0 - smoothstep(-0.6, 0.6, d);
      gl_FragColor = vec4(texture2D(uMap, vUv).rgb * a, 1.0);
      #include <colorspace_fragment>
    }`,
}));
(display.material as THREE.ShaderMaterial).side = THREE.DoubleSide; // y-down camera flips winding
display.position.z = -0.5;
scene.add(display);
scene.background = new THREE.Color('#050506');
let rect = { x: 0, y: 0, w: 1, h: 1 };
let zoom = 1;
let viewDirty = true; // layout, zoom, and resize changes that need the display quad redrawn

function layout() {
  const w = root.clientWidth, h = root.clientHeight;
  renderer.setSize(w, h, false);
  const avail = { w: w - 380, h: h - 60 };
  const s = Math.min(avail.w / SCREEN.width, avail.h / SCREEN.height) * zoom;
  const dw = SCREEN.width * s, dh = SCREEN.height * s;
  if (zoom > 1 && selected) {
    // Keep the selected shape's centre in the middle of the viewing area.
    const cx = selected.x + selected.width / 2, cy = selected.y + selected.height / 2;
    rect = { x: 30 + avail.w / 2 - cx * s, y: h / 2 - cy * s, w: dw, h: dh };
  } else {
    rect = { x: 30 + (avail.w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
  }
  viewDirty = true;
  camera.left = 0; camera.right = w; camera.top = 0; camera.bottom = h; // pixel space, y down
  camera.updateProjectionMatrix();
  display.scale.set(dw / 2, -dh / 2, 1);
  display.position.set(rect.x + dw / 2, rect.y + dh / 2, -0.5);
}
new ResizeObserver(layout).observe(root);
layout();

// ---- Foreground ---------------------------------------------------------------------------------

let tones = new Map<string, number>();
function drawForeground() {
  const ctx = fgCanvas.getContext('2d')!;
  ctx.setTransform(SCREEN.scale, 0, 0, SCREEN.scale, 0, 0);
  ctx.clearRect(0, 0, SCREEN.width, SCREEN.height);
  for (const s of shapes) {
    if ((s.presence ?? 1) < 0.5 || s.id === 'panel') continue;
    const tone = tones.get(s.id) ?? 1;
    ctx.strokeStyle = ctx.fillStyle = tone > 0.5 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
    ctx.beginPath();
    if (s.id === 'back') { ctx.moveTo(cx + 4, cy - 8); ctx.lineTo(cx - 4, cy); ctx.lineTo(cx + 4, cy + 8); }
    else if (s.id === 'share') { ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy - 9); ctx.moveTo(cx - 5, cy - 4); ctx.lineTo(cx, cy - 9); ctx.lineTo(cx + 5, cy - 4); ctx.rect(cx - 8, cy - 2, 16, 12); }
    else if (s.id === 'search') { ctx.arc(cx - 2, cy - 2, 6.5, 0, Math.PI * 2); ctx.moveTo(cx + 3, cy + 3); ctx.lineTo(cx + 8, cy + 8); }
    else if (s.id === 'tabs') { for (let i = 0; i < 4; i++) { ctx.moveTo(cx + 4.5, s.y + 30 + i * 45); ctx.arc(cx, s.y + 30 + i * 45, 4.5, 0, Math.PI * 2); } }
    else if (s.id === 'toolbar') { ctx.font = '590 17px system-ui'; ctx.fillText('Today', s.x + 22, cy + 6); }
    ctx.stroke();
  }
  fg.needsUpdate = true;
}

// ---- Interaction ---------------------------------------------------------------------------------

const toPt = (e: PointerEvent) => ({ x: ((e.clientX - rect.x) / rect.w) * SCREEN.width, y: ((e.clientY - rect.y) / rect.h) * SCREEN.height });
const hit = (p: { x: number; y: number }) => [...shapes].reverse().find((s) => p.x >= s.x && p.x <= s.x + s.width && p.y >= s.y && p.y <= s.y + s.height);
let drag: { shape: GlassShape; dx: number; dy: number; moved: boolean; start: { x: number; y: number } } | null = null;
let selected: GlassShape = shapes[5];

renderer.domElement.addEventListener('pointerdown', (e) => {
  const p = toPt(e);
  const s = hit(p);
  if (!s) return;
  selected = s;
  renderer.domElement.setPointerCapture(e.pointerId);
  drag = { shape: s, dx: p.x - s.x, dy: p.y - s.y, moved: false, start: p };
  refreshPanel();
});
renderer.domElement.addEventListener('pointermove', (e) => {
  const p = toPt(e);
  if (!drag && !lightLocked) {
    // The light follows the pointer: a stand-in for tilting the device.
    const lx = (p.x / SCREEN.width - 0.5) * -1.6, ly = (p.y / SCREEN.height - 0.5) * -1.6;
    glass.light.set(lx, ly, 0.6).normalize();
  }
  if (!drag) return;
  if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 3) drag.moved = true;
  drag.shape.x = p.x - drag.dx; drag.shape.y = p.y - drag.dy;
  drawForeground();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved) press(drag.shape, toPt(e));
  drag = null;
});

/** Press: light spreads from the finger, and the shape scales and bounces (motion.spring.bouncy). */
function press(s: GlassShape, p: { x: number; y: number }) {
  s.touch = { x: p.x, y: p.y, strength: 1, radius: 8 };
  animate(s.touch, { strength: 0, radius: Math.max(s.width, s.height) * 1.4, duration: 700, ease: 'out(3)' });
  const base = { x: s.x, y: s.y, width: s.width, height: s.height };
  const k = { scale: 1 };
  animate(k, {
    scale: [1, 1.06, 1],
    ease: spring({ bounce: springs.bouncy.bounce, duration: springs.bouncy.duration }),
    onUpdate: () => {
      s.width = base.width * k.scale; s.height = base.height * k.scale;
      s.x = base.x - (s.width - base.width) / 2; s.y = base.y - (s.height - base.height) / 2;
    },
  });
}

/** Materialise or dematerialise every shape: lensing strength on a spring, never opacity. */
function materialize(on: boolean) {
  shapes.forEach((s, i) => animate(s, {
    presence: on ? 1 : 0, delay: i * 40,
    ease: spring({ bounce: springs.smooth.bounce, duration: springs.smooth.duration }),
    onUpdate: drawForeground,
  }));
}

// ---- Calibration ---------------------------------------------------------------------------------

/** One 155 pt disc in the middle of the screen, the size of the disc in Apple's HIG Materials art. */
let calibrating = false;
const layoutShapes = shapes.map((s) => ({ ...s }));
function calibrate(on: boolean) {
  calibrating = on;
  shapes.length = 0;
  if (on) shapes.push({ id: 'disc', x: SCREEN.width / 2 - 77.5, y: SCREEN.height / 2 - 77.5, width: 155, height: 155, radius: 'capsule', variant: selected.variant, group: 9, presence: 1 });
  else shapes.push(...layoutShapes.map((s) => ({ ...s })));
  glass.shapes = shapes;
  selected = shapes[0];
  drawForeground();
}

// ---- Panel ---------------------------------------------------------------------------------------

type ParamKey = keyof typeof tokens.material.glass.regular;
const PARAMS: [ParamKey, number, number, number][] = [
  ['ior', 1.0, 2.2, 0.01], ['lens', 0, 60, 0.5], ['lensPower', 0.5, 2, 0.01], ['bezelRatio', 0.1, 0.9, 0.01], ['profile', 0.05, 1, 0.01],
  ['dispersion', 0, 2, 0.05], ['frost', 0, 1, 0.01],
  ['rim', 0, 0.6, 0.005], ['shadow', 0, 0.6, 0.01],
];
const panel = document.createElement('aside');
panel.className = 'lab-panel type-footnote';
root.append(panel);

function refreshPanel() {
  const variant = selected.variant;
  const v = tokens.material.glass[variant] as unknown as Record<string, number>;
  panel.innerHTML = `
    <h1 class="type-headline">Glass Lab</h1>
    <p class="lab-muted">Selected: <b>${selected.id}</b> · ${variant}. Drag shapes, tap to press, move the pointer to move the light.</p>
    <div class="lab-row"><button data-act="calibrate" aria-pressed="${calibrating}">Calibration disc</button></div>
    <div class="lab-row">${(['landscape', 'text', 'light', 'dark', 'stripes', 'beach', 'space', 'bricks'] as LabContent[]).map((c) => `<button data-content="${c}" aria-pressed="${c === contentKind}">${c}</button>`).join('')}</div>
    <div class="lab-row"><button data-variant="regular" aria-pressed="${variant === 'regular'}">Regular</button><button data-variant="clear" aria-pressed="${variant === 'clear'}">Clear</button>
      <button data-act="materialize">Materialize</button><button data-act="dematerialize">Dematerialize</button></div>
    <div class="lab-row"><button data-appearance="1" aria-pressed="${glass.environment.appearance === 1}">Light mode</button><button data-appearance="0" aria-pressed="${glass.environment.appearance === 0}">Dark mode</button>
      <button data-act="zoom" aria-pressed="${zoom > 1}">Zoom ×3 on selected</button></div>
    <div class="lab-row"><label><input type="checkbox" data-env="increaseContrast" ${glass.environment.increaseContrast ? 'checked' : ''}> Increase Contrast</label>
      <label><input type="checkbox" data-env="reduceTransparency" ${glass.environment.reduceTransparency ? 'checked' : ''}> Reduce Transparency</label>
      <label><input type="checkbox" data-act="lock-light" ${lightLocked ? 'checked' : ''}> Lock light</label></div>
    <label class="lab-slider">Clear ↔ Tinted <input type="range" min="0" max="1" step="0.01" value="${glass.environment.tint}" data-env="tint"><output>${glass.environment.tint.toFixed(2)}</output></label>
    <h2 class="type-subheadline">${variant} parameters (live)</h2>
    ${PARAMS.map(([key, min, max, step]) => `<label class="lab-slider">${key}<input type="range" min="${min}" max="${max}" step="${step}" value="${v[key]}" data-param="${key}"><output>${Number(v[key]).toFixed(2)}</output></label>`).join('')}
    <button data-act="export">Copy ${variant} tokens</button>`;
}
let lightLocked = false;
panel.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  if (b.dataset.content) {
    contentKind = b.dataset.content as LabContent;
    drawContent(contentCanvas, contentKind, SCREEN.width, SCREEN.height, SCREEN.scale);
    content.needsUpdate = true; glass.markContentDirty();
    glass.environment.appearance = contentKind === 'dark' || contentKind === 'space' ? 0 : 1; // the appearance that content implies
  }
  if (b.dataset.appearance) glass.environment.appearance = Number(b.dataset.appearance);
  if (b.dataset.act === 'zoom') { zoom = zoom > 1 ? 1 : 3; layout(); }
  if (b.dataset.act === 'calibrate') calibrate(!calibrating);
  if (b.dataset.variant) selected.variant = b.dataset.variant as 'regular' | 'clear';
  if (b.dataset.act === 'materialize') materialize(true);
  if (b.dataset.act === 'dematerialize') materialize(false);
  if (b.dataset.act === 'export') {
    const v = tokens.material.glass[selected.variant];
    void navigator.clipboard?.writeText(JSON.stringify(v, null, 2));
    console.log(`material.glass.${selected.variant}`, JSON.stringify(v, null, 2));
  }
  refreshPanel();
});
panel.addEventListener('input', (e) => {
  const input = e.target as HTMLInputElement;
  const out = input.parentElement?.querySelector('output');
  if (input.dataset.param) {
    // Live override of the token value for this session (export to write it back to the tokens file).
    (tokens.material.glass[selected.variant] as unknown as Record<string, number>)[input.dataset.param] = Number(input.value);
  }
  if (input.dataset.env === 'tint') glass.environment.tint = Number(input.value);
  if (input.dataset.env === 'increaseContrast') glass.environment.increaseContrast = input.checked;
  if (input.dataset.env === 'reduceTransparency') glass.environment.reduceTransparency = input.checked;
  if (input.dataset.act === 'lock-light') lightLocked = input.checked;
  if (out) out.textContent = Number(input.value).toFixed(2);
});
refreshPanel();
drawForeground();

// ---- Loop ----------------------------------------------------------------------------------------

engine.useDefaultMainLoop = false;
let frame = 0;
new ResizeObserver(() => { viewDirty = true; }).observe(root);
renderer.setAnimationLoop(() => {
  engine.update();
  const glassChanged = glass.render(); // skips itself when nothing changed
  if (glassChanged && ++frame % 6 === 0) {
    // Read tones back only after a real change (the read is a GPU sync).
    const next = new Map(glass.readTones().map((t) => [t.id, t.tone]));
    const changed = [...next].some(([id, tone]) => Math.abs((tones.get(id) ?? -1) - tone) > 0.2);
    tones = next;
    if (changed) drawForeground();
  }
  if (!glassChanged && !viewDirty) return;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  viewDirty = false;
});

(window as unknown as { lab: unknown }).lab = {
  glass, shapes, press, materialize,
  select: (id: string) => { selected = shapes.find((x) => x.id === id) ?? selected; layout(); refreshPanel(); },
  zoom: (z: number) => { zoom = z; layout(); refreshPanel(); },
};
