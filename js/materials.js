import * as THREE from 'three';
import { rngFor } from './rng.js';

// Procedural canvas materials. Seeded by the 'finish' stage so re-rolling
// paint/dirt never moves any geometry.
let cache = new Map();
export function resetMaterials() {
  for (const v of cache.values()) for (const m of (v.isMaterial ? [v] : Object.values(v))) { m.map?.dispose?.(); m.dispose?.(); }
  cache = new Map();
}

function canvasTex(size, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 16;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function canvasTexWH(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
function speckle(ctx, s, rng, n, base, amp, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = (rng() - 0.5) * amp;
    ctx.fillStyle = rgb(base[0] + v, base[1] + v, base[2] + v, 0.5);
    ctx.fillRect(rng() * s, rng() * s, size * (0.5 + rng()), size * (0.5 + rng()));
  }
}

const makers = {
  // patchwork asphalt/slab floor, one tile = 4 m
  floor(seeds) {
    const rng = rngFor(seeds, 'finish', 'floor');
    return canvasTex(1024, (ctx, s) => {
      ctx.fillStyle = rgb(86, 87, 90); ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 46; i++) {
        const v = rng.range(-22, 22);
        const x = rng() * s, y = rng() * s, w = rng.range(50, 360), h = rng.range(36, 300);
        ctx.fillStyle = rgb(86 + v, 87 + v, 90 + v + rng.range(-2, 3));
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = rgb(170, 172, 178, 0.22); ctx.lineWidth = 2;   // pale joint between asphalt patches
        ctx.strokeRect(x, y, w, h);
      }
      speckle(ctx, s, rng, 9000, [86, 87, 90], 16, 2.5);
      ctx.strokeStyle = rgb(40, 42, 50, 0.35); ctx.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i * s / 4, 0); ctx.lineTo(i * s / 4, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * s / 4); ctx.lineTo(s, i * s / 4); ctx.stroke();
      }
    });
  },
  // unit-paver grid (light-grey bricks) for decal zones
  paver(seeds) {
    const rng = rngFor(seeds, 'finish', 'paver');
    return canvasTex(512, (ctx, s) => {
      ctx.fillStyle = rgb(60, 62, 68); ctx.fillRect(0, 0, s, s);
      const nx = 6, ny = 12, bw = s / nx, bh = s / ny;
      for (let y = 0; y < ny; y++) for (let x = -1; x < nx; x++) {
        const v = rng.range(-16, 18);
        const ox = (y % 2) * bw / 2;
        ctx.fillStyle = rgb(146 + v, 150 + v, 158 + v);
        ctx.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, bh - 4);
      }
    });
  },
  tactile() { // yellow dotted block
    return canvasTex(256, (ctx, s) => {
      ctx.fillStyle = rgb(226, 170, 40); ctx.fillRect(0, 0, s, s);
      const n = 6, w = s / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        ctx.fillStyle = rgb(244, 196, 70); ctx.beginPath(); ctx.arc(x * w + w / 2, y * w + w / 2, w * 0.28, 0, 7); ctx.fill();
        ctx.fillStyle = rgb(160, 110, 20, 0.5); ctx.beginPath(); ctx.arc(x * w + w / 2 + 2, y * w + w / 2 + 3, w * 0.2, 0, 7); ctx.fill();
      }
    });
  },

  // vertical pillar with soot, rain streaks, rust drips, grime at the foot, chips and stickers
  pillarDirt(seeds) {
    const rng = rngFor(seeds, 'finish', 'pillarDirt');
    return canvasTexWH(256, 1536, (ctx, w, h) => {
      ctx.fillStyle = rgb(178, 172, 152); ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, rng, 1200, [178, 172, 152], 30, 2);
      // soot toward the roof
      let g = ctx.createLinearGradient(0, 0, 0, h * 0.2); g.addColorStop(0, 'rgba(40,36,30,0.55)'); g.addColorStop(1, 'rgba(40,36,30,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.2);
      // rain streaks
      for (let i = 0; i < 70; i++) {
        const x = rng() * w, len = rng.range(160, 1100), y0 = rng.range(0, h * 0.4), sw = rng.range(2, 12);
        g = ctx.createLinearGradient(0, y0, 0, y0 + len);
        const a = rng.range(0.1, 0.32);
        g.addColorStop(0, rgb(70, 62, 48, a)); g.addColorStop(1, rgb(70, 62, 48, 0));
        ctx.fillStyle = g; ctx.fillRect(x, y0, sw, len);
      }
      // rust drips from the bracket area
      for (let i = 0; i < 14; i++) {
        const x = rng() * w, y0 = rng.range(h * 0.45, h * 0.8), len = rng.range(120, 420);
        g = ctx.createLinearGradient(0, y0, 0, y0 + len);
        g.addColorStop(0, 'rgba(150,76,34,0.38)'); g.addColorStop(1, 'rgba(150,76,34,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y0, rng.range(3, 9), len);
      }
      // grime + moss at the foot
      g = ctx.createLinearGradient(0, h * 0.8, 0, h); g.addColorStop(0, 'rgba(70,84,48,0)'); g.addColorStop(1, 'rgba(60,72,40,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, h * 0.8, w, h * 0.2);
      // paint chips
      for (let i = 0; i < 60; i++) { ctx.fillStyle = rgb(120, 112, 96, rng.range(0.25, 0.6)); ctx.fillRect(rng() * w, rng() * h, rng.range(3, 14), rng.range(3, 22)); }
      // stickers / plates
      ctx.fillStyle = rgb(226, 120, 40); ctx.fillRect(w * 0.15, h * 0.62, w * 0.5, 64);
      ctx.fillStyle = rgb(240, 240, 232); ctx.fillRect(w * 0.2, h * 0.5, w * 0.4, 90);
      ctx.fillStyle = rgb(30, 30, 40); ctx.fillRect(w * 0.26, h * 0.5 + 22, w * 0.28, 8); ctx.fillRect(w * 0.26, h * 0.5 + 50, w * 0.2, 8);
      ctx.fillStyle = rgb(40, 110, 160); ctx.fillRect(w * 0.55, h * 0.36, w * 0.3, 70);
    });
  },
  signWomen() { // generic women-only floor marking (pink plate)
    return canvasTexWH(512, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const rr = (x, y, ww, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
      ctx.fillStyle = rgb(236, 120, 156); rr(4, 4, w - 8, h - 8, 26); ctx.fill();
      ctx.strokeStyle = rgb(255, 255, 255); ctx.lineWidth = 6; rr(16, 16, w - 32, h - 32, 18); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 84px "Yu Gothic","Meiryo",sans-serif'; ctx.fillText('女性専用車', w / 2, h * 0.42);
      ctx.font = 'bold 40px sans-serif'; ctx.fillText('WOMEN ONLY', w / 2, h * 0.76);
    });
  },
  signGreen() { // teal boarding-position panel with stripes
    return canvasTexWH(512, 256, (ctx, w, h) => {
      ctx.fillStyle = rgb(70, 178, 146); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rgb(236, 240, 232); ctx.fillRect(0, h * 0.30, w, 8); ctx.fillRect(0, h * 0.70, w, 8);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 80px "Yu Gothic","Meiryo",sans-serif'; ctx.fillText('3号車 乗車口', w / 2, h * 0.5);
    });
  },
  signGreen2() {
    return canvasTexWH(256, 256, (ctx, w, h) => {
      ctx.fillStyle = rgb(48, 150, 112); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rgb(228, 238, 228); ctx.fillRect(14, 14, w - 28, 8); ctx.fillRect(14, h - 22, w - 28, 8);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 120px sans-serif'; ctx.fillText('Ⅲ', w / 2, h / 2);
    });
  },
  tactileDark() { // weathered grey-olive dotted block (inner strip in the photo)
    return canvasTex(256, (ctx, s) => {
      ctx.fillStyle = rgb(58, 58, 56); ctx.fillRect(0, 0, s, s);
      const n = 6, w = s / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        ctx.fillStyle = rgb(128, 120, 92); ctx.beginPath(); ctx.arc(x * w + w / 2, y * w + w / 2, w * 0.27, 0, 7); ctx.fill();
        ctx.fillStyle = rgb(30, 30, 28, 0.6); ctx.beginPath(); ctx.arc(x * w + w / 2 + 2, y * w + w / 2 + 3, w * 0.18, 0, 7); ctx.fill();
      }
    });
  },
  signRadio() { // generic vertical sign board
    return canvasTexWH(128, 320, (ctx, w, h) => {
      ctx.fillStyle = rgb(244, 244, 238); ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = rgb(44, 150, 110); ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 66px "Yu Gothic","Meiryo",sans-serif';
      [...'無線切替'].forEach((c, i) => ctx.fillText(c, w / 2, 52 + i * 72));
    });
  },
  leafAlpha(seeds) { // cut-out mask: dense leaf dapples, ragged at the edge of every clump
    const rng = rngFor(seeds, 'finish', 'leafAlpha');
    return canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 1100; i++) { ctx.beginPath(); ctx.ellipse(rng() * s, rng() * s, rng.range(3, 9), rng.range(2.5, 7), rng() * 3.14, 0, 7); ctx.fill(); }
    }, { srgb: false });
  },
  needleAlpha(seeds) { // conifer skirt: needle tufts, tips broken along the lower edge
    const rng = rngFor(seeds, 'finish', 'needleAlpha');
    return canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
      ctx.fillRect(0, 0, s, s * 0.45);
      for (let i = 0; i < 520; i++) {
        const x = rng() * s, y = rng.range(s * 0.2, s * 0.95), len = rng.range(10, 34);
        ctx.lineWidth = rng.range(2, 5); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-5, 5), y + len * (1.1 - y / s)); ctx.stroke();
      }
    }, { srgb: false });
  },
  panelDirt(seeds) { // painted cabinet: edge wear, rain streaks from the lid, rust at the lower corners
    const rng = rngFor(seeds, 'finish', 'panelDirt');
    return canvasTexWH(512, 256, (ctx, w, h) => {
      ctx.fillStyle = rgb(226, 222, 206); ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, rng, 1500, [226, 222, 206], 20, 2);
      for (let i = 0; i < 40; i++) {
        const x = rng() * w, len = rng.range(40, 200), g = ctx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, rgb(80, 74, 60, rng.range(0.1, 0.3))); g.addColorStop(1, rgb(80, 74, 60, 0));
        ctx.fillStyle = g; ctx.fillRect(x, 0, rng.range(2, 8), len);
      }
      let g = ctx.createLinearGradient(0, h * 0.7, 0, h); g.addColorStop(0, 'rgba(60,54,44,0)'); g.addColorStop(1, 'rgba(60,54,44,0.5)');
      ctx.fillStyle = g; ctx.fillRect(0, h * 0.7, w, h * 0.3);
      for (const x of [0, w]) { g = ctx.createRadialGradient(x, h, 0, x, h, 90); g.addColorStop(0, 'rgba(150,76,34,0.55)'); g.addColorStop(1, 'rgba(150,76,34,0)'); ctx.fillStyle = g; ctx.fillRect(x - 90, h - 90, 180, 90); }
      ctx.strokeStyle = 'rgba(70,64,52,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(0, 0, w, h);
    });
  },
  footGrime() { // soft dark stain around a pillar foot
    return canvasTexWH(256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(34,30,26,0.6)'); g.addColorStop(0.55, 'rgba(34,30,26,0.25)'); g.addColorStop(1, 'rgba(34,30,26,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
  },
  bldBands(seeds) { // wall with horizontal glass strips, 3 floors per tile
    const rng = rngFor(seeds, 'finish', 'bldBands');
    return canvasTex(256, (ctx, s) => {
      ctx.fillStyle = rgb(226, 222, 212); ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 3; i++) {
        const y = i * s / 3 + s * 0.09, hh = s * 0.17;
        ctx.fillStyle = rgb(86 + rng.range(-6, 6), 120 + rng.range(-6, 6), 150 + rng.range(-6, 6)); ctx.fillRect(0, y, s, hh);
        ctx.fillStyle = rgb(190, 188, 178); ctx.fillRect(0, y + hh, s, 5);
      }
      for (let x = 0; x < s; x += s / 2) { ctx.fillStyle = rgb(170, 166, 156, 0.7); ctx.fillRect(x, 0, 3, s); }
    });
  },
  bldPanels(seeds) { // large panel divisions with a few windows
    const rng = rngFor(seeds, 'finish', 'bldPanels');
    return canvasTex(256, (ctx, s) => {
      ctx.fillStyle = rgb(214, 208, 192); ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = rgb(150, 144, 130); ctx.lineWidth = 3;
      for (let i = 0; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s / 2, 0); ctx.lineTo(i * s / 2, s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * s / 3); ctx.lineTo(s, i * s / 3); ctx.stroke(); }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) if (rng() < 0.6) { ctx.fillStyle = rgb(88, 116, 142); ctx.fillRect(c * s / 2 + s * 0.14, r * s / 3 + s * 0.1, s * 0.22, s * 0.13); }
    });
  },
  trainSide() { // silver stainless side: window band, doors, yellow stripe (generic livery)
    return canvasTexWH(2048, 256, (ctx, w, h) => {
      ctx.fillStyle = rgb(196, 200, 204); ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // yellow band under windows, thin blue line below
      ctx.fillStyle = rgb(244, 190, 20); ctx.fillRect(0, h * 0.62, w, h * 0.12);
      ctx.fillStyle = rgb(30, 90, 170); ctx.fillRect(0, h * 0.76, w, h * 0.025);
      // windows
      const n = 4, dw = w * 0.085;
      for (let d = 0; d < n; d++) {
        const dx = (d + 0.5) * w / n - dw / 2;
        ctx.fillStyle = rgb(150, 156, 160); ctx.fillRect(dx - 4, h * 0.07, dw + 8, h * 0.78);         // door
        ctx.fillStyle = rgb(56, 84, 108); ctx.fillRect(dx + 8, h * 0.13, dw / 2 - 12, h * 0.4); ctx.fillRect(dx + dw / 2 + 4, h * 0.13, dw / 2 - 12, h * 0.4);
        const wx0 = dx + dw + 10, wx1 = ((d + 1.5) * w / n) - dw / 2 - 10, cnt = 3, ww = (wx1 - wx0 - (cnt - 1) * 10) / cnt;
        if (d < n - 1) for (let i = 0; i < cnt; i++) { ctx.fillStyle = rgb(50, 78, 100); ctx.fillRect(wx0 + i * (ww + 10), h * 0.11, ww, h * 0.42); }
      }
      const wx0 = 14, wx1 = (0.5 * w / n) - dw / 2 - 10, ww2 = (wx1 - wx0 - 10) / 2; // end windows
      for (let i = 0; i < 2; i++) { ctx.fillStyle = rgb(50, 78, 100); ctx.fillRect(wx0 + i * (ww2 + 10), h * 0.11, ww2, h * 0.42); }
      const ex0 = (n - 0.5) * w / n + dw / 2 + 10, ww3 = (w - 14 - ex0 - 10) / 2;
      for (let i = 0; i < 2; i++) { ctx.fillStyle = rgb(50, 78, 100); ctx.fillRect(ex0 + i * (ww3 + 10), h * 0.11, ww3, h * 0.42); }
    }, { srgb: true });
  },
  trainFront() {
    return canvasTexWH(512, 256, (ctx, w, h) => {
      ctx.fillStyle = rgb(196, 200, 204); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rgb(244, 190, 20); ctx.fillRect(0, h * 0.7, w, h * 0.12);
      ctx.fillStyle = rgb(30, 30, 36); ctx.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.42);       // cab window
      ctx.fillStyle = rgb(70, 100, 126); ctx.fillRect(w * 0.14, h * 0.14, w * 0.72, h * 0.36);
      ctx.fillStyle = rgb(30, 30, 36); ctx.fillRect(w * 0.47, h * 0.12, w * 0.06, h * 0.42);       // centre gangway door frame
      ctx.fillStyle = rgb(255, 250, 220); ctx.beginPath(); ctx.arc(w * 0.12, h * 0.62, 12, 0, 7); ctx.arc(w * 0.88, h * 0.62, 12, 0, 7); ctx.fill();
      ctx.fillStyle = rgb(190, 40, 40); ctx.beginPath(); ctx.arc(w * 0.2, h * 0.62, 7, 0, 7); ctx.arc(w * 0.8, h * 0.62, 7, 0, 7); ctx.fill();
      ctx.fillStyle = rgb(240, 240, 240); ctx.fillRect(w * 0.36, h * 0.03, w * 0.28, h * 0.07);   // destination board
      ctx.fillStyle = rgb(230, 120, 30); ctx.fillRect(w * 0.38, h * 0.045, w * 0.24, h * 0.03);
    });
  },
  trainEnd() {
    return canvasTexWH(256, 256, (ctx, w, h) => {
      ctx.fillStyle = rgb(168, 172, 176); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rgb(60, 64, 68); ctx.fillRect(w * 0.2, h * 0.14, w * 0.6, h * 0.5);
    });
  },
  concrete(seeds) {
    const rng = rngFor(seeds, 'finish', 'concrete');
    return canvasTex(512, (ctx, s) => {
      ctx.fillStyle = rgb(150, 148, 142); ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, rng, 7000, [150, 148, 142], 50, 3);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = rgb(60, 56, 50, 0.05); ctx.fillRect(rng() * s, 0, rng.range(2, 14), s); }
    });
  },
  roofUnder(seeds) {
    const rng = rngFor(seeds, 'finish', 'roofUnder');
    return canvasTex(512, (ctx, s) => {
      ctx.fillStyle = rgb(138, 134, 124); ctx.fillRect(0, 0, s, s);
      const n = 6;
      for (let i = 0; i < n; i++) { const v = rng.range(-14, 12); ctx.fillStyle = rgb(138 + v, 134 + v, 124 + v); ctx.fillRect(0, i * s / n, s, s / n - 3); }
      speckle(ctx, s, rng, 6000, [136, 132, 122], 22, 3);
    });
  },
  roofTop(seeds) {
    const rng = rngFor(seeds, 'finish', 'roofTop');
    return canvasTex(512, (ctx, s) => {
      ctx.fillStyle = rgb(120, 124, 128); ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 16; i++) { ctx.fillStyle = rgb(90, 94, 98, 0.5); ctx.fillRect(i * s / 16, 0, 3, s); }
      speckle(ctx, s, rng, 5000, [120, 124, 128], 40, 3);
    });
  },
  ballast(seeds) {
    const rng = rngFor(seeds, 'finish', 'ballast');
    return canvasTex(512, (ctx, s) => {
      ctx.fillStyle = rgb(92, 88, 84); ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 3200; i++) {
        const v = rng.range(-55, 70);
        ctx.fillStyle = rgb(104 + v, 100 + v, 96 + v);
        ctx.beginPath(); ctx.ellipse(rng() * s, rng() * s, rng.range(3, 9), rng.range(3, 7), rng() * 3, 0, 7); ctx.fill();
      }
    });
  },
  grassDry(seeds) {
    const rng = rngFor(seeds, 'finish', 'grass');
    return canvasTex(512, (ctx, s) => {
      ctx.fillStyle = rgb(196, 150, 84); ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 6000; i++) {
        const v = rng.range(-46, 52);
        ctx.strokeStyle = rgb(204 + v, 158 + v * 0.8, 88 + v * 0.4, 0.7); ctx.lineWidth = rng.range(1, 2.5);
        ctx.beginPath(); const x = rng() * s, y = rng() * s; ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-6, 6), y - rng.range(8, 22)); ctx.stroke();
      }
    });
  },
  mesh() { // fence mesh with alpha
    return canvasTex(128, (ctx, s) => {
      ctx.clearRect(0, 0, s, s); ctx.strokeStyle = 'rgba(200,205,212,1)'; ctx.lineWidth = 3;
      for (let i = -s; i < s * 2; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i + s, 0); ctx.lineTo(i, s); ctx.stroke();
      }
    });
  },
  windows(seeds) {
    const rng = rngFor(seeds, 'finish', 'windows');
    return canvasTex(256, (ctx, s) => {
      ctx.fillStyle = rgb(205, 205, 210); ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) {
        const v = rng.range(-20, 30);
        ctx.fillStyle = rgb(90 + v, 130 + v, 170 + v); ctx.fillRect(x * s / 6 + 5, y * s / 8 + 5, s / 6 - 10, s / 8 - 10);
      }
    });
  },
  foliage(seeds) {
    const rng = rngFor(seeds, 'finish', 'foliage');
    return canvasTex(256, (ctx, s) => {
      ctx.fillStyle = rgb(60, 92, 48); ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 1800; i++) {
        const v = rng.range(-30, 40);
        ctx.fillStyle = rgb(60 + v * 0.8, 96 + v, 46 + v * 0.4, 0.8);
        ctx.beginPath(); ctx.arc(rng() * s, rng() * s, rng.range(3, 9), 0, 7); ctx.fill();
      }
    });
  },
};

const PRESETS = {
  floor:     { tex: 'floor', rough: 0.92, metal: 0, rep: [1, 1] },
  paver:     { tex: 'paver', rough: 0.8, metal: 0, rep: [1, 1] },
  tactileDark: { tex: 'tactileDark', rough: 0.75, metal: 0, rep: [1, 1] },
  panelDirt: { tex: 'panelDirt', rough: 0.5, metal: 0.2, rep: [1, 1], fit: true },
  footGrime: { tex: 'footGrime', rough: 1, metal: 0, rep: [1, 1], fit: true, blend: true },
  bldBands: { tex: 'bldBands', rough: 0.7, metal: 0, rep: [1, 1] },
  bldPanels: { tex: 'bldPanels', rough: 0.8, metal: 0, rep: [1, 1] },
  trainSide: { tex: 'trainSide', rough: 0.35, metal: 0.55, rep: [1, 1], fit: true },
  trainFront: { tex: 'trainFront', rough: 0.35, metal: 0.5, rep: [1, 1], fit: true },
  trainEnd: { tex: 'trainEnd', rough: 0.5, metal: 0.4, rep: [1, 1], fit: true },
  signRadio: { tex: 'signRadio', rough: 0.7, metal: 0, rep: [1, 1], fit: true },
  tactile:   { tex: 'tactile', rough: 0.7, metal: 0, rep: [1, 1] },
  concrete:  { tex: 'concrete', rough: 0.9, metal: 0, rep: [1, 1] },
  roofUnder: { tex: 'roofUnder', rough: 0.95, metal: 0, rep: [1, 1] },
  roofTop:   { tex: 'roofTop', rough: 0.6, metal: 0.3, rep: [1, 1] },
  ballast:   { tex: 'ballast', rough: 1, metal: 0, rep: [1, 1] },
  grass:     { tex: 'grassDry', rough: 1, metal: 0, rep: [1, 1] },
  windows:   { tex: 'windows', rough: 0.4, metal: 0, rep: [1, 1] },
  foliage:   { color: '#ffffff', rough: 1, metal: 0 },
  pillar:    { color: '#cfc9b4', rough: 0.75, metal: 0.05 },
  pillarDirt:{ tex: 'pillarDirt', rough: 0.85, metal: 0.02, rep: [1, 1] },
  signWomen: { tex: 'signWomen', rough: 0.75, metal: 0, rep: [1, 1], fit: true, alpha: true },
  signGreen: { tex: 'signGreen', rough: 0.75, metal: 0, rep: [1, 1], fit: true },
  signGreen2:{ tex: 'signGreen2', rough: 0.75, metal: 0, rep: [1, 1], fit: true },
  yellowLine:{ color: '#e6b21e', rough: 0.7, metal: 0 },
  inlayDark: { color: '#2d3036', rough: 0.9, metal: 0 },
  inlayLight:{ color: '#8d9198', rough: 0.85, metal: 0 },
  steel:     { color: '#8f8e88', rough: 0.55, metal: 0.7 },
  pole:      { color: '#c4c9cd', rough: 0.5, metal: 0.7 },
  rail:      { color: '#7a4a32', rough: 0.55, metal: 0.7 },
  sleeper:   { color: '#6d6a64', rough: 0.95, metal: 0 },
  pipe:      { color: '#e8e6dc', rough: 0.55, metal: 0.1 },
  cable:     { color: '#16181a', rough: 0.6, metal: 0.2 },
  wireY:     { color: '#e3b83a', rough: 0.5, metal: 0.2 },
  wireG:     { color: '#4b4f55', rough: 0.5, metal: 0.4 },
  lampBody:  { color: '#d8d6cc', rough: 0.5, metal: 0.2 },
  lampGlow:  { color: '#fff7e0', emissive: '#fff4d0', ei: 0.9, rough: 0.4, metal: 0 },
  box:       { color: '#e4e0cf', rough: 0.7, metal: 0.05 },
  trunk:     { color: '#5b4632', rough: 1, metal: 0 },
  fenceBlue: { color: '#7d8aa0', rough: 0.6, metal: 0.4 },
  orange:    { color: '#e0642c', rough: 0.7, metal: 0 },
  pink:      { color: '#e07aa0', rough: 0.8, metal: 0 },
  green:     { color: '#3caa86', rough: 0.8, metal: 0 },
  white:     { color: '#eeeeee', rough: 0.8, metal: 0 },
  dark:      { color: '#2b2d31', rough: 0.9, metal: 0 },
};

/** getMat(seeds, name, {repeat:[u,v]}); repeat = texture repeats over UV 0..1 */
export function getMat(seeds, name, { repeat, side } = {}) {
  const key = name + (repeat ? repeat.join(',') : '') + (side ?? '');
  if (cache.has(key)) return cache.get(key);
  const p = PRESETS[name];
  if (!p) throw new Error('no material ' + name);
  const m = new THREE.MeshStandardMaterial({ roughness: p.rough, metalness: p.metal });
  if (p.tex) {
    const t = makers[p.tex](seeds);
    t.repeat.set(...(repeat ?? p.rep));
    m.map = t;
  } else m.color = new THREE.Color(p.color);
  if (p.fit) m.userData.fit = true;
  if (p.blend) { m.transparent = true; m.depthWrite = false; }
  if (p.alpha) { m.transparent = true; m.alphaTest = 0.5; }
  if (p.emissive) { m.emissive = new THREE.Color(p.emissive); m.emissiveIntensity = p.ei; }
  if (side) m.side = side;
  cache.set(key, m);
  return m;
}
export function getFenceMat(seeds, repeat) {
  const key = 'fenceMesh' + repeat;
  if (cache.has(key)) return cache.get(key);
  const t = makers.mesh(seeds);
  t.repeat.set(...repeat);
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
  cache.set(key, m);
  return m;
}

/** vertical-bar steel fence (alpha cutout) */
export function getBarFenceMat(seeds, repeat) {
  const key = 'barFence' + repeat;
  if (cache.has(key)) return cache.get(key);
  const t = canvasTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = 'rgb(118,134,166)';
    for (let x = 0; x < s; x += 16) ctx.fillRect(x + 5, 0, 6, s);
    ctx.fillRect(0, 4, s, 10); ctx.fillRect(0, s / 2 - 5, s, 8); ctx.fillRect(0, s - 14, s, 10);
  });
  t.repeat.set(...repeat);
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.5 });
  cache.set(key, m);
  return m;
}

/** alpha-cut foliage material: kind 'broad' | 'conifer' */
export function getLeafMat(seeds, kind = 'broad') {
  const key = 'leaf' + kind;
  if (cache.has(key)) return cache.get(key);
  const t = kind === 'conifer' ? makers.needleAlpha(seeds) : makers.leafAlpha(seeds);
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
  // holes only toward the silhouette: surfaces facing the camera stay solid, grazing ones break up into leaves
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>',
      'float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));\n  diffuseColor.a = mix(diffuseColor.a, 1.0, smoothstep(0.3, 0.62, facing));\n#include <alphatest_fragment>');
  };
  m.customProgramCacheKey = () => 'leafEdge';
  cache.set(key, m);
  return m;
}

/** lit LED guidance panel; kind 'main' | 'exit'. Generic wording. */
export function getSignMat(seeds, kind) {
  const key = 'sign' + kind;
  if (cache.has(key)) return cache.get(key);
  const t = kind === 'main'
    ? canvasTexWH(1536, 360, (ctx, w, h) => {
        ctx.fillStyle = '#16181c'; ctx.fillRect(0, 0, w, h);
        const cell = (x, bg, draw) => { ctx.fillStyle = bg; ctx.fillRect(x + 8, 8, w / 4 - 16, h - 16); draw(x + 8, w / 4 - 16); };
        const arrow = (cx, cy, s, col, rot = 0) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, -s * 0.1); ctx.lineTo(s * 0.28, -s * 0.1); ctx.lineTo(s * 0.28, s); ctx.lineTo(-s * 0.28, s); ctx.lineTo(-s * 0.28, -s * 0.1); ctx.lineTo(-s * 0.7, -s * 0.1); ctx.closePath(); ctx.fill(); ctx.restore(); };
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        cell(0, '#f2c21a', (x0, cw) => { arrow(x0 + 70, h / 2, 48, '#111'); ctx.fillStyle = '#111'; ctx.font = 'bold 76px "Yu Gothic","Meiryo",sans-serif'; ctx.fillText('東口', x0 + 150, h * 0.36); ctx.font = '40px sans-serif'; ctx.fillText('East Exit', x0 + 150, h * 0.66);
          ctx.fillStyle = '#12906a'; ctx.beginPath(); ctx.arc(x0 + cw - 62, h * 0.5, 38, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', x0 + cw - 62, h * 0.52); ctx.textAlign = 'left'; });
        cell(w / 4, '#f4f4f0', (x0, cw) => { arrow(x0 + 70, h / 2, 48, '#111'); ctx.fillStyle = '#111'; ctx.font = 'bold 96px sans-serif'; ctx.fillText('1・2', x0 + 140, h * 0.4); ctx.font = '38px "Yu Gothic","Meiryo",sans-serif'; ctx.fillText('番線 各駅停車', x0 + 140, h * 0.74); ctx.fillStyle = '#f2c21a'; ctx.fillRect(x0 + cw - 44, h * 0.2, 22, h * 0.6); });
        cell(w / 2, '#f4f4f0', (x0, cw) => { arrow(x0 + 70, h / 2, 48, '#111'); ctx.fillStyle = '#d23a3a'; ctx.beginPath(); ctx.arc(x0 + 170, h * 0.3, 18, 0, 7); ctx.fill(); ctx.fillRect(x0 + 156, h * 0.38, 28, 70); ctx.fillStyle = '#2a64c8'; ctx.beginPath(); ctx.arc(x0 + 230, h * 0.3, 18, 0, 7); ctx.fill(); ctx.fillRect(x0 + 216, h * 0.38, 28, 70);
          ctx.fillStyle = '#111'; ctx.font = 'bold 66px "Yu Gothic","Meiryo",sans-serif'; ctx.fillText('化粧室', x0 + 130, h * 0.78); });
        cell(w * 0.75, '#f4f4f0', (x0, cw) => { arrow(x0 + 70, h / 2, 48, '#111', Math.PI / 2 * 0); ctx.fillStyle = '#111'; ctx.font = 'bold 60px "Yu Gothic","Meiryo",sans-serif'; ctx.fillText('ホーム', x0 + 140, h * 0.38); ctx.font = '38px sans-serif'; ctx.fillText('To platform', x0 + 140, h * 0.7); ctx.fillStyle = '#d23a3a'; ctx.beginPath(); ctx.arc(x0 + cw - 62, h * 0.5, 36, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('M', x0 + cw - 62, h * 0.52); });
      })
    : canvasTexWH(768, 320, (ctx, w, h) => {
        ctx.fillStyle = '#16181c'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f2c21a'; ctx.fillRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = '#111'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.font = 'bold 118px "Yu Gothic","Meiryo",sans-serif'; ctx.fillText('改札口', w / 2, h * 0.38);
        ctx.font = '60px sans-serif'; ctx.fillText('Ticket Gates', w / 2, h * 0.76);
      });
  const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.55, roughness: 0.4, metalness: 0 });
  cache.set(key, m);
  return m;
}

const STRIPES = { orange: ['#e8731c', '#c85a10'], yellow: ['#f2bd14', '#c99a08'], sky: ['#2f9bd8', '#1f7bb0'] };

/** Commuter-train textures (generic livery, no operator marks). */
export function getTrainMats(seeds, stripe = 'orange') {
  const key = 'train' + stripe;
  if (cache.has(key)) return cache.get(key);
  const [S1, S2] = STRIPES[stripe] ?? STRIPES.orange;
  const rng = rngFor(seeds, 'finish', 'train');
  const glass = (ctx, x, y, w, h, r) => {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x - 5, y - 5, w + 10, h + 10, r + 4); ctx.fillStyle = '#2c2f33'; ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9fb7c8'); g.addColorStop(0.45, '#4d6677'); g.addColorStop(1, '#1d262d');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(x + w * 0.2, y); ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.1, y + h); ctx.lineTo(x - w * 0.2, y + h); ctx.fill();
    ctx.fillStyle = 'rgba(20,24,28,0.5)'; ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
    ctx.restore();
  };
  const side = canvasTexWH(4096, 640, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c9ccd0'); g.addColorStop(0.55, '#b3b6ba'); g.addColorStop(1, '#8e9195');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { ctx.fillStyle = rgb(120, 124, 128, rng.range(0.02, 0.06)); ctx.fillRect(rng() * w, rng() * h, rng.range(30, 160), 2); }
    ctx.fillStyle = S1; ctx.fillRect(0, h * 0.065, w, h * 0.085);
    ctx.fillStyle = S1; ctx.fillRect(0, h * 0.665, w, h * 0.14);
    ctx.fillStyle = S2; ctx.fillRect(0, h * 0.805, w, h * 0.012);
    ctx.fillStyle = 'rgba(70,72,76,0.5)'; ctx.fillRect(0, h * 0.17, w, 3); ctx.fillRect(0, h * 0.6, w, 3); ctx.fillRect(0, h * 0.95, w, 4);
    const n = 4, dw = w * 0.063;
    for (let d = 0; d < n; d++) {
      const cx = (d + 0.5) * w / n, x0 = cx - dw / 2;
      ctx.fillStyle = '#8d9094'; ctx.fillRect(x0 - 10, h * 0.14, dw + 20, h * 0.8);
      ctx.fillStyle = '#a4a7ab'; ctx.fillRect(x0, h * 0.16, dw / 2 - 3, h * 0.77); ctx.fillRect(x0 + dw / 2 + 3, h * 0.16, dw / 2 - 3, h * 0.77);
      ctx.fillStyle = S1; ctx.fillRect(x0, h * 0.7, dw / 2 - 3, h * 0.1); ctx.fillRect(x0 + dw / 2 + 3, h * 0.7, dw / 2 - 3, h * 0.1);
      glass(ctx, x0 + 14, h * 0.21, dw / 2 - 31, h * 0.34, 18); glass(ctx, x0 + dw / 2 + 17, h * 0.21, dw / 2 - 31, h * 0.34, 18);
      ctx.fillStyle = '#25282c'; ctx.fillRect(cx - 3, h * 0.16, 6, h * 0.77);
      ctx.fillStyle = '#2f77c4'; ctx.fillRect(x0 + 4, h * 0.58, 22, 22);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = (i + 0.5) * w / n + dw / 2 + 24, b = (i + 1.5) * w / n - dw / 2 - 24, gw = (b - a - 24) / 2;
      glass(ctx, a, h * 0.21, gw, h * 0.34, 30); glass(ctx, a + gw + 24, h * 0.21, gw, h * 0.34, 30);
    }
    const aL = 24, bL = 0.5 * w / n - dw / 2 - 24, gL = (bL - aL - 24) / 2;
    glass(ctx, aL, h * 0.21, gL, h * 0.34, 28); glass(ctx, aL + gL + 24, h * 0.21, gL, h * 0.34, 28);
    const aR = (n - 0.5) * w / n + dw / 2 + 24, bR = w - 24, gR = (bR - aR - 24) / 2;
    glass(ctx, aR, h * 0.21, gR, h * 0.34, 28); glass(ctx, aR + gR + 24, h * 0.21, gR, h * 0.34, 28);
    ctx.fillStyle = 'rgba(40,44,48,0.35)'; ctx.fillRect(0, h * 0.88, w, h * 0.12);
    for (let i = 0; i < 50; i++) { const x = rng() * w; const g2 = ctx.createLinearGradient(0, h * 0.2, 0, h); g2.addColorStop(0, 'rgba(70,64,56,0)'); g2.addColorStop(1, 'rgba(70,64,56,0.18)'); ctx.fillStyle = g2; ctx.fillRect(x, h * 0.2, rng.range(2, 8), h * 0.8); }
  });
  const front = canvasTexWH(768, 896, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c6c9cc'); g.addColorStop(1, '#a4a7ab'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e6e7e8'; ctx.fillRect(w * 0.1, h * 0.62, w * 0.8, h * 0.18);
    ctx.fillStyle = S1; ctx.fillRect(0, h * 0.28, w * 0.1, h * 0.5); ctx.fillRect(w * 0.9, h * 0.28, w * 0.1, h * 0.5);
    ctx.fillStyle = '#17191c'; ctx.beginPath(); ctx.roundRect(w * 0.1, h * 0.12, w * 0.8, h * 0.5, 30); ctx.fill();
    const gg = ctx.createLinearGradient(0, h * 0.14, 0, h * 0.6); gg.addColorStop(0, '#8fb0c6'); gg.addColorStop(0.5, '#3f5668'); gg.addColorStop(1, '#202b33');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(w * 0.12, h * 0.14, w * 0.76, h * 0.46, 24); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.14); ctx.lineTo(w * 0.42, h * 0.14); ctx.lineTo(w * 0.22, h * 0.6); ctx.lineTo(w * 0.12, h * 0.6); ctx.fill();
    ctx.fillStyle = '#101214'; ctx.fillRect(w * 0.13, h * 0.145, w * 0.74, h * 0.07);
    ctx.fillStyle = S1; ctx.font = 'bold 40px "Yu Gothic","Meiryo",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('各駅停車', w / 2, h * 0.18);
    ctx.fillStyle = '#16181b'; ctx.fillRect(w * 0.1, h * 0.62, w * 0.8, h * 0.07);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(0, 0, w, 6);
    ctx.fillStyle = '#25282c'; ctx.fillRect(w * 0.47, h * 0.14, 6, h * 0.46);
  });
  const end = canvasTexWH(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6e7176'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#26292d'; ctx.fillRect(w * 0.18, h * 0.12, w * 0.64, h * 0.74);
    ctx.fillStyle = '#4a4f55'; ctx.fillRect(w * 0.22, h * 0.16, w * 0.56, h * 0.66);
  });
  const mk = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.34, metalness: 0.55, ...o });
  const mats = {
    side: mk(side), front: mk(front, { roughness: 0.3 }), end: mk(end, { roughness: 0.6, metalness: 0.2 }),
    body: new THREE.MeshStandardMaterial({ color: '#b6b9bd', roughness: 0.38, metalness: 0.6 }),
    roof: new THREE.MeshStandardMaterial({ color: '#7a7d80', roughness: 0.6, metalness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#25272a', roughness: 0.75, metalness: 0.4 }),
    light: new THREE.MeshStandardMaterial({ color: '#fff8e0', emissive: new THREE.Color('#fff4cc'), emissiveIntensity: 1.6, roughness: 0.3 }),
    tail: new THREE.MeshStandardMaterial({ color: '#c02828', emissive: new THREE.Color('#a01818'), emissiveIntensity: 0.8, roughness: 0.4 }),
    wheel: new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.5, metalness: 0.8 }),
  };
  cache.set(key, mats);
  return mats;
}
