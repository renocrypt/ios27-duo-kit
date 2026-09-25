/**
 * Physically based materials for iPhone Duo.
 *
 * Colours and the values that differ per finish come from tokens (device.finish), which carry
 * Apple's AR model material values. The shared surface values below are Apple's too, where its
 * model states a constant ([M]); where it uses a texture map we cannot copy, the value is our
 * reading of that surface ([C]).
 *
 *   createMaterials(finish) -> DuoMaterials
 */
import * as THREE from 'three';
import { tokens } from '../tokens/tokens.ts';

export type Finish = 'starWhite' | 'nightSky';

export interface DuoMaterials {
  frame: THREE.MeshPhysicalMaterial;
  antenna: THREE.MeshPhysicalMaterial;
  rim: THREE.MeshPhysicalMaterial;
  hingeCover: THREE.MeshPhysicalMaterial;
  back: THREE.MeshPhysicalMaterial;
  outerGlass: THREE.MeshPhysicalMaterial;
  lensBezel: THREE.MeshPhysicalMaterial;
  lensHousing: THREE.MeshStandardMaterial;
  lensElement: THREE.MeshPhysicalMaterial;
  lensCover: THREE.MeshPhysicalMaterial;
  flash: THREE.MeshPhysicalMaterial;
  sensor: THREE.MeshPhysicalMaterial;
  buttonFace: THREE.MeshPhysicalMaterial;
  screw: THREE.MeshPhysicalMaterial;
  opening: THREE.MeshStandardMaterial;
  /** Inside faces of open shells (frame, rim), so no view ever sees through the body. */
  interior: THREE.MeshStandardMaterial;
  cavity: THREE.MeshStandardMaterial;
}

export function createMaterials(finish: Finish): DuoMaterials {
  const f = tokens.device.finish[finish];
  const color = (hex: string) => new THREE.Color(hex);
  // [M] metallic 1, roughness 0.05: mirror-polished. We keep a touch more roughness so the thin
  // frame does not alias into sparkles at presentation scale ([C]).
  const frame = new THREE.MeshPhysicalMaterial({ color: color(f.frame), metalness: 1, roughness: 0.09 });
  // [M] metallic 0, roughness 1, clearcoat 0.6 (roughness 0.05): a coated polymer band.
  const antenna = new THREE.MeshPhysicalMaterial({ color: color(f.antenna), metalness: 0, roughness: 0.7, clearcoat: 0.6, clearcoatRoughness: 0.05 });
  // [M] near-black (0.002), metallic 0; roughness is a texture: we read it as satin ([C] 0.5).
  const rim = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.002, 0.002, 0.002, THREE.LinearSRGBColorSpace), metalness: 0, roughness: 0.5 });
  // [M] metallic 1 (0.8 Night Sky); roughness is a texture: bead-blasted ([C] 0.34).
  const hingeCover = new THREE.MeshPhysicalMaterial({ color: color(f.hingeCover), metalness: finish === 'nightSky' ? 0.8 : 1, roughness: 0.34 });
  // Textured matte glass over the colour layer: [M] metallic and clearcoat per finish; roughness is a texture ([C] 0.52).
  const back = new THREE.MeshPhysicalMaterial({
    color: color(f.back), metalness: f.backMetalness, roughness: 0.52,
    clearcoat: f.backClearcoat, clearcoatRoughness: 0.18,
  });
  // Outer display cover glass: [M] black, roughness 1, with a glossy coat ([M] clearcoat 0.25; we use a full coat for glass).
  const outerGlass = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 1, clearcoat: 1, clearcoatRoughness: 0.03 });
  // [M] black metal ring, roughness 0.1.
  const lensBezel = new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 1, roughness: 0.1 });
  // [M] black, roughness 0.8 (the housing), and dark coated elements.
  const lensHousing = new THREE.MeshStandardMaterial({ color: 0x030304, metalness: 0, roughness: 0.8 });
  const lensElement = new THREE.MeshPhysicalMaterial({
    color: 0x04060a, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02,
    iridescence: 1, iridescenceIOR: 1.38, iridescenceThicknessRange: [220, 480], // anti-reflective coating tint [C]
  });
  // [M] the cover glass is clear (opacity 0.01): only its reflection is drawn, added over the housing.
  const lensCover = new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const flash = new THREE.MeshPhysicalMaterial({ color: color(f.flash), metalness: 0.03, roughness: 0.75, clearcoat: 1, clearcoatRoughness: 0.05 }); // [M] + the plateau glass above it
  const sensor = new THREE.MeshPhysicalMaterial({ color: color(f.sensor), metalness: 0.03, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.05 });
  // [M] matte metal face (roughness 1, metallic per finish) under sapphire (roughness 0.01).
  const buttonFace = new THREE.MeshPhysicalMaterial({ color: color(f.buttonFace), metalness: f.buttonFaceMetalness, roughness: 0.8, clearcoat: 1, clearcoatRoughness: 0.02 });
  const screw = new THREE.MeshPhysicalMaterial({ color: color(f.screw), metalness: 1, roughness: 0.15 }); // [M]
  const opening = new THREE.MeshStandardMaterial({ color: 0x020203, metalness: 0, roughness: 0.9 });
  const interior = new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0, roughness: 1, side: THREE.BackSide });
  const cavity = new THREE.MeshStandardMaterial({ color: 0x08090b, metalness: 0, roughness: 0.95 });
  return { frame, antenna, rim, hingeCover, back, outerGlass, lensBezel, lensHousing, lensElement, lensCover, flash, sensor, buttonFace, screw, opening, interior, cavity };
}
