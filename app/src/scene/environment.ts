/**
 * A procedural photo studio for image-based lighting: softboxes, strip lights and black flags in a
 * cyclorama, rendered once into a PMREM environment map. Polished metal and glass show what they
 * reflect, so the lighting is designed like a product shoot: a large key, a gentle fill, overhead
 * and rim strips that draw long highlights along the frame, and dark cards that give its edges
 * definition. No image assets.
 *
 *   scene.environment = studioEnvironment(renderer, { key, fill, rim, top });
 *   studioEnvironment(renderer, lights, { key: '#FFE3C8', sky: '#2B2119', ground: '#0E0A07' })
 *
 * The room has two halves, and is turned with the camera (+z toward the lens):
 *   - the set, behind the device: the backdrop the viewer sees, walls in its sky colour and floor
 *     in its ground colour, so what the device reflects there agrees with what surrounds it (a
 *     dark set gives dark reflections and bright strips; a light set, the bright cyclorama that
 *     makes polished light finishes read light);
 *   - the studio, behind the camera and never in frame: walls at least `lights.studio` bright, so
 *     a polished edge on a black set still draws its outline, with a black flag around the lens
 *     so a screen facing the camera stays black.
 * `key` tints the lights (key, fill, top); the rim strips stay white.
 *
 *   EnvironmentMixer   blends prefiltered maps texel by texel (a PMREM is linear in radiance, so
 *                      the blend of two is the map of the blended room), for light that changes
 *                      continuously between moods
 */
import * as THREE from 'three';

export interface StudioLights { key: number; fill: number; rim: number; top: number; bounce: number; studio: number }

/** Where the key softbox sits; its direction also lights the screens' glass. */
export const KEY_LIGHT_POSITION = new THREE.Vector3(-4, 3.5, 4);

export interface StudioSet {
  /** Light colour (key, fill, top). */
  key?: THREE.ColorRepresentation;
  /** Wall colour (the backdrop's sky), sRGB. */
  sky?: THREE.ColorRepresentation;
  /** Floor colour (the backdrop's ground), sRGB. */
  ground?: THREE.ColorRepresentation;
}

function softbox(width: number, height: number, radiance: number, tint: THREE.ColorRepresentation = 0xffffff): THREE.Mesh {
  // A radial falloff inside the box keeps highlights soft-edged, like a diffused softbox.
  const c = new THREE.Color(tint);
  const material = new THREE.ShaderMaterial({
    uniforms: { uRadiance: { value: new THREE.Vector3(c.r, c.g, c.b).multiplyScalar(radiance) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uRadiance; varying vec2 vUv;
      void main(){ vec2 d = abs(vUv - 0.5) * 2.0; float e = 1.0 - smoothstep(0.7, 1.0, max(d.x, d.y));
        gl_FragColor = vec4(uRadiance * (0.35 + 0.65 * e), 1.0); }`,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

export function studioEnvironment(renderer: THREE.WebGLRenderer, lights: StudioLights, set: StudioSet = {}): THREE.Texture {
  const scene = new THREE.Scene();
  // Room: a cyclorama in the set's colours (ColorManagement makes these linear), brightest toward
  // the ceiling and shaded toward the floor straight down, so polished edges keep a gradient.
  const sky = new THREE.Color(set.sky ?? 0xffffff), ground = new THREE.Color(set.ground ?? 0xffffff);
  const room = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uSky: { value: new THREE.Vector3(sky.r, sky.g, sky.b) }, uGround: { value: new THREE.Vector3(ground.r, ground.g, ground.b) },
      uStudio: { value: lights.studio },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uSky; uniform vec3 uGround; uniform float uStudio; varying vec3 vDir; void main(){
      vec3 d = normalize(vDir);
      vec3 floorShade = uGround * mix(0.3, 0.7, smoothstep(-0.9, -0.05, d.y)); // floor: darker straight down
      vec3 wall = uSky * mix(0.75, 1.0, smoothstep(0.0, 0.7, d.y));           // walls to ceiling
      vec3 set = d.y < 0.0 ? floorShade : wall;
      // Behind the camera: the studio, no darker than the set; black within ~25 degrees of the lens.
      float lens = smoothstep(0.83, 0.93, d.z);
      vec3 studio = max(set, vec3(uStudio * mix(0.5, 1.0, smoothstep(-0.6, 0.6, d.y)) * (1.0 - lens)));
      gl_FragColor = vec4(mix(set, studio, smoothstep(-0.2, 0.4, d.z)), 1.0); }`,
  }));
  scene.add(room);

  const place = (mesh: THREE.Mesh, position: [number, number, number]) => {
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };
  const key = set.key ?? 0xffffff;
  place(softbox(4.5, 3.2, lights.key, key), KEY_LIGHT_POSITION.toArray()); // key, upper left front
  place(softbox(5, 3, lights.fill, key), [5, 1.2, 3.5]);  // fill, right
  place(softbox(0.6, 7, lights.rim), [-5.5, 1.5, -3]);    // rim strip, back left
  place(softbox(0.6, 7, lights.rim), [5.5, 1.5, -3]);     // rim strip, back right
  place(softbox(9, 1.6, lights.bounce, key), [0, -2.2, 6]); // bounce card, low in front: the near edges' line
  const top = softbox(8, 0.7, lights.top, key);           // overhead strip
  top.position.set(0, 6, 0.5);
  top.rotation.x = Math.PI / 2;
  scene.add(top);
  // Black flags: tall dark cards beside and behind the set. Mirror-polished metal needs something
  // dark to reflect, or its edges vanish into the white.
  const flag = (w: number, h: number, position: [number, number, number]) =>
    place(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide })), position);
  flag(2.2, 8, [-6.5, 0.5, 1.5]);
  flag(2.2, 8, [6.5, 0.5, 0.5]);
  flag(6, 2.2, [0, 1, -7]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  return target.texture;
}

/**
 * Blends prefiltered environment maps (PMREM, cube-UV layout) into one live map, texel by texel.
 * The live map's identity never changes, so materials keep their programs; a blend is one
 * full-screen pass over a small half-float texture.
 *
 *   const mixer = new EnvironmentMixer(renderer, anyPmrem);
 *   scene.environment = mixer.texture;
 *   mixer.blend(a, b, t);     // live = a + (b - a) t
 *   mixer.hold();             // copy live aside, then blend(mixer.held, next, t) eases from it
 */
export class EnvironmentMixer {
  private readonly live: THREE.WebGLRenderTarget;
  private readonly aside: THREE.WebGLRenderTarget;
  private readonly material: THREE.ShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(private readonly renderer: THREE.WebGLRenderer, like: THREE.Texture) {
    const { width, height } = like.image as { width: number; height: number };
    const target = () => {
      const t = new THREE.WebGLRenderTarget(width, height, {
        magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false,
        type: THREE.HalfFloatType, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: false,
      });
      t.texture.mapping = THREE.CubeUVReflectionMapping;
      t.texture.name = 'PMREM.cubeUv';
      return t;
    };
    this.live = target();
    this.aside = target();
    this.material = new THREE.ShaderMaterial({
      uniforms: { uA: { value: null }, uB: { value: null }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D uA; uniform sampler2D uB; uniform float uT; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(uA, vUv), texture2D(uB, vUv), uT); }',
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.blend(like, like, 0);
  }

  get texture(): THREE.Texture { return this.live.texture; }
  /** The map set aside by `hold()`. */
  get held(): THREE.Texture { return this.aside.texture; }

  blend(a: THREE.Texture, b: THREE.Texture, t: number, into: THREE.WebGLRenderTarget = this.live): void {
    const u = this.material.uniforms;
    u.uA.value = a; u.uB.value = b; u.uT.value = t;
    const previous = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(into);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(previous);
  }

  /** Set the live map aside, to ease from it. */
  hold(): void { this.blend(this.live.texture, this.live.texture, 0, this.aside); }

  dispose(): void { this.live.dispose(); this.aside.dispose(); this.material.dispose(); }
}
