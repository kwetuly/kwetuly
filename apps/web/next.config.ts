import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Shared code from the monorepo is TypeScript source, so Next compiles it.
  transpilePackages: ["@rafrika/shared"],
  images: {
    // Stock photos (see src/lib/photos.ts) and guide photos stored in Supabase.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "zsymxfommlxqqfywekuy.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  experimental: {
    // Files (guide photos, ID scans, chat media) upload straight from the browser to Supabase
    // Storage; forms only send text, so this limit is just a safety margin.
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
