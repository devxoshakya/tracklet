/**
 * Packs the loadable extension files into apps/web/public/extension.zip so
 * the web app's avatar menu can offer the download. Runs the self-check
 * first — a failing extension never gets packed. Run from anywhere:
 *   bun apps/extension/tools/pack.ts
 *
 * For a production download, set the real origins in config.js first, then
 * re-run this script.
 */
import { $ } from "bun";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const outRel = "../web/public/extension.zip";

// Gate: the parity/manifest check must pass.
await $`bun tools/check-extension.ts`.cwd(root).quiet();

await $`mkdir -p ../web/public`.cwd(root).quiet();
await $`rm -f ${outRel}`.cwd(root).quiet();

await $`zip -q -r ${outRel} manifest.json config.js popup.html popup.css popup.js lib icons README.md`
  .cwd(root)
  .quiet();

const listing = await $`unzip -l ${outRel}`.cwd(root).quiet().text();
const names = listing
  .split("\n")
  .filter((line) => line.includes("apps/extension") || /popup|manifest|config|icons|lib|README/.test(line));
for (const name of [...names.slice(0, 3), ...names.slice(-3)]) console.log(name.trim());
console.log(`packed apps/web/public/extension.zip (${names.length} entries)`);
