import * as THREE from 'three';
import { getMat } from '../materials.js';
import { trackX } from './track.js';
import { box, cyl, tube } from './util.js';

/** Overhead-line poles, arching cross pipes, and sagging wires. Spacing is a rule; poles are named by index along z. */
export function buildPoles(ctx) {
  const { group, seeds, P } = ctx;
  const pl = P.poles;
  const pole = getMat(seeds, 'pole'), steel = getMat(seeds, 'steel');
  const wireY = getMat(seeds, 'wireY'), wireG = getMat(seeds, 'wireG');
  const zs = [];
  for (let z = pl.z0; z > -150; z -= pl.spacing) zs.push(z);

  zs.forEach((zBase, i) => {
    for (const side of [-1, 1]) {
      const z = zBase + (side < 0 ? pl.leftZ ?? 0 : 0);
      const x = side > 0 ? pl.xRight : pl.xLeft;
      const id = `pole${i}${side > 0 ? 'R' : 'L'}`;
      cyl(group, 0.27, 0.17, pl.height, pole, x, pl.height / 2, z, { name: id, mask: 'pole', line: 'struct' }, 14);
      cyl(group, 0.4, 0.4, 0.5, steel, x, 0.25, z, { name: id + '.foot', mask: 'pole', line: 'detail' }, 10);
      // arched cross pipe over the nearest track
      const tx = trackX(P, side, z);
      const y1 = pl.height - 0.4;
      tube(group, [[x, y1 - 1.4, z], [x, y1, z], [x - side * 1.2, y1 + 0.35, z], [x - side * 2.8, y1 + 0.3, z], [tx + side * 0.4, y1 - 0.2, z]], 0.1, steel, { name: id + '.arch', mask: 'pole', line: 'detail' }, { seg: 32, radial: 8 });
      // insulators / hanging brackets over the track
      for (const h of [5.5, 5.0]) {
        box(group, 0.08, 0.08, 0.5, steel, tx, h + 0.35, z, { name: `${id}.brk${h}`, mask: 'pole', line: 'detail' });
      }
    }
  });

  // sagging wires along each track (between poles), plus feeder cables at the pole tops
  const wire = (side, dy, dx, mat, name, rad) => {
    const pts = [];
    for (let z = 22; z > -150; z -= 4) {
      // catenary-like sag in between poles
      const dz = ((pl.z0 - z) % pl.spacing + pl.spacing) % pl.spacing;
      const t = dz / pl.spacing;
      const sag = Math.sin(t * Math.PI) * 0.25;
      pts.push([trackX(P, side, z) + dx, dy - sag, z]);
    }
    tube(group, pts, rad, mat, { name, mask: 'wire', line: 'detail' }, { seg: pts.length * 2, radial: 4, cast: false });
  };
  for (const side of [-1, 1]) {
    const s = side > 0 ? 'R' : 'L';
    wire(side, 5.55, 0, wireG, 'wire.messenger' + s, 0.022);
    wire(side, 5.05, 0.15, wireY, 'wire.contactY' + s, 0.035);
    wire(side, 5.05, -0.15, wireY, 'wire.contactY2' + s, 0.035);
    wire(side, 6.5, side * 1.9, wireG, 'wire.feeder' + s, 0.03);
    wire(side, 6.5, side * 1.5, wireY, 'wire.feederY' + s, 0.04);
  }
}
