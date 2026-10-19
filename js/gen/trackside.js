import * as THREE from 'three';
import { getMat, getBarFenceMat, getFenceMat } from '../materials.js';
import { rngFor } from '../rng.js';
import { tag } from '../registry.js';
import { box, mesh, tube, cyl } from './util.js';
import { groundHeight } from './env.js';
import { trackX } from './track.js';

/** Left-hand trackside (gravel apron, concrete ledge, weeds, bar fence, panel buildings, stairs, signs, ground cables). */
export function buildTrackside(ctx) {
  const { group, seeds, P } = ctx;
  const m4 = new THREE.Matrix4();

  // gravel apron between platform and fence (sits just above the terrain heightfield)
  {
    const g = new THREE.PlaneGeometry(8.2, 190, 1, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8.2 / 2.2, uv.getY(i) * 190 / 2.2);
    mesh(group, g, getMat(seeds, 'ballast'), { name: 'gravelApron', mask: 'ground', line: 'ground' }, { pos: [-6.7, -0.29, -70], rot: [-Math.PI / 2, 0, 0], cast: false });
  }
  // low concrete ledge along the gravel
  box(group, 1.7, 0.6, 28, getMat(seeds, 'concrete'), -8.7, -0.02, 2, { name: 'ledge', mask: 'ground', line: 'detail' }, { tile: 1.5 });
  box(group, 1.5, 0.12, 28, getMat(seeds, 'concrete'), -8.5, 0.34, 2, { name: 'ledge.top', mask: 'ground', line: 'detail' }, { tile: 1.5 });

  // tall bar fence on the low wall + backing panel structures
  {
    const L = 190, h = 2.0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, h), getBarFenceMat(seeds, [L / 1.0, h / 1.0]));
    m.rotation.y = Math.PI / 2; m.position.set(-10.6, 0.58 + h / 2, -70);
    tag(m, { name: 'fenceBars', mask: 'ground', line: 'detail', noG: true });
    group.add(m);
    const white = getMat(seeds, 'white'), conc = getMat(seeds, 'concrete');
    box(group, 2.2, 3.4, 20, white, -13.4, 1.3, -2, { name: 'panelBldg0', mask: 'building', line: 'detail' });
    box(group, 1.4, 2.4, 8, getMat(seeds, 'fenceBlue'), -12.6, 0.9, -19, { name: 'panelBldg1', mask: 'building', line: 'detail' });
    box(group, 4.5, 4.0, 7, conc, -14.5, 1.7, 14, { name: 'concBlock', mask: 'building', line: 'detail' }, { tile: 2 });
    // pipe runs along the fence
    tube(group, [[-10.2, 0.2, 16], [-10.2, 0.2, -40]], 0.09, getMat(seeds, 'steel'), { name: 'pipeRunA', mask: 'fixture', line: 'detail' }, { seg: 4, radial: 8 });
    tube(group, [[-10.0, 0.45, 16], [-10.0, 0.45, -40]], 0.07, getMat(seeds, 'fenceBlue'), { name: 'pipeRunB', mask: 'fixture', line: 'detail' }, { seg: 4, radial: 8 });
  }

  // dry weeds (instanced, 5 blades per tuft share one outline ID)
  const tufts = (name, n, xr, zr, near) => {
    const per = 5;
    const blade = new THREE.ConeGeometry(0.03, 1, 4); blade.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), n * per);
    im.userData.instGroup = per;
    const col = new THREE.Color();
    for (let t = 0; t < n; t++) {
      const r = rngFor(seeds, 'props', `${name}${t}`);
      const x = r.range(...xr);
      const z = near ? zr[0] - Math.pow(r(), 1.5) * (zr[0] - zr[1]) : r.range(...zr);
      const y = groundHeight(x, z) + (x > -10.4 && x < -7.8 ? 0.05 : 0.0);
      for (let b = 0; b < per; b++) {
        const hh = r.range(0.25, 0.75);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(-0.5, 0.5), r.range(0, 6.3), r.range(-0.5, 0.5)));
        m4.compose(new THREE.Vector3(x + r.range(-0.12, 0.12), y, z + r.range(-0.12, 0.12)), q, new THREE.Vector3(1, hh, 1));
        im.setMatrixAt(t * per + b, m4);
        col.setHSL(0.09 + r.range(-0.02, 0.02), r.range(0.35, 0.6), r.range(0.38, 0.58));
        im.setColorAt(t * per + b, col);
      }
    }
    im.castShadow = false; im.receiveShadow = true;
    tag(im, { name: `weeds.${name}`, mask: 'veg', line: 'bg' });
    group.add(im);
  };
  tufts('wL', 420, [-10.2, -5.8], [14, -45], true);
  // right bank: tufts grow in clumps, bare ground left between them
  {
    const per = 5, clusters = 85, perCluster = 16;
    const blade = new THREE.ConeGeometry(0.03, 1, 4); blade.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), clusters * perCluster * per);
    im.userData.instGroup = per;
    const col = new THREE.Color();
    let idx = 0;
    for (let c = 0; c < clusters; c++) {
      const rc = rngFor(seeds, 'props', `wRc${c}`);
      const cx = rc.range(8.6, 17), cz = 22 - Math.pow(rc(), 1.5) * 108;
      const hue = 0.085 + rc.range(-0.015, 0.015), tone = rc.range(0.42, 0.56);
      for (let t = 0; t < perCluster; t++) {
        const r = rngFor(seeds, 'props', `wR${c}_${t}`);
        const x = cx + (r() + r() + r() - 1.5) * 1.6, z = cz + (r() + r() + r() - 1.5) * 1.6;
        const y = groundHeight(x, z);
        for (let b = 0; b < per; b++) {
          const hh = r.range(0.3, 0.8);
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(-0.5, 0.5), r.range(0, 6.3), r.range(-0.5, 0.5)));
          m4.compose(new THREE.Vector3(x + r.range(-0.1, 0.1), y, z + r.range(-0.1, 0.1)), q, new THREE.Vector3(1, hh, 1));
          im.setMatrixAt(idx, m4);
          col.setHSL(hue + r.range(-0.008, 0.008), 0.5, tone + r.range(-0.04, 0.04));
          im.setColorAt(idx, col); idx++;
        }
      }
    }
    im.castShadow = false; im.receiveShadow = true;
    tag(im, { name: 'weeds.right', mask: 'veg', line: 'bg' });
    group.add(im);
  }

  // white chain-link fence following the bending right-hand track
  {
    const pts = [];
    for (let z = 24; z > -110; z -= 2) pts.push([trackX(P, 1, z) + 5.2, z]);
    const h = 1.5, pos = [], uv = [], idx = [];
    let cum = 0;
    pts.forEach(([x, z], i) => {
      if (i) cum += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      const y0 = groundHeight(x, z);
      pos.push(x, y0 - 0.1, z, x, y0 + h, z);
      uv.push(cum / 0.9, 0, cum / 0.9, h / 0.9);
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 3, k, k + 3, k + 1); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, getFenceMat(seeds, [1, 1]));
    tag(m, { name: 'fenceRight', mask: 'ground', line: 'detail', noG: true });
    group.add(m);
    const nP = Math.floor(pts.length / 2);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, h + 0.2, 0.07), getMat(seeds, 'pole'), nP);
    for (let i = 0; i < nP; i++) {
      const [x, z] = pts[i * 2];
      m4.makeTranslation(x, groundHeight(x, z) + h / 2, z); posts.setMatrixAt(i, m4);
    }
    posts.castShadow = true;
    tag(posts, { name: 'fencePostsRight', mask: 'ground', line: 'detail' });
    group.add(posts);
  }

  // end-of-platform gate, slatted, with a teal bin beside it
  {
    const hw = P.platform.halfWidth, H = P.platform.height, zE = P.platform.zStart - P.platform.length + 0.6;
    const wood = getMat(seeds, 'trunk'), steel = getMat(seeds, 'steel');
    for (const sx of [-1, 1]) box(group, 0.12, 1.9, 0.12, steel, sx * (hw - 0.25), H + 0.95, zE, { name: `gate.post${sx}`, mask: 'fixture', line: 'detail' });
    box(group, hw * 2 - 0.4, 0.1, 0.1, steel, 0, H + 1.85, zE, { name: 'gate.top', mask: 'fixture', line: 'detail' });
    for (let i = 0; i < 10; i++) box(group, 0.1, 1.4, 0.05, wood, -hw + 0.7 + i * ((hw * 2 - 1.4) / 9), H + 1.05, zE, { name: `gate.slat${i}`, mask: 'fixture', line: 'detail' });
    box(group, 0.8, 1.3, 0.7, getMat(seeds, 'green'), hw - 0.9, H + 0.65, zE + 1.2, { name: 'gate.bin', mask: 'fixture', line: 'detail' });
  }

  // small stair with green rail, radio-switch sign board, orange diamond sign, loose cable runs
  {
    const gz = -20, gx = -8.4;
    const conc = getMat(seeds, 'concrete');
    const green = new THREE.MeshStandardMaterial({ color: '#2f9a72', roughness: 0.6, metalness: 0.3 });
    for (let i = 0; i < 6; i++) box(group, 1.1, 0.2, 0.34, conc, gx, -0.2 + i * 0.2 + 0.1, gz - i * 0.34, { name: `stair.step${i}`, mask: 'ground', line: 'detail' });
    for (const s of [-1, 1]) {
      const x = gx + s * 0.58;
      tube(group, [[x, 0.7, gz + 0.2], [x, 0.9, gz - 0.4], [x, 1.9, gz - 1.9], [x, 2.1, gz - 2.3]], 0.025, green, { name: `stair.rail${s}`, mask: 'fixture', line: 'detail' }, { seg: 8, radial: 5 });
    }
    cyl(group, 0.04, 0.04, 2.6, getMat(seeds, 'steel'), gx + 1.1, 1.1, gz - 0.2, { name: 'signPoleRadio', mask: 'fixture', line: 'detail' }, 8);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 1.1), getMat(seeds, 'signRadio', { side: THREE.DoubleSide }));
    board.position.set(gx + 1.1, 1.6, gz + 0.03); board.castShadow = true;
    tag(board, { name: 'signRadio', mask: 'fixture', line: 'detail' });
    group.add(board);

    // orange diamond marker on a thin pole near the platform edge
    cyl(group, 0.03, 0.03, 1.9, getMat(seeds, 'steel'), -7.9, 0.65, -10, { name: 'markerPole', mask: 'fixture', line: 'detail' }, 6);
    const d = box(group, 0.55, 0.55, 0.04, getMat(seeds, 'orange'), -7.9, 1.75, -10, { name: 'markerDiamond', mask: 'fixture', line: 'detail' });
    d.rotation.z = Math.PI / 4;
    const dw = box(group, 0.3, 0.3, 0.05, getMat(seeds, 'white'), -7.9, 1.75, -10 + 0.005, { name: 'markerDiamondInner', mask: 'fixture', line: 'none' }, { cast: false });
    dw.rotation.z = Math.PI / 4;

    // cable runs lying on the gravel
    const cab = getMat(seeds, 'wireG');
    for (let k = 0; k < 4; k++) {
      const o = k * 0.16;
      tube(group, [[-5.2 - o, -0.18, -6], [-6.6 - o, -0.14, -9], [-8.0 - o * 0.6, 0.1, -12.2], [-8.9, 0.25, -13]], 0.07, cab, { name: `groundCable${k}`, mask: 'fixture', line: 'detail' }, { seg: 16, radial: 6 });
    }
  }
}
