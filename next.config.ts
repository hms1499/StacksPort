import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@stacks/transactions",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        // Allow Chrome extension to embed the app in Side Panel
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' chrome-extension://*",
          },
        ],
      },
      {
        // Allow extension background service worker to call API routes
        source: "/api/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
    };

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
