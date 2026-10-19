import * as THREE from 'three';
import { getMat, getSignMat } from '../materials.js';
import { box } from './util.js';

/** Overhead hanging LED guidance boards (generic wording). Hung under the roof beams on rods. */
export function buildSigns(ctx, roof) {
  const { group, seeds, P } = ctx;
  const S = P.signs;
  if (!S.show) return;
  const steel = getMat(seeds, 'steel');
  const H = P.platform.height;
  const boards = [
    { id: 'main', kind: 'main', x: 2.4, z: S.zMain, w: 3.0, h: 0.8 },
    { id: 'exitL', kind: 'exit', x: -1.9, z: S.zMain - 17, w: 1.5, h: 0.62 },
    { id: 'exitR', kind: 'exit', x: 2.4, z: S.zMain - 17, w: 1.5, h: 0.62 },
  ];
  for (const b of boards) {
    const top = roof.undersideY(b.x) - 0.4;           // below the cross beams
    const cy = Math.min(top - 0.55 - b.h / 2, H + 3.25 + b.h / 2);
    const mat = getSignMat(seeds, b.kind);
    const body = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.6, metalness: 0.4 });
    // faces: +z and -z show the panel, rest dark housing
    const m = box(group, b.w, b.h, 0.16, [body, body, body, body, mat, mat], b.x, cy, b.z, { name: `sign.${b.id}`, mask: 'fixture', line: 'detail' });
    m.castShadow = true;
    for (const sx of [-1, 1]) box(group, 0.04, top - (cy + b.h / 2), 0.04, steel, b.x + sx * (b.w / 2 - 0.2), (top + cy + b.h / 2) / 2, b.z, { name: `sign.${b.id}.rod${sx}`, mask: 'fixture', line: 'detail' });
  }
}
