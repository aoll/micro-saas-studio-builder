import type { NextConfig } from "next";
// Fails the build (and this import) if any of the 8 required variables is
// missing or invalid (docs/10-tooling-dev.md).
import "./lib/env";

const nextConfig: NextConfig = {
  cacheComponents: true, // 'use cache', PPR, dynamic by default
  partialPrefetching: true, // one prefetched shell per route, reused across links
  reactCompiler: true, // automatic memoization
  typedRoutes: true, // typed links and redirects
};

export default nextConfig;
