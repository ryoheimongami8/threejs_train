import * as THREE from 'three';
import { getMat } from '../materials.js';
import { tag } from '../registry.js';
import { box, sweepRect } from './util.js';

const Z_NEAR = 24, Z_FAR = -150;

/** Centre-line x of a track at depth z (side: -1 left, +1 right). Gentle bend away from camera. */
export function trackX(P, side, z) {
  const base = side * (P.platform.halfWidth + P.track.offset);
  const d = Math.max(0, 8 - z);
  return base + P.track.curve * d * d;
}
export function trackYaw(P, side, z) {
  const e = 0.5;
  return Math.atan2(trackX(P, side, z - e) - trackX(P, side, z + e), -2 * e);
}

export function buildTrack(ctx) {
  const { group, seeds, P } = ctx;
  const railMat = getMat(seeds, 'rail', { side: THREE.DoubleSide });
  const g = P.track.gauge;
  const pts = (side, off) => {
    const a = [];
    for (let z = Z_NEAR; z >= Z_FAR; z -= 1.5) a.push([trackX(P, side, z) + off, z]);
    return a;
  };
  const sleepers = [];
  for (const side of [-1, 1]) {
    const rails = !(side < 0 && P.track.leftTrack === false);
    for (const o of rails ? [-g / 2, g / 2] : []) {
      const p = pts(side, o);
      sweepRect(group, p, 0.115, 0.14, 0.03, railMat, { name: `rail.foot${side}${o}`, mask: 'track', line: 'detail' });
      sweepRect(group, p, 0.145, 0.04, 0.1, railMat, { name: `rail.web${side}${o}`, mask: 'track', line: 'detail' });
      sweepRect(group, p, 0.245, 0.075, 0.04, railMat, { name: `rail.head${side}${o}`, mask: 'track', line: 'detail' });
    }
    // ballast bed (trapezoid-ish slab) following the curve
    const bed = [];
    for (let z = Z_NEAR; z >= Z_FAR; z -= 3) bed.push([trackX(P, side, z), z]);
    sweepRect(group, bed, -0.28, side < 0 ? 5.2 : 6.6, 0.26, getMat(seeds, 'ballast', { side: THREE.DoubleSide }), { name: `ballast${side}`, mask: 'ground', line: 'ground' });
    // sleepers
    if (rails) for (let z = Z_NEAR; z >= Z_FAR; z -= 0.62) sleepers.push([side, z]);
  }
  const geo = new THREE.BoxGeometry(2.4, 0.14, 0.22);
  const im = new THREE.InstancedMesh(geo, getMat(seeds, 'sleeper'), sleepers.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  sleepers.forEach(([side, z], i) => {
    e.set(0, trackYaw(P, side, z), 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(trackX(P, side, z), 0.045, z), q, new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(i, m4);
  });
  im.castShadow = im.receiveShadow = true;
  tag(im, { name: 'sleepers', mask: 'track', line: 'ground' });
  group.add(im);
  return { Z_NEAR, Z_FAR };
}
