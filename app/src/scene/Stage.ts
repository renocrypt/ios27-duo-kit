/**
 * The presentation stage: renderer, studio light moods, contact shadow, a framing camera, and the
 * device with its live screens. Anime.js runs on the same frame loop as Three.js, and the stage
 * renders only when something changed (idle frames cost nothing).
 *
 *   const stage = new Stage(container, { surfaces: { inner, outer } });
 *   await stage.pose('seated');                  // spring the hinge and orientation (motion.spring.hinge)
 *   stage.frame({ azimuth: 20, elevation: 12, fov: 22, fill: 0.6, at: [0.28, 0] });
 *   stage.light('evening');                      // light mood (stage.mood tokens)
 *   stage.explore(true);                         // hand the camera to the viewer
 *
 * Framing: `frame()` looks at the device's centre from an azimuth and elevation, solves the
 * distance so the device fills `fill` of the frame's short axis, and shifts the lens so the
 * device's centre lands at `at` (normalised screen coordinates, -1..1). The solve reruns every
 * frame while the device moves, so a fold never pushes the device out of its framing.
 *
 * The canvas is transparent: the page draws the backdrop (CSS), the stage draws the device and
 * its ground shadow.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { animate, engine, spring, type JSAnimation } from 'animejs';
import { DuoDevice } from '../device/DuoDevice.ts';
import type { Finish } from '../device/materials.ts';
import { tokens, springs } from '../tokens/tokens.ts';
import { EnvironmentMixer, KEY_LIGHT_POSITION, studioEnvironment } from './environment.ts';
import { DeviceScreens } from './screens.ts';
import { ContactShadow } from './contactShadow.ts';
import { orientation, POSTURES, type PostureName } from './postures.ts';
import type { ScreenSurface } from '../surface/ScreenSurface.ts';

const MM = 0.001;

export type MoodName = keyof typeof tokens.stage.mood;
export interface Mood { sky: string; ground: string; ink: 'light' | 'dark'; env: 'neutral' | 'warm' | 'cool'; intensity: number; exposure: number; turn: number; shadow: number; floor: string; floorStrength: number }
export const moods = tokens.stage.mood as unknown as Record<MoodName, Mood>;
/** Light colour of each studio variant (key, fill, top). [C] */
const LIGHT_TINT: Record<Mood['env'], string> = { neutral: '#FFFFFF', warm: '#FFE3C8', cool: '#D6E4FF' };

export interface Shot {
  /** Degrees about the vertical, 0 = in front of the device. */
  azimuth: number;
  /** Degrees above the horizon. */
  elevation: number;
  /** Vertical field of view, degrees. */
  fov: number;
  /** Fraction of the frame's short axis the device fills. */
  fill: number;
  /** Where the device's centre sits on screen, normalised (-1..1, x right, y up). */
  at: [number, number];
  /** Largest width the device may take, as a fraction of the frame's width. Default 0.9. */
  maxW?: number;
}

export interface StageOptions {
  finish?: Finish;
  surfaces: { inner: ScreenSurface; outer: ScreenSurface };
}

type Transition = 'spring' | 'settle' | 'cut';

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(22, 1, 0.01, 20);
  readonly controls: OrbitControls;
  readonly device: DuoDevice;
  readonly screens: DeviceScreens;
  private readonly shadow: ContactShadow;
  private readonly floor: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  private posture: PostureName = 'closed';
  private readonly state = { theta: 0, hover: POSTURES.closed.hover, quaternion: new THREE.Quaternion() };
  private readonly shot: Shot = { azimuth: 0, elevation: 8, fov: tokens.stage.camera.fov.default, fill: tokens.stage.camera.fill, at: [0, 0] };
  /** Each mood's studio, built when first lit; the mixer blends them into the live map. */
  private readonly envs = new Map<MoodName, THREE.Texture>();
  private readonly mixer: EnvironmentMixer;
  private poseAnim?: JSAnimation;
  private shotAnim?: JSAnimation;
  private lightAnim?: JSAnimation;
  private exploring = false;
  /** A turn by hand on top of the posture (degrees): yaw about the vertical, pitch about the camera's right. */
  private readonly handTurn = { yaw: 0, pitch: 0 };
  private turnAnim?: JSAnimation;
  private readonly box = new THREE.Box3();
  private readonly centre = new THREE.Vector3();
  private needsRender = true;
  private poseChanged = true;
  private readonly keyLight = KEY_LIGHT_POSITION.clone().normalize();
  private readonly keyWorld = new THREE.Vector3();
  /**
   * The studio turns with the camera, as the backdrop does (it is fixed to the viewport): the set
   * stays behind the device and the off-camera studio behind the lens. `lightTurn` (degrees, from
   * the mood) turns the lights about the device relative to the camera.
   */
  private lightTurn = 0;
  /** Frames actually rendered, for profiling. */
  renders = 0;

  constructor(private readonly container: HTMLElement, opts: StageOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = tokens.stage.exposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);

    this.mixer = new EnvironmentMixer(this.renderer, this.env('morning'));
    this.scene.environment = this.mixer.texture;
    // Build the other moods' studios in idle time, one per slot, so no transition waits on one.
    const pending = Object.keys(moods) as MoodName[];
    const prebuild = () => { const name = pending.shift(); if (!name) return; this.env(name); requestIdleCallback(prebuild); };
    requestIdleCallback(prebuild);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 1.2;
    this.controls.addEventListener('change', () => { this.needsRender = true; });

    this.shadow = new ContactShadow({ size: 0.6, far: 0.2, blur: 3.2, darkness: tokens.stage.shadow });
    this.scene.add(this.shadow.group);
    this.floor = groundPool();
    this.scene.add(this.floor);

    this.device = new DuoDevice({ finish: opts.finish ?? 'starWhite', innerImage: opts.surfaces.inner.content, outerImage: opts.surfaces.outer.content });
    this.device.root.scale.setScalar(MM);
    this.scene.add(this.device.root);
    this.device.setFold(0);
    this.state.quaternion.copy(orientation('closed', this.device.fold));
    this.screens = new DeviceScreens(this.renderer, this.device, opts.surfaces);
    this.place();

    engine.useDefaultMainLoop = false; // one clock: Anime.js advances inside the Three.js frame loop
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  get current(): PostureName { return this.posture; }

  /** Spring (or cut) to a posture: fold angle, orientation, and floating height. */
  pose(name: PostureName, how: Transition = 'spring'): Promise<void> {
    this.poseAnim?.pause();
    const from = { theta: this.state.theta, hover: this.state.hover, quaternion: this.state.quaternion.clone() };
    const target = POSTURES[name];
    const to = { theta: THREE.MathUtils.degToRad(target.theta), hover: target.hover };
    this.posture = name;
    const set = (t: number) => {
      this.state.theta = THREE.MathUtils.lerp(from.theta, to.theta, t);
      this.state.hover = THREE.MathUtils.lerp(from.hover, to.hover, t);
      this.device.setFold(this.state.theta);
      this.state.quaternion.slerpQuaternions(from.quaternion, orientation(name, this.device.fold), t);
      this.place();
    };
    if (how === 'cut') { set(1); return Promise.resolve(); }
    const progress = { t: 0 };
    return new Promise((resolve) => {
      this.poseAnim = animate(progress, {
        t: 1,
        ease: spring({ bounce: springs.hinge.bounce, duration: springs.hinge.duration }),
        onUpdate: () => set(progress.t),
        onComplete: () => resolve(),
      });
    });
  }

  /** Move the camera to a shot: spring-settle, or cut. */
  frame(shot: Partial<Shot>, how: Transition = 'settle'): Promise<void> {
    this.shotAnim?.pause();
    const target: Shot = { ...this.shot, ...shot, at: [...(shot.at ?? this.shot.at)] as [number, number] };
    if (how === 'cut') { Object.assign(this.shot, target); this.needsRender = true; return Promise.resolve(); }
    const s = how === 'spring' ? springs.hinge : springs.cameraSettle;
    const from = { ...this.shot, at: [...this.shot.at] as [number, number] };
    const progress = { t: 0 };
    return new Promise((resolve) => {
      this.shotAnim = animate(progress, {
        t: 1,
        ease: spring({ bounce: s.bounce, duration: s.duration }),
        onUpdate: () => {
          const t = progress.t, l = THREE.MathUtils.lerp;
          this.shot.azimuth = l(from.azimuth, target.azimuth, t);
          this.shot.elevation = l(from.elevation, target.elevation, t);
          this.shot.fov = l(from.fov, target.fov, t);
          this.shot.fill = l(from.fill, target.fill, t);
          this.shot.at = [l(from.at[0], target.at[0], t), l(from.at[1], target.at[1], t)];
          this.shot.maxW = l(from.maxW ?? 0.9, target.maxW ?? 0.9, t);
          this.needsRender = true;
        },
        onComplete: () => resolve(),
      });
    });
  }

  /** The studio for a mood: its light tint, and a room in its backdrop's colours. */
  private env(name: MoodName): THREE.Texture {
    let texture = this.envs.get(name);
    if (!texture) {
      const m = moods[name];
      texture = studioEnvironment(this.renderer, tokens.stage.light, { key: LIGHT_TINT[m.env], sky: m.sky, ground: m.ground });
      this.envs.set(name, texture);
    }
    return texture;
  }

  /** Light the stage for a mood: the environment, its strength and the floor ease together. */
  light(name: MoodName, how: Transition = 'settle'): void {
    const m = moods[name];
    this.lightAnim?.pause();
    const target = this.env(name);
    this.mixer.hold();
    const u = this.floor.material.uniforms;
    const floorFrom = u.uColor.value.clone(), floorTo = new THREE.Color(m.floor);
    const from = { intensity: this.scene.environmentIntensity, exposure: this.renderer.toneMappingExposure, turn: this.lightTurn, floor: u.uStrength.value as number, mix: 0 };
    const apply = (v: typeof from) => {
      u.uStrength.value = v.floor;
      u.uColor.value.copy(floorFrom).lerp(floorTo, v.mix);
      this.mixer.blend(this.mixer.held, target, v.mix);
      this.scene.environmentIntensity = v.intensity;
      this.renderer.toneMappingExposure = v.exposure;
      this.lightTurn = v.turn;
      this.needsRender = true;
    };
    this.shadow.darkness = m.shadow;
    this.poseChanged = true;
    const to = { intensity: m.intensity, exposure: m.exposure, turn: m.turn, floor: m.floorStrength, mix: 1 };
    if (how === 'cut') { apply(to); return; }
    const v = { ...from };
    this.lightAnim = animate(v, { ...to, ease: spring({ bounce: 0, duration: 900 }), onUpdate: () => apply(v) });
  }

  /** Turn the device by hand (degrees). `spring` eases it there; otherwise it follows at once. */
  turn(yaw: number, pitch: number, how: Transition = 'cut'): void {
    this.turnAnim?.pause();
    if (how === 'cut') { this.handTurn.yaw = yaw; this.handTurn.pitch = pitch; this.place(); return; }
    this.turnAnim = animate(this.handTurn, {
      yaw, pitch, ease: spring({ bounce: springs.smooth.bounce, duration: springs.smooth.duration }), onUpdate: () => this.place(),
    });
  }

  get turned(): { yaw: number; pitch: number } { return { ...this.handTurn }; }

  /** Set the light between two moods at t (0..1), at once: for light that follows the scroll. */
  lightMix(a: MoodName, b: MoodName, t: number): void {
    this.lightAnim?.pause();
    const ma = moods[a], mb = moods[b], l = THREE.MathUtils.lerp;
    this.mixer.blend(this.env(a), this.env(b), t);
    this.scene.environmentIntensity = l(ma.intensity, mb.intensity, t);
    this.renderer.toneMappingExposure = l(ma.exposure, mb.exposure, t);
    this.lightTurn = l(ma.turn, mb.turn, t);
    this.shadow.darkness = l(ma.shadow, mb.shadow, t);
    const u = this.floor.material.uniforms;
    u.uStrength.value = l(ma.floorStrength, mb.floorStrength, t);
    u.uColor.value.set(ma.floor).lerp(new THREE.Color(mb.floor), t);
    this.poseChanged = true;
    this.needsRender = true;
  }

  /** Hand the camera to the viewer (orbit), or take it back. */
  explore(on: boolean): void {
    this.exploring = on;
    this.controls.enabled = on;
    if (on) {
      this.camera.clearViewOffset();
      this.controls.target.copy(this.centre);
    }
    this.needsRender = true;
  }

  setFinish(finish: Finish): void { this.device.setFinish(finish); this.needsRender = true; }

  invalidate(): void { this.needsRender = true; }

  /** Rest the device's lowest point on the ground, or float it; keep its centre for framing. */
  private place(): void {
    const root = this.device.root;
    root.position.set(0, 0, 0);
    root.quaternion.copy(this.state.quaternion);
    if (this.handTurn.yaw || this.handTurn.pitch) {
      const az = THREE.MathUtils.degToRad(this.shot.azimuth);
      const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(this.handTurn.yaw))
        .multiply(new THREE.Quaternion().setFromAxisAngle(right, THREE.MathUtils.degToRad(this.handTurn.pitch)));
      root.quaternion.premultiply(q);
    }
    root.updateMatrixWorld(true);
    this.device.worldBounds(this.box);
    const c = this.box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -this.box.min.y + this.state.hover * MM, -c.z);
    root.updateMatrixWorld(true);
    this.device.worldBounds(this.box);
    this.box.getCenter(this.centre);
    this.floor.position.set(this.centre.x, 0, this.centre.z);
    this.poseChanged = true;
    this.needsRender = true;
  }

  /** Solve the camera for the current shot and device bounds. */
  private solveCamera(): void {
    const { azimuth, elevation, fov, fill, at } = this.shot;
    const az = THREE.MathUtils.degToRad(azimuth), el = THREE.MathUtils.degToRad(elevation);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right);
    const tan = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const aspect = this.camera.aspect;
    const corners: THREE.Vector3[] = [];
    const { min, max } = this.box;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push(new THREE.Vector3(x, y, z).sub(this.centre));
    // Projected half-extents (normalised) at distance d; solve d for the fill on the short axis.
    const spans = (d: number) => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const q of corners) {
        const depth = d - q.dot(dir);
        const px = q.dot(right) / (depth * tan * aspect), py = q.dot(camUp) / (depth * tan);
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      return { w: (x1 - x0) / 2, h: (y1 - y0) / 2 };
    };
    const shortIsVertical = aspect >= 1;
    let lo = 0.02, hi = 20;
    for (let i = 0; i < 40; i++) {
      const d = (lo + hi) / 2, s = spans(d);
      const tooBig = (shortIsVertical ? s.h : s.w) > fill || s.w > (this.shot.maxW ?? 0.9) || s.h > 0.9;
      if (tooBig) lo = d; else hi = d;
    }
    const d = hi;
    this.camera.fov = fov;
    this.camera.position.copy(this.centre).addScaledVector(dir, d);
    this.camera.up.copy(up);
    this.camera.lookAt(this.centre);
    this.camera.near = Math.max(0.005, d * 0.2);
    this.camera.far = d * 4;
    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera.setViewOffset(w, h, (-at[0] * w) / 2, (at[1] * h) / 2, w, h);
    this.camera.updateProjectionMatrix();
  }

  /** Turn the studio to the camera (see `lightTurn`); the screens' glass follows its key light. */
  private orientStudio(): void {
    const c = this.camera.position;
    const azimuth = this.exploring ? Math.atan2(c.x - this.centre.x, c.z - this.centre.z) : THREE.MathUtils.degToRad(this.shot.azimuth);
    const y = azimuth + THREE.MathUtils.degToRad(this.lightTurn);
    if (y === this.scene.environmentRotation.y && this.keyWorld.lengthSq()) return;
    this.scene.environmentRotation.y = y;
    this.keyWorld.copy(this.keyLight).applyAxisAngle(new THREE.Vector3(0, 1, 0), y);
    this.needsRender = true;
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  private tick(): void {
    engine.update();                                        // runs any active transition
    if (this.exploring && this.controls.update()) this.needsRender = true;
    this.orientStudio();
    if (this.screens.update(this.keyWorld.lengthSq() ? this.keyWorld : this.keyLight)) this.needsRender = true;
    if (!this.needsRender) return;
    if (!this.exploring) this.solveCamera();
    if (this.poseChanged) {
      this.floor.visible = false; // the ground itself casts nothing
      this.shadow.render(this.renderer, this.scene);
      this.floor.visible = true;
      this.poseChanged = false;
    }
    this.renderer.render(this.scene, this.camera);
    this.needsRender = false;
    this.renders++;
  }
}

/**
 * A pool of light on the ground under the device, for dark moods: a soft radial falloff, dithered
 * so it does not band in 8 bits, fading to nothing so the page's backdrop shows around it.
 */
function groundPool(): THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(0x000000) }, uStrength: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float a = uStrength * pow(1.0 - smoothstep(0.0, 1.0, r), 2.2);
        a += (hash(gl_FragCoord.xy) - 0.5) / 255.0;          // dither
        gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 96).rotateX(-Math.PI / 2), material);
  mesh.renderOrder = -1;
  mesh.name = 'GroundPool';
  return mesh;
}
