import * as THREE from 'three';
import { getMat } from '../materials.js';
import { rngFor } from '../rng.js';
import { tag } from '../registry.js';
import { box, tube } from './util.js';

/**
 * Roof-underside equipment. Everything hangs off a pillar ID (or the bay after it), never an array index.
 * Overrides: overrides.fixtures[fixtureId] = {remove, dx, dy, dz}.
 */
export function buildFixtures(ctx, pillars, roof) {
  const { group, seeds, P, overrides } = ctx;
  const mats = (n) => getMat(seeds, n);
  const ovr = (id) => overrides.fixtures[id] ?? {};
  const live = (id) => !ovr(id).remove;
  const off = (id, x, y, z) => { const o = ovr(id); return [x + (o.dx ?? 0), y + (o.dy ?? 0), z + (o.dz ?? 0)]; };
  const sp = P.pillars.spacing;
  const beamBottom = (x) => roof.undersideY(x) - 0.38; // below cross beams

  // ---------- fluorescent lamp: housing, glow slot, dark end caps, two hanger rods ----------
  const lamp = (id, lx, lz) => {
    if (!live(id)) return;
    const [x, , z] = off(id, lx, 0, lz);
    const top = beamBottom(x);
    const y = top - 0.5 + (ovr(id).dy ?? 0);
    box(group, 0.32, 0.13, 1.9, mats('lampBody'), x, y, z, { name: id, mask: 'fixture', line: 'detail' });
    box(group, 0.24, 0.03, 1.78, mats('lampGlow'), x, y - 0.08, z, { name: id + '.glow', mask: 'fixture', line: 'none' }, { cast: false });
    for (const s of [-1, 1]) {
      box(group, 0.34, 0.15, 0.08, mats('dark'), x, y, z + s * 0.97, { name: `${id}.cap${s}`, mask: 'fixture', line: 'detail' });
      box(group, 0.035, top - y, 0.035, mats('steel'), x, (top + y) / 2, z + s * 0.6, { name: `${id}.rod${s}`, mask: 'fixture', line: 'detail' });
    }
  };

  // ---------- electrical panel: cabinet, doors, vents, skirt, brackets, roof hangers ----------
  const panel = (p) => {
    const id = `${p.id}.panel`;
    if (!live(id)) return;
    const [x, y, z] = off(id, p.x + 1.3, p.top - 1.05, p.z);
    box(group, 2.5, 0.6, 0.82, mats('panelDirt'), x, y, z, { name: id, mask: 'fixture', line: 'struct' });
    for (const s of [-0.6, 0.6]) {
      box(group, 1.0, 0.42, 0.03, mats('box'), x + s, y, z + 0.42, { name: `${id}.door${s}`, mask: 'fixture', line: 'detail' });
      box(group, 0.06, 0.1, 0.05, mats('dark'), x + s * 0.2, y, z + 0.45, { name: `${id}.handle${s}`, mask: 'fixture', line: 'none' }, { cast: false });
    }
    box(group, 2.6, 0.07, 0.92, mats('steel'), x, y - 0.33, z, { name: id + '.skirt', mask: 'fixture', line: 'detail' });
    box(group, 2.3, 0.05, 0.7, mats('steel'), x, y + 0.33, z, { name: id + '.lid', mask: 'fixture', line: 'detail' });
    // louvres
    for (let i = 0; i < 4; i++) box(group, 0.5, 0.025, 0.02, mats('dark'), x + 0.9, y - 0.1 + i * 0.06, z - 0.42, { name: `${id}.louvre${i}`, mask: 'fixture', line: 'none' }, { cast: false });
    // arm from the pillar + hangers up to the beams
    box(group, 1.0, 0.1, 0.12, mats('steel'), p.x + 0.5, y + 0.05, z, { name: id + '.arm', mask: 'fixture', line: 'detail' });
    for (const hx of [-0.9, 0.9]) {
      const rx = x + hx, rt = beamBottom(rx), rb = y + 0.36;
      box(group, 0.05, rt - rb, 0.05, mats('steel'), rx, (rt + rb) / 2, z, { name: `${id}.hang${hx}`, mask: 'fixture', line: 'detail' });
    }
    // conduit from the cabinet side to the pillar
    tube(group, [[x - 1.25, y + 0.1, z + 0.15], [x - 1.5, y + 0.1, z + 0.2], [p.x + 0.2, y - 0.1, z + 0.28]], 0.035, mats('pipe'), { name: id + '.conduit', mask: 'fixture', line: 'detail' }, { seg: 8, radial: 6 });
    return { x, y, z, top: y + 0.33 };
  };

  pillars.forEach((p, k) => {
    const r = rngFor(seeds, 'props', p.id);
    const pn = panel(p);

    // heavy black cable bundle dropping from the roof onto the cabinet
    const cid = `${p.id}.cable`;
    if (live(cid) && pn) {
      const y0 = beamBottom(p.x + 0.4);
      [[0.05, 0, 0.0], [0.035, 0.12, 0.06], [0.03, -0.1, 0.1]].forEach(([rad, dx, dz], i) => {
        const [x, , z] = off(cid, p.x + 0.35 + dx, 0, p.z - 0.3 + dz);
        tube(group, [[x, y0, z], [x + 0.05, y0 - 0.5, z + 0.35], [x + 0.45, pn.top + 0.35, z + 0.55], [x + 0.55, pn.top + 0.02, z + 0.3]], rad, mats('cable'), { name: `${cid}${i}`, mask: 'fixture', line: 'detail' }, { seg: 16, radial: 6 });
      });
      // looping drop beside the pillar
      tube(group, [[p.x - 0.12, y0, p.z + 0.2], [p.x - 0.24, y0 - 0.8, p.z + 0.2], [p.x - 0.25, y0 - 1.6, p.z + 0.19], [p.x - 0.24, y0 - 2.4, p.z + 0.19]], 0.026, mats('cable'), { name: cid + '.loop', mask: 'fixture', line: 'detail' }, { seg: 16, radial: 6 });
    }

    // white drain/utility pipes: left run with elbows, right run mirrored, short vertical riser at the pillar
    const pid = `${p.id}.pipe`;
    if (live(pid)) {
      const y0 = beamBottom(p.x) - 0.2;
      const [x, y, z] = off(pid, p.x, y0, p.z - 0.5);
      tube(group, [[x, y, z], [x - 1.8, y, z], [x - 3.2, y - 0.06, z], [x - 3.45, y - 0.55, z], [x - 3.45, y - 1.0, z]], 0.075, mats('pipe'), { name: pid, mask: 'fixture', line: 'detail' }, { seg: 32, radial: 8 });
      tube(group, [[x + 0.3, y - 0.05, z + 0.9], [x + 1.9, y - 0.12, z + 0.9], [x + 3.2, y - 0.2, z + 0.9], [x + 3.55, y - 0.5, z + 0.9], [x + 3.55, y - 0.95, z + 0.9]], 0.065, mats('pipe'), { name: pid + 'R', mask: 'fixture', line: 'detail' }, { seg: 32, radial: 8 });
      tube(group, [[p.x + 0.6, y + 0.2, p.z - 0.25], [p.x + 0.6, y - 1.5, p.z - 0.25]], 0.055, mats('pipe'), { name: pid + '.riser', mask: 'fixture', line: 'detail' }, { seg: 4, radial: 8 });
      box(group, 0.28, 0.24, 0.18, mats('steel'), p.x + 0.6, y - 1.6, p.z - 0.25, { name: pid + '.jbox', mask: 'fixture', line: 'detail' });
    }

    // hanging black cable loops along the bay (3 per bay)
    const zNext = p.z - sp;
    for (let c = 0; c < 3 && live(`${p.id}.loops${c}`); c++) {
      const cx = p.x + [-1.9, -0.8, 1.9][c] + r.range(-0.1, 0.1);
      const y0 = beamBottom(cx) - 0.1;
      const sag = r.range(0.35, 0.8);
      tube(group, [[cx, y0, p.z - 0.4], [cx, y0 - sag * 0.8, p.z - sp * 0.25], [cx, y0 - sag, p.z - sp * 0.5], [cx, y0 - sag * 0.8, p.z - sp * 0.75], [cx, y0, zNext + 0.4]], 0.022, mats('cable'), { name: `${p.id}.loops${c}`, mask: 'wire', line: 'none' }, { seg: 20, radial: 4, cast: false });
    }

    // lamps: pair in the bay after each pillar; plus a pair in the bay in front of the first pillar
    for (const side of [-1, 1]) {
      const sfx = side > 0 ? 'R' : 'L';
      lamp(`${p.id}.lamp${sfx}`, p.x + side * 2.2, p.z - sp / 2 + (side > 0 ? 1.4 : -0.6));
      if (k === 0) lamp(`${p.id}.lampF${sfx}`, p.x + side * 2.2, p.z + sp / 2 - 2.6 + (side > 0 ? -0.6 : 0.6));
    }
  });

  // ladder-type cable tray on the -x side
  if (live('tray')) {
    const zS = P.platform.zStart - 1, zE = P.platform.zStart - P.platform.length + 2;
    const L = zS - zE;
    const [x, y, z] = off('tray', P.pillars.x - 1.15, beamBottom(P.pillars.x - 1.15) - 0.12, (zS + zE) / 2);
    box(group, 0.04, 0.1, L, mats('steel'), x - 0.2, y, z, { name: 'tray.railL', mask: 'fixture', line: 'detail' });
    box(group, 0.04, 0.1, L, mats('steel'), x + 0.2, y, z, { name: 'tray.railR', mask: 'fixture', line: 'detail' });
    const n = Math.floor(L / 0.5);
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.03, 0.03), mats('steel'), n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m4.makeTranslation(x, y - 0.03, zS - i * 0.5); im.setMatrixAt(i, m4); }
    im.castShadow = true;
    tag(im, { name: 'tray.rungs', mask: 'fixture', line: 'detail' });
    group.add(im);
  }
  return {};
}
