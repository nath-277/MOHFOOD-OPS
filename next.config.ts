import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.174'],
  reactStrictMode: true,
  serverExternalPackages: ["@neondatabase/serverless"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
