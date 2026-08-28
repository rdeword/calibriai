import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
