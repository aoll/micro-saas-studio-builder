import { listProducts } from "@/lib/dal/products";

// What the demo actually is (1 Next.js app driving live sub-apps, counted the
// same way as ProductsShowcase) plus the run's own figures, frozen from logs
// in app/(marketing)/making-of/_data/run.ts's KEY_FIGURES — kept in sync by
// hand rather than imported, since that file is private to the making-of
// page (docs/09-arborescence.md's `_` convention).
export async function KeyNumbers() {
  const subApps = (await listProducts()).filter((product) => product.status !== "killed").length;

  const numbers = [
    { value: "1", label: "app Next.js" },
    { value: String(subApps), label: "sub-apps dynamiques" },
    { value: "258", label: "agents lancés" },
    { value: "76", label: "pull requests" },
    { value: "1 718", label: "tests verts" },
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
