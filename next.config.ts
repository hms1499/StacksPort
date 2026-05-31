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
      // API CORS is handled in src/middleware.ts, scoped to the extension
      // origin — never a blanket `*` (which exposed the proxy to any website).
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
