import type { NextConfig } from "next";
// Fails the build (and this import) if any of the 8 required variables is
// missing or invalid (docs/10-tooling-dev.md).
import "./lib/env";

const nextConfig: NextConfig = {
  cacheComponents: true, // 'use cache', PPR, dynamic by default
  partialPrefetching: true, // one prefetched shell per route, reused across links
  reactCompiler: true, // automatic memoization
  typedRoutes: true, // typed links and redirects
  typescript: {
    // tsconfig.json (protected, docs/10-tooling-dev.md) sets `baseUrl`,
    // deprecated as of TypeScript 6/7 (TS5101). tsconfig.build.json adds
    // `ignoreDeprecations: "6.0"`, the fix the tsc error message itself
    // suggests, without touching the protected file. IDEs still read
    // tsconfig.json directly and may show the same diagnostic.
    tsconfigPath: "tsconfig.build.json",
  },
};

export default nextConfig;
