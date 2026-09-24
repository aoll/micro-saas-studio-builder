import "@/app/globals.css";
import { listProductSlugs } from "@/lib/dal/products";

// A root param needs at least one value under Cache Components (docs/04-nextjs.md).
export async function generateStaticParams() {
  const slugs = await listProductSlugs();
  return slugs.map((app) => ({ app }));
}

export default function ProductLayout({ children, modal }: LayoutProps<"/[app]">) {
  return (
    <html lang="fr">
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
