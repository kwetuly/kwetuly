import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Shared code from the monorepo is TypeScript source, so Next compiles it.
  transpilePackages: ["@rafrika/shared"],
  experimental: {
    // Guide photos and ID scans are uploaded through Server Actions.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
