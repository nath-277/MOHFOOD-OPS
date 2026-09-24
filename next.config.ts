import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.174'],
  reactStrictMode: true,
  serverExternalPackages: ["@neondatabase/serverless"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "mohfood.com",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: "/damages",
        destination: "/returns",
      },
    ];
  },
};

export default nextConfig;
