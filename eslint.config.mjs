import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The database is only read by the DAL (docs/09-arborescence.md).
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/lib/db", "@/lib/db/*"], message: "Passer par lib/dal" }] },
      ],
    },
  },
  {
    files: ["lib/dal/**", "lib/db/**", "lib/auth.ts", "scripts/**", "**/*.test.ts", "e2e/**"],
    rules: { "no-restricted-imports": "off" },
  },
  prettier, // last: turns off formatting rules
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "drizzle/**",
  ]),
]);
