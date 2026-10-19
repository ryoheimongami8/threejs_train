import * as THREE from 'three';
import { getMat, getLeafMat } from '../materials.js';
import { rngFor } from '../rng.js';
import { tag } from '../registry.js';

// Trees are grown from structure: trunk -> branches/limbs (tapered segments) -> foliage tufts placed ALONG them.
// Foliage tufts are flattened jagged blobs with a silhouette-only alpha cut (see getLeafMat).
// Everything of one kind is instanced; a whole planting shares one outline ID (instGroup huge).

const hp = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };

function jaggedBlob(detail) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 0.8 + 0.28 * hp(Math.round(v.x * 22), Math.round(v.y * 22), Math.round(v.z * 22)) + 0.14 * hp(Math.round(v.x * 70), Math.round(v.y * 70), Math.round(v.z * 70));
    const n = v.clone().normalize();
    pos.setXYZ(i, n.x * k, n.y * k, n.z * k);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const m4 = new THREE.Matrix4();

function segInstance(a, b, radius) {
  const d = b.clone().sub(a), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(Y, d.normalize());
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(radius, len, radius));
}

function buildMeshes(group, seeds, name, trunks, segs, tufts, tuftDetail = 1) {
  const bark = getMat(seeds, 'trunk');
  const meshes = [];
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 1, 1, 7), bark, Math.max(1, trunks.length));
  trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m));
  trunkMesh.count = trunks.length;
  const segMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 1, 1, 5), bark, Math.max(1, segs.length));
  segs.forEach((m, i) => segMesh.setMatrixAt(i, m));
  segMesh.count = segs.length;
  const tuftMesh = new THREE.InstancedMesh(jaggedBlob(tuftDetail), getLeafMat(seeds, 'broad'), Math.max(1, tufts.length));
  tufts.forEach((t, i) => { tuftMesh.setMatrixAt(i, t.m); tuftMesh.setColorAt(i, t.c); });
  tuftMesh.count = tufts.length;
  for (const m of [trunkMesh, segMesh, tuftMesh]) { m.userData.instGroup = 1e6; m.castShadow = true; m.receiveShadow = true; }
  tag(trunkMesh, { name: `${name}.trunks`, mask: 'veg', line: 'bg' });
  tag(segMesh, { name: `${name}.branches`, mask: 'veg', line: 'bg' });
  tag(tuftMesh, { name: `${name}.foliage`, mask: 'veg', line: 'bg' });
  group.add(trunkMesh, segMesh, tuftMesh);
}

/** specs: [{id, x, y (ground), z, h}] */
export function plantConifers(group, seeds, name, specs) {
  const trunks = [], segs = [], tufts = [];
  const col = new THREE.Color();
  for (const sp of specs) {
    const r = rngFor(seeds, 'layout', `conifer:${sp.id}`);
    const { x, y, z, h } = sp;
    const hue = r.range(0.29, 0.35), lean = r.range(-0.5, 0.5);
    const rb = h * 0.02;
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + h * 0.5, z), new THREE.Quaternion(), new THREE.Vector3(rb, h, rb)));
    const whorls = 16, f0 = 0.17;
    for (let w = 0; w < whorls; w++) {
      const f = f0 + (0.96 - f0) * (w / (whorls - 1));
      const wy = y + h * f;
      const Lmax = h * 0.2 * Math.pow(1 - f, 0.85) + h * 0.015;
      const nb = Math.max(3, Math.round(6.5 - 3.2 * f));
      const rot = r() * 6.283;
      const droop = 0.62 * (1 - f) + 0.12, curl = 0.5 * f;
      for (let k = 0; k < nb; k++) {
        if (f < 0.55 && r.chance(0.14)) continue;           // gaps in the lower crown
        const th = rot + (k / nb) * 6.283 + r.range(-0.3, 0.3);
        const L = Lmax * r.range(0.7, 1.15);
        const c = Math.cos(th), s = Math.sin(th);
        const P = (t) => new THREE.Vector3(x + lean * f + c * L * t, wy + L * (0.12 * t - droop * 0.6 * t * t + curl * 0.5 * t * t * t), z + s * L * t);
        const T = (t) => new THREE.Vector3(c * L, L * (0.12 - 2 * droop * 0.6 * t + 1.5 * curl * 0.5 * t * t), s * L).normalize();
        for (let i = 0; i < 4; i++) segs.push(segInstance(P(i / 4), P((i + 1) / 4), Math.max(0.012, h * 0.0045 * (1 - i / 4))));
        const m = Math.round(6 + 7 * (L / (h * 0.2)));
        for (let j = 0; j < m; j++) {
          const t = 0.18 + 0.82 * ((j + r()) / m);
          const side = (j % 2 ? 1 : -1) * r.range(0.04, 0.2) * L;
          const up = r.range(-0.07, 0.11) * L;
          const p = P(t).add(new THREE.Vector3(-s * side, up, c * side));
          const along = L * 0.3 * (0.5 + 0.65 * Math.sin(Math.PI * Math.min(t, 0.97))) * r.range(0.85, 1.2) + 0.12;
          const d = T(t);
          const q = new THREE.Quaternion().setFromUnitVectors(X, d);
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(d, r.range(-0.5, 0.5)));
          tufts.push({
            m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(along, along * 0.2, along * 0.5)),
            c: col.clone().setHSL(hue + r.range(-0.012, 0.012), 0.5, 0.08 + 0.1 * f + (up > 0 ? 0.035 : 0) + r.range(-0.015, 0.015)),
          });
        }
      }
    }
    // leader tuft at the top
    const q = new THREE.Quaternion().setFromUnitVectors(X, Y);
    tufts.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x + lean, y + h * 0.985, z), q, new THREE.Vector3(h * 0.045, h * 0.012, h * 0.016)), c: col.clone().setHSL(hue, 0.5, 0.2) });
  }
  buildMeshes(group, seeds, name, trunks, segs, tufts);
}

/** Broadleaf: trunk forks into limbs; foliage = lumpy masses of unequal clumps along each limb. */
export function plantBroadleaf(group, seeds, name, specs) {
  const trunks = [], segs = [], tufts = [];
  const col = new THREE.Color();
  for (const sp of specs) {
    const r = rngFor(seeds, 'layout', `broad:${sp.id}`);
    const { x, y, z, h } = sp;
    const hue = r.range(0.24, 0.32), vig = r.range(0.9, 1.1), lean = r.range(-0.06, 0.06) * h;
    const rb = h * 0.02, trunkH = h * r.range(0.4, 0.52);
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x + lean * 0.3, y + trunkH / 2, z), new THREE.Quaternion(), new THREE.Vector3(rb, trunkH, rb)));
    const top = new THREE.Vector3(x + lean * 0.5, y + trunkH, z);
    const nl = r.int(4, 7), a0 = r() * 6.283;
    const crownLo = top.y, crownHi = top.y + h * 0.62;
    const clump = (p, s, inner) => {
      const rel = THREE.MathUtils.clamp((p.y - crownLo) / (crownHi - crownLo), 0, 1);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6));
      tufts.push({
        m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(s * r.range(1.0, 1.4), s * r.range(0.7, 0.95), s * r.range(1.0, 1.4))),
        c: col.clone().setHSL(hue + r.range(-0.012, 0.012) - 0.01 * (1 - rel), r.range(0.46, 0.58), (0.1 + 0.26 * Math.pow(rel, 1.2) + (inner ? -0.05 : 0.03)) * vig),
      });
    };
    for (let l = 0; l < nl; l++) {
      const th = a0 + (l / nl) * 6.283 + r.range(-0.4, 0.4);
      const el0 = r.range(0.45, 1.05), Ll = h * r.range(0.26, 0.42);
      const P = (t) => {
        const el = el0 - 0.25 * t;
        const hr = Math.cos(el);
        return new THREE.Vector3(top.x + Math.cos(th) * hr * Ll * t, top.y + Math.sin(el) * Ll * t, top.z + Math.sin(th) * hr * Ll * t);
      };
      for (let i = 0; i < 4; i++) segs.push(segInstance(P(i / 4), P((i + 1) / 4), Math.max(0.03, rb * 0.55 * (1 - i / 5))));
      const nc = r.int(4, 6);
      for (let c = 0; c < nc; c++) {
        const t = 0.4 + 0.6 * ((c + r()) / nc);
        const p = P(t);
        const s = h * (0.1 + 0.08 * Math.sin(Math.PI * Math.min(t, 0.98))) * r.range(0.8, 1.2);
        clump(p.clone().add(new THREE.Vector3(0, s * 0.25, 0)), s, false);
        const sub = r.int(1, 3);
        for (let k = 0; k < sub; k++) {
          const a = r() * 6.283;
          clump(p.clone().add(new THREE.Vector3(Math.cos(a) * s * 0.95, r.range(-0.3, 0.7) * s, Math.sin(a) * s * 0.95)), s * r.range(0.45, 0.7), false);
        }
      }
    }
    for (let k = 0; k < 3; k++) clump(top.clone().add(new THREE.Vector3(r.range(-1, 1), r.range(0.4, 1.4), r.range(-1, 1)).multiplyScalar(h * 0.06)), h * 0.1, true);
  }
  buildMeshes(group, seeds, name, trunks, segs, tufts, 2);
}
