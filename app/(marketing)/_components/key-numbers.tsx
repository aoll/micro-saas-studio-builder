// Scope facts only: the cost and delivery-speed figures from
// docs/00-accueil.md ("La démo en chiffres") read as bragging on a public
// landing, so they stay in the docs and off this section.
const NUMBERS = [
  { value: "17", label: "écrans conçus" },
  { value: "4", label: "thèmes partagés" },
];

export function KeyNumbers() {
  return (
    <section className="border-y bg-muted/30 py-10">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 text-center">
        {NUMBERS.map((number) => (
          <div key={number.label}>
            <p className="text-3xl font-bold tracking-tight">{number.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{number.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
