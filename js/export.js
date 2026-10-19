import * as THREE from 'three';
import { encodePNG } from './png.js';

export const GENERATOR_VERSION = '0.1.0';
export const DEPTH_MAX_M = 160; // 16-bit depth range: 0..160 m, 65535 = beyond / sky

export function exportSize(state, renderer) {
  const long = state.export.longEdge, a = state.aspect;
  let w = a >= 1 ? long : Math.round(long * a);
  let h = a >= 1 ? Math.round(long / a) : long;
  const max = Math.min(renderer.capabilities.maxTextureSize, renderer.capabilities.maxRenderbufferSize ?? 16384);
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.floor(w * k), Math.floor(h * k), k];
}

/** Save to ./out/<stamp>/<name> through serve.py when available, else browser download. */
async function save(stamp, name, blob) {
  try {
    const r = await fetch(`/save?path=${encodeURIComponent(`out/${stamp}/${name}`)}`, { method: 'POST', body: blob });
    if (r.ok) return 'server';
  } catch {}
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${stamp}_${name}`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'download';
}

/** Renders at full export size and writes: final, line, depth16, depth8, id, mask, meta.json */
export async function exportAll({ pipeline, scene, camera, state, renderer, world, onStatus }) {
  const [W, H, k] = exportSize(state, renderer);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const say = (s) => onStatus?.(s);
  say(`render ${W}x${H}${k < 1 ? ` (clamped x${k.toFixed(2)})` : ''}`);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  pipeline.renderScene(scene, camera, W, H, state.style, world);

  const meta = {
    generator: GENERATOR_VERSION, createdAt: new Date().toISOString(), size: [W, H],
    camera: { ...state.camera, aspect: W / H }, seeds: state.seeds, style: state.style,
    params: state.params, overrides: state.overrides,
    depth: { unit: 'metre', encoding: 'linear distance along camera forward axis', range: [0, DEPTH_MAX_M], png16: '0..65535 maps 0..range (65535 = far/sky); larger = farther' },
    id: { encoding: 'RGB = editId (R low byte, B high byte); editId = hash of stable part name; instanced parts add instance group index' },
    mask: { encoding: 'R = mask category*21 (see registry MASK), G = line group*63' },
  };
  const metaStr = JSON.stringify(meta);
  const asciiMeta = metaStr.replace(/[^\x20-\x7e]/g, '');
  const results = {};

  say('final'); {
    const px = pipeline.readLayer(0);
    for (let i = 3; i < px.length; i += 4) px[i] = 255;
    results.final = await save(stamp, 'final.png', await encodePNG({ width: W, height: H, channels: 4, data: px, meta: asciiMeta }));
  }
  say('lines'); {
    const px = pipeline.readLayer(1);
    results.lines = await save(stamp, 'lines.png', await encodePNG({ width: W, height: H, channels: 4, data: px }));
  }
  say('depth'); {
    const d = pipeline.readDepth();
    const d16 = new Uint16Array(W * H), d8 = new Uint8Array(W * H);
    for (let i = 0; i < d.length; i++) {
      const t = d[i] >= DEPTH_MAX_M ? 1 : Math.max(0, d[i] / DEPTH_MAX_M);
      d16[i] = Math.round(t * 65535);
      d8[i] = 255 - Math.round(Math.sqrt(t) * 255); // preview: near = white
    }
    results.depth16 = await save(stamp, 'depth16.png', await encodePNG({ width: W, height: H, channels: 1, depth: 16, data: d16 }));
    results.depth8 = await save(stamp, 'depth_preview.png', await encodePNG({ width: W, height: H, channels: 1, data: d8 }));
  }
  say('id'); {
    const px = pipeline.readLayer(2);
    const rgb = new Uint8Array(W * H * 3);
    for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2]; }
    results.id = await save(stamp, 'id.png', await encodePNG({ width: W, height: H, channels: 3, data: rgb }));
  }
  say('mask'); {
    const px = pipeline.readLayer(3);
    const rgb = new Uint8Array(W * H * 3);
    for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { rgb[j] = Math.min(255, Math.round(px[i] * 12 / 255 * 21)); rgb[j + 1] = Math.min(255, Math.round(px[i + 1] * 4 / 255 * 63)); }
    results.mask = await save(stamp, 'mask.png', await encodePNG({ width: W, height: H, channels: 3, data: rgb }));
  }
  results.meta = await save(stamp, 'meta.json', new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' }));
  say(`done: out/${stamp}/ (${Object.values(results)[0]})`);
  return { stamp, W, H, results };
}
