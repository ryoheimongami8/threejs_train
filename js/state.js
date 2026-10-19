import { DEFAULT_PARAMS } from './params.js';
import { STYLE_PRESETS } from './render/styles.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const LS_KEY = 'stationPlatform.project.v1';

export const defaultCamera = () => ({ x: 0.15, y: 2.5, z: 9.8, yaw: 0, pitch: 8, fov: 58 });

export function defaultState() {
  return {
    version: 1,
    seeds: { shape: 1, layout: 2, finish: 3, props: 4 },
    params: clone(DEFAULT_PARAMS),
    // per-part overrides, keyed by stable part id (e.g. P00): {dx,dz,remove,...}
    overrides: { pillars: {}, fixtures: {} },
    style: { ...STYLE_PRESETS.painterly },
    camera: defaultCamera(),
    // saved cameras per reference photo
    cameras: {},
    photo: { name: 'o3433247515091178067.jpg', opacity: 0.5, show: false },
    aspect: 3433 / 2475,
    aspectLock: true,
    refPoints: [], // {name, uv:[0..1,0..1], world:[x,y,z]}
    export: { longEdge: 3840 },
  };
}

export const state = defaultState();
const subs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
export function emit(path) { for (const fn of subs) fn(path); scheduleSave(); }

export function getPath(path) { return path.split('.').reduce((o, k) => o?.[k], state); }
export function setPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const obj = keys.reduce((o, k) => (o[k] ??= {}), state);
  obj[last] = value;
  emit(path);
}

/** Does this path change geometry (needs world rebuild)? */
export function needsRebuild(path) {
  return (/^(params|seeds|overrides)/.test(path) && !path.startsWith('params.light')) || path === '*';
}

let saveTimer = 0;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }, 300);
}
export function loadLocal() {
  try { const s = localStorage.getItem(LS_KEY); if (s) replaceState(JSON.parse(s), false); } catch {}
}
export function replaceState(obj, notify = true) {
  const d = defaultState();
  // shallow-merge sections so older saves still load after new fields appear
  for (const k of Object.keys(d)) {
    if (obj[k] === undefined) continue;
    state[k] = (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) ? { ...d[k], ...obj[k] } : obj[k];
  }
  for (const k of ['platform', 'track', 'pillars', 'roof', 'poles', 'env', 'light', 'train', 'signs']) {
    state.params[k] = { ...d.params[k], ...(obj.params?.[k] ?? {}) };
  }
  if (notify) emit('*');
}
export const exportJSON = () => JSON.stringify(state, null, 2);

/** per-photo camera memory */
export function saveCameraFor(name) { state.cameras[name] = { ...state.camera }; emit('cameras'); }
export function loadCameraFor(name) { if (state.cameras[name]) { state.camera = { ...state.cameras[name] }; emit('camera'); return true; } return false; }
