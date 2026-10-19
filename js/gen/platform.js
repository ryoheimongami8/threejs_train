import * as THREE from 'three';
import { getMat } from '../materials.js';
import { rngFor } from '../rng.js';
import { box, decal } from './util.js';

/** Island platform: slab, side walls, edge line, tactile strips, decals. */
export function buildPlatform(ctx) {
  const { group, seeds, P } = ctx;
  const { halfWidth: hw, height: H, length: L, zStart } = P.platform;
  const zMid = zStart - L / 2;
  const zEnd = zStart - L;
  const floor = getMat(seeds, 'floor');

  // top slab (0.15 thick) + body
  box(group, hw * 2, 0.15, L, floor, 0, H - 0.075, zMid, { name: 'platform.top', mask: 'floor', line: 'ground' }, { tile: 4 });
  const concrete = getMat(seeds, 'concrete');
  box(group, hw * 2, H, L, concrete, 0, H / 2 - 0.15, zMid, { name: 'platform.body', mask: 'floor', line: 'ground' }, { tile: 2, cast: true });
  // lower the body slightly so top slab owns the visible top face
  group.children[group.children.length - 1].scale.set(0.999, 0.97, 1);

  // --- painted / tactile layout (measured against photo o3433) ---
  const orange = getMat(seeds, 'orange');
  const tact = getMat(seeds, 'tactile'); tact.userData.tileM = 0.45;
  const yel = getMat(seeds, 'yellowLine');
  const y = H + 0.004;
  const zA = zStart - 0.5, zB = zEnd + 1.5, zc = (zA + zB) / 2, Ls = zA - zB;
  for (const s of [-1, 1]) decal(group, 0.16, L, s * (hw - 0.1), y, zMid, orange, `platform.edge${s}`, 'ground');
  // wide tactile band on the left edge only (right edge is plain, as in the photo)
  decal(group, 0.62, Ls, -(hw - 1.2), y, zc, tact, 'platform.tactileL', 'ground');
  // inner dotted strip on the right with yellow borders
  const xi = hw - 2.1;
  const tactD = getMat(seeds, 'tactileDark'); tactD.userData.tileM = 0.4;
  decal(group, 0.46, Ls, xi, y, zc, tactD, 'platform.tactileInner', 'ground');
  decal(group, 0.05, Ls, xi - 0.28, y, zc, yel, 'platform.innerBorderL', 'ground');
  // thin yellow line on the left, inside the wide strip
  decal(group, 0.05, Ls, -(hw - 1.6), y, zc, yel, 'platform.leftLine', 'ground');
  // L-shaped cross line near the middle distance
  decal(group, 1.55, 0.16, xi - 0.45, y, -5.5, yel, 'platform.crossLine', 'ground');
  decal(group, 0.16, 1.4, xi - 1.2, y, -4.8, yel, 'platform.crossLine2', 'ground');
  // end patch
  decal(group, hw * 2, 1.4, 0, y, zEnd + 1, getMat(seeds, 'dark'), 'platform.endPatch', 'ground');

  // inlays: dark rectangles with a pale border (asphalt repairs / maintenance covers)
  const inlays = [[0.9, -1.6, 1.5, 2.3], [-0.9, -4.2, 1.1, 1.7], [0.3, -9.0, 2.2, 1.4], [-1.2, 2.0, 1.2, 0.9], [2.35, -0.6, 0.45, 1.6]];
  inlays.forEach(([x, z, w, d], i) => {
    decal(group, w + 0.12, d + 0.12, x, y, z, getMat(seeds, 'inlayLight'), `platform.inlayB${i}`, 'ground');
    decal(group, w, d, x, y + 0.001, z, getMat(seeds, 'inlayDark'), `platform.inlay${i}`, 'ground');
  });

  // unit-paver zone in the foreground (running-bond bricks)
  const paver = getMat(seeds, 'paver');
  paver.userData.tileM = 1.1;
  decal(group, 1.3, 5.8, 0.1, y + 0.002, 4.5, paver, 'platform.paver', 'ground');

  // generic signage decals (text is not copied from any real station)
  decal(group, 1.0, 0.65, -1.0, y + 0.003, 3.9, getMat(seeds, 'signWomen'), 'platform.signWomen', 'ground');
  decal(group, 0.95, 0.7, -1.45, y + 0.003, 4.9, getMat(seeds, 'signGreen'), 'platform.signGreen', 'ground');
  decal(group, 0.55, 0.55, 2.3, y + 0.003, -2.4, getMat(seeds, 'signGreen2'), 'platform.signGreen2', 'ground');
  return { zEnd };
}
