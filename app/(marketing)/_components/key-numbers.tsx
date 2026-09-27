import { listProducts } from "@/lib/dal/products";

// What the demo actually is (1 Next.js app driving live sub-apps, counted the
// same way as ProductsShowcase) plus repo-scale figures. "8 agents
// spécialisés" counts .claude/agents/*.md (planner, tdd-guide, 5 reviewers,
// e2e-runner) — a design fact, not a run statistic, so unlike a launched-
// agent tally it never goes stale. PRs and tests are re-verified by hand
// against GitHub (`is:pr is:merged`) and `pnpm vitest run`'s total.
export async function KeyNumbers() {
  const subApps = (await listProducts()).filter((product) => product.status !== "killed").length;

  const numbers = [
    { value: "1", label: "app Next.js" },
    { value: String(subApps), label: "sub-apps dynamiques" },
    { value: "8", label: "agents spécialisés" },
    { value: "98", label: "pull requests mergées" },
    { value: "1 833", label: "tests verts" },
  ];

  return (
    <section className="border-y bg-muted/30 py-10">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 text-center sm:grid-cols-5">
        {numbers.map((number) => (
          <div key={number.label}>
            <p className="text-3xl font-bold tracking-tight">{number.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{number.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
