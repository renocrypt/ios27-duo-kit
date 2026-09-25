/**
 * Screens (dev tool): every hub screen rendered flat through the real pipeline (HTML-in-Canvas,
 * then the Liquid Glass compositor), in display-shaped frames at a fixed scale, for designing the
 * interfaces without the 3D device in the way.
 *
 *   /screens/            all views
 *   /screens/?v=kitchen  one view, large
 */
import '../../base.css';
import * as THREE from 'three';
import { ScreenSurface, type Rotation } from '../../surface/ScreenSurface.ts';
import { views, type View } from '../../hub/views.ts';
import { GlassCompositor } from '../../glass/GlassCompositor.ts';
import { DUO } from '../../device/spec.ts';

type Display = 'inner' | 'outer';
const entries: { id: string; display: Display; rotation: Rotation; view: () => View }[] = [
  { id: 'titleFace', display: 'outer', rotation: 0, view: views.titleFace },
  { id: 'bedsideNight', display: 'outer', rotation: 270, view: () => views.bedside('night', '6:41') },
  { id: 'bedsideDawn', display: 'outer', rotation: 270, view: () => views.bedside('dawn', '6:58') },
  { id: 'lockNowNext', display: 'outer', rotation: 0, view: views.lockNowNext },
  { id: 'liveApproval', display: 'outer', rotation: 0, view: views.liveApproval },
  { id: 'todayPlan', display: 'inner', rotation: 0, view: views.todayPlan },
  { id: 'noteSource', display: 'inner', rotation: 0, view: views.noteSource },
  { id: 'kitchen', display: 'inner', rotation: 90, view: views.kitchen },
  { id: 'review', display: 'inner', rotation: 0, view: views.review },
];

const only = new URLSearchParams(location.search).get('v');
const list = only ? entries.filter((e) => e.id === only) : entries;
const root = document.getElementById('screens')!;
root.style.cssText = 'position:fixed;inset:0;background:#1d1d1f';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.append(renderer.domElement);
renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1);
const labels = document.createElement('div');
labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:600 12px system-ui;color:#fff';
root.append(labels);

const items = list.map((e) => {
  const native = DUO[e.display].canvas;
  const surface = new ScreenSurface({ native, scale: 2 });
  const glass = new GlassCompositor(renderer, { ...native, scale: 2 });
  const v = e.view();
  surface.show(v.html, { rotation: e.rotation });
  glass.setContent(surface.content);
  glass.setForeground(surface.foreground);
  glass.environment.appearance = v.appearance;
  surface.onChange = () => { glass.shapes = surface.shapes; glass.markContentDirty(); dirty = true; };
  // Shown in the interface's orientation: undo the surface's rotation on the quad.
  const material = new THREE.MeshBasicMaterial({ map: glass.texture, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.rotation.z = (-e.rotation * Math.PI) / 180;
  scene.add(mesh);
  return { e, surface, glass, mesh, logical: surface.logical };
});
let dirty = true;

function layout() {
  const W = root.clientWidth, H = root.clientHeight;
  renderer.setSize(W, H, false);
  camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = H; camera.updateProjectionMatrix();
  labels.innerHTML = '';
  const gap = 28;
  // Uniform scale: 1 pt = k px, so inner and outer screens compare at the same size.
  const rowH = only ? H - 2 * gap : (H - 3 * gap) / 2;
  const k = only ? Math.min((W - 2 * gap) / items[0].logical.width, rowH / items[0].logical.height) : rowH / 951;
  let x = gap, y = gap;
  for (const it of items) {
    const w = it.logical.width * k, h = it.logical.height * k;
    if (x + w > W - gap && x > gap) { x = gap; y += rowH + gap; }
    it.mesh.position.set(x + w / 2, y + h / 2, 0);
    it.mesh.scale.set(it.e.rotation % 180 ? h : w, it.e.rotation % 180 ? w : h, 1);
    it.mesh.scale.y *= -1; // y down
    const tag = document.createElement('span');
    tag.textContent = it.e.id;
    tag.style.cssText = `position:absolute;left:${x}px;top:${y - 18}px`;
    labels.append(tag);
    x += w + gap;
  }
  dirty = true;
}
new ResizeObserver(layout).observe(root);
layout();
renderer.setAnimationLoop(() => {
  let any = false;
  for (const it of items) any = it.glass.render() || any;
  if (!any && !dirty) return;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  dirty = false;
});
(window as unknown as { screens: unknown }).screens = { items };
