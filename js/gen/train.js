import * as THREE from 'three';
import { getTrainMats } from '../materials.js';
import { tag } from '../registry.js';
import { box } from './util.js';
import { trackX, trackYaw } from './track.js';

const W = 2.9, HW = 1.45, Y0 = 0.62, YW = 3.35, YR = 3.92;           // body half-width, floor, wall top, roof top
const CAR_L = 19.5, GAP = 0.45;
const RAKE = 0.95;                                                    // how far the windscreen leans back at the roof

/** half width of the cross-section at height y (matches the extruded profile) */
const halfAt = (y) => (y <= YW ? HW : HW - (HW - 0.95) * Math.pow((y - YW) / (YR - YW), 0.6));
const frontDz = (y) => RAKE * THREE.MathUtils.smoothstep(y, 1.35, YR);

function profileShape() {
  const s = new THREE.Shape();
  s.moveTo(-1.38, Y0); s.lineTo(1.38, Y0); s.lineTo(HW, Y0 + 0.2); s.lineTo(HW, YW);
  s.quadraticCurveTo(1.38, YR - 0.04, 0.55, YR); s.lineTo(-0.55, YR);
  s.quadraticCurveTo(-1.38, YR - 0.04, -HW, YW); s.lineTo(-HW, Y0 + 0.2); s.closePath();
  return s;
}

function bodyGeometry(raked) {
  const g = new THREE.ExtrudeGeometry(profileShape(), { depth: CAR_L, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -CAR_L / 2);
  if (raked) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) > CAR_L / 2 - 1e-3) p.setZ(i, CAR_L / 2 - frontDz(p.getY(i)));
  }
  g.computeVertexNormals();
  return g;
}

function frontPanel(mat) {
  const ys = 14, y1 = YR - 0.03;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= ys; j++) {
    const y = Y0 + 0.05 + (y1 - Y0 - 0.05) * (j / ys), hw = halfAt(y) * 0.995;
    for (const k of [0, 1]) {
      pos.push((k ? hw : -hw), y, CAR_L / 2 - frontDz(y) + 0.004);
      uv.push(k, (y - Y0 - 0.05) / (y1 - Y0 - 0.05));
    }
    if (j) { const a = (j - 1) * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/** Stopped commuter train on the right-hand track. Generic livery; stripe colour from params.train.stripe. */
export function buildTrain(ctx) {
  const { group, seeds, P } = ctx;
  const T = P.train;
  if (!T.show) return;
  const M = getTrainMats(seeds, T.stripe);
  const add = (parent, mesh, name, line = 'detail', cast = true) => { mesh.castShadow = cast; mesh.receiveShadow = true; tag(mesh, { name, mask: 'train', line }); parent.add(mesh); return mesh; };

  for (let c = 0; c < T.cars; c++) {
    const zc = T.zFront - CAR_L / 2 - c * (CAR_L + GAP);
    const g = new THREE.Group();
    g.position.set(trackX(P, 1, zc), 0, zc);
    g.rotation.y = trackYaw(P, 1, zc) + Math.PI;
    group.add(g);
    const nm = `train.car${c}`;
    add(g, new THREE.Mesh(bodyGeometry(c === 0), M.body), nm, 'struct');

    // side livery panels (windows, doors, bands) lying on the flat wall
    const sideH = YW - Y0 - 0.02;
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(CAR_L - 0.2, sideH), M.side);
      m.position.set(s * (HW + 0.004), Y0 + sideH / 2 + 0.01, 0);
      m.rotation.y = s * Math.PI / 2;
      add(g, m, `${nm}.side${s}`, 'detail', false);
    }
    if (c === 0) {
      add(g, frontPanel(M.front), `${nm}.front`, 'struct', false);
      for (const s of [-1, 1]) {
        const y = 3.0, z = CAR_L / 2 - frontDz(y) + 0.02;
        add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14).rotateX(Math.PI / 2), M.light), `${nm}.head${s}`, 'none', false).position.set(s * 1.1, y, z);
        const y2 = 1.55, z2 = CAR_L / 2 - frontDz(y2) + 0.02;
        add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12).rotateX(Math.PI / 2), M.tail), `${nm}.tail${s}`, 'none', false).position.set(s * 1.2, y2, z2);
      }
      const pl = add(g, new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, 0.5), M.body), `${nm}.plough`, 'detail');
      pl.position.set(0, 0.62, CAR_L / 2 + 0.1); pl.rotation.x = -0.35;
      box(g, 0.5, 0.35, 0.5, M.dark, 0, 0.75, CAR_L / 2 - 0.1, { name: `${nm}.coupler`, mask: 'train', line: 'detail' });
    } else {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, YW - Y0 - 0.1), M.end);
      e.position.set(0, (YW + Y0) / 2, CAR_L / 2 + 0.01); add(g, e, `${nm}.endF`, 'detail', false);
    }
    const er = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, YW - Y0 - 0.1), M.end);
    er.position.set(0, (YW + Y0) / 2, -CAR_L / 2 - 0.01); er.rotation.y = Math.PI; add(g, er, `${nm}.endB`, 'detail', false);

    // roof: dark cover strip, AC units
    box(g, 1.0, 0.07, CAR_L - 1.0, M.roof, 0, YR + 0.03, 0, { name: `${nm}.roofStrip`, mask: 'train', line: 'detail' });
    for (const z of [-5.4, 5.4]) box(g, 0.95, 0.3, 2.6, M.body, 0, YR + 0.2, z, { name: `${nm}.ac${z}`, mask: 'train', line: 'detail' });
    // underfloor equipment + bogies
    box(g, 2.2, 0.5, 6.2, M.dark, 0, Y0 - 0.2, 0, { name: `${nm}.under`, mask: 'train', line: 'detail' });
    box(g, 0.9, 0.38, 3.6, M.dark, 0.62, Y0 - 0.12, 7.0, { name: `${nm}.underA`, mask: 'train', line: 'detail' });
    for (const bz of [-6.6, 6.6]) {
      box(g, 2.0, 0.22, 2.5, M.dark, 0, 0.62, bz, { name: `${nm}.bogie${bz}`, mask: 'train', line: 'detail' });
      for (const wz of [-0.9, 0.9]) for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 16).rotateZ(Math.PI / 2), M.wheel);
        w.position.set(sx * 0.72, 0.43, bz + wz); add(g, w, `${nm}.wheel${bz}${wz}${sx}`);
      }
    }
    if (c < T.cars - 1) box(g, 2.5, 2.9, GAP + 0.1, M.dark, 0, Y0 + 1.5, -CAR_L / 2 - GAP / 2, { name: `${nm}.bellows`, mask: 'train', line: 'detail' });
  }
}
