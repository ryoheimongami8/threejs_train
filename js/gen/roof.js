import * as THREE from 'three';
import { getMat } from '../materials.js';
import { tag } from '../registry.js';
import { tileBox } from './util.js';

/** Gable roof: two slabs hinged on the pillar line. Beams are InstancedMesh (per-instance IDs). */
export function buildRoof(ctx, pillars) {
  const { group, seeds, P } = ctx;
  const r = P.roof;
  const cx = P.pillars.x;
  const H = P.platform.height + P.pillars.height; // underside at ridge
  const zStart = P.platform.zStart;
  const zEnd = zStart - P.platform.length;
  const L = zStart - zEnd, zMid = (zStart + zEnd) / 2;
  const a = Math.atan(r.pitch);
  const under = getMat(seeds, 'roofUnder'), top = getMat(seeds, 'roofTop'), steel = getMat(seeds, 'steel');
  const halves = [];

  for (const s of [-1, 1]) {
    const w = r.halfWidth / Math.cos(a);
    const geo = new THREE.BoxGeometry(w, r.thickness, L);
    tileBox(geo, w, r.thickness, L, 1.5);
    const m = new THREE.Mesh(geo, [steel, steel, top, under, steel, steel]);
    // slab centre: slope downward away from the ridge
    const xc = cx + s * (r.halfWidth / 2);
    const yc = H + r.thickness / 2 - Math.sin(a) * (r.halfWidth / 2);
    m.position.set(xc, yc, zMid);
    m.rotation.z = -s * a;
    m.castShadow = m.receiveShadow = true;
    tag(m, { name: `roof.slab${s}`, mask: 'roof', line: 'struct' });
    group.add(m);
    halves.push({ s, xc, yc, a });

    // cross beams + longitudinal rafters (instanced)
    const nB = Math.floor(L / r.beamSpacing);
    const beamGeo = new THREE.BoxGeometry(w * 0.98, 0.24, 0.1);
    const bi = new THREE.InstancedMesh(beamGeo, steel, nB);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -s * a));
    for (let i = 0; i < nB; i++) {
      const z = zStart - (i + 0.5) * r.beamSpacing;
      const off = new THREE.Vector3(0, -(r.thickness / 2 + 0.12), 0).applyQuaternion(q);
      m4.compose(new THREE.Vector3(xc + off.x, yc + off.y, z), q, new THREE.Vector3(1, 1, 1));
      bi.setMatrixAt(i, m4);
    }
    bi.castShadow = bi.receiveShadow = true;
    tag(bi, { name: `roof.beams${s}`, mask: 'roof', line: 'detail' });
    group.add(bi);

    const rafters = 4;
    const rGeo = new THREE.BoxGeometry(0.12, 0.2, L);
    const ri = new THREE.InstancedMesh(rGeo, steel, rafters);
    for (let i = 0; i < rafters; i++) {
      const lx = ((i + 0.5) / rafters - 0.5) * w * 0.98; // along slab
      const loc = new THREE.Vector3(lx, -(r.thickness / 2 + 0.34), 0).applyQuaternion(q);
      m4.compose(new THREE.Vector3(xc + loc.x, yc + loc.y, zMid), q, new THREE.Vector3(1, 1, 1));
      ri.setMatrixAt(i, m4);
    }
    ri.castShadow = ri.receiveShadow = true;
    tag(ri, { name: `roof.rafters${s}`, mask: 'roof', line: 'detail' });
    group.add(ri);
  }

  // thin X-brace rods between cross beams (instanced; one instance per rod)
  {
    const rods = [];
    const nB = Math.floor(L / r.beamSpacing);
    const yAt = (x) => H - Math.sin(a) * Math.abs(x - cx) - r.thickness - 0.5;
    for (const s of [-1, 1]) {
      const xa = cx + s * r.halfWidth * 0.12, xb = cx + s * r.halfWidth * 0.92;
      for (let i = 0; i < nB - 1; i += 2) {
        const z0 = zStart - (i + 0.5) * r.beamSpacing, z1 = zStart - (i + 1.5) * r.beamSpacing;
        rods.push([[xa, yAt(xa), z0], [xb, yAt(xb), z1]], [[xb, yAt(xb), z0], [xa, yAt(xa), z1]]);
      }
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.026, 0.026, 1), steel, rods.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1);
    rods.forEach(([A, B], i) => {
      const va = new THREE.Vector3(...A), vb = new THREE.Vector3(...B), d = vb.clone().sub(va), len = d.length();
      q.setFromUnitVectors(z, d.normalize());
      m4.compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, len));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = true;
    tag(im, { name: 'roof.braces', mask: 'roof', line: 'detail' });
    group.add(im);
  }

  /** underside height at world x (used by hanging fixtures) */
  const undersideY = (x) => H - Math.sin(a) * Math.abs(x - cx) * 1.0;
  return { halves, undersideY, H, zEnd };
}
