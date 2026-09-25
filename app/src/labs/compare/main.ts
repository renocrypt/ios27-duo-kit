/**
 * Reference compare (dev tool): our DuoDevice against Apple's AR model (served from /tmp by the
 * dev-only reference plugin), in the two poses Apple ships: Landscape (flat, θ = π) and Closed (θ = 0).
 *
 * Modes:
 *   overlay   ours shaded, Apple's in red wireframe, orthographic views
 *   diff      silhouette masks from each orthographic view: grey both, red ours only, cyan Apple only
 *   section   both models cut by a plane at height y (mm), seen along the cut
 *
 * window.compare.metrics() returns, per view, the silhouette XOR area (mm²), IoU, and bounds deltas,
 * so geometry can be checked numerically from DevTools.
 */
import '../../base.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DuoDevice } from '../../device/DuoDevice.ts';
import { DUO } from '../../device/spec.ts';
import { placeholderImages } from '../../scene/placeholder.ts';

type Pose = 'landscape' | 'closed';
type View = 'front' | 'back' | 'top' | 'side';
type Mode = 'overlay' | 'diff' | 'section';

const PX_PER_MM = 10;
const hH = DUO.leaf.height / 2;

/** Apple's frame to our device frame (mm), per pose. */
function referenceMatrix(pose: Pose): THREE.Matrix4 {
  if (pose === 'landscape') return new THREE.Matrix4().makeTranslation(0, -hH, -2.49); // display surface at z = 0
  // Closed: Apple stacks leaves along z with the hinge toward -x; ours stands the leaves up along +z
  // from the pivot, stacked along x. x' = -z, y' = y - hH, z' = x + (leaf hinge end 41.08 + pivot 0.27).
  return new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, -hH, 1, 0, 0, 41.08 + DUO.hinge.pivotHeight, 0, 0, 0, 1);
}

const root = document.getElementById('compare')!;
root.setAttribute('data-appearance', 'dark');
root.style.cssText = 'position:fixed;inset:0;background:#0b0b0d;';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
root.append(renderer.domElement);
renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x333340, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(-1, 2, 3); scene.add(key);

const images = placeholderImages();
const device = new DuoDevice({ finish: 'starWhite', innerImage: images.inner, outerImage: images.outer });
scene.add(device.root);

const loader = new GLTFLoader();
const references: Partial<Record<Pose, THREE.Group>> = {};
const wire = new THREE.MeshBasicMaterial({ color: 0xff3b30, wireframe: true, transparent: true, opacity: 0.55 });

async function loadReference(pose: Pose): Promise<THREE.Group> {
  if (references[pose]) return references[pose]!;
  const gltf = await loader.loadAsync(`/@reference/apple-duo-${pose}.glb`);
  const group = new THREE.Group();
  group.add(gltf.scene);
  gltf.scene.applyMatrix4(referenceMatrix(pose));
  group.traverse((o) => { if (o instanceof THREE.Mesh) o.material = wire; });
  references[pose] = group;
  return group;
}

// ---- State ------------------------------------------------------------------------------------

const state = { pose: 'landscape' as Pose, view: 'front' as View, mode: 'overlay' as Mode, sectionY: 0 };
let reference: THREE.Group | null = null;

const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, -500, 500);
function aimCamera(view: View, bounds: THREE.Box3) {
  const c = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const dirs: Record<View, [THREE.Vector3, THREE.Vector3]> = {
    front: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
    back: [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)],
    top: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)],
    side: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
  };
  const [dir, up] = dirs[view];
  camera.position.copy(c).addScaledVector(dir, 300);
  camera.up.copy(up);
  camera.lookAt(c);
  const w = view === 'side' ? size.z : size.x, h = view === 'top' ? size.z : size.y;
  const half = Math.max(w, h) * 0.56;
  const aspect = root.clientWidth / Math.max(1, root.clientHeight);
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
  camera.updateProjectionMatrix();
}

async function apply() {
  device.setFold(state.pose === 'landscape' ? Math.PI : 0);
  if (reference) scene.remove(reference);
  reference = await loadReference(state.pose);
  scene.add(reference);
  const clip = state.mode === 'section' ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), state.sectionY)] : [];
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { m.clippingPlanes = clip; m.side = THREE.DoubleSide; m.needsUpdate = true; });
    }
  });
  const bounds = new THREE.Box3().setFromObject(device.root, true).union(new THREE.Box3().setFromObject(reference, true));
  aimCamera(state.mode === 'section' ? 'top' : state.view, bounds);
  draw();
}

// ---- Masks and metrics ----------------------------------------------------------------------------

const maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
function mask(object: THREE.Object3D, width: number, height: number): Uint8Array {
  const target = new THREE.WebGLRenderTarget(width, height);
  const others = scene.children.filter((c) => c !== object && c.visible);
  others.forEach((c) => (c.visible = false));
  const background = scene.background;
  scene.background = new THREE.Color(0x000000);
  scene.overrideMaterial = maskMaterial;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  scene.background = background;
  others.forEach((c) => (c.visible = true));
  target.dispose();
  return pixels;
}

async function metrics(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const savedView = state.view, savedMode = state.mode;
  state.mode = 'overlay';
  await apply();
  const bOurs = new THREE.Box3().setFromObject(device.root, true);
  const bRef = new THREE.Box3().setFromObject(reference!, true);
  out.boundsDelta = {
    min: bOurs.min.clone().sub(bRef.min).toArray().map((v) => +v.toFixed(2)),
    max: bOurs.max.clone().sub(bRef.max).toArray().map((v) => +v.toFixed(2)),
    ours: [bOurs.min.toArray().map((v) => +v.toFixed(2)), bOurs.max.toArray().map((v) => +v.toFixed(2))],
    apple: [bRef.min.toArray().map((v) => +v.toFixed(2)), bRef.max.toArray().map((v) => +v.toFixed(2))],
  };
  for (const view of ['front', 'back', 'top', 'side'] as View[]) {
    aimCamera(view, bOurs.clone().union(bRef));
    const w = Math.round((camera.right - camera.left) * PX_PER_MM), h = Math.round((camera.top - camera.bottom) * PX_PER_MM);
    const a = mask(device.root, w, h), b = mask(reference!, w, h);
    let both = 0, oursOnly = 0, appleOnly = 0;
    for (let i = 0; i < a.length; i += 4) {
      const x = a[i] > 127, y = b[i] > 127;
      if (x && y) both++; else if (x) oursOnly++; else if (y) appleOnly++;
    }
    const mm2 = 1 / (PX_PER_MM * PX_PER_MM);
    out[view] = { oursOnlyMm2: +(oursOnly * mm2).toFixed(1), appleOnlyMm2: +(appleOnly * mm2).toFixed(1), iou: +(both / Math.max(1, both + oursOnly + appleOnly)).toFixed(4) };
  }
  state.view = savedView; state.mode = savedMode;
  await apply();
  return out;
}

// ---- Drawing --------------------------------------------------------------------------------------

const diffCanvas = document.createElement('canvas');
diffCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;image-rendering:pixelated';
root.append(diffCanvas);

function draw() {
  const w = root.clientWidth, h = root.clientHeight;
  renderer.setSize(w, h, false);
  if (state.mode !== 'diff') {
    diffCanvas.style.display = 'none';
    renderer.render(scene, camera);
    return;
  }
  const mw = Math.round((camera.right - camera.left) * PX_PER_MM), mh = Math.round((camera.top - camera.bottom) * PX_PER_MM);
  const a = mask(device.root, mw, mh), b = mask(reference!, mw, mh);
  diffCanvas.width = mw; diffCanvas.height = mh;
  const ctx = diffCanvas.getContext('2d')!;
  const img = ctx.createImageData(mw, mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const src = ((mh - 1 - y) * mw + x) * 4, dst = (y * mw + x) * 4;
    const p = a[src] > 127, q = b[src] > 127;
    const c = p && q ? [120, 120, 128] : p ? [255, 59, 48] : q ? [0, 200, 255] : [11, 11, 13];
    img.data.set([c[0], c[1], c[2], 255], dst);
  }
  ctx.putImageData(img, 0, 0);
  diffCanvas.style.display = 'block';
  renderer.setClearColor(0x0b0b0d);
  renderer.clear();
}

// ---- Panel ----------------------------------------------------------------------------------------

const panel = document.createElement('nav');
panel.className = 'type-footnote';
panel.style.cssText = 'position:absolute;left:16px;top:16px;display:grid;gap:6px;padding:12px;border-radius:14px;background:#1c1c1e;color:#fff;z-index:2';
root.append(panel);
function refreshPanel() {
  const b = (group: string, value: string, label = value) =>
    `<button data-${group}="${value}" style="font:inherit;padding:4px 10px;border-radius:99px;border:0;cursor:pointer;background:${(state as Record<string, unknown>)[group] === value ? '#0088ff' : '#3a3a3c'};color:#fff">${label}</button>`;
  panel.innerHTML = `<b>Reference compare</b>
    <div>${b('pose', 'landscape')}${b('pose', 'closed')}</div>
    <div>${b('view', 'front')}${b('view', 'back')}${b('view', 'top')}${b('view', 'side')}</div>
    <div>${b('mode', 'overlay')}${b('mode', 'diff')}${b('mode', 'section')}</div>
    <label>section y <input type="range" min="${-hH}" max="${hH}" step="0.5" value="${state.sectionY}" id="sy"> <output>${state.sectionY}</output></label>
    <span style="opacity:.6">diff: grey both · red ours only · cyan Apple only</span>`;
}
panel.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button');
  if (!t) return;
  for (const k of ['pose', 'view', 'mode'] as const) if (t.dataset[k]) (state as Record<string, unknown>)[k] = t.dataset[k];
  refreshPanel(); void apply();
});
panel.addEventListener('input', (e) => {
  const i = e.target as HTMLInputElement;
  state.sectionY = Number(i.value);
  refreshPanel(); void apply();
});
new ResizeObserver(() => draw()).observe(root);
refreshPanel();
void apply();

(window as unknown as { compare: unknown }).compare = {
  metrics, device, state,
  set: async (patch: Partial<typeof state>) => { Object.assign(state, patch); refreshPanel(); await apply(); },
};
