import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@neondatabase/serverless"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
