import * as THREE from 'three';
import { getMat, getFenceMat, getLeafMat } from '../materials.js';
import { rngFor } from '../rng.js';
import { tag } from '../registry.js';
import { box, mesh, cyl } from './util.js';
import { trackX } from './track.js';
import { plantBroadleaf, plantConifers } from './trees.js';

const NOISE = (x, z) => Math.sin(x * 0.37 + z * 0.11) * 0.5 + Math.sin(x * 0.13 - z * 0.29) * 0.5;

// bank start follows the (bending) right-hand track; set once per build
let GP = { curve: 0 };
export function setGroundParams(P) { GP = { curve: P.track.curve }; }
const bendShift = (z) => GP.curve * Math.pow(Math.max(0, 8 - z), 2);

export function groundHeight(x, z) {
  const B = -0.32;
  const xr = x - bendShift(z);
  if (xr > 9.4) return B + Math.min(4.4, (xr - 9.4) * 0.5) + NOISE(x, z) * 0.12 * Math.min(1, (xr - 9.4) / 3);
  if (x < -10.8) return B + Math.min(3.0, (-10.8 - x) * 0.4) + NOISE(x, z) * 0.1 * Math.min(1, (-10.8 - x) / 3);
  return B;
}

/** Terrain, retaining wall + fences, trees, far buildings. */
export function buildEnv(ctx) {
  const { group, seeds, P } = ctx;
  const E = P.env;
  setGroundParams(P);

  // --- terrain heightfield (dry grass) ---
  const W = 150, D = 200, sx = 75, sz = 100;
  const g = new THREE.PlaneGeometry(W, D, sx, sz);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i) - 70;
    pos.setZ(i, z);
    pos.setY(i, groundHeight(x, z));
    uv.setXY(i, x / 6, z / 6);
  }
  g.computeVertexNormals();
  mesh(group, g, getMat(seeds, 'grass'), { name: 'terrain', mask: 'ground', line: 'ground' }, { cast: false });

  // --- left retaining wall + blue fence, right low fence ---
  box(group, 0.3, 0.9, 190, getMat(seeds, 'concrete'), -10.6, 0.13, -70, { name: 'wallLeft', mask: 'ground', line: 'detail' }, { tile: 2 });
  const fence = (x, y, h, name) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(190, h), getFenceMat(seeds, [190 / 0.8, h / 0.8]));
    m.rotation.y = Math.PI / 2; m.position.set(x, y, -70);
    tag(m, { name, mask: 'ground', line: 'detail', noG: true });
    group.add(m);
  };
  // fence posts (instanced)
  const postGeo = new THREE.BoxGeometry(0.08, 1.7, 0.08);
  const nP = 80;
  const posts = new THREE.InstancedMesh(postGeo, getMat(seeds, 'fenceBlue'), nP);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < nP; i++) {
    const z = 24 - i * 2.4;
    m4.compose(new THREE.Vector3(-10.6, 1.58, z), new THREE.Quaternion(), new THREE.Vector3(1, 1.18, 1)); posts.setMatrixAt(i, m4);
  }
  posts.castShadow = true;
  tag(posts, { name: 'fencePosts', mask: 'ground', line: 'detail' });
  group.add(posts);

  // --- trees: grown from branches (see trees.js); env only decides where and how tall ---
  const specs = (n, xr, name, hRange, zf) => Array.from({ length: n }, (_, t) => {
    const r = rngFor(seeds, 'layout', `${name}${t}`);
    const x = r.range(xr[0], xr[1]);
    const z = zf ? zf(r) : 22 - Math.pow(r(), 1.8) * 140;
    return { id: `${name}${t}`, x, z, y: groundHeight(x, z), h: r.range(...hRange) };
  });
  plantBroadleaf(group, seeds, 'treeL', specs(E.treesLeft, [-27, -13], 'treeL', [9, 16]));
  plantBroadleaf(group, seeds, 'hedgeL', specs(30, [-17, -12.5], 'hedgeL', [6.5, 10.5]));
  plantBroadleaf(group, seeds, 'farTrees', specs(12, [-10, 14], 'farTrees', [8, 12.5], (r) => r.range(-84, -56)));
  plantBroadleaf(group, seeds, 'treeR', specs(Math.floor(E.treesRight * 0.4), [16, 32], 'treeR', [8, 13]));
  plantConifers(group, seeds, 'conifers', specs(Math.floor(E.treesRight * 0.7), [12, 22], 'conifer', [12, 21], (r) => 14 - Math.pow(r(), 1.5) * 100));

  // --- mid/far buildings: wall + glass strips or big panels, a setback and rooftop boxes ---
  const tints = ['#ffffff', '#f3ead8', '#d9e6f2', '#ece8e0'];
  for (let i = 0; i < E.buildings; i++) {
    const r = rngFor(seeds, 'layout', `bld${i}`);
    const w = r.range(9, 20), h = r.range(9, 22), d = r.range(9, 16);
    const x = r.range(-40, 44), z = r.range(-140, -84);
    const kind = r.pick(['bldBands', 'bldPanels', 'bldBands']);
    const tint = r.pick(tints);
    const wallMat = (name) => { const m = getMat(seeds, name).clone(); m.color.set(tint); return m; };
    box(group, w, h, d, wallMat(kind), x, h / 2 - 0.5, z, { name: `bld${i}`, mask: 'building', line: 'bg' }, { tile: 9.6, cast: false });
    // setback block + parapet + rooftop equipment
    const sw = w * r.range(0.5, 0.75), sd = d * r.range(0.5, 0.75), sh = h * r.range(0.12, 0.22);
    box(group, sw, sh, sd, wallMat('bldPanels'), x + r.range(-1, 1), h - 0.5 + sh / 2, z + r.range(-1, 1), { name: `bld${i}.top`, mask: 'building', line: 'bg' }, { tile: 9.6, cast: false });
    box(group, w + 0.3, 0.35, d + 0.3, getMat(seeds, 'concrete'), x, h - 0.5 + 0.17, z, { name: `bld${i}.parapet`, mask: 'building', line: 'bg' }, { tile: 3, cast: false });
    if (r.chance(0.7)) box(group, r.range(1.5, 3), r.range(1, 2), r.range(1.5, 3), getMat(seeds, 'steel'), x + r.range(-w * 0.3, w * 0.3), h - 0.5 + sh + 0.9, z + r.range(-d * 0.3, d * 0.3), { name: `bld${i}.unit`, mask: 'building', line: 'bg' }, { cast: false });
  }
  // tunnel portal where the right-hand track bends away into the bank
  {
    const tz = -66, tx = trackX(P, 1, tz);
    box(group, 7.6, 6.4, 6, getMat(seeds, 'concrete'), tx, 2.9, tz, { name: 'tunnel.portal', mask: 'building', line: 'detail' }, { tile: 2 });
    box(group, 3.8, 4.2, 0.2, getMat(seeds, 'dark'), tx, 1.9, tz + 3.05, { name: 'tunnel.mouth', mask: 'building', line: 'detail' }, { cast: false });
  }
}
