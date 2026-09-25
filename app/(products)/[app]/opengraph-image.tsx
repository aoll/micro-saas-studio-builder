import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { getProduct } from "@/lib/dal/products";
import { getTheme } from "@/lib/dal/themes";
import { resolveOgColors } from "./_lib/og-colors";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// I18N-SEO (specs/I18N-SEO.md): the product's name and landing headline on
// its theme colours, for social sharing previews. Same conventions as
// icon.tsx (Route Handler props not root params, already-cached DAL reads,
// 404 / throw rules).
export default async function OpengraphImage({ params }: { params: Promise<{ app: string }> }) {
  const { app: slug } = await params;
  const product = await getProduct(slug);
  if (!product || product.status === "killed") notFound();

  const theme = await getTheme(product.themeId);
  if (!theme) throw new Error(`opengraph-image(${product.slug}): missing theme row for ${product.themeId}`);

  const colors = resolveOgColors(theme.tokens.light, product.branding);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: colors.background,
        color: colors.foreground,
      }}
    >
      <div style={{ display: "flex", color: colors.primary, fontSize: 40, fontWeight: 700 }}>{product.name}</div>
      <div style={{ display: "flex", marginTop: 24, fontSize: 64, fontWeight: 700, maxWidth: 900 }}>
        {product.landing.headline}
      </div>
    </div>,
    { ...size },
  );
}
