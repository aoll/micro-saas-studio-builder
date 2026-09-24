import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
// Fails the build (and this import) if any of the 8 required variables is
// missing or invalid (docs/10-tooling-dev.md).
import "./lib/env";

// next-intl without i18n routing (docs/08-stack.md): i18n/request.ts reads
// the locale from the product config via next/root-params, not a URL
// segment.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

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

export default withNextIntl(nextConfig);
