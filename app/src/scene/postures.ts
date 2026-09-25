/**
 * Apple's named iPhone Duo postures as fold angles and world orientations.
 *
 * Angles are ASSUMPTIONS (Apple publishes none; see the 3D-approach note). Orientation maps the
 * device frame (x across the fold, y along the hinge, z out of the inner display) into the world
 * (y up, camera looking down -z). Resting postures sit on the ground; held postures float.
 *
 *   const pose = posePose('seated', theta);   // { quaternion, hover }
 */
import * as THREE from 'three';
import type { FoldState } from '../device/fold.ts';

export type PostureName = 'open' | 'book' | 'seated' | 'standing' | 'closed';

export interface Posture {
  label: string;
  /** Interior angle in degrees (ASSUMPTION). */
  theta: number;
  /** Floating height of the lowest point above the ground in mm; 0 = resting on it. */
  hover: number;
  /** Extra turn about world y, degrees, for a three-quarter view. */
  yaw: number;
}

export const POSTURES: Record<PostureName, Posture> = {
  // Yaw stays 0: the camera's azimuth (Stage shots) chooses the view, the posture only places the device.
  open: { label: 'Open', theta: 180, hover: 34, yaw: 0 },
  book: { label: 'Book', theta: 122, hover: 34, yaw: 0 },
  seated: { label: 'Seated', theta: 112, hover: 0, yaw: 0 },
  standing: { label: 'Standing', theta: 62, hover: 0, yaw: 0 },
  closed: { label: 'Closed', theta: 0, hover: 34, yaw: 0 },
};

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

/** Rotation taking device basis vectors (a, b, c) to world vectors (A, B, C). Both must be right-handed. */
function mapBasis(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3) {
  const device = new THREE.Matrix4().makeBasis(a, b, c);
  const world = new THREE.Matrix4().makeBasis(A, B, C);
  return new THREE.Quaternion().setFromRotationMatrix(world.multiply(device.transpose()));
}

/** Device-to-world orientation for a posture at the current fold. */
export function orientation(name: PostureName, fold: FoldState): THREE.Quaternion {
  let q: THREE.Quaternion;
  switch (name) {
    case 'seated': {
      // The outer-display leaf lies on the ground, free edge toward the viewer; the camera leaf rises behind.
      const { t, n } = fold.left;
      q = mapBasis(new THREE.Vector3(t.x, 0, t.z), Y.clone().negate(), new THREE.Vector3(n.x, 0, n.z), Z, X, Y);
      break;
    }
    case 'standing':
      // Tent: hinge on top, free edges on the ground, outer display facing the viewer.
      q = mapBasis(X, Y, Z, Z.clone().negate(), X, Y.clone().negate());
      break;
    case 'closed':
      // Outer display toward the viewer, upright.
      q = mapBasis(X, Y, Z, Z.clone().negate(), Y, X);
      break;
    default:
      q = new THREE.Quaternion();
  }
  const yaw = new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(POSTURES[name].yaw));
  return yaw.multiply(q);
}
