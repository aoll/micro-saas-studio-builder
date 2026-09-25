import type { Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ANONYMOUS_ID_COOKIE, readAnonymousId } from "@/app/(products)/[app]/api/events/anonymous-id";
import { EmptyState } from "@/components/shared/empty-state";
import { ResultCard } from "@/components/product/result-card";
import { Button } from "@/components/ui/button";
import { listGenerations } from "@/lib/dal/history";
import { getSession } from "@/lib/dal/session";
import { excerpt, summarizeInput } from "../_lib/summarize";

const pageParamSchema = z.coerce.number().int().min(1).catch(1);

// The async leaf of /[app]/history (SA-06, specs/SA-06-historique.md):
// reads the session (or, absent one, the anonymous_id cookie) and `?page=`,
// so it must stay under the page's <Suspense> boundary — reading these
// outside it would make the whole route blocking (docs/04-nextjs.md).
export async function HistoryList({
  slug,
  productId,
  fields,
  searchParams,
}: {
  slug: string;
  productId: string;
  fields: { key: string; label: string }[];
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("history");
  const format = await getFormatter();
  const params = await searchParams;
  const rawPage = params.page;
  const page = pageParamSchema.parse(Array.isArray(rawPage) ? rawPage[0] : rawPage);

  const session = await getSession();
  let identity: string | null;
  if (session) {
    identity = session.user.id;
  } else {
    const cookieStore = await cookies();
    identity = readAnonymousId(cookieStore.get(ANONYMOUS_ID_COOKIE)?.value);
  }

  if (!identity) {
    return <EmptyHistory slug={slug} title={t("empty.title")} cta={t("empty.cta")} />;
  }

  const result = await listGenerations(identity, productId, page);

  if (result.total === 0) {
    return <EmptyHistory slug={slug} title={t("empty.title")} cta={t("empty.cta")} />;
  }

  if (result.entries.length === 0) {
    return (
      <EmptyState
        title={t("pageEmpty")}
        action={
          <Button asChild variant="outline">
            <Link href={`/${slug}/history` as Route}>{t("backToFirst")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t("count", { count: result.total })}</p>
      <ul className="grid gap-3">
        {result.entries.map((entry) => (
          <li key={entry.id} className="rounded-md border">
            <details>
              <summary className="cursor-pointer list-none p-4">
                <span className="font-medium">
                  {format.dateTime(entry.createdAt, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}
                </span>
                {" — "}
                <span>{summarizeInput(entry.input, fields)}</span>
                <span className="block text-muted-foreground">{excerpt(entry.output)}</span>
                <span className="text-sm underline">{t("open")}</span>
              </summary>
              <div className="border-t p-4">
                <ResultCard output={{ kind: "markdown", text: entry.output }} fileName={`${slug}-${entry.id}`} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      <nav className="flex items-center justify-between text-sm">
        {page > 1 ? <Link href={`/${slug}/history?page=1` as Route}>{t("pagination.newer")}</Link> : <span />}
        {result.hasMore ? (
          <Link href={`/${slug}/history?page=${page + 1}` as Route}>{t("pagination.more")}</Link>
        ) : null}
      </nav>
    </div>
  );
}

function EmptyHistory({ slug, title, cta }: { slug: string; title: string; cta: string }) {
  return (
    <EmptyState
      title={title}
      action={
        <Button asChild>
          <Link href={`/${slug}/tool` as Route}>{cta}</Link>
        </Button>
      }
    />
  );
}
