import * as THREE from 'three';
import { state, subscribe, setPath, emit, needsRebuild, loadLocal, replaceState, exportJSON, defaultState } from './state.js';
import { buildWorld, updateLighting } from './gen/world.js';
import { Pipeline } from './render/pipeline.js';
import { STYLE_PRESETS } from './render/styles.js';
import { applyCamera, PhotoOverlay, PHOTOS, saveCameraFor, loadCameraFor } from './cameraMatch.js';
import { exportAll, exportSize } from './export.js';
import { SKY_PRESETS } from './params.js';
import { h, section, slider, select, check, number, button, register } from './ui.js';

loadLocal();

const stage = document.getElementById('stage');
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, state.aspect, 0.1, 2000);
const pipeline = new Pipeline(renderer);
const pmrem = new THREE.PMREMGenerator(renderer);
let envTex = null;
/** image-based light from the stylised sky (+ warm ground): gives metals something to reflect, softens ambient */
function updateEnv() {
  if (!world) return;
  const tmp = new THREE.Scene();
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), world.skyMat);
  skyMesh.frustumCulled = false; skyMesh.renderOrder = -10;
  const ground = new THREE.Mesh(new THREE.SphereGeometry(650, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(world.sky.hemiGround).multiplyScalar(0.7), side: THREE.BackSide }));
  tmp.add(skyMesh, ground);
  envTex?.dispose();
  envTex = pmrem.fromScene(tmp, 0, 1, 2000).texture;
  scene.environment = envTex; scene.environmentIntensity = 0.26;
  skyMesh.geometry.dispose(); ground.geometry.dispose(); ground.material.dispose();
}
let world = null;
let dirty = true;
const overlay = new PhotoOverlay(stage, canvas, camera);

// ---------- scene ----------
function rebuild() {
  if (world) {
    scene.remove(world.group);
    world.group.traverse((o) => { o.geometry?.dispose?.(); });
  }
  const t0 = performance.now();
  world = buildWorld(state);
  scene.add(world.group);
  console.log(`world built in ${(performance.now() - t0).toFixed(0)} ms`);
  refreshPillarList();
  updateEnv();
  dirty = true;
}

// ---------- layout: aspect-locked canvas ----------
const PREVIEW_MAX = 1800;
function layout() {
  const bw = stage.clientWidth, bh = stage.clientHeight;
  const a = state.aspect;
  let cw = bw, ch = bw / a;
  if (ch > bh) { ch = bh; cw = bh * a; }
  canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
  for (const el of [overlay.img, overlay.mark]) { el.style.width = `${cw}px`; el.style.height = `${ch}px`; }
  const k = Math.min(1, PREVIEW_MAX / Math.max(cw, ch) / (window.devicePixelRatio || 1));
  const pw = Math.max(2, Math.round(cw * (window.devicePixelRatio || 1) * k));
  const ph = Math.max(2, Math.round(pw / a));
  renderer.setPixelRatio(1);
  renderer.setSize(pw, ph, false);
  pipeline.previewSize = [pw, ph];
  dirty = true;
}
new ResizeObserver(layout).observe(stage);

function frame() {
  requestAnimationFrame(frame);
  if (!dirty || !world) return;
  dirty = false;
  applyCamera(camera);
  const [w, hh] = pipeline.previewSize ?? [canvas.width, canvas.height];
  pipeline.renderScene(scene, camera, w, hh, state.style, world);
  pipeline.present();
  overlay.draw();
  updateRefErrors();
}

// ---------- mouse: drag = look, wheel = dolly, shift+drag = pan ----------
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, shift: e.shiftKey }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  const c = state.camera;
  if (drag.shift) {
    const k = 0.005 * Math.max(1, c.z * 0.15);
    const yaw = THREE.MathUtils.degToRad(c.yaw);
    c.x -= Math.cos(yaw) * dx * k; c.z += Math.sin(yaw) * dx * k; c.y += dy * k;
  } else {
    const k = c.fov / canvas.clientHeight;
    c.yaw += dx * k; c.pitch += dy * k;
    c.pitch = Math.max(-80, Math.min(80, c.pitch));
  }
  emit('camera');
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const c = state.camera, yaw = THREE.MathUtils.degToRad(c.yaw), step = -e.deltaY * 0.01;
  c.x += -Math.sin(yaw) * step; c.z += -Math.cos(yaw) * step;
  emit('camera');
}, { passive: false });

// ---------- panel ----------
const panel = document.getElementById('panel');
const status = h('div', { class: 'status' }, 'ready');

const styleSec = section('Style (material + light + line + grade)',
  h('div', { class: 'btnrow' }, Object.keys(STYLE_PRESETS).map((k) => button(k, () => { state.style = { ...state.style, ...STYLE_PRESETS[k] }; emit('style'); }))),
  slider('exposure', 'style.exposure', 0.3, 2.5, 0.01),
  slider('saturation', 'style.saturation', 0.4, 1.8, 0.01),
  slider('shadow tint', 'style.shadowTint', 0, 1, 0.01),
  slider('haze', 'style.haze', 0, 2, 0.01),
  slider('haze start (m)', 'style.hazeStart', 0, 150, 1),
  slider('bloom', 'style.bloom', 0, 1.5, 0.01),
  slider('contact AO', 'style.ao', 0, 1, 0.01),
  slider('toon bands', 'style.bands', 2, 6, 1),
  slider('line strength', 'style.lineStrength', 0, 1, 0.01),
  slider('line width', 'style.lineWidth', 0.5, 4, 0.1),
  slider('crease thr', 'style.creaseThr', 0.05, 0.9, 0.01),
  slider('depth thr', 'style.depthThr', 0.005, 0.2, 0.001),
);
const lightSec = section('Light / sky',
  select('sky', 'params.light.skyPreset', Object.keys(SKY_PRESETS)),
  slider('sun azimuth', 'params.light.azimuth', -180, 180, 1),
  slider('sun elevation', 'params.light.elevation', 3, 85, 1),
  slider('sun intensity', 'params.light.intensity', 0, 8, 0.05),
);
const camSec = section('Camera',
  slider('x', 'camera.x', -10, 10, 0.01), slider('y (eye)', 'camera.y', 0.5, 8, 0.01), slider('z', 'camera.z', -30, 40, 0.01),
  slider('yaw', 'camera.yaw', -90, 90, 0.05), slider('pitch', 'camera.pitch', -45, 45, 0.05), slider('fov', 'camera.fov', 15, 110, 0.1),
  h('div', { class: 'btnrow' },
    button('photo view', () => { state.camera = { x: 0.15, y: 2.5, z: 9.8, yaw: 0, pitch: 8, fov: 58 }; emit('camera'); }),
    button('train view', () => { state.camera = { x: 0.4, y: 2.5, z: 9.8, yaw: -2.5, pitch: 5, fov: 58 }; emit('camera'); }),
    button('open view', () => { state.camera = { x: 1.9, y: 2.5, z: 9.8, yaw: -3, pitch: 6, fov: 58 }; emit('camera'); }),
  ),
  check('aspect lock (photo)', 'aspectLock'),
  number('aspect', 'aspect', 0.001),
);
const photoSec = section('Reference photo',
  select('photo', 'photo.name', PHOTOS, (name) => {
    const img = new Image();
    img.onload = () => { if (state.aspectLock) setPath('aspect', img.naturalWidth / img.naturalHeight); loadCameraFor(name); layout(); };
    img.src = `photo/${name}`;
  }),
  check('overlay', 'photo.show'),
  slider('opacity', 'photo.opacity', 0, 1, 0.01),
  h('div', { class: 'btnrow' },
    button('save camera for photo', () => { saveCameraFor(state.photo.name); status.textContent = `camera saved for ${state.photo.name}`; }),
    button('load', () => loadCameraFor(state.photo.name) || (status.textContent = 'no saved camera')),
  ),
);
const refList = h('div', { class: 'reflist' });
const refSec = section('Reference points (match camera)',
  h('div', { class: 'note' }, 'Add point → click it on the photo → enter its world xyz (m). Cyan = model projection, red = photo. Error px shown.'),
  refList,
  button('+ add point', () => { state.refPoints.push({ name: `p${state.refPoints.length + 1}`, uv: null, world: [0, 0, 0] }); emit('refPoints'); }),
);
function renderRefs() {
  refList.replaceChildren(...state.refPoints.map((rp, i) => {
    const num = (k) => h('input', { type: 'number', step: 0.05, value: rp.world[k], onchange: (e) => { rp.world[k] = parseFloat(e.target.value); emit('refPoints'); } });
    return h('div', { class: 'ref' },
      h('input', { type: 'text', value: rp.name, onchange: (e) => { rp.name = e.target.value; emit('refPoints'); } }),
      num(0), num(1), num(2),
      button(rp.uv ? 'repick' : 'pick', () => { overlay.picking = i; state.photo.show = true; emit('photo'); status.textContent = 'click the point on the photo'; }),
      h('span', { class: 'err', 'data-i': i }, ''),
      button('×', () => { state.refPoints.splice(i, 1); emit('refPoints'); }),
    );
  }));
}
function updateRefErrors() {
  refList.querySelectorAll('.err').forEach((s) => { const e = overlay.errors?.[+s.dataset.i]; s.textContent = e == null ? '' : `${e.toFixed(1)}px`; });
}

const ruleSec = section('Rules (generation)',
  slider('platform half width', 'params.platform.halfWidth', 2, 7, 0.05),
  slider('platform height', 'params.platform.height', 0.5, 1.3, 0.01),
  slider('pillar count', 'params.pillars.count', 1, 12, 1),
  slider('pillar spacing', 'params.pillars.spacing', 4, 20, 0.1),
  slider('pillar x', 'params.pillars.x', -3, 3, 0.05),
  slider('pillar z0', 'params.pillars.z0', -10, 20, 0.1),
  slider('pillar height', 'params.pillars.height', 3, 6.5, 0.05),
  slider('roof half width', 'params.roof.halfWidth', 2.5, 8, 0.05),
  slider('roof pitch', 'params.roof.pitch', 0, 0.3, 0.005),
  slider('track offset', 'params.track.offset', 1.2, 3, 0.01),
  slider('track curve', 'params.track.curve', 0, 0.003, 0.00005),
  check('train', 'params.train.show'),
  select('train stripe', 'params.train.stripe', ['orange', 'yellow', 'sky']),
  slider('train cars', 'params.train.cars', 1, 3, 1),
  slider('train front z', 'params.train.zFront', -45, 0, 0.5),
  check('overhead guide signs', 'params.signs.show'),
  slider('sign z', 'params.signs.zMain', -40, 4, 0.5),
  slider('pole spacing', 'params.poles.spacing', 10, 60, 0.5),
  slider('trees left', 'params.env.treesLeft', 0, 40, 1),
  slider('trees right', 'params.env.treesRight', 0, 40, 1),
);
const seedSec = section('Seeds (stage-wise)',
  ...['shape', 'layout', 'finish', 'props'].map((k) => h('div', { class: 'row' }, h('span', { class: 'lab' }, k), number('', `seeds.${k}`, 1).querySelector('input'), button('roll', () => setPath(`seeds.${k}`, Math.floor(Math.random() * 99999))))),
);
const pillarList = h('div', { class: 'pilllist' });
const ovrSec = section('Per-part overrides (pillars)', pillarList);
function refreshPillarList() {
  if (!world) return;
  const ids = Array.from({ length: state.params.pillars.count }, (_, i) => `P${String(i).padStart(2, '0')}`);
  pillarList.replaceChildren(...ids.map((id) => {
    const o = (state.overrides.pillars[id] ??= {});
    const n = (k) => h('input', { type: 'number', step: 0.1, value: o[k] ?? 0, onchange: (e) => { o[k] = parseFloat(e.target.value) || 0; emit('overrides'); } });
    const rm = h('input', { type: 'checkbox', onchange: (e) => { o.remove = e.target.checked; emit('overrides'); } }); rm.checked = !!o.remove;
    return h('div', { class: 'ref' }, h('b', {}, id), 'dx', n('dx'), 'dz', n('dz'), 'del', rm);
  }));
}

const exportSec = section('Export / project',
  select('long edge px', 'export.longEdge', ['1920', '2560', '3840', '5120', '7680'].map(String)),
  h('div', { class: 'note', id: 'expinfo' }),
  h('div', { class: 'btnrow' },
    button('Export layers', async () => {
      try {
        await exportAll({ pipeline, scene, camera, state, renderer, world, onStatus: (s) => { status.textContent = s; } });
      } catch (e) { status.textContent = 'export failed: ' + e.message; console.error(e); }
      layout(); dirty = true;
    }, 'primary'),
  ),
  h('div', { class: 'btnrow' },
    button('save project', () => { const a = h('a', { href: URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })), download: 'station_project.json' }); a.click(); }),
    button('load project', () => { const i = h('input', { type: 'file', accept: '.json', onchange: async (e) => { replaceState(JSON.parse(await e.target.files[0].text())); } }); i.click(); }),
    button('reset', () => { if (confirm('reset all settings?')) replaceState(defaultState()); }),
  ),
);
panel.append(styleSec, lightSec, camSec, photoSec, refSec, ruleSec, seedSec, ovrSec, exportSec, status);
register(renderRefs);
register(() => {
  const [w, hh, k] = exportSize(state, renderer);
  const el = document.getElementById('expinfo');
  if (el) el.textContent = `${w} x ${hh}${k < 1 ? ` (clamped x${k.toFixed(2)} by GPU limit)` : ''}`;
});

// ---------- wiring ----------
subscribe((path) => {
  if (needsRebuild(path)) rebuild();
  else if (path.startsWith('params.light')) { updateLighting(world, state.params.light); updateEnv(); }
  if (path === 'aspect' || path === '*') layout();
  overlay.refresh();
  dirty = true;
});

rebuild();
layout();
overlay.refresh();
frame();
window.__app = { state, setPath, emit, scene, camera, renderer, pipeline, get world() { return world; }, layout, overlay, exportAll: () => exportAll({ pipeline, scene, camera, state, renderer, world, onStatus: (s) => { status.textContent = s; } }) };
