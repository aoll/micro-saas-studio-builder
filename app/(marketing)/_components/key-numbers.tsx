import { getFormatter, getTranslations } from "next-intl/server";
import { listProducts } from "@/lib/dal/products";

// What the demo actually is (1 Next.js app driving live sub-apps, counted the
// same way as ProductsShowcase) plus repo-scale figures. "8 agents
// spécialisés" counts .claude/agents/*.md (planner, tdd-guide, 5 reviewers,
// e2e-runner) — a design fact, not a run statistic, so unlike a launched-
// agent tally it never goes stale. PRs and tests are re-verified by hand
// against GitHub (`is:pr is:merged`) and `pnpm vitest run`'s total.
export async function KeyNumbers() {
  const [subApps, t, format] = await Promise.all([
    listProducts().then((products) => products.filter((product) => product.status !== "killed").length),
    getTranslations("marketing.keyNumbers"),
    getFormatter(),
  ]);

  const numbers = [
    { value: format.number(1), label: t("app") },
    { value: format.number(subApps), label: t("subApps") },
    { value: format.number(8), label: t("agents") },
    { value: format.number(98), label: t("pullRequests") },
    { value: format.number(1833), label: t("tests") },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-8">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {numbers.map((number) => (
          <div key={number.label} className="flex flex-col-reverse gap-1.5 mk-card p-5">
            <dt className="text-sm text-mk-muted">{number.label}</dt>
            <dd className="font-[family-name:var(--font-mk-display)] text-4xl leading-none font-extrabold tracking-[-0.03em] tabular-nums">
              {number.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
