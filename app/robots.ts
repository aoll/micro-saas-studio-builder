import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// I18N-SEO (specs/I18N-SEO.md): excludes the backoffice from indexing.
// `/admin$` matches the route itself, `/admin/` matches everything under
// it, so a product slug such as `admin-xyz` is never blocked (it never
// starts with `/admin/` or equals `/admin`).
export default function robots(): MetadataRoute.Robots {
  // `env.BETTER_AUTH_URL` (docs/08-stack.md) is the app's own base URL; its
  // trailing slash is stripped so `${baseUrl}/sitemap.xml` never doubles up.
  const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin$", "/admin/"] },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
