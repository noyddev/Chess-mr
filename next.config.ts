import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lichess.org",
      },
      {
        protocol: "https",
        hostname: "*.chess-results.com",
      },
    ],
  },
};

export default nextConfig;
