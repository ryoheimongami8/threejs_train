import * as THREE from 'three';
import { state, setPath, emit, saveCameraFor, loadCameraFor } from './state.js';

export const PHOTOS = ['o3433247515091178067.jpg', 'maxresdefault.jpg', 'images.jpg'];

/** state.camera -> THREE camera. yaw>0 looks left, pitch>0 looks up (degrees). */
export function applyCamera(camera) {
  const c = state.camera;
  camera.position.set(c.x, c.y, c.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(THREE.MathUtils.degToRad(c.pitch), THREE.MathUtils.degToRad(c.yaw), 0);
  camera.fov = c.fov;
  camera.aspect = state.aspect;
  camera.near = 0.1; camera.far = 2000;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

/** Photo overlay + reference-point markers, drawn on top of the canvas. */
export class PhotoOverlay {
  constructor(stage, canvas, camera) {
    this.camera = camera;
    this.img = document.createElement('img');
    this.img.className = 'overlay';
    this.mark = document.createElement('canvas');
    this.mark.className = 'overlay';
    stage.append(this.img, this.mark);
    this.canvas = canvas;
    this.picking = null; // index of ref point awaiting a photo click
    this.mark.addEventListener('click', (e) => this.onClick(e));
    this.refresh();
  }
  get on() { return state.photo.show; }
  refresh() {
    const p = state.photo;
    const src = `photo/${p.name}`;
    if (!this.img.src.endsWith(encodeURI(src))) this.img.src = src;
    this.img.style.display = p.show ? 'block' : 'none';
    this.img.style.opacity = p.opacity;
    this.mark.style.display = p.show || state.refPoints.length ? 'block' : 'none';
    this.mark.style.pointerEvents = this.picking !== null ? 'auto' : 'none';
    this.mark.style.cursor = this.picking !== null ? 'crosshair' : 'default';
    this.draw();
  }
  onClick(e) {
    if (this.picking === null) return;
    const r = this.mark.getBoundingClientRect();
    const rp = state.refPoints[this.picking];
    rp.uv = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    this.picking = null;
    emit('refPoints');
  }
  /** returns reprojection errors (px at displayed size) */
  draw() {
    const m = this.mark, r = this.canvas.getBoundingClientRect();
    m.width = Math.max(1, Math.round(r.width)); m.height = Math.max(1, Math.round(r.height));
    const ctx = m.getContext('2d');
    ctx.clearRect(0, 0, m.width, m.height);
    const errs = [];
    state.refPoints.forEach((rp, i) => {
      ctx.lineWidth = 2;
      let sx = null;
      if (rp.world) {
        const v = new THREE.Vector3(...rp.world).project(this.camera);
        if (v.z < 1) sx = [(v.x * 0.5 + 0.5) * m.width, (-v.y * 0.5 + 0.5) * m.height];
      }
      if (rp.uv) {
        const px = [rp.uv[0] * m.width, rp.uv[1] * m.height];
        ctx.strokeStyle = '#ff3b6b';
        ctx.beginPath(); ctx.moveTo(px[0] - 9, px[1]); ctx.lineTo(px[0] + 9, px[1]); ctx.moveTo(px[0], px[1] - 9); ctx.lineTo(px[0], px[1] + 9); ctx.stroke();
        if (sx) { ctx.strokeStyle = '#2ee6d6'; ctx.beginPath(); ctx.moveTo(px[0], px[1]); ctx.lineTo(sx[0], sx[1]); ctx.stroke(); errs[i] = Math.hypot(px[0] - sx[0], px[1] - sx[1]); }
        ctx.fillStyle = '#ff3b6b'; ctx.font = '12px sans-serif'; ctx.fillText(rp.name || `#${i}`, px[0] + 10, px[1] - 8);
      }
      if (sx) { ctx.strokeStyle = '#2ee6d6'; ctx.beginPath(); ctx.arc(sx[0], sx[1], 7, 0, 7); ctx.stroke(); }
    });
    this.errors = errs;
    return errs;
  }
}

export { saveCameraFor, loadCameraFor };
