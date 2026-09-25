/**
 * Device screens: each display's interface (a ScreenSurface) runs through a GlassCompositor, lit
 * from the device's real orientation on the stage, and lands on the device's display material.
 *
 *   const screens = new DeviceScreens(renderer, device, { inner, outer });   // ScreenSurfaces
 *   screens.update(keyLightWorld);   // each frame, before rendering the stage; true if anything changed
 *
 * The key light is the studio's key softbox direction in world space. It is carried into each
 * display's own frame (x right, y down, z out of the glass), so the glass highlights move as the
 * device turns or folds, the way Apple's highlights answer device motion (WWDC25 219).
 */
import * as THREE from 'three';
import type { DuoDevice } from '../device/DuoDevice.ts';
import { DUO } from '../device/spec.ts';
import { GlassCompositor } from '../glass/GlassCompositor.ts';
import type { ScreenSurface } from '../surface/ScreenSurface.ts';

export class DeviceScreens {
  readonly inner: GlassCompositor;
  readonly outer: GlassCompositor;
  private changed = true;
  private readonly q = new THREE.Quaternion();
  private readonly axes = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };

  constructor(renderer: THREE.WebGLRenderer, private readonly device: DuoDevice, surfaces: { inner: ScreenSurface; outer: ScreenSurface }) {
    // @2x: the device never covers more screen pixels than that in the presentation.
    this.inner = new GlassCompositor(renderer, { ...DUO.inner.canvas, scale: 2 });
    this.outer = new GlassCompositor(renderer, { ...DUO.outer.canvas, scale: 2 });
    for (const [glass, surface] of [[this.inner, surfaces.inner], [this.outer, surfaces.outer]] as const) {
      glass.setContent(surface.content);
      glass.setForeground(surface.foreground);
      glass.shapes = surface.shapes;
      let view = surface.views;
      surface.onChange = () => {
        glass.shapes = surface.shapes;
        // The first paint of a new view: its controls take their tone from what is under them now.
        if (surface.views !== view) { view = surface.views; glass.resetTones(); } else glass.markContentDirty();
        this.changed = true;
      };
    }
    device.setScreenImages(this.inner.texture, this.outer.texture);
  }

  /** Set each display's glass appearance (0 dark content, 1 light content). */
  setAppearance(inner: number, outer: number): void {
    this.inner.environment.appearance = inner;
    this.outer.environment.appearance = outer;
    this.changed = true;
  }

  /** Relight and re-render the screens if anything changed; returns whether either rendered. */
  update(keyLightWorld: THREE.Vector3): boolean {
    // Inner display: the right leaf's frame is a good proxy for "the screen" (x right, y down, z out).
    this.lightInto(this.inner, this.device.rightPivot, keyLightWorld, false);
    // Outer display: seen from behind, so x is mirrored and z points out of the back.
    this.lightInto(this.outer, this.device.leftPivot, keyLightWorld, true);
    const inner = this.inner.render();
    const outer = this.outer.render();
    const any = inner || outer || this.changed;
    this.changed = false;
    return any;
  }

  private lightInto(glass: GlassCompositor, frame: THREE.Object3D, lightWorld: THREE.Vector3, back: boolean): void {
    frame.getWorldQuaternion(this.q);
    const { x, y, z } = this.axes;
    x.set(back ? -1 : 1, 0, 0).applyQuaternion(this.q);
    y.set(0, -1, 0).applyQuaternion(this.q);
    z.set(0, 0, back ? -1 : 1).applyQuaternion(this.q);
    glass.light.set(lightWorld.dot(x), lightWorld.dot(y), Math.max(0.15, lightWorld.dot(z))).normalize();
  }
}
