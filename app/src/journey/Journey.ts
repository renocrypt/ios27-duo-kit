/**
 * Journey: the scroll-driven presentation of "a day with Duo" (docs/presentation.md).
 *
 *   const journey = new Journey(root, scenes);           // builds the page: backdrop, viewport, copy, rail, track
 *   const stage = new Stage(journey.viewport, { surfaces });
 *   journey.start(stage, surfaces);
 *
 * The page scrolls a tall track of empty sections, one per scene; everything visible is fixed
 * above it. The scene under the middle of the viewport is the current one. Moving to a neighbour
 * either lets the device lead (a fold or a pick-up springs on `motion.spring.hinge`, the camera
 * settles a beat later) or dissolves through a veil to a new moment of the day. Copy arrives only
 * once the frame has settled, and leaves first. A scene may follow the scroll within itself (the
 * dawn), or let the viewer turn the device by hand.
 *
 * Keyboard: arrows, Page Up/Down and Space move between scenes; the rail's marks jump to one.
 */
import './journey.css';
import { moods, type MoodName, type Shot, type Stage } from '../scene/Stage.ts';
import type { ScreenSurface } from '../surface/ScreenSurface.ts';
import { views } from '../hub/views.ts';
import type { Scene, SceneScreen } from './scenes.ts';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Journey {
  readonly viewport: HTMLDivElement;
  private readonly skies: HTMLDivElement[] = [];
  private readonly fade: HTMLDivElement;
  private readonly copy: HTMLDivElement;
  private readonly rail: HTMLElement;
  private readonly hint: HTMLDivElement;
  private readonly replay: HTMLButtonElement;
  private readonly sections: HTMLElement[] = [];
  private stage!: Stage;
  private surfaces!: { inner: ScreenSurface; outer: ScreenSurface };
  private index = -1;
  private sky = 0;
  private copyTimer = 0;
  private cutTimer = 0;
  private shown: { inner?: SceneScreen; outer?: SceneScreen; clock?: string } = {};
  private scrolled = false;
  private turnHinted = false;
  private hintTimer = 0;
  private skyTimer = 0;

  constructor(root: HTMLElement, private readonly scenes: Scene[]) {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string) => { const n = document.createElement(tag); n.className = cls; return n; };
    const backdrop = el('div', 'j-backdrop');
    for (let i = 0; i < 2; i++) { const s = el('div', 'j-sky'); backdrop.append(s); this.skies.push(s); }
    this.viewport = el('div', 'j-viewport');
    this.fade = el('div', 'j-fade');
    this.copy = el('div', 'j-copy');
    this.rail = el('nav', 'j-rail');
    this.rail.setAttribute('aria-label', 'Scenes');
    this.hint = el('div', 'j-hint');
    this.replay = el('button', 'j-hint j-replay');
    this.replay.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8a4.5 4.5 0 1 0 1.3-3.2M3.5 3v2.5H6"/></svg>Start again';
    this.replay.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
    const track = el('div', 'j-track');
    scenes.forEach((scene, i) => {
      const section = el('section', scene.long ? 'is-long' : '');
      section.setAttribute('aria-label', scene.copy.headline);
      track.append(section);
      this.sections.push(section);
      const mark = document.createElement('button');
      mark.setAttribute('aria-label', `${scene.copy.kicker ?? ''} ${scene.copy.headline}`.trim());
      mark.addEventListener('click', () => this.scrollTo(i));
      this.rail.append(mark);
    });
    root.append(backdrop, this.viewport, this.fade, this.copy, this.rail, this.hint, this.replay, track);
  }

  start(stage: Stage, surfaces: { inner: ScreenSurface; outer: ScreenSurface }): void {
    this.stage = stage;
    this.surfaces = surfaces;
    // A presentation starts at its beginning, not where the last visit left off.
    history.scrollRestoration = 'manual';
    scrollTo(0, 0);
    addEventListener('scroll', () => this.onScroll(), { passive: true });
    addEventListener('resize', () => { this.onScroll(); this.onResize(); });
    addEventListener('keydown', (e) => this.onKey(e));
    this.enableTurning();
    this.go(this.current(), true);
    this.onScroll();
    this.showHint('Scroll');
  }

  // ---- Scroll ------------------------------------------------------------------------------------

  /** The scene whose section holds the middle of the viewport, and the progress through it. */
  private current(): number { return this.locate().index; }

  private locate(): { index: number; progress: number } {
    const mid = scrollY + innerHeight / 2;
    for (let i = 0; i < this.sections.length; i++) {
      const s = this.sections[i], top = s.offsetTop, h = s.offsetHeight;
      if (mid < top + h || i === this.sections.length - 1) {
        return { index: i, progress: Math.min(1, Math.max(0, (mid - top) / h)) };
      }
    }
    return { index: 0, progress: 0 };
  }

  private onScroll(): void {
    if (scrollY > 8 && !this.scrolled) { this.scrolled = true; this.hideHint(); }
    const { index, progress } = this.locate();
    if (index !== this.index) this.go(index);
    const scene = this.scenes[index];
    if (scene.scrub === 'dawn') this.dawn(progress);
  }

  private scrollTo(i: number): void {
    const s = this.sections[i];
    const top = s.offsetTop + s.offsetHeight / 2 - innerHeight / 2;
    scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }

  private onKey(e: KeyboardEvent): void {
    const next = ['ArrowDown', 'PageDown', ' '].includes(e.key), prev = ['ArrowUp', 'PageUp'].includes(e.key);
    if (!next && !prev) return;
    e.preventDefault();
    this.scrollTo(Math.min(this.scenes.length - 1, Math.max(0, this.index + (next ? 1 : -1))));
  }

  // ---- Scenes ------------------------------------------------------------------------------------

  private go(index: number, first = false): void {
    const from = this.index;
    this.index = index;
    const scene = this.scenes[index];
    // Crossing a boundary backwards uses that boundary's style (the later scene's).
    const style = first || reduced || Math.abs(index - from) > 1 ? 'cut' : (index > from ? scene : this.scenes[from]).enter;
    [...this.rail.children].forEach((b, i) => { if (i === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    this.replay.classList.toggle('is-on', index === this.scenes.length - 1);
    this.replay.dataset.ink = moods[scene.mood].ink;
    // Hints belong to one scene: a pending one is dropped when the scene changes.
    clearTimeout(this.hintTimer);
    if (!first) this.hideHint();
    if (scene.turn && !this.turnHinted) {
      this.hintTimer = window.setTimeout(() => { if (this.scenes[this.index].turn) { this.turnHinted = true; this.showHint('Drag to turn it around'); } }, 1400);
    }
    this.hideCopy();
    clearTimeout(this.cutTimer);
    const shot = this.fit(scene);

    if (style === 'cut') {
      const apply = () => {
        this.stage.turn(0, 0);
        this.setScreens(scene);
        this.setSky(scene.mood, true);
        void this.stage.pose(scene.posture, 'cut');
        void this.stage.frame(shot, 'cut');
        this.stage.light(scene.mood, 'cut');
        if (first && scene.id === 'title') { this.stage.light('black', 'cut'); setTimeout(() => this.stage.light('title'), 350); }
        if (scene.scrub === 'dawn') this.dawn(this.locate().progress);
        this.fade.classList.remove('is-on');
        this.showCopy(scene, first ? 900 : 420);
      };
      if (first) { apply(); return; }
      this.fade.style.background = moods[scene.mood].sky;
      this.fade.classList.add('is-on');
      this.cutTimer = window.setTimeout(apply, 330);
      return;
    }

    // The device leads, the camera follows a beat later. A veil left by a superseded cut lifts.
    this.fade.classList.remove('is-on');
    this.stage.turn(0, 0, 'spring');
    this.setScreens(scene);
    this.setSky(scene.mood);
    this.stage.light(scene.mood);
    void this.stage.pose(scene.posture);
    window.setTimeout(() => void this.stage.frame(shot), 240);
    this.showCopy(scene, 1150);
  }

  /**
   * The scene's shot, fitted to this viewport: the device centres in the space the copy leaves and
   * never grows into it. On portrait screens the copy sits on top and the device below.
   */
  private fit(scene: Scene): Shot {
    const W = innerWidth, H = innerHeight, shot = scene.shot;
    if (W / H < 1) return { ...shot, at: [0, -0.28], fill: Math.min(shot.fill, 0.5), maxW: 0.86 };
    const hero = scene.copy.hero === true;
    const margin = 0.075 * W, rail = 64;
    const block = hero ? Math.min(0.46 * W, 760) : Math.min(0.34 * W, 520);
    const copyEdge = margin + block + 0.03 * W;           // where the device's space begins
    const space = W - rail - copyEdge;                    // px available to the device
    const centre = copyEdge + space / 2;                  // px from the copy's side
    const x = (centre / W) * 2 - 1;
    const at: [number, number] = [scene.copy.place === 'right' ? -x : scene.copy.place === 'center' ? 0 : x, shot.at[1]];
    return { ...shot, at, maxW: (space / W) * 0.94 };
  }

  private onResize(): void {
    if (this.index < 0) return;
    void this.stage.frame(this.fit(this.scenes[this.index]), 'cut');
  }

  private setScreens(scene: Scene): void {
    for (const key of ['inner', 'outer'] as const) {
      const want = scene[key];
      if (this.shown[key] === want && !(scene.scrub === 'dawn' && key === 'outer')) continue;
      this.shown[key] = want;
      const v = want.view();
      this.surfaces[key].show(v.html, { rotation: want.rotation });
      if (key === 'inner') this.stage.screens.setAppearance(v.appearance, this.stage.screens.outer.environment.appearance);
      else this.stage.screens.setAppearance(this.stage.screens.inner.environment.appearance, v.appearance);
    }
    this.shown.clock = undefined;
  }

  /**
   * The dawn: night, then the blue hour, then morning light as you scroll; the clock runs from
   * 6:41 to 6:58 and colour returns to it once the room is light (StandBy leaves night mode).
   */
  private dawn(progress: number): void {
    const t = smoothstep(0.12, 0.88, progress);
    // Two legs through the blue hour, so the sky never passes through grey. The first leg is short:
    // night and the blue hour are both dark, and most of the visible change is in the second.
    const split = 0.38;
    const [a, b, u]: [MoodName, MoodName, number] = t < split ? ['night', 'twilight', t / split] : ['twilight', 'dawn', (t - split) / (1 - split)];
    this.stage.lightMix(a, b, u);
    clearTimeout(this.skyTimer);
    const lower = this.skies[this.sky], upper = this.skies[1 - this.sky];
    lower.style.zIndex = '0'; upper.style.zIndex = '1';
    lower.style.transitionDuration = upper.style.transitionDuration = '1ms';
    lower.style.background = backdrop(a);
    upper.style.background = backdrop(b);
    lower.style.opacity = '1';
    upper.style.opacity = String(u);
    lower.classList.add('is-on'); upper.classList.add('is-on');
    // The copy's ink follows the sky behind it: whichever ink contrasts more with the blended backdrop.
    const behind = mixColor(backdropAt(a, 0.5), backdropAt(b, 0.5), u);
    const ink = inkFor(behind);
    this.copy.dataset.ink = ink; this.rail.dataset.ink = ink; this.hint.dataset.ink = ink;
    // On mid-tone skies neither secondary grey holds contrast, so secondary copy takes the primary ink.
    this.copy.toggleAttribute('data-mid', luminance(behind) > 0.08 && luminance(behind) < 0.4);
    const minute = 41 + Math.round(17 * smoothstep(0.05, 0.95, progress));
    const mode = t > 0.6 ? 'dawn' : 'night';
    const key = `${mode} 6:${minute}`;
    if (key !== this.shown.clock) {
      this.shown.clock = key;
      this.surfaces.outer.show(views.bedside(mode, `6:${minute}`).html, { rotation: 270 });
    }
  }

  private setSky(mood: MoodName, instant = false): void {
    const next = 1 - this.sky;
    const below = this.skies[this.sky], above = this.skies[next];
    clearTimeout(this.skyTimer);
    // The old sky stays fully on underneath while the new one fades in above it.
    below.style.zIndex = '0'; above.style.zIndex = '1';
    below.style.transitionDuration = '1ms'; below.style.opacity = '1'; below.classList.add('is-on');
    above.style.opacity = '';
    above.style.transitionDuration = instant ? '1ms' : '';
    above.classList.remove('is-on');
    above.style.background = backdrop(mood);
    void above.offsetWidth; // start the fade from 0
    above.classList.add('is-on');
    this.skyTimer = window.setTimeout(() => { below.classList.remove('is-on'); below.style.opacity = ''; }, instant ? 20 : 900);
    this.sky = next;
    this.copy.dataset.ink = moods[mood].ink;
    this.copy.removeAttribute('data-mid');
    this.rail.dataset.ink = moods[mood].ink;
    this.hint.dataset.ink = moods[mood].ink;
  }

  // ---- Copy --------------------------------------------------------------------------------------

  private hideCopy(): void {
    clearTimeout(this.copyTimer);
    this.copy.querySelectorAll('.j-block').forEach((b) => { b.classList.remove('is-in'); setTimeout(() => b.remove(), 650); });
  }

  private showCopy(scene: Scene, delay: number): void {
    const c = scene.copy;
    const block = document.createElement('div');
    block.className = c.hero ? 'j-block is-hero' : 'j-block';
    block.dataset.place = c.place;
    block.innerHTML =
      (c.kicker ? `<p class="j-kicker type-stage-kicker">${c.kicker}</p>` : '') +
      `<h2 class="j-headline ${c.hero ? 'type-stage-hero' : 'type-stage-headline'}">${c.headline}</h2>` +
      (c.body ? `<p class="j-body type-stage-body">${c.body}</p>` : '');
    this.copy.append(block);
    this.copyTimer = window.setTimeout(() => requestAnimationFrame(() => block.classList.add('is-in')), reduced ? 0 : delay);
  }

  // ---- Hints and turning -------------------------------------------------------------------------

  private showHint(text: string): void {
    const arrow = text === 'Scroll'
      ? '<path d="M8 3v10M4 9l4 4 4-4"/>'
      : '<path d="M3 8h10M5.5 5.5 3 8l2.5 2.5M10.5 5.5 13 8l-2.5 2.5"/>';
    this.hint.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${arrow}</svg>${text}`;
    const show = () => { if (text !== 'Scroll' || (scrollY < 8 && !this.scrolled)) this.hint.classList.add('is-on'); };
    setTimeout(show, text === 'Scroll' ? 1800 : 0);
  }

  private hideHint(): void { this.hint.classList.remove('is-on'); }

  /** In scenes that allow it, drag turns the device; it springs back when the scene ends. */
  private enableTurning(): void {
    let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
    let hinted = false;
    const v = this.viewport;
    const allowed = () => this.scenes[this.index]?.turn === true;
    const sync = () => v.classList.toggle('is-draggable', allowed());
    addEventListener('scroll', sync, { passive: true });
    v.addEventListener('pointerdown', (e) => {
      if (!allowed()) return;
      const t = this.stage.turned;
      drag = { x: e.clientX, y: e.clientY, yaw: t.yaw, pitch: t.pitch };
      v.setPointerCapture(e.pointerId);
      v.classList.add('is-dragging');
      if (!hinted) { hinted = true; this.hideHint(); }
    });
    v.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const yaw = drag.yaw + (e.clientX - drag.x) * 0.3; // all the way round: the back is worth seeing
      const pitch = Math.max(-25, Math.min(25, drag.pitch + (e.clientY - drag.y) * 0.15));
      this.stage.turn(yaw, pitch);
    });
    const end = () => { drag = null; v.classList.remove('is-dragging'); };
    v.addEventListener('pointerup', end);
    v.addEventListener('pointercancel', end);
    new MutationObserver(sync).observe(this.rail, { subtree: true, attributes: true });
  }
}

/** The backdrop's colour at a height (0 top .. 1 bottom), sRGB 0..1, ignoring the light pool. */
function backdropAt(mood: MoodName, y: number): [number, number, number] {
  const a = hexRgb(moods[mood].sky), b = hexRgb(moods[mood].ground);
  return mixColor(a, b, y);
}
const hexRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
const mixColor = (a: number[], b: number[], t: number): [number, number, number] => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];

/** WCAG relative luminance of an sRGB colour (0..1 channels). */
function luminance(rgb: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** 'light' (dark text) or 'dark' (light text): the copy ink with the higher WCAG contrast on this colour. */
function inkFor(rgb: [number, number, number]): 'light' | 'dark' {
  const L = luminance(rgb);
  const onDark = (0.913 + 0.05) / (L + 0.05);   // #F5F5F7
  const onLight = (L + 0.05) / (0.0122 + 0.05); // #1D1D1F
  return onLight > onDark ? 'light' : 'dark';
}

/** The backdrop for a mood: its sky above, its ground below, with a soft pool of light behind the device. */
function backdrop(mood: MoodName): string {
  const m = moods[mood];
  if (m.ink === 'dark') return `linear-gradient(${m.sky}, ${m.ground})`; // a pool on dark grounds bands in 8 bits
  return `radial-gradient(52% 58% at 64% 50%, #FFFFFF8C 0%, #FFFFFF00 72%), linear-gradient(${m.sky}, ${m.ground})`;
}
