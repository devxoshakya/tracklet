/**
 * One-off icon generator for the Tracklet extension: navy rounded square with
 * three white "tracker list" bars. Run from the repo root:
 *   cd apps/extension && bun tools/make-icons.ts
 * Outputs icons/icon{16,48,128}.png and self-checks the PNG structure.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const NAVY = [26, 88, 219, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

/** CRC32 for PNG chunks. */
const table = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = ~0;
  for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeIcon(size) {
  const margin = size / 8;
  const barH = size / 9;
  const gap = barH;
  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(0); // PNG filter byte: none.
    for (let x = 0; x < size; x++) {
      // Rounded corners.
      const r = size / 5;
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      const inside = dx + dy >= r || (dx >= r && dy >= r);
      let color = CLEAR;
      if (inside) {
        color = NAVY;
        // Three centered bars.
        const listH = barH * 3 + gap * 2;
        const top = (size - listH) / 2;
        const rel = y - top;
        const inBarBand = rel >= 0 && rel < listH;
        const band = Math.floor(rel / (barH + gap));
        const inBar = inBarBand && rel % (barH + gap) < barH;
        const width = size - margin * 2 - band * margin * 0.9;
        if (inBar && x >= margin && x <= margin + width) color = WHITE;
      }
      rows.push(...color);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.from(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  const png = makeIcon(size);
  // Self-check: magic + IHDR dims + end marker.
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error("bad magic");
  if (png.readUInt32BE(16) !== size) throw new Error("bad width");
  if (png.subarray(png.length - 8).toString("latin1") !== "IEND\xaeB`\x82") {
    throw new Error("bad IEND");
  }
  writeFileSync(`icons/icon${size}.png`, png);
  console.log(`icons/icon${size}.png ${png.length}B`);
}
