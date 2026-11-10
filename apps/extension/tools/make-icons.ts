/**
 * Regenerates icons/icon{16,48,128}.png from the blue Tracklet mark
 * (icons/logo-blue.svg). Needs ImageMagick. Run from apps/extension:
 *   bun tools/make-icons.ts
 */
import { $ } from "bun";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../", import.meta.url));

// `magick` on IMv7, `convert` on IMv6.
const tool = await $`magick -version`.quiet().then(() => "magick").catch(() => "convert");
for (const size of [16, 48, 128]) {
  await $`${tool} -background none icons/logo-blue.svg -resize ${size}x${size} icons/icon${size}.png`.cwd(dir);
  const png = readFileSync(`${dir}icons/icon${size}.png`);
  if (png.readUInt32BE(0) !== 0x89504e47 || png.readUInt32BE(16) !== size) {
    throw new Error(`bad PNG at ${size}px`);
  }
  console.log(`icons/icon${size}.png ${png.length}B`);
}
