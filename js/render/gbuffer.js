import * as THREE from 'three';

// Multi-pass G-buffer (kept simple on purpose; MRT only if speed ever demands it):
//   geo pass : view-space normal (xyz) + linear view depth in metres (w)   [RGBA32F]
//   id  pass : editId (x), mask (y), line group (z)                          [RGBA32F]
// Both targets are NEAREST-filtered data textures - never tone-mapped or colour-converted.

const geoMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader: /* glsl */`
    varying vec3 vN; varying float vD;
    void main(){
      #include <beginnormal_vertex>
      #include <defaultnormal_vertex>
      #include <begin_vertex>
      #include <project_vertex>
      vN = normalize(transformedNormal);
      vD = -mvPosition.z;
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vN; varying float vD;
    void main(){
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      gl_FragColor = vec4(n, vD);
    }`,
});

function makeIdMat(reg, group) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uEdit: { value: reg.editId & 0x7fffff }, uMask: { value: reg.mask }, uLine: { value: reg.line }, uGroup: { value: group } },
    vertexShader: /* glsl */`
      uniform float uEdit, uMask, uLine, uGroup;
      flat varying vec4 vId;
      void main(){
        #include <begin_vertex>
        #include <project_vertex>
        float inst = 0.0;
        #ifdef USE_INSTANCING
          inst = floor(float(gl_InstanceID) / uGroup);
        #endif
        vId = vec4(uEdit + inst, uMask, uLine, 1.0);
      }`,
    fragmentShader: /* glsl */`
      flat varying vec4 vId;
      void main(){ gl_FragColor = vId; }`,
  });
}

export class GBuffer {
  constructor(renderer) {
    this.renderer = renderer;
    this.idMats = new WeakMap();
  }
  _idMat(mesh) {
    let m = this.idMats.get(mesh);
    if (!m) { m = makeIdMat(mesh.userData.reg, mesh.userData.instGroup ?? 1); this.idMats.set(mesh, m); }
    return m;
  }
  /** Run one pass with every tagged mesh's material swapped. Restores everything afterwards. */
  _pass(scene, camera, target, pickMat) {
    const r = this.renderer;
    const saved = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.noG || !o.userData.reg) { saved.push([o, o.material, o.visible]); o.visible = false; return; }
      saved.push([o, o.material, o.visible]);
      o.material = pickMat(o);
    });
    const prev = { bg: scene.background, env: scene.environment };
    scene.background = null;
    r.setRenderTarget(target);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    r.render(scene, camera);
    scene.background = prev.bg;
    for (const [o, m, v] of saved) { o.material = m; o.visible = v; }
  }
  renderGeo(scene, camera, target) { this._pass(scene, camera, target, () => geoMat); }
  renderId(scene, camera, target) { this._pass(scene, camera, target, (o) => this._idMat(o)); }
}
