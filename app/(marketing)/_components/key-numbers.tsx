import { listProducts } from "@/lib/dal/products";

// What the demo actually is (1 Next.js app driving live sub-apps, counted the
// same way as ProductsShowcase) plus repo-scale figures. Agents launched is
// the v1 run's own frozen count (app/(marketing)/making-of/_data/run.ts's
// KEY_FIGURES, private to that page per docs/09-arborescence.md's `_`
// convention) — no live source exists to recompute it. PRs and tests instead
// track the whole repo since, so they're re-verified by hand against GitHub
// (`is:pr is:merged`) and `pnpm vitest run`'s total, not copied from that
// run's snapshot.
export async function KeyNumbers() {
  const subApps = (await listProducts()).filter((product) => product.status !== "killed").length;

  const numbers = [
    { value: "1", label: "app Next.js" },
    { value: String(subApps), label: "sub-apps dynamiques" },
    { value: "258", label: "agents lancés" },
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
