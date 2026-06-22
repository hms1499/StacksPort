import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    alias: {
      // Stub Next.js server internals unavailable outside the Next.js runtime
      "next/navigation": resolve(__dirname, "src/__stubs__/next-navigation.ts"),
      "next/headers": resolve(__dirname, "src/__stubs__/next-headers.ts"),
    },
    server: {
      deps: {
        // Force next-intl through vitest's transform pipeline so its ESM imports
        // go through the alias table above instead of raw Node ESM resolution.
        inline: ["next-intl", "next"],
      },
    },
  },
});
