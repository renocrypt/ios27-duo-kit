/**
 * DuoDevice: a physically modelled iPhone Duo that folds.
 *
 *   const device = new DuoDevice({ finish: 'starWhite', innerImage, outerImage });
 *   scene.add(device.root);          // millimetres; scale the root (0.001) for metres
 *   device.setFold(Math.PI);         // theta: 0 closed ... π open flat
 *   device.setFinish('nightSky');
 *
 * Structure (device frame, see spec.ts): the two leaves hang from pivot groups on the hinge axis
 * (x = 0, z = pivotHeight). Both leaves are built from the same parts (parts.ts) in the camera
 * leaf's coordinates; the outer-display leaf is the same content mirrored in x. The inner display
 * and the flexible part of its rim live in the root and bend with the fold solution; the hinge
 * cover (spine) stays level and rises toward the axis as the leaves close.
 */
import * as THREE from 'three';
import { DUO } from './spec.ts';
import { displayAt, solveFold, type FoldState } from './fold.ts';
import {
  backPlateGeometry, bumperGeometry, buttonGeometry, frameGeometry, lensGeometries, outlines,
  plateEdgeGeometry, pocketGeometry, spineBottom, spineGeometry, wallDecal,
} from './parts.ts';
import type { Outline } from './outline.ts';
import type { P2 } from './profile.ts';
import { createMaterials, type DuoMaterials, type Finish } from './materials.ts';
import { createScreenMaterial, FoldableScreen } from './screen.ts';

export interface DuoDeviceOptions {
  finish: Finish;
  innerImage: THREE.Texture;
  outerImage: THREE.Texture;
}

const { leaf, hinge, camera, controls: c } = DUO;
const W = leaf.width, T = leaf.thickness, hH = leaf.height / 2, h = hinge.pivotHeight;
const HALF_FOLD = hinge.foldLength / 2;

/**
 * The flexible part of the display rim along the top and bottom edges near the hinge: the rim's
 * inner section swept along the display's fold curve, so it bends with the display.
 */
class FlexRim {
  readonly geometry = new THREE.BufferGeometry();
  private readonly cols: number[];

  constructor(columns: number[], private readonly rows: P2[]) {
    this.cols = columns.filter((s) => Math.abs(s) <= HALF_FOLD + 1e-9);
    const nc = this.cols.length, nr = rows.length, per = nc * nr;
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(per * 2 * 3), 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(per * 2 * 3), 3));
    const index: number[] = [];
    for (const [strip, top] of [[0, true], [1, false]] as const) {
      for (let i = 0; i < nc - 1; i++) {
        for (let k = 0; k < nr - 1; k++) {
          const a = strip * per + i * nr + k, b = a + nr, cc = a + 1, d = b + 1;
          if (top) index.push(a, cc, b, b, cc, d); else index.push(a, b, cc, b, d, cc);
        }
      }
    }
    this.geometry.setIndex(index);
  }

  update(state: FoldState): void {
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const nor = this.geometry.getAttribute('normal') as THREE.BufferAttribute;
    const nc = this.cols.length, nr = this.rows.length, per = nc * nr;
    const tr = new THREE.Vector3(), tc = new THREE.Vector3(), n = new THREE.Vector3();
    this.cols.forEach((s, i) => {
      const { p, n: dn } = displayAt(state, s);
      const tx = dn.z, tz = -dn.x; // display tangent along +s
      for (const [strip, sign] of [[0, 1], [1, -1]] as const) {
        for (let k = 0; k < nr; k++) {
          const [d, z] = this.rows[k];
          pos.setXYZ(strip * per + i * nr + k, p.x + z * dn.x, sign * (hH - d), p.z + z * dn.z);
        }
        for (let k = 0; k < nr; k++) {
          const [d0, z0] = this.rows[Math.max(0, k - 1)], [d1, z1] = this.rows[Math.min(nr - 1, k + 1)];
          tr.set((z1 - z0) * dn.x, -sign * (d1 - d0), (z1 - z0) * dn.z);
          tc.set(tx, 0, tz);
          if (sign > 0) n.crossVectors(tr, tc); else n.crossVectors(tc, tr);
          n.normalize();
          nor.setXYZ(strip * per + i * nr + k, n.x, n.y, n.z);
        }
      }
    });
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}

export class DuoDevice {
  readonly root = new THREE.Group();
  /** Outer-display leaf (x < 0). */
  readonly leftPivot = new THREE.Group();
  /** Camera leaf (x > 0). */
  readonly rightPivot = new THREE.Group();
  readonly inner: FoldableScreen;
  readonly materials: DuoMaterials;
  private readonly spine: THREE.Mesh;
  private readonly flexRim: FlexRim;
  private innerMaterial!: THREE.MeshPhysicalMaterial;
  private outerMaterial!: THREE.MeshPhysicalMaterial;
  private state: FoldState;
  private finish: Finish;
  /** Corner points of each leaf's contents in its pivot's frame, for cheap bounds. */
  private readonly leafCorners: [THREE.Vector3[], THREE.Vector3[]] = [[], []];
  private readonly scratch = new THREE.Vector3();

  constructor(opts: DuoDeviceOptions) {
    this.finish = opts.finish;
    this.materials = createMaterials(opts.finish);
    const m = this.materials;
    this.root.name = 'DuoDevice';

    // Shared leaf geometry, built once.
    const frame = frameGeometry();
    const { rigid: rim, flexRows } = bumperGeometry();
    const pocket = pocketGeometry();
    const plateEdge = plateEdgeGeometry();

    for (const [pivot, side] of [[this.leftPivot, 'left'], [this.rightPivot, 'right']] as const) {
      pivot.name = side === 'left' ? 'OuterDisplayLeaf' : 'CameraLeaf';
      pivot.position.set(0, 0, h);
      const content = new THREE.Group();
      content.position.set(0, 0, -h);
      if (side === 'left') content.scale.x = -1; // same parts, mirrored
      pivot.add(content);
      this.root.add(pivot);
      content.add(
        named(new THREE.Mesh(frame, [m.frame, m.antenna]), 'Frame', true),
        named(new THREE.Mesh(frame, m.interior), 'FrameInside'),
        named(new THREE.Mesh(rim, m.rim), 'Rim', true),
        named(new THREE.Mesh(rim, m.interior), 'RimInside'),
        named(new THREE.Mesh(pocket, m.cavity), 'HingePocket'),
      );
      if (side === 'left') this.buildOuterDisplayLeaf(content, plateEdge, opts.outerImage);
      else this.buildCameraLeaf(content, plateEdge);
    }

    // Inner display: one flexible sheet across both leaves, under the rim.
    const cover = W - DUO.inner.coverInset, coverH = hH - DUO.inner.coverInset;
    const act = DUO.inner.active, ic = DUO.inner.corner, fc = leaf.corners.free;
    const coverCorner = { ax: fc.ax - DUO.inner.coverInset, ay: fc.ay - DUO.inner.coverInset, n: fc.n };
    const allCorners = <C>(k: C) => ({ bl: k, br: k, tr: k, tl: k });
    const rimInner = Math.max(...DUO.bumper.section.map(([d]) => d)); // the rim's inner edge, from the leaf outline
    const coverOutline: Outline = { x0: -cover, y0: -coverH, x1: cover, y1: coverH, corners: allCorners(coverCorner) };
    this.innerMaterial = createScreenMaterial({
      uvToPlane: { origin: [-cover, -coverH], size: [2 * cover, 2 * coverH] },
      active: { x0: -act.width / 2, y0: -act.height / 2, x1: act.width / 2, y1: act.height / 2, corners: allCorners(ic) },
      image: opts.innerImage,
      roughness: 1, clearcoat: 0.8, clearcoatRoughness: 0.12, // foldable cover: a slightly soft gloss [C]
      facing: { reach: W - rimInner, halfHeight: hH - rimInner, rim: h }, // rim line and top (the rims meet at the axis height)
    });
    this.inner = new FoldableScreen(coverOutline, hinge.foldLength, this.innerMaterial);
    this.inner.mesh.name = 'InnerDisplay';
    this.root.add(this.inner.mesh);

    this.flexRim = new FlexRim(this.inner.columns, flexRows);
    const flex = named(new THREE.Mesh(this.flexRim.geometry, m.rim), 'FlexRim');
    const flexInside = named(new THREE.Mesh(this.flexRim.geometry, m.interior), 'FlexRimInside');
    flex.frustumCulled = false; flexInside.frustumCulled = false;
    this.root.add(flex, flexInside);

    this.spine = named(new THREE.Mesh(spineGeometry(), m.hingeCover), 'HingeCover', true);
    this.root.add(this.spine);

    // Each leaf's local bounding corners, taken while everything is flat and unrotated.
    this.root.updateMatrixWorld(true);
    [this.leftPivot, this.rightPivot].forEach((pivot, i) => {
      const box = new THREE.Box3().setFromObject(pivot.children[0], true);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        this.leafCorners[i].push(new THREE.Vector3(x, y, z - h)); // pivot-local
      }
    });

    this.state = solveFold(Math.PI, hinge);
    this.setFold(Math.PI);
  }

  /**
   * World-space bounds from the leaves' corner points and the hinge cover's box instead of every
   * vertex. Call after the root's world matrix is up to date.
   */
  worldBounds(target: THREE.Box3): THREE.Box3 {
    target.makeEmpty();
    const v = this.scratch;
    [this.leftPivot, this.rightPivot].forEach((pivot, i) => {
      for (const corner of this.leafCorners[i]) target.expandByPoint(v.copy(corner).applyMatrix4(pivot.matrixWorld));
    });
    const s = DUO.spine, z0 = this.spine.position.z;
    for (const x of [-s.width / 2, s.width / 2]) for (const y of [-(hH - s.endInset), hH - s.endInset]) for (const z of [z0, z0 + s.depth]) {
      target.expandByPoint(v.set(x, y, z).applyMatrix4(this.root.matrixWorld));
    }
    return target;
  }

  get theta(): number { return this.state.theta; }
  get fold(): FoldState { return this.state; }

  setFold(theta: number): void {
    this.state = solveFold(theta, hinge);
    this.leftPivot.rotation.y = this.state.leafAngle;
    this.rightPivot.rotation.y = -this.state.leafAngle;
    this.inner.update(this.state);
    this.flexRim.update(this.state);
    this.spine.position.z = h + spineBottom(this.state.leafAngle);
    // Closed, the inner panel is off (it would only glow through the gaps); it wakes as the device opens.
    const [w0, w1] = DUO.inner.wake, t = Math.min(1, Math.max(0, ((theta * 180) / Math.PI - w0) / (w1 - w0)));
    this.innerMaterial.emissiveIntensity = t * t * (3 - 2 * t);
  }

  /** Show new images on the displays (for example, the glass compositors' outputs). */
  setScreenImages(inner: THREE.Texture, outer: THREE.Texture): void {
    this.innerMaterial.emissiveMap = inner;
    this.outerMaterial.emissiveMap = outer;
    this.innerMaterial.needsUpdate = true;
    this.outerMaterial.needsUpdate = true;
  }

  setFinish(finish: Finish): void {
    if (finish === this.finish) return;
    const next = createMaterials(finish);
    for (const key of Object.keys(next) as (keyof DuoMaterials)[]) {
      (this.materials[key] as THREE.Material).copy(next[key] as THREE.Material);
      (this.materials[key] as THREE.Material).needsUpdate = true;
    }
    this.finish = finish;
  }

  // ---- Leaves ---------------------------------------------------------------------------------------

  /** The outer-display leaf, authored in camera-leaf coordinates (its content group is mirrored). */
  private buildOuterDisplayLeaf(content: THREE.Group, plateEdge: THREE.BufferGeometry, image: THREE.Texture): void {
    const m = this.materials, o = DUO.outer, b = outlines.back;
    const hc = o.corners.hinge, fc = o.corners.free;
    const active: Outline = {
      x0: o.border.hinge, x1: W - o.border.free, y0: -hH + o.border.bottom, y1: hH - o.border.top,
      corners: { bl: hc, tl: hc, br: fc, tr: fc },
    };
    this.outerMaterial = createScreenMaterial({
      uvToPlane: { origin: [b.x0, b.y0], size: [b.x1 - b.x0, b.y1 - b.y0] },
      active,
      hole: { x: W - o.camera.fromFree, y: hH - o.camera.fromTop, radius: o.camera.cutout / 2 },
      image, roughness: 1, clearcoat: 1, clearcoatRoughness: 0.03, // Ceramic Shield, polished
    });
    content.add(
      named(new THREE.Mesh(backPlateGeometry('display'), this.outerMaterial), 'OuterDisplay'),
      named(new THREE.Mesh(plateEdge, m.outerGlass), 'OuterGlassEdge'),
    );
    // Front camera in the cutout: a dark ring and a coated lens, just behind the glass surface.
    const cam = new THREE.Group();
    cam.position.set(W - o.camera.fromFree, hH - o.camera.fromTop, -T - 0.004);
    const ring = new THREE.Mesh(new THREE.RingGeometry(o.camera.aperture / 2, o.camera.ring / 2, 64), m.lensBezel);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(o.camera.aperture / 2, 48), m.lensElement);
    ring.rotation.x = Math.PI; lens.rotation.x = Math.PI; // face -z
    cam.add(ring, lens);
    content.add(cam);

    // Bottom edge: USB-C between two screws. Top edge: six holes.
    content.add(decal(wallDecal('b', c.usbC.centerFromHinge, c.usbC.z, c.usbC.width, c.usbC.height, 0.1), [m.frame, m.opening], 'USBC'));
    for (const x of c.screws.left) content.add(decal(wallDecal('b', x, c.screws.z, c.screws.diameter, c.screws.diameter, 0.05), [m.opening, m.screw], 'Screw'));
    for (let k = 0; k < c.topHoles.count; k++) {
      const x = c.topHoles.left + k * c.topHoles.pitch;
      content.add(decal(wallDecal('t', x, c.topHoles.z, c.topHoles.diameter, c.topHoles.diameter, c.chamfer), [m.frame, m.opening], 'TopHole'));
    }
  }

  private buildCameraLeaf(content: THREE.Group, plateEdge: THREE.BufferGeometry): void {
    const m = this.materials;
    content.add(
      named(new THREE.Mesh(backPlateGeometry('camera'), m.back), 'BackGlass', true),
      named(new THREE.Mesh(plateEdge, m.back), 'BackGlassEdge'),
    );

    // Cameras on the plateau.
    const p = camera.plateau, top = -T - p.rise;
    const g = lensGeometries();
    for (const fromFree of camera.lens.fromFree) {
      const lens = new THREE.Group();
      lens.add(
        named(new THREE.Mesh(g.ring, m.frame), 'LensRing', true),
        new THREE.Mesh(g.bezel, m.lensBezel),
        new THREE.Mesh(g.housing, m.lensHousing),
        new THREE.Mesh(g.element, m.lensElement),
        new THREE.Mesh(g.cover, m.lensCover),
      );
      lens.rotation.x = -Math.PI / 2; // lathe +y -> device -z (out of the back)
      lens.position.set(W - fromFree, hH - camera.lens.fromTop, top);
      content.add(lens);
    }
    const f = camera.flash;
    const flash = new THREE.Mesh(new THREE.CircleGeometry(f.diameter / 2, 64), m.flash);
    const flashRing = new THREE.Mesh(new THREE.RingGeometry(f.diameter / 2, f.diameter / 2 + 0.06, 64), m.lensHousing);
    for (const mesh of [flash, flashRing]) { mesh.rotation.x = Math.PI; mesh.position.set(W - f.fromFree, hH - f.fromTop, top - 0.003); content.add(mesh); }
    const s = camera.sensor;
    const sensor = new THREE.Mesh(new THREE.ShapeGeometry(stadiumShape(s.width, s.height), 24), m.sensor);
    sensor.rotation.x = Math.PI;
    sensor.position.set(W - s.fromFree, hH - s.fromTop, top - 0.003);
    content.add(sensor);

    // Buttons, each in an opening 0.05 mm larger all round.
    const gap = c.clearance * 2;
    const topEdge = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
    const freeEdge = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
    const button = (geometry: THREE.BufferGeometry, basis: THREE.Matrix4, at: THREE.Vector3, name: string) => {
      const mesh = named(new THREE.Mesh(geometry, [m.frame, m.buttonFace]), name, true);
      mesh.quaternion.setFromRotationMatrix(basis);
      mesh.position.copy(at);
      content.add(mesh);
    };
    const v = c.volume;
    for (let i = 0; i < 2; i++) {
      const x = W - v.fromFree - v.length / 2 - i * (v.length + v.gap);
      button(buttonGeometry(v.length, v.height, v.protrusion), topEdge, new THREE.Vector3(x, hH, c.centerZ), 'Volume');
      content.add(decal(wallDecal('t', x, c.centerZ, v.length + gap, v.height + gap, 0.12), [m.frame, m.opening], 'VolumeOpening'));
    }
    const sb = c.sideButton, sy = hH - sb.fromTop - sb.length / 2;
    button(buttonGeometry(sb.length, sb.height, sb.protrusion, sb.border), freeEdge, new THREE.Vector3(W, sy, c.centerZ), 'SideButton');
    content.add(decal(wallDecal('r', sy, c.centerZ, sb.length + gap, sb.height + gap, 0.12), [m.frame, m.opening], 'SideButtonOpening'));
    const cc = c.cameraControl, cy = -hH + cc.fromBottom + cc.length / 2;
    button(buttonGeometry(cc.length, cc.height, cc.protrusion, cc.border), freeEdge, new THREE.Vector3(W, cy, c.centerZ), 'CameraControl');
    content.add(decal(wallDecal('r', cy, c.centerZ, cc.length + gap, cc.height + gap, 0.12), [m.frame, m.opening], 'CameraControlOpening'));

    // Bottom edge: two rows of four speaker holes, two screws between them.
    for (const first of c.speaker.right) for (let k = 0; k < 4; k++) {
      content.add(decal(wallDecal('b', first + k * c.speaker.pitch, c.speaker.z, c.speaker.diameter, c.speaker.diameter, c.chamfer), [m.frame, m.opening], 'Speaker'));
    }
    for (const x of c.screws.right) content.add(decal(wallDecal('b', x, c.screws.z, c.screws.diameter, c.screws.diameter, 0.05), [m.opening, m.screw], 'Screw'));
  }
}

function named<T extends THREE.Object3D>(o: T, name: string, castShadow = false): T {
  o.name = name;
  o.castShadow = castShadow;
  return o;
}

function decal(geometry: THREE.BufferGeometry, materials: THREE.Material[], name: string): THREE.Mesh {
  return named(new THREE.Mesh(geometry, materials), name);
}

function stadiumShape(width: number, height: number): THREE.Shape {
  const r = height / 2, half = width / 2 - r;
  const s = new THREE.Shape();
  s.absarc(half, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.absarc(-half, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}
