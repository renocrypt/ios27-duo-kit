/**
 * Inspect (dev tool): a contact sheet of close-up views of the device, each at its own fold angle,
 * rendered in one frame with the stage's studio lighting. For quality passes on the model and its
 * materials: one screenshot covers the hinge, the plateau, the buttons, the ports and the postures.
 *
 * Presets are in the device frame (mm): the camera sits at target + dir * dist, looking at target.
 *
 *   /labs/inspect.html                     default sheet
 *   /labs/inspect.html?only=3              one preset full-window
 *   window.inspect.presets        edit, then window.inspect.render()
 *   window.inspect.finish('nightSky')
 */
import '../../base.css';
import * as THREE from 'three';
import { DuoDevice } from '../../device/DuoDevice.ts';
import type { Finish } from '../../device/materials.ts';
import { placeholderImages } from '../../scene/placeholder.ts';
import { studioEnvironment } from '../../scene/environment.ts';
import { tokens } from '../../tokens/tokens.ts';

interface Preset { label: string; theta: number; target: [number, number, number]; dir: [number, number, number]; dist: number; fov: number }

const presets: Preset[] = [
  { label: 'Open · front ¾', theta: 180, target: [0, 0, -2.6], dir: [0.35, 0.35, 1], dist: 440, fov: 26 },
  { label: 'Open · hinge seam, top edge', theta: 180, target: [0, 59, -2.6], dir: [0.3, 1, 0.55], dist: 28, fov: 30 },
  { label: 'Open · back ¾', theta: 180, target: [0, 0, -2.6], dir: [-0.4, 0.3, -1], dist: 440, fov: 26 },
  { label: '100° · hinge from behind', theta: 100, target: [0, 40, -4], dir: [0.15, 0.6, -1], dist: 70, fov: 30 },
  { label: '100° · hinge end, from the top', theta: 100, target: [0, 59, -1], dir: [0.05, 1, -0.25], dist: 34, fov: 30 },
  { label: 'Closed · spine', theta: 0, target: [0, 0, -1], dir: [0.35, 0.35, -1], dist: 170, fov: 30 },
  { label: 'Closed · top edge at the hinge', theta: 0, target: [0, 59, 4], dir: [0.4, 1, -0.3], dist: 40, fov: 30 },
  { label: 'Camera plateau', theta: 180, target: [55, 44, -8], dir: [0.5, 0.35, -1], dist: 110, fov: 30 },
  { label: 'Free edge · buttons', theta: 180, target: [82, 0, -2.6], dir: [1, 0.25, -0.35], dist: 120, fov: 30 },
  { label: 'Bottom edge · ports', theta: 180, target: [0, -59, -2.6], dir: [0.1, -1, -0.35], dist: 160, fov: 30 },
  { label: 'Standing · 62°', theta: 62, target: [0, 0, 20], dir: [0.45, 0.3, -1], dist: 440, fov: 26 },
  { label: 'Book · 122°', theta: 122, target: [0, 0, 20], dir: [0.25, 0.2, 1], dist: 440, fov: 26 },
];

const root = document.getElementById('inspect')!;
root.style.cssText = 'position:fixed;inset:0;background:' + tokens.stage.mood.morning.sky;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setScissorTest(true);
root.append(renderer.domElement);
renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';

const scene = new THREE.Scene();
scene.background = new THREE.Color(tokens.stage.mood.morning.sky);
scene.environment = studioEnvironment(renderer, tokens.stage.light);
const images = placeholderImages();
const device = new DuoDevice({ finish: 'starWhite', innerImage: images.inner, outerImage: images.outer });
scene.add(device.root);
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 5000);

const labels = document.createElement('div');
labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:600 12px/1.2 system-ui;color:#1d1d1f';
root.append(labels);

function render(): void {
  const only = new URLSearchParams(location.search).get('only');
  const list = only !== null ? [presets[Number(only)]] : presets;
  const W = root.clientWidth, H = root.clientHeight;
  renderer.setSize(W, H, false);
  const cols = list.length === 1 ? 1 : Math.ceil(Math.sqrt(list.length * (W / H)));
  const rows = Math.ceil(list.length / cols);
  const cw = W / cols, ch = H / rows;
  labels.innerHTML = '';
  list.forEach((p, i) => {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
    device.setFold((p.theta * Math.PI) / 180);
    const target = new THREE.Vector3(...p.target);
    const dir = new THREE.Vector3(...p.dir).normalize();
    camera.position.copy(target).addScaledVector(dir, p.dist);
    camera.up.set(0, Math.abs(dir.y) > 0.85 ? 0 : 1, Math.abs(dir.y) > 0.85 ? -Math.sign(dir.y) : 0);
    camera.fov = p.fov; camera.aspect = cw / ch; camera.updateProjectionMatrix();
    camera.lookAt(target);
    // WebGL's viewport origin is bottom-left.
    renderer.setViewport(cx, H - cy - ch, cw, ch);
    renderer.setScissor(cx, H - cy - ch, cw, ch);
    renderer.render(scene, camera);
    const tag = document.createElement('span');
    tag.textContent = `${only ?? i}  ${p.label}`;
    tag.style.cssText = `position:absolute;left:${cx + 8}px;top:${cy + 6}px`;
    labels.append(tag);
  });
}

new ResizeObserver(() => render()).observe(root);
render();

(window as unknown as { inspect: unknown }).inspect = {
  presets, render, device,
  finish: (f: Finish) => { device.setFinish(f); render(); },
};
