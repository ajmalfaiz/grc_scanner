import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Smaller self-contained server output for nginx + systemd / process manager deploys.
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
