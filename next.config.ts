import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Smaller self-contained server output for nginx + systemd / process manager deploys.
  output: "standalone",
  serverExternalPackages: [
    "ssh2",
    "ssh2-sftp-client",
    "@awo00/smb2",
    "mammoth",
    "xlsx",
    "pdf-parse",
  ],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
