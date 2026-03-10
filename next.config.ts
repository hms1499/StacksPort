import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // pino-pretty is an optional dev dependency of walletconnect — not needed at runtime
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
