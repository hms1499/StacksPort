import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // pino-pretty is an optional dev dependency of walletconnect — not needed at runtime
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
    };

    // Handle @stacks/connect-ui ESM module for client-side rendering
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@stacks/connect-ui": "@stacks/connect-ui",
      };

      config.module.rules.push({
        test: /\.js$/,
        include: /node_modules\/@stacks\/connect-ui/,
        type: "javascript/esm",
      });
    }

    return config;
  },
};

export default nextConfig;
