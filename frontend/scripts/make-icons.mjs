// Generates PNG app icons with a tiny software rasteriser (no native deps).
// Run from frontend/: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel((x + 0.5) / size, (y + 0.5) / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const dist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const edges = [[0.5, 0.16, 0.86, 0.42], [0.86, 0.42, 0.5, 0.86], [0.5, 0.86, 0.14, 0.42], [0.14, 0.42, 0.5, 0.16], [0.14, 0.42, 0.86, 0.42], [0.5, 0.16, 0.35, 0.42], [0.35, 0.42, 0.5, 0.86], [0.5, 0.16, 0.65, 0.42], [0.65, 0.42, 0.5, 0.86]];
function pixel(maskable) {
  return (u, v) => {
    const radius = maskable ? 0 : 0.22;
    const inX = Math.min(u, 1 - u), inY = Math.min(v, 1 - v);
    let bgAlpha = 1;
    if (!maskable && inX < radius && inY < radius) bgAlpha = Math.hypot(inX - radius, inY - radius) <= radius ? 1 : 0;
    const scale = maskable ? 0.72 : 1; const cu = 0.5 + (u - 0.5) / scale, cv = 0.5 + (v - 0.5) / scale;
    let d = Infinity; for (const [ax, ay, bx, by] of edges) d = Math.min(d, dist(cu, cv, ax, ay, bx, by));
    const line = Math.max(0, Math.min(1, (0.03 - d) / 0.012));
    const r = Math.round(27 + (228 - 27) * line), g = Math.round(26 + (199 - 26) * line), b = Math.round(23 + (127 - 23) * line);
    return [r, g, b, Math.round(255 * bgAlpha)];
  };
}
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, pixel(false)));
writeFileSync("public/icons/icon-512.png", png(512, pixel(false)));
writeFileSync("public/icons/icon-maskable-512.png", png(512, pixel(true)));
console.log("icons written");
