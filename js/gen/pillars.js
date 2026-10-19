import { getMat } from '../materials.js';
import { box, decal } from './util.js';

/** Stable-ID pillars. Rule: evenly spaced; overrides: {dx, dz, remove}. Returns position list for dependants. */
export function buildPillars(ctx) {
  const { group, seeds, P, overrides } = ctx;
  const pp = P.pillars;
  const mat = getMat(seeds, 'pillarDirt');
  const steel = getMat(seeds, 'steel');
  const list = [];
  for (let i = 0; i < pp.count; i++) {
    const id = `P${String(i).padStart(2, '0')}`;
    const ov = overrides.pillars[id] ?? {};
    if (ov.remove) continue;
    const x = pp.x + (ov.dx ?? 0);
    const z = pp.z0 - i * pp.spacing + (ov.dz ?? 0);
    const h = pp.height;
    const H = P.platform.height;
    // main H-section look: web + two flanges
    box(group, pp.width, h, pp.depth, mat, x, H + h / 2, z, { name: `${id}.shaft`, mask: 'pillar', line: 'struct' });
    box(group, pp.width + 0.18, 0.12, pp.depth + 0.18, steel, x, H + 0.06, z, { name: `${id}.base`, mask: 'pillar', line: 'detail' });
    box(group, pp.width + 0.3, 0.16, pp.depth + 0.3, steel, x, H + h - 0.05, z, { name: `${id}.cap`, mask: 'pillar', line: 'detail' });
    // vertical bracket plate on the +x face (cable guard)
    box(group, 0.06, h * 0.62, 0.22, getMat(seeds, 'steel'), x + pp.width / 2 + 0.04, H + h * 0.48, z, { name: `${id}.guard`, mask: 'pillar', line: 'detail' });
    decal(group, 1.5, 1.3, x, H + 0.006, z + 0.1, getMat(seeds, 'footGrime'), `${id}.grime`, 'none');
    list.push({ id, x, z, top: H + h });
  }
  return list;
}
