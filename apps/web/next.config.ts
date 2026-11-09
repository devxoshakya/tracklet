import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

import { withPwa } from "./pwa.config";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  images: {
    qualities: [75, 100],
    localPatterns: [{ pathname: "/art/**" }],
  },
};

export default withPwa(nextConfig);

initOpenNextCloudflareForDev();
