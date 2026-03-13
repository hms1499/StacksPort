import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // These patterns (setLoading/setState at start of useEffect) are intentional
      "react-hooks/set-state-in-effect": "warn",
      // Date.now() / Math.random() inside useMemo is intentional for time-based filtering
      "react-hooks/purity": "off",
      // Downgrade unused-expressions to warning
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
]);

export default eslintConfig;
