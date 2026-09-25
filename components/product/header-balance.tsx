import { useTranslations } from "next-intl";
import Link from "next/link";
import { getBalance } from "@/lib/dal/credits";
import { getSession } from "@/lib/dal/session";
import { BalanceBadge } from "@/components/product/balance";

// Streamed under <Suspense> in the product layout (docs/04-nextjs.md): the
// only part of the header that reads the session, so the rest of the page
// stays statically pre-rendered.
export async function HeaderBalance({ productId, slug }: { productId: string; slug: string }) {
  const session = await getSession();
  if (!session) return <SignInLink slug={slug} />;

  const balance = await getBalance(session.user.id, productId);
  return <BalanceBadge balance={balance} />;
}

function SignInLink({ slug }: { slug: string }) {
  const t = useTranslations("common.header");
  return <Link href={`/${slug}/signup`}>{t("signIn")}</Link>;
}
