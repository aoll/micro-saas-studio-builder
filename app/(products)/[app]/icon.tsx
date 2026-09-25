import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { getProduct, listProductSlugs } from "@/lib/dal/products";
import { getTheme } from "@/lib/dal/themes";
import { resolveOgColors } from "./_lib/og-colors";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// A root param needs at least one value under Cache Components, same as
// [app]/layout.tsx: without this, the icon is served dynamically (`ƒ`) on
// every request instead of being prerendered per slug (code review MEDIUM).
export async function generateStaticParams() {
  const slugs = await listProductSlugs();
  return slugs.map((app) => ({ app }));
}

// I18N-SEO (specs/I18N-SEO.md): the product's initial on its primary color.
// Route Handler props, not `next/root-params` (orchestrator decision 4:
// root params don't work here); no `'use cache'` either — `getProduct` and
// `getTheme` are already `'use cache'`-tagged (lib/dal/products.ts,
// lib/dal/themes.ts), this handler is just their reader. Same 404 / throw
// rules as [app]/layout.tsx (orchestrator decision 5): unknown or killed
// product -> notFound(), missing theme row -> throw (a data integrity
// error, not a 404).
export default async function Icon({ params }: { params: Promise<{ app: string }> }) {
  const { app: slug } = await params;
  const product = await getProduct(slug);
  if (!product || product.status === "killed") notFound();

  const theme = await getTheme(product.themeId);
  if (!theme) throw new Error(`icon(${product.slug}): missing theme row for ${product.themeId}`);

  const colors = resolveOgColors(theme.tokens.light, product.branding);
  const initial = product.name.trim().charAt(0).toUpperCase() || "?";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.primary,
        color: colors.onPrimary,
        fontSize: 20,
        fontWeight: 700,
      }}
    >
      {initial}
    </div>,
    { ...size },
  );
}
