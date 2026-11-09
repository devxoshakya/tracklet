import { defineConfig } from "tsdown";
import { unwasm } from "unwasm/plugin";

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  plugins: [unwasm({ esmImport: true })],
  deps: {
    alwaysBundle: [/@tracklet \/.*/],
    neverBundle: ["cloudflare:workers"],
  },
});
