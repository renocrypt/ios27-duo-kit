/**
 * Stage lab (dev tool): the stage with a control panel for postures, finish, fold angle, light
 * moods and camera, plus test patterns on both screens for checking orientation per posture.
 * The presentation itself never shows controls; this page is where they live.
 */
import '../../base.css';
import '../../scene/stage.css';
import { Stage, moods, type MoodName } from '../../scene/Stage.ts';
import { POSTURES, type PostureName } from '../../scene/postures.ts';
import { ScreenSurface, type Rotation } from '../../surface/ScreenSurface.ts';
import { DUO } from '../../device/spec.ts';

const root = document.getElementById('stage')!;
root.setAttribute('data-appearance', 'light');
const viewport = document.createElement('div');
viewport.className = 'stage-viewport';
root.append(viewport);

const pattern = (label: string, w: number, h: number) => `
  <div class="scr" style="background:linear-gradient(160deg,#0a84ff,#5e5ce6 55%,#bf5af2)">
    <div style="position:absolute;left:0;top:0;right:0;height:${h * 0.12}px;background:#ffffff33;display:grid;place-items:center;color:white;font:700 ${h * 0.06}px system-ui">TOP · ${label} ${w}×${h}</div>
    <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:800 ${h * 0.4}px system-ui;color:white">F↑</div>
    <div data-glass="regular" style="position:absolute;right:20px;bottom:20px;width:120px;height:44px;border-radius:22px;display:grid;place-items:center;font:600 17px system-ui;color:white">Glass</div>
  </div>`;

const inner = new ScreenSurface({ native: DUO.inner.canvas, scale: 2 });
const outer = new ScreenSurface({ native: DUO.outer.canvas, scale: 2 });
const stage = new Stage(viewport, { surfaces: { inner, outer } });

const rotations: Record<PostureName, { inner: Rotation; outer: Rotation }> = {
  open: { inner: 0, outer: 0 }, book: { inner: 0, outer: 0 }, seated: { inner: 90, outer: 0 },
  standing: { inner: 0, outer: 270 }, closed: { inner: 0, outer: 0 },
};
function showPatterns(p: PostureName) {
  const r = rotations[p];
  for (const [surface, rot, label] of [[inner, r.inner, 'inner'], [outer, r.outer, 'outer']] as const) {
    surface.rotation = rot;
    const { width, height } = surface.logical;
    surface.show(pattern(label, width, height), { rotation: rot });
  }
}
showPatterns('closed');
stage.light('morning', 'cut');
stage.frame({ azimuth: 0, elevation: 10 }, 'cut');

const panel = document.createElement('nav');
panel.className = 'stage-panel type-footnote';
panel.innerHTML = `
  <div class="stage-row">${(Object.keys(POSTURES) as PostureName[]).map((p) => `<button data-posture="${p}">${POSTURES[p].label}</button>`).join('')}</div>
  <div class="stage-row">${(Object.keys(moods) as MoodName[]).map((m) => `<button data-mood="${m}">${m}</button>`).join('')}</div>
  <div class="stage-row"><button data-finish="starWhite">Star White</button><button data-finish="nightSky">Night Sky</button><button data-explore>Explore</button></div>
  <label class="stage-row">azimuth <input type="range" min="-180" max="180" value="0" id="az"></label>
  <label class="stage-row">elevation <input type="range" min="-30" max="80" value="10" id="el"></label>`;
root.append(panel);
panel.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  if (b.dataset.posture) { const p = b.dataset.posture as PostureName; showPatterns(p); void stage.pose(p); }
  if (b.dataset.mood) { const m = moods[b.dataset.mood as MoodName]; stage.light(b.dataset.mood as MoodName); root.style.background = `linear-gradient(${m.sky}, ${m.ground})`; }
  if (b.dataset.finish) stage.setFinish(b.dataset.finish as 'starWhite' | 'nightSky');
  if (b.dataset.explore !== undefined) stage.explore(b.getAttribute('aria-pressed') !== 'true'), b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
});
panel.addEventListener('input', () => {
  const az = Number((panel.querySelector('#az') as HTMLInputElement).value);
  const el = Number((panel.querySelector('#el') as HTMLInputElement).value);
  void stage.frame({ azimuth: az, elevation: el }, 'cut');
});

(window as unknown as { duo: unknown }).duo = { stage, inner, outer, showPatterns };
