/**
 * Contact shadow: renders the scene's depth from below the ground into a small target, blurs it,
 * and lays it on the ground as a soft shadow that darkens where objects touch. Adapted from the
 * three.js contact-shadow example (webgl_shadow_contact).
 *
 *   const shadow = new ContactShadow({ size: 0.5, far: 0.12, blur: 2.4, darkness: 0.55 });
 *   scene.add(shadow.group);
 *   shadow.render(renderer, scene);   // before the main render, on frames where the pose changed
 */
import * as THREE from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

export interface ContactShadowOptions { size: number; far: number; blur: number; darkness: number; resolution?: number }

export class ContactShadow {
  readonly group = new THREE.Group();
  private readonly target: THREE.WebGLRenderTarget;
  private readonly blurTarget: THREE.WebGLRenderTarget;
  private readonly camera: THREE.OrthographicCamera;
  private readonly depthMaterial: THREE.MeshDepthMaterial;
  private readonly blurPlane: THREE.Mesh;
  private readonly hBlur: THREE.ShaderMaterial;
  private readonly vBlur: THREE.ShaderMaterial;

  constructor(private readonly opts: ContactShadowOptions) {
    const res = opts.resolution ?? 1024;
    this.target = new THREE.WebGLRenderTarget(res, res);
    this.target.texture.generateMipmaps = false;
    this.blurTarget = new THREE.WebGLRenderTarget(res, res);
    this.blurTarget.texture.generateMipmaps = false;

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.size, opts.size).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.target.texture, transparent: true, depthWrite: false }));
    plane.renderOrder = 1;
    plane.scale.y = -1; // the shadow camera looks up, so flip the image back
    this.group.add(plane);

    this.blurPlane = new THREE.Mesh(new THREE.PlaneGeometry(opts.size, opts.size).rotateX(Math.PI / 2));
    this.blurPlane.visible = false;
    this.group.add(this.blurPlane);

    this.camera = new THREE.OrthographicCamera(-opts.size / 2, opts.size / 2, opts.size / 2, -opts.size / 2, 0, opts.far);
    this.camera.rotation.x = Math.PI / 2; // look up from the ground
    this.group.add(this.camera);

    this.depthMaterial = new THREE.MeshDepthMaterial();
    this.depthMaterial.userData.darkness = { value: opts.darkness };
    this.depthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = this.depthMaterial.userData.darkness;
      shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
        'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );')}`;
    };
    this.depthMaterial.depthTest = false;
    this.depthMaterial.depthWrite = false;

    this.hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
    this.hBlur.depthTest = false;
    this.vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    this.vBlur.depthTest = false;
  }

  set darkness(v: number) { this.depthMaterial.userData.darkness.value = v; }

  private blur(renderer: THREE.WebGLRenderer, amount: number) {
    this.blurPlane.visible = true;
    this.blurPlane.material = this.hBlur;
    this.hBlur.uniforms.tDiffuse.value = this.target.texture;
    this.hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(this.blurTarget);
    renderer.render(this.blurPlane, this.camera);
    this.blurPlane.material = this.vBlur;
    this.vBlur.uniforms.tDiffuse.value = this.blurTarget.texture;
    this.vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(this.target);
    renderer.render(this.blurPlane, this.camera);
    this.blurPlane.visible = false;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const background = scene.background;
    const override = scene.overrideMaterial;
    this.group.visible = false;
    scene.background = null;
    scene.overrideMaterial = this.depthMaterial;
    const clear = renderer.getClearAlpha();
    renderer.setClearAlpha(0);
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, this.camera);
    scene.overrideMaterial = override;
    this.group.visible = true;
    this.blur(renderer, this.opts.blur);
    this.blur(renderer, this.opts.blur * 0.4); // a second, finer pass removes banding
    renderer.setRenderTarget(null);
    renderer.setClearAlpha(clear);
    scene.background = background;
  }
}
