import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityGeneration } from "@/lib/dal/activity";
import {
  formatCostMicros,
  formatRelative,
  generationStatus,
  summarizeOutput,
  summarizeInput,
} from "../_lib/activity-format";
import { activityHref, type ActivityListKey } from "../_lib/pagination";
import { PaginationNav } from "./pagination-nav";

const STATUS_BADGE_CLASS: Record<"ok" | "error" | "pending", string> = {
  ok: "border-transparent bg-emerald-100 text-emerald-800",
  error: "border-transparent bg-destructive/15 text-destructive",
  pending: "border-transparent bg-muted text-muted-foreground",
};

// BO-04's "Dernières générations" table (mockup, docs/02-ecrans.md › BO-04):
// date, entrée, sortie, modèle, coût IA, statut — every status, the refunded flag
// folded into the status pill. I18N-BACKOFFICE-STRINGS: async, its own translator, and — since
// React Testing Library's client renderer can't render an async component nested as plain JSX
// (product-tabs.tsx's comment) — `PaginationNav` is called and awaited directly rather than
// mounted as `<PaginationNav ... />`.
export async function GenerationsTable({
  slug,
  entries,
  total,
  page,
  hasMore,
  fields,
  now,
  currentPages,
}: {
  slug: string;
  entries: ActivityGeneration[];
  total: number;
  page: number;
  hasMore: boolean;
  fields: { key: string; label: string }[];
  now: Date;
  currentPages: Partial<Record<ActivityListKey, number>>;
}) {
  const listKey: ActivityListKey = "generations";
  const [t, locale] = await Promise.all([getTranslations("backoffice-product-sheet"), getLocale()]);
  const paginationNav = await PaginationNav({ slug, listKey, page, hasMore, currentPages });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("activity.generations.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {total === 0 ? (
          <EmptyState title={t("activity.generations.empty")} />
        ) : entries.length === 0 ? (
          <EmptyState
            title={t("activity.emptyPage.title")}
            action={
              <Link href={activityHref(slug, currentPages, { key: listKey, page: 1 })} className="underline">
                {t("activity.emptyPage.backToFirstPage")}
              </Link>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t("activity.generations.columns.date")}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t("activity.generations.columns.input")}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t("activity.generations.columns.output")}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t("activity.generations.columns.model")}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t("activity.generations.columns.cost")}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t("activity.generations.columns.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const status = generationStatus(entry, t);
                return (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatRelative(entry.createdAt, now, t)}</td>
                    <td className="py-2 pr-4">{summarizeInput(entry.input, fields)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{summarizeOutput(entry.output)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{entry.model ?? "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatCostMicros(entry.costMicros, locale)}</td>
                    <td className="py-2 pr-4">
                      <Badge className={STATUS_BADGE_CLASS[status.variant]}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {paginationNav}
      </CardContent>
    </Card>
  );
}
