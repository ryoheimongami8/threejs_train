// Minimal PNG encoder: 8/16-bit gray / RGB / RGBA, with a tEXt metadata chunk.
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(raw) {
  const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** data: Uint8Array (depth 8) or Uint16Array (depth 16), channels interleaved, top-down. */
export async function encodePNG({ width, height, channels, depth = 8, data, meta }) {
  const colorType = { 1: 0, 3: 2, 4: 6 }[channels];
  const bps = depth / 8, rowBytes = width * channels * bps;
  const raw = new Uint8Array(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    const o = y * (rowBytes + 1);
    raw[o] = 0;
    if (depth === 8) raw.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), o + 1);
    else {
      const n = width * channels, src = y * n;
      for (let i = 0; i < n; i++) { const v = data[src + i]; raw[o + 1 + i * 2] = v >> 8; raw[o + 2 + i * 2] = v & 255; }
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width); dv.setUint32(4, height);
  ihdr[8] = depth; ihdr[9] = colorType;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)];
  if (meta) {
    const text = new TextEncoder().encode('stationMeta\0' + meta); // Latin-1 safe: JSON.stringify escapes nothing >0x7f we rely on ASCII
    parts.push(chunk('tEXt', text));
  }
  parts.push(chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0)));
  return new Blob(parts, { type: 'image/png' });
}
