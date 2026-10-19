import * as THREE from 'three';
import { tag } from '../registry.js';

/** Scale a BoxGeometry's UVs so textures tile at `tile` metres per repeat. */
export function tileBox(geo, w, h, d, tile = 1) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile);
    }
  }
  return geo;
}

export function mesh(parent, geo, mat, reg, { pos, rot, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.castShadow = cast; m.receiveShadow = receive;
  tag(m, reg);
  parent.add(m);
  return m;
}

/** Box centred at (x,y,z) size (w,h,d). mat may be an array (box face order). */
export function box(parent, w, h, d, mat, x, y, z, reg, opts = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (opts.tile) tileBox(g, w, h, d, opts.tile);
  return mesh(parent, g, mat, reg, { pos: [x, y, z], ...opts });
}

export function tube(parent, points, radius, mat, reg, { seg = 24, radial = 6, cast = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, radius, radial, false);
  return mesh(parent, g, mat, reg, { cast, receive: false });
}

export function cyl(parent, r0, r1, h, mat, x, y, z, reg, radial = 12, opts = {}) {
  return mesh(parent, new THREE.CylinderGeometry(r1, r0, h, radial), mat, reg, { pos: [x, y, z], ...opts });
}

/** Horizontal decal quad lying on top of the platform */
export function decal(parent, w, d, x, y, z, mat, name, line = 'detail', mask = 'floor') {
  const m = mat.clone();
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  if (!m.userData.fit) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / (m.userData.tileM ?? 1), uv.getY(i) * d / (m.userData.tileM ?? 1));
  return mesh(parent, g, m, { name, mask, line }, { pos: [x, y, z], rot: [-Math.PI / 2, 0, 0], cast: false });
}

/** Sweep a rectangular cross-section (cw x ch, centred above y0) along a polyline of [x,z]. */
export function sweepRect(parent, pts, y0, cw, ch, mat, reg) {
  const pos = [], idx = [];
  const hw = cw / 2;
  const n = pts.length;
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz, nz = tx; // left normal in XZ
    const [px, pz] = pts[i];
    ring.push([
      [px - nx * hw, y0, pz - nz * hw], [px + nx * hw, y0, pz + nz * hw],
      [px + nx * hw, y0 + ch, pz + nz * hw], [px - nx * hw, y0 + ch, pz - nz * hw],
    ]);
  }
  const g = new THREE.BufferGeometry();
  const verts = [], indices = [], uvs = [];
  let dist = 0;
  const cum = [0];
  for (let i = 1; i < n; i++) { dist += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(dist); }
  const fw = [cw, ch, cw, ch];
  // per-quad vertices so each face has a flat normal
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < 4; s++) {
      const a0 = ring[i][s], a1 = ring[i][(s + 1) % 4], b0 = ring[i + 1][s], b1 = ring[i + 1][(s + 1) % 4];
      const base = verts.length / 3;
      verts.push(...a0, ...a1, ...b1, ...b0);
      uvs.push(0, cum[i], fw[s], cum[i], fw[s], cum[i + 1], 0, cum[i + 1]);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return mesh(parent, g, mat, reg, { cast: true });
}
