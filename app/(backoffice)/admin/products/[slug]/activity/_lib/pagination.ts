import type { Route } from "next";

// BO-04 (specs/BO-04-activite.md): the page owns three independently
// paginated lists (generations, purchases, credit movements), so their
// `?page=` query keys must not collide, and paginating one list must not
// reset the other two (plan § "pagination.ts: parsePageParam, activityHref,
// which keeps each list's page param").

export type ActivityListKey = "generations" | "purchases" | "movements";

const PAGE_PARAM: Record<ActivityListKey, string> = {
  generations: "genPage",
  purchases: "purPage",
  movements: "movPage",
};

// A malformed, missing or non-positive value falls back to page 1 (mirrors
// SA-06's `pageParamSchema`), never throws: it drives a link's query string,
// not a DAL call.
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

// The activity page's own href builder: `current` carries the three lists'
// current pages, `next` the one being changed. Page 1 is the default (never
// written to the URL), so a fresh visit's URL stays bare.
export function activityHref(
  slug: string,
  current: Partial<Record<ActivityListKey, number>>,
  next: { key: ActivityListKey; page: number },
): Route {
  const merged: Partial<Record<ActivityListKey, number>> = { ...current, [next.key]: next.page };
  const params = new URLSearchParams();
  (Object.keys(PAGE_PARAM) as ActivityListKey[]).forEach((key) => {
    const page = merged[key];
    if (page && page > 1) params.set(PAGE_PARAM[key], String(page));
  });
  const query = params.toString();
  return `/admin/products/${slug}/activity${query ? `?${query}` : ""}` as Route;
}

export function readPageParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: ActivityListKey,
): number {
  return parsePageParam(searchParams[PAGE_PARAM[key]]);
}
