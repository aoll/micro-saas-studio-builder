import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listCreditMovements, listPurchases } from "@/lib/dal/account";
import { getBalance } from "@/lib/dal/credits";
import { getSession } from "@/lib/dal/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AccountSignOutButton } from "./sign-out-button";
import { MovementList } from "./movement-list";
import { PurchaseList } from "./purchase-list";
import { SignupPrompt } from "./signup-prompt";

// SA-07 (specs/SA-07-compte.md): the async leaf of /[app]/account, the only
// place that reads the session — kept under the page's <Suspense> boundary
// so the shell stays instant (docs/04-nextjs.md: "compte … streamé"). No
// session: SignupPrompt, no DAL call at all (spec: "Non connecté → modale
// d'inscription"). Signed in: the session user's own balance, movements
// and purchases, fetched in parallel and never trusted from client input
// (each DAL function re-checks the session against `session.user.id`).
export async function AccountContent({ slug, productId }: { slug: string; productId: string }) {
  const session = await getSession();
  if (!session) {
    return <SignupPrompt slug={slug} />;
  }

  const t = await getTranslations("account");
  const userId = session.user.id;
  const [balance, movements, purchases] = await Promise.all([
    getBalance(userId, productId),
    listCreditMovements(userId, productId),
    listPurchases(userId, productId),
  ]);

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">{session.user.email}</p>

      <Card>
        <CardContent className="grid justify-items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">{t("balance.label")}</p>
          <p className="text-4xl font-bold">{balance}</p>
          <p className="text-sm text-muted-foreground">{t("balance.credits", { count: balance })}</p>
          <Button asChild className="mt-2">
            <Link href={`/${slug}/pricing` as Route}>{t("balance.recharge")}</Link>
          </Button>
        </CardContent>
      </Card>

      <MovementList movements={movements} />
      <PurchaseList purchases={purchases} />

      <Button asChild variant="outline">
        <Link href={`/${slug}/history` as Route}>{t("history.link")}</Link>
      </Button>

      <AccountSignOutButton slug={slug} />
    </div>
  );
}
