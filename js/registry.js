// Three kinds of IDs, kept separate:
//  editId   - stable per named part (selection, overrides, saved state)
//  mask     - category used for post masks (floor/pillar/roof...)
//  line     - outline group: decides how strongly its borders become lines
import { hash24 } from './rng.js';

export const MASK = { sky: 0, floor: 1, pillar: 2, roof: 3, track: 4, ground: 5, fixture: 6, pole: 7, veg: 8, building: 9, train: 10, wire: 11 };
// weight of lines whose border touches this group (0 = never)
export const LINE = { none: 0, struct: 1, detail: 2, ground: 3, bg: 4 };
export const LINE_WEIGHT = [0, 1.0, 0.45, 0.22, 0.18];

/** Tag an Object3D (Mesh or InstancedMesh). Children inherit nothing; tag meshes. */
export function tag(obj, { name, mask, line = 'struct', noG = false }) {
  obj.name = name;
  obj.userData.reg = { name, editId: hash24(name) || 1, mask: MASK[mask], line: LINE[line] };
  if (noG) obj.userData.noG = true; // excluded from G-buffer passes (alpha cards, etc.)
  return obj;
}
