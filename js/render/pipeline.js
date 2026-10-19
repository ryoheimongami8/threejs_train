import * as THREE from 'three';
import { GBuffer } from './gbuffer.js';
import { makeComposite } from './post.js';
import { MODE_INDEX } from './styles.js';

/** beauty -> geo -> id -> composite. Same code path for preview and export. */
export class Pipeline {
  constructor(renderer) {
    this.r = renderer;
    this.gb = new GBuffer(renderer);
    this.comp = makeComposite(renderer);
    this.size = [0, 0];
    this.rt = {};
  }

  _targets(w, h) {
    if (this.size[0] === w && this.size[1] === h) return;
    for (const t of Object.values(this.rt)) t.dispose();
    const data = { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false };
    this.rt.color = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    this.rt.geo = new THREE.WebGLRenderTarget(w, h, data);
    this.rt.id = new THREE.WebGLRenderTarget(w, h, data);
    this.rt.out = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
    this.size = [w, h];
  }

  _applyStyle(style, world) {
    const u = this.comp.mat.uniforms;
    u.uMode.value = MODE_INDEX[style.mode] ?? 1;
    u.uExposure.value = style.exposure; u.uSat.value = style.saturation; u.uTint.value = style.shadowTint;
    u.uHaze.value = style.haze; u.uBloom.value = style.bloom ?? 0; u.uAO.value = style.ao ?? 0; u.uHazeStart.value = style.hazeStart ?? 0; u.uBands.value = style.bands; u.uLineStrength.value = style.lineStrength;
    u.uLineWidth.value = style.lineWidth; u.uCrease.value = style.creaseThr; u.uDepth.value = style.depthThr;
    if (world?.sky) u.uHazeColor.value.set(world.sky.haze);
  }

  /** Render the 3 scene passes at w x h. */
  renderScene(scene, camera, w, h, style, world) {
    const r = this.r;
    this._targets(w, h);
    this._applyStyle(style, world);
    const prevTM = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(this.rt.color);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(scene, camera);
    this.gb.renderGeo(scene, camera, this.rt.geo);
    this.gb.renderId(scene, camera, this.rt.id);
    r.toneMapping = prevTM;
    const u = this.comp.mat.uniforms;
    u.tColor.value = this.rt.color.texture; u.tGeo.value = this.rt.geo.texture; u.tId.value = this.rt.id.texture;
    u.uRes.value.set(w, h);
    u.uFocal.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }

  /** composite to the canvas (preview) */
  present() {
    const r = this.r;
    this.comp.mat.uniforms.uOut.value = 0;
    r.setRenderTarget(null);
    r.render(this.comp.scene, this.comp.cam);
  }

  /** composite one layer into rt.out and read it back (Uint8 RGBA, bottom-up flipped to top-down) */
  readLayer(outMode) {
    const [w, h] = this.size;
    this.comp.mat.uniforms.uOut.value = outMode;
    this.r.setRenderTarget(this.rt.out);
    this.r.render(this.comp.scene, this.comp.cam);
    const buf = new Uint8Array(w * h * 4);
    this.r.readRenderTargetPixels(this.rt.out, 0, 0, w, h, buf);
    this.r.setRenderTarget(null);
    return flipY(buf, w, h, 4);
  }

  /** linear view depth (metres) as Float32, top-down */
  readDepth() {
    const [w, h] = this.size;
    const buf = new Float32Array(w * h * 4);
    this.r.readRenderTargetPixels(this.rt.geo, 0, 0, w, h, buf);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = buf[((h - 1 - y) * w + x) * 4 + 3];
    return out;
  }
}

function flipY(buf, w, h, ch) {
  const row = w * ch, out = new Uint8Array(buf.length);
  for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  return out;
}
